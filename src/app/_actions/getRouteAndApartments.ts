"use server";

import { cache } from "@/lib/cache";
import { decode as decodePolyline } from "@googlemaps/polyline-codec";
import { point, lineString } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import distance from "@turf/distance";
import type {
  LatLng,
  RouteOption,
  TravelMode,
  SearchResult,
  ApartmentListing,
  PlaceDetails,
  DistanceBucket,
} from "@/types";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

interface RouteResult {
  routes: RouteOption[];
  status: string;
}

// SAR quota tracking (simple in-memory counter for this implementation)
let sarQuotaUsed = 0;
const MAX_SAR_QUOTA_PER_SEARCH = 65;

/**
 * Generate a cache key for consistent caching
 */
function generateCacheKey(...parts: string[]): string {
  return parts.join("|");
}

/**
 * Main function to get routes and apartments
 */
export async function getRouteAndApartments(
  origin: string,
  destination: string,
  travelMode: TravelMode,
  selectedRouteIndex?: number
): Promise<SearchResult> {
  // Clear cache to avoid issues with old format
  cache.clear();

  const cacheKey = generateCacheKey(
    "route_apartments",
    origin,
    destination,
    travelMode,
    selectedRouteIndex?.toString() || "0"
  );

  const cached = cache.get<SearchResult>(cacheKey);
  if (cached) return cached;

  // Get routes
  const routeResult = await computeRoutes(origin, destination, travelMode);
  if (!routeResult.routes.length) {
    return {
      routeOptions: [],
      apartments: { "≤1mi": [], "≤2mi": [], "≤3mi": [] },
      totalFound: 0,
    };
  }

  // Use the selected route or first route
  const route = routeResult.routes[selectedRouteIndex || 0];

  // Search for apartments along the route
  const apartments = await searchApartmentsAlongRoute(route);

  // Process distances and create apartment listings
  const apartmentListings = await processApartmentDistances(apartments, route);

  // Group by distance buckets
  const apartmentsByDistance = groupApartmentsByDistance(apartmentListings);

  const result: SearchResult = {
    routeOptions: routeResult.routes,
    selectedRoute: route,
    apartments: apartmentsByDistance,
    totalFound: apartmentListings.length,
  };

  cache.set(cacheKey, result);
  return result;
}

/**
 * Compute routes using Google Directions API (more stable than Routes API v2)
 */
async function computeRoutes(
  origin: string,
  destination: string,
  travelMode: TravelMode
): Promise<RouteResult> {
  const cacheKey = generateCacheKey("routes", origin, destination, travelMode);
  const cached = cache.get<RouteResult>(cacheKey);
  if (cached) return cached;

  const url = "https://maps.googleapis.com/maps/api/directions/json";

  // Map travel modes to Directions API format
  const modeMapping = {
    DRIVE: "driving",
    WALK: "walking",
    BICYCLE: "bicycling",
    TRANSIT: "transit",
  };

  const params = new URLSearchParams({
    origin,
    destination,
    mode: modeMapping[travelMode] || "driving",
    alternatives: "true",
    key: GOOGLE_MAPS_API_KEY,
  });

  console.log(`Making Directions API request: ${url}?${params}`);

  const response = await fetch(`${url}?${params}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Directions API error ${response.status}:`, errorText);
    throw new Error(`Directions API error: ${response.status}`);
  }

  const data = await response.json();
  console.log(`Directions API response status: ${data.status}`);

  if (data.status !== "OK") {
    console.error(`Directions API error:`, data);
    throw new Error(
      `Directions API error: ${data.status} - ${data.error_message || "Unknown error"}`
    );
  }

  const routes: RouteOption[] = (data.routes || []).map(
    (route: any, index: number) => ({
      route_id: `route_${index}`,
      overview_polyline: {
        points: route.overview_polyline?.points || "",
      },
      bounds: route.bounds || {
        northeast: { lat: 0, lng: 0 },
        southwest: { lat: 0, lng: 0 },
      },
      legs: route.legs || [],
      duration: route.legs?.[0]?.duration?.text || "0 mins",
      fare: route.fare,
      warnings: route.warnings || [],
      waypoint_order: route.waypoint_order || [],
      copyrights: route.copyrights || "",
      summary: generateRouteSummary(route),
    })
  );

  const result: RouteResult = {
    routes,
    status: data.status || "OK",
  };

  cache.set(cacheKey, result);
  return result;
}

/**
 * Generate a human-readable route summary
 */
