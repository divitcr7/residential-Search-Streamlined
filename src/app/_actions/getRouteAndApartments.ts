"use server";

import { decode as decodePolyline } from "@googlemaps/polyline-codec";
import { point, lineString } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import distance from "@turf/distance";
import pLimit from "p-limit";

// Simple geohash alternative
function encodeGeohash(lat: number, lng: number, precision: number): string {
  return `${lat.toFixed(precision)}:${lng.toFixed(precision)}`;
}
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

// Simple fallback cache and metrics
const simpleCache = new Map<string, any>();
const metrics = {
  startTimer: (id: string) => {},
  endTimer: (id: string, method: string, status: string) => {},
  updateMemoryUsage: () => {},
  recordCacheHit: (type: string, hit: boolean) => {},
  recordApiCall: (apiType: string, status: string) => {},
  recordApartmentsFound: (method: string, count: number) => {},
};

const sarCache = {
  get: (key: string) => simpleCache.get(`sar:${key}`),
  set: (key: string, value: any) => simpleCache.set(`sar:${key}`, value),
};

const nearbySearchCache = {
  get: (key: string) => simpleCache.get(`nearby:${key}`),
  set: (key: string, value: any) => simpleCache.set(`nearby:${key}`, value),
};

// Performance constants
const MAX_CONCURRENT_REQUESTS = 5; // Increased for better coverage
const MAX_SAR_CALLS_PER_HOUR = 65;
const GEOHASH_PRECISION = 3; // Simplified precision
const SAMPLE_INTERVAL = 2; // Much more frequent sampling
const KEYWORDS = ["apartment", "apartment complex", "condo", "housing"]; // More comprehensive keywords

// Request limiter for concurrency control
const limit = pLimit(MAX_CONCURRENT_REQUESTS);

// SAR quota tracking
let sarCallsThisHour = 0;
let sarQuotaResetTime = Date.now() + 60 * 60 * 1000;

interface RouteResult {
  routes: RouteOption[];
  status: string;
}

interface LightApartment {
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  geohash: string;
}

/**
 * Generate cache key
 */
function generateCacheKey(...parts: string[]): string {
  return parts.join("|");
}

/**
 * Exponential backoff with jitter
 */
async function exponentialBackoff(attempt: number): Promise<void> {
  const baseDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
  const jitter = Math.random() * 1000;
  await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
}

/**
 * Main function to get routes and apartments with performance optimizations
 */
export async function getRouteAndApartments(
  origin: string,
  destination: string,
  travelMode: TravelMode,
  selectedRouteIndex?: number
): Promise<SearchResult> {
  const timerId = `search_${Date.now()}`;
  metrics.startTimer(timerId);
  metrics.updateMemoryUsage();

  try {
    // Get routes using existing stable implementation
    const routeResult = await computeRoutes(origin, destination, travelMode);
    if (!routeResult.routes.length) {
      metrics.endTimer(timerId, "route_and_apartments", "error");
      return {
        routeOptions: [],
        apartments: { "≤1mi": [], "≤2mi": [], "≤3mi": [] },
        totalFound: 0,
      };
    }

    const route = routeResult.routes[selectedRouteIndex || 0];

    // Search for apartments with performance optimizations
    const lightApartments = await searchApartmentsPerformant(route);

    // Process distances and create apartment listings (light objects)
    const apartmentListings = await processApartmentDistancesLight(
      lightApartments,
      route
    );

    // Group by distance buckets
    const apartmentsByDistance = groupApartmentsByDistance(apartmentListings);

    const result: SearchResult = {
      routeOptions: routeResult.routes,
      selectedRoute: route,
      apartments: apartmentsByDistance,
      totalFound: apartmentListings.length,
    };

    metrics.endTimer(timerId, "route_and_apartments", "success");
    metrics.recordApartmentsFound("nearby", apartmentListings.length);
    return result;
  } catch (error) {
    console.error("Route and apartments search failed:", error);
    metrics.endTimer(timerId, "route_and_apartments", "error");
    throw error;
  }
}

/**
 * Performance-optimized apartment search with SAR primary and adaptive fallback
 */
