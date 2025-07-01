"use server";

// Use Google Maps built-in polyline decoding
function decodePolyline(encoded: string): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}
// @ts-ignore - turf typing issue with ES modules
import * as turf from "@turf/turf";
import { cache } from "@/lib/cache";
import type {
  TravelMode,
  SearchResult,
  RouteOption,
  RouteResult,
  PlaceDetails,
  ApartmentListing,
  DistanceBucket,
  LatLng,
  RouteStep,
} from "@/types";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

if (!GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY environment variable is required");
}

/**
 * Main function to get route options and apartments
 */
export async function getRouteAndApartments(
  origin: string,
  destination: string,
  travelMode: TravelMode,
  selectedRouteIndex?: number
): Promise<SearchResult> {
  try {
    console.log(
      `🚀 Getting route and apartments: ${origin} → ${destination} (${travelMode})`
    );

    // Step 1: Get route options (multiple for transit)
    const routeResult = await computeRoutes(origin, destination, travelMode);

    if (!routeResult.routes || routeResult.routes.length === 0) {
      throw new Error("No routes found");
    }

    // Step 2: Select route (first route by default, or user-selected)
    const selectedRoute = routeResult.routes[selectedRouteIndex || 0];

    console.log(
      `📍 Found ${routeResult.routes.length} route options, using route ${selectedRouteIndex || 0}`
    );

    // Step 3: Search for apartments along the selected route
    const apartments = await searchApartmentsAlongRoute(selectedRoute);

    // Step 4: Process and bucket apartments by distance
    const processedApartments = await processApartmentDistances(
      apartments,
      selectedRoute
    );

    const buckets = groupApartmentsByDistance(processedApartments);

    console.log(`🏠 Found ${apartments.length} apartments total`);

    return {
      routeOptions: routeResult.routes,
      selectedRoute,
      apartments: buckets,
      totalFound: apartments.length,
    };
  } catch (error) {
    console.error("Error in getRouteAndApartments:", error);
    throw new Error("Failed to get route and apartments. Please try again.");
  }
}

/**
 * Compute routes using Google Directions API with transit support
 */