function generateRouteSummary(route: any): string {
  if (!route.legs?.[0]?.steps) return "Route";

  const transitSteps = route.legs[0].steps.filter(
    (step: any) => step.travel_mode === "TRANSIT"
  );

  if (transitSteps.length === 0) return route.legs[0].distance?.text || "Route";

  const transitLines = transitSteps
    .map(
      (step: any) =>
        step.transit_details?.line?.short_name ||
        step.transit_details?.line?.name
    )
    .filter(Boolean)
    .join(" → ");

  return (
    transitLines || `${route.legs[0].duration?.text || "Route"} via transit`
  );
}

/**
 * Search for apartments along route using SAR with Nearby Search fallback
 */
async function searchApartmentsAlongRoute(
  route: RouteOption
): Promise<PlaceDetails[]> {
  const cacheKey = generateCacheKey(
    "apartments_sar",
    route.route_id,
    route.overview_polyline.points.slice(0, 50)
  );
  const cached = cache.get<PlaceDetails[]>(cacheKey);
  if (cached) return cached;

  let apartments: PlaceDetails[] = [];

  // Calculate route length for quota management
  const totalDistanceMeters = route.legs.reduce(
    (total, leg) => total + (leg.distance?.value || 0),
    0
  );
  const routeLengthKm = totalDistanceMeters / 1000;
  const maxNearbyCallsAllowed = Math.ceil(routeLengthKm / 0.1);

  try {
    // Try Search-Along-Route first if we haven't exceeded quota
    if (sarQuotaUsed < MAX_SAR_QUOTA_PER_SEARCH) {
      console.log("Attempting Search-Along-Route (SAR)...");
      apartments = await searchAlongRouteAPI(route);
      sarQuotaUsed++;

      if (apartments.length > 0) {
        console.log(`SAR returned ${apartments.length} apartments`);
        cache.set(cacheKey, apartments);
        return apartments;
      }
    }

    // Fallback to improved Nearby Search
    console.log("Using improved Nearby Search fallback...");
    apartments = await searchNearbyWithPagination(route, maxNearbyCallsAllowed);
  } catch (error) {
    console.warn("SAR failed, falling back to Nearby Search:", error);
    apartments = await searchNearbyWithPagination(route, maxNearbyCallsAllowed);
  }

  cache.set(cacheKey, apartments);
  return apartments;
}

/**
 * Search using Google Places Text Search API (fallback since SAR might not be available)
 */
async function searchAlongRouteAPI(
  route: RouteOption
): Promise<PlaceDetails[]> {
  // For now, skip SAR and go directly to nearby search since SAR API may not be available
  throw new Error("SAR not available, using nearby search fallback");
}

/**
 * Enhanced Nearby Search with pagination and improved sampling
 */
async function searchNearbyWithPagination(
  route: RouteOption,
  maxCalls: number
): Promise<PlaceDetails[]> {
  // Decode the overview polyline
  const decodedPolyline = decodePolyline(route.overview_polyline.points);
  const routePoints = decodedPolyline.map(([lat, lng]) => ({ lat, lng }));

  // Sample points every 3rd vertex (~100m intervals)
  const samplePoints = sampleRoutePoints(routePoints, 3);

  const allApartments: PlaceDetails[] = [];
  const seenPlaceIds = new Set<string>();
  let callCount = 0;

  for (const point of samplePoints) {
    if (callCount >= maxCalls || allApartments.length >= 300) {
      console.log(
        `Breaking early: calls=${callCount}, apartments=${allApartments.length}`
      );
      break;
    }

    try {
      const apartments = await searchNearbyApartmentsWithPagination(
        point.lat,
        point.lng,
        maxCalls - callCount
      );

      callCount += Math.min(3, maxCalls - callCount); // Account for potential pagination

      // Deduplicate by place_id
      for (const apartment of apartments) {
        if (!seenPlaceIds.has(apartment.place_id)) {
          seenPlaceIds.add(apartment.place_id);
          allApartments.push(apartment);
        }
      }
    } catch (error) {
      console.warn(
        `Failed to search near point ${point.lat}, ${point.lng}:`,
        error
      );
      continue;
    }
  }

  return allApartments;
}

/**
 * Sample points along the route at regular intervals
 */
function sampleRoutePoints(polyline: LatLng[], interval: number): LatLng[] {
  const samplePoints: LatLng[] = [];

  for (let i = 0; i < polyline.length; i += interval) {
    samplePoints.push(polyline[i]);
  }

  // Always include the last point
  if (polyline.length > 0) {
    samplePoints.push(polyline[polyline.length - 1]);
  }

  return samplePoints;
}

/**
 * Search for ALL types of residential housing near a specific location with comprehensive coverage
 */