async function searchApartmentsPerformant(
  route: RouteOption
): Promise<LightApartment[]> {
  const cacheKey = generateCacheKey(
    "apartments_perf",
    route.overview_polyline.points
  );

  // Check LRU cache first
  const cached = sarCache.get(cacheKey);
  if (cached) {
    metrics.recordCacheHit("sar", true);
    return cached;
  }

  metrics.recordCacheHit("sar", false);

  // Reset SAR quota if needed
  if (Date.now() > sarQuotaResetTime) {
    sarCallsThisHour = 0;
    sarQuotaResetTime = Date.now() + 60 * 60 * 1000;
  }

  let apartments: LightApartment[] = [];

  try {
    // Primary path: Search-Along-Route (SAR)
    if (sarCallsThisHour < MAX_SAR_CALLS_PER_HOUR) {
      console.log("Attempting Search-Along-Route (SAR)...");
      apartments = await searchAlongRoute(route);
      sarCallsThisHour++;

      if (apartments.length >= 30) {
        console.log(`SAR returned ${apartments.length} apartments`);
        sarCache.set(cacheKey, apartments);
        metrics.recordApartmentsFound("sar", apartments.length);
        return apartments;
      }
    }

    // Fallback: Adaptive sampler with concurrency control
    console.log("Using adaptive sampler fallback...");
    apartments = await adaptiveSampler(route);
  } catch (error) {
    console.warn("SAR failed, using adaptive sampler:", error);
    apartments = await adaptiveSampler(route);
  }

  console.log(`🏠 Found ${apartments.length} apartments along route`);
  sarCache.set(cacheKey, apartments);
  return apartments;
}

/**
 * Search-Along-Route using Places API (when available)
 */
async function searchAlongRoute(route: RouteOption): Promise<LightApartment[]> {
  // For now, skip SAR and use adaptive sampler directly
  // since Google Places Search-Along-Route is in limited preview
  console.log("SAR not available, using adaptive sampler");
  return adaptiveSampler(route);
}

/**
 * Adaptive sampler with concurrency control and early termination
 */
async function adaptiveSampler(route: RouteOption): Promise<LightApartment[]> {
  const decodedPolyline = decodePolyline(route.overview_polyline.points);
  const routePoints = decodedPolyline.map(([lat, lng]) => ({ lat, lng }));

  // Use multiple sampling strategies for comprehensive coverage
  const intervalPoints = sampleRoutePoints(routePoints, SAMPLE_INTERVAL);
  const distancePoints = sampleRouteByDistance(routePoints, 400); // Every 400m

  // Combine and deduplicate sampling points
  const allSamplePoints = [...intervalPoints, ...distancePoints];
  const uniquePoints = deduplicatePoints(allSamplePoints, 300); // Remove points within 300m

  console.log(
    `🗺️ Sampling ${uniquePoints.length} points distributed along entire route`
  );

  const allApartments: LightApartment[] = [];
  const seenGeohashes = new Set<string>();

  // Process more points for comprehensive route coverage
  const limitedSamplePoints = uniquePoints.slice(0, 50);

  // Create route line for filtering apartments
  const routeLineCoords = routePoints.map((p) => [p.lng, p.lat]);
  const routeLine = lineString(routeLineCoords);

  for (const searchPoint of limitedSamplePoints) {
    // Early termination if we have enough apartments
    if (allApartments.length >= 60) break;

    try {
      const apartments = await searchNearPointConcurrent(
        searchPoint.lat,
        searchPoint.lng
      );

      // Filter apartments to only those actually close to the route
      const routeFilteredApartments = apartments.filter((apartment) => {
        const aptPoint = point([apartment.lng, apartment.lat]);
        const nearestPoint = nearestPointOnLine(routeLine, aptPoint, {
          units: "kilometers",
        });
        const distanceToRoute = nearestPoint.properties.dist || 0;
        return distanceToRoute <= 4.0; // Within 4km of route (generous for urban areas)
      });

      console.log(
        `📍 Point ${searchPoint.lat.toFixed(3)},${searchPoint.lng.toFixed(3)}: found ${apartments.length} apartments, ${routeFilteredApartments.length} near route`
      );

      // Add route-filtered apartments with geohash deduplication
      for (const apartment of routeFilteredApartments) {
        if (
          !seenGeohashes.has(apartment.geohash) &&
          allApartments.length < 60
        ) {
          seenGeohashes.add(apartment.geohash);
          allApartments.push(apartment);
        }
      }
    } catch (error) {
      console.warn(
        `Failed to search near point ${searchPoint.lat}, ${searchPoint.lng}:`,
        error
      );
      continue;
    }
  }

  metrics.recordApartmentsFound("nearby", allApartments.length);
  return allApartments;
}

/**
 * Concurrent search near a point with up to 2 keywords
 */
async function searchNearPointConcurrent(
  lat: number,
  lng: number
): Promise<LightApartment[]> {
  const cacheKey = generateCacheKey("nearby", lat.toFixed(4), lng.toFixed(4));

  // Check cache
  const cached = nearbySearchCache.get(cacheKey);
  if (cached) {
    metrics.recordCacheHit("nearby_search", true);
    return cached;
  }

  metrics.recordCacheHit("nearby_search", false);

  // Launch searches for keywords sequentially to avoid rate limits
  const apartments: LightApartment[] = [];

  for (const keyword of KEYWORDS) {
    try {
      const results = await performSingleSearch(lat, lng, keyword);
      apartments.push(...results);

      // Break if we have enough results for this point
      if (apartments.length >= 15) break;
    } catch (error) {
      console.warn(`Search failed for keyword ${keyword}:`, error);
      continue;
    }
  }

  // If we don't have many results, try a type-based search for lodging
  if (apartments.length < 8) {
    try {
      const lodgingResults = await performTypeSearch(lat, lng, "lodging");
      apartments.push(...lodgingResults);
    } catch (error) {
      console.warn(`Lodging search failed:`, error);
    }
  }

  const deduped = deduplicateByGeohash(apartments);
  nearbySearchCache.set(cacheKey, deduped);

  return deduped;
}