async function computeRoutes(
  origin: string,
  destination: string,
  travelMode: TravelMode
): Promise<RouteResult> {
  const cacheKey = generateCacheKey("routes", origin, destination, travelMode);
  const cached = cache.get<RouteResult>(cacheKey);
  if (cached) return cached;

  const directionsUrl = "https://maps.googleapis.com/maps/api/directions/json";

  const baseParams = {
    origin,
    destination,
    key: GOOGLE_MAPS_API_KEY,
    alternatives: "true", // Get multiple route options
    language: "en",
    units: "imperial",
  };

  // Add mode-specific parameters
  let modeParams: Record<string, string> = {};

  switch (travelMode) {
    case "TRANSIT":
      modeParams = {
        mode: "transit",
        transit_mode: "bus|subway|train|tram|rail",
        departure_time: Math.floor(Date.now() / 1000).toString(), // Current time
      };
      break;
    case "DRIVE":
      modeParams = { mode: "driving" };
      break;
    case "WALK":
      modeParams = { mode: "walking" };
      break;
    case "BICYCLE":
      modeParams = { mode: "bicycling" };
      break;
  }

  const params = new URLSearchParams({ ...baseParams, ...modeParams });

  const response = await fetch(`${directionsUrl}?${params}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Directions API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  if (data.status !== "OK") {
    throw new Error(
      `Directions API error: ${data.status} - ${data.error_message || "Unknown error"}`
    );
  }

  // Transform Google Directions API response to our RouteOption format
  const routes: RouteOption[] = data.routes.map(
    (route: any, index: number) => ({
      route_id: `route_${index}`,
      summary: route.summary || generateRouteSummary(route),
      overview_polyline: route.overview_polyline,
      bounds: route.bounds,
      legs: route.legs,
      fare: route.fare,
      warnings: route.warnings || [],
      waypoint_order: route.waypoint_order || [],
      copyrights: route.copyrights || "",
    })
  );

  const result: RouteResult = {
    routes,
    status: data.status,
  };

  cache.set(cacheKey, result);
  return result;
}

/**
 * Generate a human-readable route summary for transit routes
 */
function generateRouteSummary(route: any): string {
  if (!route.legs?.[0]?.steps) return "Route";

  const transitSteps = route.legs[0].steps.filter(
    (step: any) => step.travel_mode === "TRANSIT"
  );

  if (transitSteps.length === 0) return route.legs[0].distance.text;

  const transitLines = transitSteps
    .map(
      (step: any) =>
        step.transit_details?.line?.short_name ||
        step.transit_details?.line?.name
    )
    .filter(Boolean)
    .join(" → ");

  return transitLines || `${route.legs[0].duration.text} via transit`;
}

/**
 * Search for apartments along route using multiple sampling points
 */
async function searchApartmentsAlongRoute(
  route: RouteOption
): Promise<PlaceDetails[]> {
  const cacheKey = generateCacheKey(
    "apartments",
    route.route_id,
    route.overview_polyline.points.slice(0, 50)
  );
  const cached = cache.get<PlaceDetails[]>(cacheKey);
  if (cached) return cached;

  // Decode the overview polyline
  const decodedPolyline = decodePolyline(route.overview_polyline.points);
  const routePoints = decodedPolyline.map(([lat, lng]) => ({ lat, lng }));

  // Sample points along the route (every ~500 meters)
  const samplePoints = sampleRoutePoints(routePoints, 10);

  const allApartments: PlaceDetails[] = [];
  const seenPlaceIds = new Set<string>();

  // Search for apartments near each sample point
  for (const point of samplePoints) {
    try {
      const apartments = await searchNearbyApartments(point.lat, point.lng);

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

  cache.set(cacheKey, allApartments);
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
 * Search for apartments near a specific location
 */
async function searchNearbyApartments(
  lat: number,
  lng: number
): Promise<PlaceDetails[]> {
  const searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`;

  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: "2000", // 2km radius per search point
    type: "lodging",
    keyword: "apartment",
    key: GOOGLE_MAPS_API_KEY,
  });

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
    throw new Error(
      `Places API error: ${data.status} - ${data.error_message || "Unknown error"}`
    );
  }

  return (data.results || []).map((place: any) => ({
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
  const routeLine = turf.lineString(routeLineCoords);

  return apartments.map((apartment) => {
    const apartmentPoint = turf.point([
      apartment.geometry.location.lng,
      apartment.geometry.location.lat,
    ]);

    // Find nearest point on route
    const nearestPoint = turf.nearestPointOnLine(routeLine, apartmentPoint, {
      units: "meters",
    });
    const distanceToRoute = nearestPoint.properties.dist || 0;

    // Find nearest transit step for context
    const nearestTransitStep = findNearestTransitStep(apartment, route);

    return {
      place: apartment,
      distanceToRoute,
      bucket: getBucketFromDistance(distanceToRoute),
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

  const apartmentPoint = turf.point([
    apartment.geometry.location.lng,
    apartment.geometry.location.lat,
  ]);

  for (const step of route.legs[0].steps) {
    if (step.travel_mode === "TRANSIT" && step.transit) {
      // Calculate distance to this transit step
      const stepMidpoint = turf.point([
        (step.start_location.lng + step.end_location.lng) / 2,
        (step.start_location.lat + step.end_location.lat) / 2,
      ]);

      const distance = turf.distance(apartmentPoint, stepMidpoint, {
        units: "meters",
      });

      if (distance < minDistance) {
        minDistance = distance;
        nearestStep = {
          type: getTransitType(step.transit.line.vehicle.type),
          line_name: step.transit.line.name,
          line_color: step.transit.line.color,
          distance_to_step: distance,
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
  if (type.includes("tram")) return "tram";
  return "transit";
}

/**
 * Get distance bucket from meters
 */
function getBucketFromDistance(distanceMeters: number): DistanceBucket {
  const distanceMiles = distanceMeters * 0.000621371; // Convert to miles
  if (distanceMiles <= 1) return "≤1mi";
  if (distanceMiles <= 2) return "≤2mi";
  return "≤3mi";
}

/**
 * Group apartments by distance buckets
 */
function groupApartmentsByDistance(apartments: ApartmentListing[]) {
  const buckets = {
    "≤1mi": [] as ApartmentListing[],
    "≤2mi": [] as ApartmentListing[],
    "≤3mi": [] as ApartmentListing[],
  };

  for (const apartment of apartments) {
    buckets[apartment.bucket].push(apartment);
  }

  // Sort each bucket by distance
  Object.values(buckets).forEach((bucket) =>
    bucket.sort((a, b) => a.distanceToRoute - b.distanceToRoute)
  );

  return buckets;
}

/**
 * Generate cache key
 */
function generateCacheKey(...parts: string[]): string {
  return parts.join(":").replace(/[^a-zA-Z0-9:_-]/g, "_");
}