async function searchNearbyApartmentsWithPagination(
  lat: number,
  lng: number,
  maxPages: number = 3
): Promise<PlaceDetails[]> {
  const allResults: PlaceDetails[] = [];
  const seenPlaceIds = new Set<string>();

  // Define comprehensive search strategies for residential housing
  const searchStrategies = [
    // Strategy 1: Apartment-focused searches
    { keyword: "apartment", type: undefined },
    { keyword: "apartments", type: undefined },
    { keyword: "apartment building", type: undefined },
    { keyword: "apartment complex", type: undefined },

    // Strategy 2: Condominium searches
    { keyword: "condo", type: undefined },
    { keyword: "condominium", type: undefined },
    { keyword: "condos", type: undefined },

    // Strategy 3: General residential searches
    { keyword: "residential", type: undefined },
    { keyword: "housing", type: undefined },
    { keyword: "rental", type: undefined },

    // Strategy 4: Specific building types
    { keyword: "townhome", type: undefined },
    { keyword: "townhouse", type: undefined },
    { keyword: "duplex", type: undefined },

    // Strategy 5: Use lodging type with residential keywords (legacy API compatibility)
    { keyword: "apartment", type: "lodging" },
    { keyword: "residential", type: "lodging" },
  ];

  for (const strategy of searchStrategies) {
    if (allResults.length >= 200) break; // Reasonable limit to prevent excessive API calls

    try {
      const results = await performSingleResidentialSearch(
        lat,
        lng,
        strategy.keyword,
        strategy.type,
        Math.min(2, maxPages) // Limit pages per strategy
      );

      // Deduplicate by place_id
      for (const place of results) {
        if (!seenPlaceIds.has(place.place_id)) {
          seenPlaceIds.add(place.place_id);
          allResults.push(place);
        }
      }
    } catch (error) {
      console.warn(
        `Search strategy failed for keyword "${strategy.keyword}":`,
        error
      );
      continue;
    }

    // Small delay between different search strategies
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(
    `Found ${allResults.length} unique residential properties near ${lat}, ${lng}`
  );
  return allResults;
}

/**
 * Perform a single residential search with the given parameters
 */
async function performSingleResidentialSearch(
  lat: number,
  lng: number,
  keyword: string,
  type?: string,
  maxPages: number = 2
): Promise<PlaceDetails[]> {
  const results: PlaceDetails[] = [];
  let nextPageToken: string | undefined;
  let pageCount = 0;

  do {
    const searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`;

    const params = new URLSearchParams({
      location: `${lat},${lng}`,
      radius: "1500", // 1.5km radius per search point
      keyword,
      key: GOOGLE_MAPS_API_KEY,
    });

    if (type) {
      params.set("type", type);
    }

    if (nextPageToken) {
      params.set("pagetoken", nextPageToken);
      // Wait for token to become valid
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const response = await fetch(`${searchUrl}?${params}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Places API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      if (data.status === "INVALID_REQUEST") {
        console.warn(
          `Invalid request for keyword "${keyword}":`,
          data.error_message
        );
        break; // Don't retry invalid requests
      }
      throw new Error(
        `Places API error: ${data.status} - ${data.error_message || "Unknown error"}`
      );
    }

    const places = (data.results || [])
      .filter((place: any) => {
        // Filter for residential-looking places
        const name = (place.name || "").toLowerCase();
        const address = (
          place.vicinity ||
          place.formatted_address ||
          ""
        ).toLowerCase();
        const types = place.types || [];

        // Keywords that indicate residential properties
        const residentialKeywords = [
          "apartment",
          "condo",
          "residence",
          "residential",
          "housing",
          "complex",
          "towers",
          "village",
          "manor",
          "court",
          "place",
          "plaza",
          "square",
          "townhome",
          "townhouse",
          "duplex",
          "units",
          "homes",
          "lofts",
          "community",
          "gardens",
          "terrace",
          "heights",
          "ridge",
          "park",
        ];

        // Non-residential keywords to exclude
        const excludeKeywords = [
          "hotel",
          "motel",
          "inn",
          "lodge",
          "resort",
          "hospital",
          "school",
          "restaurant",
          "store",
          "shop",
          "office",
          "church",
          "gas station",
          "bank",
          "pharmacy",
          "gym",
          "spa",
          "salon",
          "market",
          "mall",
        ];

        // Check if it contains residential keywords
        const hasResidentialKeywords = residentialKeywords.some(
          (keyword) => name.includes(keyword) || address.includes(keyword)
        );

        // Check if it contains exclusion keywords
        const hasExclusionKeywords = excludeKeywords.some(
          (keyword) => name.includes(keyword) || address.includes(keyword)
        );

        // Include if it has residential keywords and doesn't have exclusion keywords
        return hasResidentialKeywords && !hasExclusionKeywords;
      })
      .map((place: any) => ({
        place_id: place.place_id,
        name: place.name || "Unknown",
        formatted_address: place.vicinity || place.formatted_address || "",
        geometry: {
          location: {
            lat: place.geometry?.location?.lat || 0,
            lng: place.geometry?.location?.lng || 0,
          },
        },
        rating: place.rating,
        user_ratings_total: place.user_ratings_total,
        photos:
          place.photos?.map((photo: any) => ({
            photo_reference: photo.photo_reference,
            height: photo.height,
            width: photo.width,
          })) || [],
        website: place.website,
        vicinity: place.vicinity,
      }));

    results.push(...places);
    nextPageToken = data.next_page_token;
    pageCount++;
  } while (nextPageToken && pageCount < maxPages && results.length < 40);

  return results;
}

