"use server";

import type { TravelMode, SearchResult, DistanceBucket } from "@/types";

import {
  metrics,
  routeCache,
  limit,
  MAX_RESULTS,
  MAX_DISTANCE_MILES,
  ROUTE_SAMPLE_DISTANCE,
  generateCacheKey,
  mapTravelModeToProfile,
  geocodeAddress,
  getRoute,
  decodePolyline,
  sampleRoutePoints,
  searchApartmentsOverpass,
  overpassElementToPlaceDetails,
  deduplicateApartments,
  filterApartmentsByRouteProximity,
  processApartmentDistances,
  groupApartmentsByDistance,
} from "./utils";

/**
 * Main function to get routes and apartments
 */
export async function getRouteAndApartments(
  origin: string,
  destination: string,
  travelMode: TravelMode,
  selectedRouteIndex?: number,
  maxDistance: DistanceBucket = "≤3mi"
): Promise<SearchResult> {
  const timerId = `search_${Date.now()}`;
  metrics.startTimer(timerId);

  try {
    console.log(`Getting route from ${origin} to ${destination}`);
    console.log(
      `Configuration: MAX_RESULTS=${MAX_RESULTS}, MAX_DISTANCE_MILES=${MAX_DISTANCE_MILES}`
    );

    // Note: API key check removed - we now have fallback functionality

    // Check cache first
    const cacheKey = generateCacheKey(origin, destination, travelMode);
    const cachedResult = routeCache.get(cacheKey);
    if (cachedResult) {
      metrics.recordCacheHit("route", true);
      return cachedResult;
    }

    // Geocode addresses
    const [startCoords, endCoords] = await Promise.all([
      geocodeAddress(origin),
      geocodeAddress(destination),
    ]);

    if (!startCoords || !endCoords) {
      throw new Error("Failed to geocode addresses");
    }

    // Get route
    const profile = mapTravelModeToProfile(travelMode);
    const route = await getRoute(startCoords, endCoords, profile);

    if (!route) {
      throw new Error("Failed to get route");
    }

    console.log(`Route found: ${route.summary}`);

    // Search for apartments along the route
    const polyline = decodePolyline(route.overview_polyline.points);
    const samplePoints = sampleRoutePoints(polyline, ROUTE_SAMPLE_DISTANCE);

    console.log(
      `Searching apartments at ${samplePoints.length} points along route`
    );

    // Search apartments concurrently at sample points
    const apartmentPromises = samplePoints.map((point) =>
      limit(() => searchApartmentsOverpass(point))
    );

    const apartmentResults = await Promise.all(apartmentPromises);
    const allApartments = apartmentResults.flat();

    console.log(`Found ${allApartments.length} raw apartment results`);

    // Convert to PlaceDetails and deduplicate
    const apartments = deduplicateApartments(
      allApartments.map(overpassElementToPlaceDetails)
    );

    console.log(`After deduplication: ${apartments.length} apartments`);

    // Filter apartments by proximity to route (using Turf.js)
    const filteredApartments = filterApartmentsByRouteProximity(
      apartments,
      polyline
    );

    console.log(
      `After proximity filtering (≤${MAX_DISTANCE_MILES} mi from route): ${filteredApartments.length} apartments`
    );

    // Process distances and create listings
    const apartmentListings = await processApartmentDistances(
      filteredApartments,
      route
    );

    // Filter by user-selected max distance
    const maxDistanceValue =
      maxDistance === "≤1mi" ? 1 : maxDistance === "≤2mi" ? 2 : 3;
    const filteredListings = apartmentListings.filter(
      (apt) => apt.distanceToRoute <= maxDistanceValue
    );

    // Group by distance buckets
    const apartmentsByDistance = groupApartmentsByDistance(filteredListings);

    const result: SearchResult = {
      routeOptions: [route],
      selectedRoute: route,
      apartments: apartmentsByDistance,
      totalFound: filteredListings.length,
    };

    // Cache the result
    routeCache.set(cacheKey, result);

    metrics.endTimer(timerId, "route_and_apartments", "success");
    metrics.recordApartmentsFound("overpass", filteredListings.length);

    console.log(
      `Final result: ${filteredListings.length} apartments found within ${maxDistance} of route`
    );
    console.log(`Results breakdown:`, {
      rawResults: allApartments.length,
      afterDeduplication: apartments.length,
      afterProximityFiltering: filteredApartments.length,
      finalFiltered: filteredListings.length,
      maxDistance,
      configuredMaxDistance: MAX_DISTANCE_MILES,
      configuredMaxResults: MAX_RESULTS,
    });
    return result;
  } catch (error) {
    console.error("Route and apartments search failed:", error);
    metrics.endTimer(timerId, "route_and_apartments", "error");
    throw error;
  }
}
