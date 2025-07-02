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
const MAX_CONCURRENT_REQUESTS = 3; // Reduced to avoid API limits
const MAX_SAR_CALLS_PER_HOUR = 65;
const GEOHASH_PRECISION = 3; // Simplified precision
const SAMPLE_INTERVAL = 5; // Reduced sampling frequency
const KEYWORDS = ["apartment", "condo"]; // Simplified keywords

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

  // Sample every 3rd vertex (~100m intervals)
  const samplePoints = sampleRoutePoints(routePoints, SAMPLE_INTERVAL);

  const allApartments: LightApartment[] = [];
  const seenGeohashes = new Set<string>();

  // Process points with concurrency control - limit to first 10 points
  const limitedSamplePoints = samplePoints.slice(0, 10);

  for (const point of limitedSamplePoints) {
    // Early termination if we have enough apartments
    if (allApartments.length >= 30) break;

    try {
      const apartments = await searchNearPointConcurrent(point.lat, point.lng);

      // Add apartments with geohash deduplication
      for (const apartment of apartments) {
        if (
          !seenGeohashes.has(apartment.geohash) &&
          allApartments.length < 30
        ) {
          seenGeohashes.add(apartment.geohash);
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

      // Break if we have enough results
      if (apartments.length >= 10) break;
    } catch (error) {
      console.warn(`Search failed for keyword ${keyword}:`, error);
      continue;
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
      radius: "1500",
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