/**
 * Process apartments and calculate distances to route with transit awareness
 */
async function processApartmentDistances(
  apartments: PlaceDetails[],
  route: RouteOption
): Promise<ApartmentListing[]> {
  // Decode the route polyline
  const decodedPolyline = decodePolyline(route.overview_polyline.points);
  const routeLineCoords = decodedPolyline.map(([lat, lng]) => [lng, lat]); // [lng, lat] for turf
  const routeLine = lineString(routeLineCoords);

  return apartments.map((apartment) => {
    const apartmentPoint = point([
      apartment.geometry.location.lng,
      apartment.geometry.location.lat,
    ]);

    // Find nearest point on route
    const nearestPoint = nearestPointOnLine(routeLine, apartmentPoint, {
      units: "kilometers", // Explicitly specify units
    });

    // FIX: Convert kilometers to miles properly
    const distanceKm = nearestPoint.properties.dist || 0;
    const distanceMiles = distanceKm * 0.621371; // Convert km to miles

    // Find nearest transit step for context
    const nearestTransitStep = findNearestTransitStep(apartment, route);

    return {
      place: apartment,
      distanceToRoute: distanceMiles, // Now in miles
      bucket: getBucketFromDistance(distanceMiles),
      nearestTransitStep,
    };
  });
}

/**
 * Find the nearest transit step to an apartment
 */
function findNearestTransitStep(apartment: PlaceDetails, route: RouteOption) {
  if (!route.legs?.[0]?.steps) return undefined;

  let nearestStep:
    | {
        type: string;
        line_name?: string;
        line_color?: string;
        distance_to_step: number;
      }
    | undefined = undefined;
  let minDistance = Infinity;

  const apartmentPoint = point([
    apartment.geometry.location.lng,
    apartment.geometry.location.lat,
  ]);

  for (const step of route.legs[0].steps) {
    if (step.travel_mode === "TRANSIT" && step.transit) {
      // Calculate distance to this transit step
      const stepMidpoint = point([
        (step.start_location.lng + step.end_location.lng) / 2,
        (step.start_location.lat + step.end_location.lat) / 2,
      ]);

      const distanceValue = distance(apartmentPoint, stepMidpoint, {
        units: "kilometers",
      });

      if (distanceValue < minDistance) {
        minDistance = distanceValue;
        nearestStep = {
          type: getTransitType(step.transit.line.vehicle.type),
          line_name: step.transit.line.name,
          line_color: step.transit.line.color,
          distance_to_step: distanceValue * 0.621371, // Convert to miles
        };
      }
    }
  }

  return nearestStep;
}

/**
 * Convert Google transit vehicle type to our simplified types
 */
function getTransitType(vehicleType: string): string {
  const type = vehicleType.toLowerCase();
  if (type.includes("bus")) return "bus";
  if (type.includes("subway") || type.includes("metro")) return "subway";
  if (type.includes("train") || type.includes("rail")) return "train";
  return "transit";
}

/**
 * Determine bucket from distance in miles
 */
function getBucketFromDistance(distanceMiles: number): DistanceBucket {
  if (distanceMiles <= 1) return "≤1mi";
  if (distanceMiles <= 2) return "≤2mi";
  return "≤3mi";
}

/**
 * Group apartments by distance buckets
 */
function groupApartmentsByDistance(apartments: ApartmentListing[]) {
  const grouped = {
    "≤1mi": [] as ApartmentListing[],
    "≤2mi": [] as ApartmentListing[],
    "≤3mi": [] as ApartmentListing[],
  };

  apartments.forEach((apartment) => {
    // Filter out apartments more than 3 miles away
    if (apartment.distanceToRoute <= 3) {
      grouped[apartment.bucket].push(apartment);
    }
  });

  // Sort each bucket by distance
  Object.values(grouped).forEach((bucket) => {
    bucket.sort((a, b) => a.distanceToRoute - b.distanceToRoute);
  });

  return grouped;
}