/**
 * Perform single search with retry logic
 */
async function performSingleSearch(
  lat: number,
  lng: number,
  keyword: string,
  retryCount = 0
): Promise<LightApartment[]> {
  try {
    const url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
    const params = new URLSearchParams({
      location: `${lat},${lng}`,
      radius: "3000", // Further increased radius for comprehensive coverage
      keyword,
      key: GOOGLE_MAPS_API_KEY,
    });

    const response = await fetch(`${url}?${params}`);

    if (response.status === 429 && retryCount < 3) {
      // Rate limit hit, exponential backoff
      await exponentialBackoff(retryCount);
      return performSingleSearch(lat, lng, keyword, retryCount + 1);
    }

    if (!response.ok) {
      metrics.recordApiCall("nearby_search", "error");
      throw new Error(`Places API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === "OVER_QUERY_LIMIT" && retryCount < 3) {
      await exponentialBackoff(retryCount);
      return performSingleSearch(lat, lng, keyword, retryCount + 1);
    }

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      metrics.recordApiCall("nearby_search", "error");
      throw new Error(`Places API error: ${data.status}`);
    }

    metrics.recordApiCall("nearby_search", "success");

    // Return light apartment objects for fast processing
    return (data.results || [])
      .filter(isResidentialPlace)
      .map((place: any) => ({
        place_id: place.place_id,
        name: place.name || "Unknown",
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        geohash: encodeGeohash(
          place.geometry.location.lat,
          place.geometry.location.lng,
          GEOHASH_PRECISION
        ),
      }));
  } catch (error) {
    console.warn(`Search failed for ${keyword} at ${lat}, ${lng}:`, error);
    return [];
  }
}

/**
 * Perform type-based search for lodging to catch more apartments
 */
async function performTypeSearch(
  lat: number,
  lng: number,
  type: string,
  retryCount = 0
): Promise<LightApartment[]> {
  try {
    const url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
    const params = new URLSearchParams({
      location: `${lat},${lng}`,
      radius: "2500",
      type,
      key: GOOGLE_MAPS_API_KEY,
    });

    const response = await fetch(`${url}?${params}`);

    if (response.status === 429 && retryCount < 3) {
      await exponentialBackoff(retryCount);
      return performTypeSearch(lat, lng, type, retryCount + 1);
    }

    if (!response.ok) {
      metrics.recordApiCall("nearby_search", "error");
      throw new Error(`Places API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      metrics.recordApiCall("nearby_search", "error");
      throw new Error(`Places API error: ${data.status}`);
    }

    metrics.recordApiCall("nearby_search", "success");

    // Filter more strictly for residential places when using lodging type
    return (data.results || [])
      .filter((place: any) => isResidentialPlace(place) && !isHotelType(place))
      .map((place: any) => ({
        place_id: place.place_id,
        name: place.name || "Unknown",
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        geohash: encodeGeohash(
          place.geometry.location.lat,
          place.geometry.location.lng,
          GEOHASH_PRECISION
        ),
      }));
  } catch (error) {
    console.warn(`Type search failed for ${type} at ${lat}, ${lng}:`, error);
    return [];
  }
}

/**
 * Check if place is a hotel/motel rather than apartments
 */
function isHotelType(place: any): boolean {
  const name = (place.name || "").toLowerCase();
  const hotelKeywords = ["hotel", "motel", "inn", "lodge", "resort", "suites"];
  return hotelKeywords.some((keyword) => name.includes(keyword));
}

/**
 * Filter for residential places using optimized keyword matching
 */
function isResidentialPlace(place: any): boolean {
  const name = (place.name || "").toLowerCase();
  const address = (
    place.vicinity ||
    place.formatted_address ||
    ""
  ).toLowerCase();

  const residentialKeywords = [
    "apartment",
    "condo",
    "residence",
    "complex",
    "towers",
    "village",
    "loft",
    "housing",
    "homes",
    "living",
    "manor",
    "court",
    "plaza",
    "place",
  ];
  const excludeKeywords = [
    "hotel",
    "motel",
    "hospital",
    "school",
    "restaurant",
    "office",
  ];

  const hasResidential = residentialKeywords.some(
    (keyword) => name.includes(keyword) || address.includes(keyword)
  );

  const hasExclusion = excludeKeywords.some(
    (keyword) => name.includes(keyword) || address.includes(keyword)
  );

  return hasResidential && !hasExclusion;
}

/**
 * Deduplicate apartments by geohash
 */
function deduplicateByGeohash(apartments: LightApartment[]): LightApartment[] {
  const seenGeohashes = new Set<string>();
  return apartments.filter((apt) => {
    if (seenGeohashes.has(apt.geohash)) return false;
    seenGeohashes.add(apt.geohash);
    return true;
  });
}

/**
 * Sample route points at intervals
 */
function sampleRoutePoints(polyline: LatLng[], interval: number): LatLng[] {
  const samplePoints: LatLng[] = [];
  for (let i = 0; i < polyline.length; i += interval) {
    samplePoints.push(polyline[i]);
  }
  if (polyline.length > 0) {
    samplePoints.push(polyline[polyline.length - 1]);
  }
  return samplePoints;
}

/**
 * Sample route points by distance intervals (more consistent spacing)
 */
function sampleRouteByDistance(
  polyline: LatLng[],
  distanceMeters: number
): LatLng[] {
  if (polyline.length < 2) return polyline;

  const samplePoints: LatLng[] = [polyline[0]]; // Always include start
  let accumulatedDistance = 0;
  let nextSampleDistance = distanceMeters;

  for (let i = 1; i < polyline.length; i++) {
    const prevPoint = point([polyline[i - 1].lng, polyline[i - 1].lat]);
    const currentPoint = point([polyline[i].lng, polyline[i].lat]);
    const segmentDistance = distance(prevPoint, currentPoint, {
      units: "meters",
    });

    accumulatedDistance += segmentDistance;

    if (accumulatedDistance >= nextSampleDistance) {
      samplePoints.push(polyline[i]);
      nextSampleDistance += distanceMeters;
    }
  }

  // Always include the destination
  const lastPoint = polyline[polyline.length - 1];
  if (samplePoints[samplePoints.length - 1] !== lastPoint) {
    samplePoints.push(lastPoint);
  }

  return samplePoints;
}

/**
 * Remove duplicate points within a certain distance threshold
 */
function deduplicatePoints(
  points: LatLng[],
  minDistanceMeters: number
): LatLng[] {
  if (points.length <= 1) return points;

  const uniquePoints: LatLng[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const newPoint = point([points[i].lng, points[i].lat]);
    let isTooClose = false;

    for (const existingPoint of uniquePoints) {
      const existingPointGeometry = point([
        existingPoint.lng,
        existingPoint.lat,
      ]);
      const dist = distance(newPoint, existingPointGeometry, {
        units: "meters",
      });

      if (dist < minDistanceMeters) {
        isTooClose = true;
        break;
      }
    }

    if (!isTooClose) {
      uniquePoints.push(points[i]);
    }
  }

  return uniquePoints;
}

/**
 * Process apartment distances with light objects
 */
async function processApartmentDistancesLight(
  apartments: LightApartment[],
  route: RouteOption
): Promise<ApartmentListing[]> {
  const decodedPolyline = decodePolyline(route.overview_polyline.points);
  const routeLineCoords = decodedPolyline.map(([lat, lng]) => [lng, lat]);
  const routeLine = lineString(routeLineCoords);

  return apartments.map((apartment) => {
    const apartmentPoint = point([apartment.lng, apartment.lat]);
    const nearestPoint = nearestPointOnLine(routeLine, apartmentPoint, {
      units: "kilometers",
    });

    const distanceKm = nearestPoint.properties.dist || 0;
    const distanceMiles = distanceKm * 0.621371;

    // Create light place object for now (full details loaded on-demand)
    const lightPlace: PlaceDetails = {
      place_id: apartment.place_id,
      name: apartment.name,
      formatted_address: "", // Will be loaded on-demand
      geometry: {
        location: {
          lat: apartment.lat,
          lng: apartment.lng,
        },
      },
      photos: [], // Will be loaded on-demand
    };

    return {
      place: lightPlace,
      distanceToRoute: distanceMiles,
      bucket: getBucketFromDistance(distanceMiles),
    };
  });
}

/**
 * Compute routes (keeping existing stable implementation)
 */
async function computeRoutes(
  origin: string,
  destination: string,
  travelMode: TravelMode
): Promise<RouteResult> {
  const url = "https://maps.googleapis.com/maps/api/directions/json";

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

  const response = await fetch(`${url}?${params}`);

  if (!response.ok) {
    throw new Error(`Directions API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.status !== "OK") {
    throw new Error(`Directions API error: ${data.status}`);
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

  return { routes, status: data.status || "OK" };
}

/**
 * Generate route summary (keeping existing implementation)
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
 * Determine bucket from distance
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
