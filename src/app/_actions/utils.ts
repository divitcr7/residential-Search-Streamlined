import { point, lineString } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import distance from "@turf/distance";
import pLimit from "p-limit";
import axios from "axios";

import type {
  LatLng,
  RouteOption,
  TravelMode,
  SearchResult,
  ApartmentListing,
  PlaceDetails,
  DistanceBucket,
} from "@/types";

const OPENROUTE_API_KEY = process.env.NEXT_PUBLIC_OPENROUTESERVICE_API_KEY!;

// Simple fallback cache and metrics
const simpleCache = new Map<string, any>();
export const metrics = {
  startTimer: (id: string) => {},
  endTimer: (id: string, method: string, status: string) => {},
  updateMemoryUsage: () => {},
  recordCacheHit: (type: string, hit: boolean) => {},
  recordApiCall: (apiType: string, status: string) => {},
  recordApartmentsFound: (method: string, count: number) => {},
};

export const routeCache = {
  get: (key: string) => simpleCache.get(`route:${key}`),
  set: (key: string, value: any) => simpleCache.set(`route:${key}`, value),
};

export const apartmentCache = {
  get: (key: string) => simpleCache.get(`apt:${key}`),
  set: (key: string, value: any) => simpleCache.set(`apt:${key}`, value),
};

// Performance constants
export const MAX_CONCURRENT_REQUESTS = 5;
export const SEARCH_RADIUS_METERS = 5000; // 5km radius for apartment search
export const ROUTE_SAMPLE_DISTANCE = 2000; // Sample every 2km along route

// Configuration via environment variables
export const MAX_RESULTS = Number(process.env.NEXT_PUBLIC_APT_RESULT_CAP ?? 20);
export const MAX_DISTANCE_MILES = Number(
  process.env.NEXT_PUBLIC_APT_ROUTE_RADIUS_MI ?? 1
);

// Request limiter for concurrency control
export const limit = pLimit(MAX_CONCURRENT_REQUESTS);

interface RouteResult {
  routes: RouteOption[];
  status: string;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags: { [key: string]: string };
}

interface OverpassResponse {
  elements: OverpassElement[];
}

/**
 * Generate cache key
 */
export function generateCacheKey(...parts: string[]): string {
  return parts.join("|");
}

/**
 * Map travel mode to OpenRouteService profile
 */
export function mapTravelModeToProfile(mode: TravelMode): string {
  switch (mode) {
    case "DRIVE":
      return "driving-car";
    case "BICYCLE":
      return "cycling-regular";
    case "WALK":
      return "foot-walking";
    case "TRANSIT":
      return "driving-car"; // Fallback to driving for now
    default:
      return "driving-car";
  }
}

/**
 * Geocode address using Nominatim
 */
export async function geocodeAddress(address: string): Promise<LatLng | null> {
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search`,
      {
        params: {
          q: address,
          format: "json",
          limit: 1,
          addressdetails: 1,
        },
        headers: {
          "User-Agent": "PropertyFinder/1.0",
        },
      }
    );

    if (response.data.length === 0) {
      return null;
    }

    const result = response.data[0];
    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    };
  } catch (error) {
    console.error("Geocoding failed:", error);
    return null;
  }
}

/**
 * Mock route for testing without API key
 */
export function createMockRoute(
  start: LatLng,
  end: LatLng,
  profile: string
): RouteOption {
  // Create a simple straight line route for testing
  const distance = calculateDistance(start, end);
  const distanceKm = distance * 1.609344; // Convert miles to km
  const estimatedTime = Math.round((distanceKm / 50) * 60); // Assume 50 km/h average speed

  // Create polyline points (just start and end for simplicity)
  const polylinePoints = encodePolyline([start, end]);

  const bounds = {
    northeast: {
      lat: Math.max(start.lat, end.lat),
      lng: Math.max(start.lng, end.lng),
    },
    southwest: {
      lat: Math.min(start.lat, end.lat),
      lng: Math.min(start.lng, end.lng),
    },
  };

  return {
    route_id: `mock_${Date.now()}`,
    summary: `${distanceKm.toFixed(1)} km, ${estimatedTime} min (Mock Route)`,
    overview_polyline: {
      points: polylinePoints,
    },
    bounds,
    legs: [
      {
        distance: {
          text: `${distanceKm.toFixed(1)} km`,
          value: distanceKm * 1000, // Convert to meters
        },
        duration: {
          text: `${estimatedTime} min`,
          value: estimatedTime * 60, // Convert to seconds
        },
        start_address: "Origin",
        end_address: "Destination",
        start_location: start,
        end_location: end,
        steps: [],
      },
    ],
    fare: undefined,
    warnings: [],
    waypoint_order: [],
    copyrights: "© Mock Route for Testing",
  };
}

/**
 * Calculate distance between two points using Haversine formula
 */
export function calculateDistance(start: LatLng, end: LatLng): number {
  const R = 3959; // Radius of Earth in miles
  const dLat = ((end.lat - start.lat) * Math.PI) / 180;
  const dLon = ((end.lng - start.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((start.lat * Math.PI) / 180) *
      Math.cos((end.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

/**
 * Get route from OpenRouteService or fallback to mock
 */
export async function getRoute(
  start: LatLng,
  end: LatLng,
  profile: string
): Promise<RouteOption | null> {
  // Check if we have a valid API key
  if (!OPENROUTE_API_KEY || OPENROUTE_API_KEY.trim() === "") {
    console.log("Using mock route - no valid API key available");
    return createMockRoute(start, end, profile);
  }

  try {
    const response = await axios.get(
      `https://api.openrouteservice.org/v2/directions/${profile}`,
      {
        params: {
          api_key: OPENROUTE_API_KEY,
          start: `${start.lng},${start.lat}`,
          end: `${end.lng},${end.lat}`,
          format: "json",
          instructions: false,
          geometry: true,
          elevation: false,
          extra_info: "",
        },
        timeout: 10000,
      }
    );

    if (!response.data?.routes?.[0]) {
      console.log("No route found, using mock route");
      return createMockRoute(start, end, profile);
    }

    const route = response.data.routes[0];
    const geometry = route.geometry;

    // Decode the polyline
    const coordinates = decodePolyline(geometry);

    // Create bounds
    const lats = coordinates.map((coord) => coord.lat);
    const lngs = coordinates.map((coord) => coord.lng);
    const bounds = {
      northeast: {
        lat: Math.max(...lats),
        lng: Math.max(...lngs),
      },
      southwest: {
        lat: Math.min(...lats),
        lng: Math.min(...lngs),
      },
    };

    return {
      route_id: `ors_${Date.now()}`,
      summary: `${(route.summary.distance / 1000).toFixed(1)} km, ${Math.round(
        route.summary.duration / 60
      )} min`,
      overview_polyline: {
        points: encodePolyline(coordinates),
      },
      bounds,
      legs: [
        {
          distance: {
            text: `${(route.summary.distance / 1000).toFixed(1)} km`,
            value: route.summary.distance,
          },
          duration: {
            text: `${Math.round(route.summary.duration / 60)} min`,
            value: route.summary.duration,
          },
          start_address: "Origin",
          end_address: "Destination",
          start_location: start,
          end_location: end,
          steps: [],
        },
      ],
      fare: undefined,
      warnings: [],
      waypoint_order: [],
      copyrights: "© OpenRouteService",
    };
  } catch (error) {
    console.error("OpenRouteService API failed:", error);
    console.log("Falling back to mock route");
    return createMockRoute(start, end, profile);
  }
}

/**
 * Encode polyline coordinates
 */
export function encodePolyline(coordinates: LatLng[]): string {
  let encoded = "";
  let prevLat = 0;
  let prevLng = 0;

  for (const coord of coordinates) {
    const lat = Math.round(coord.lat * 1e5);
    const lng = Math.round(coord.lng * 1e5);

    const dLat = lat - prevLat;
    const dLng = lng - prevLng;

    encoded += encodeValue(dLat);
    encoded += encodeValue(dLng);

    prevLat = lat;
    prevLng = lng;
  }

  return encoded;
}

/**
 * Encode a single value for polyline
 */
export function encodeValue(value: number): string {
  value = value < 0 ? ~(value << 1) : value << 1;
  let encoded = "";
  while (value >= 0x20) {
    encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
    value >>= 5;
  }
  encoded += String.fromCharCode(value + 63);
  return encoded;
}

/**
 * Decode polyline string to coordinates
 */
export function decodePolyline(encoded: string): LatLng[] {
  const coordinates: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dLng;

    coordinates.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return coordinates;
}

/**
 * Mock apartments for testing
 */
export function createMockApartments(
  center: LatLng,
  radiusMeters: number = SEARCH_RADIUS_METERS
): OverpassElement[] {
  const mockApartments: OverpassElement[] = [];
  const count = Math.floor(Math.random() * 5) + 2; // 2-6 apartments per location

  for (let i = 0; i < count; i++) {
    // Generate random offset within radius
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radiusMeters;
    const latOffset = (distance * Math.cos(angle)) / 111320; // Convert meters to degrees
    const lngOffset =
      (distance * Math.sin(angle)) /
      (111320 * Math.cos((center.lat * Math.PI) / 180));

    mockApartments.push({
      type: "way",
      id: Date.now() + i,
      lat: center.lat + latOffset,
      lon: center.lng + lngOffset,
      tags: {
        building: "apartments",
        name: `Mock Apartment Complex ${i + 1}`,
        "addr:housenumber": `${Math.floor(Math.random() * 9000) + 1000}`,
        "addr:street": `Test Street ${i + 1}`,
        "addr:city": "Houston",
        "addr:state": "TX",
        "addr:postcode": `${77000 + Math.floor(Math.random() * 999)}`,
        amenity: "residential",
      },
    });
  }

  return mockApartments;
}

/**
 * Check if tags indicate a valid apartment building
 */
export function isValidApartmentBuilding(tags: {
  [key: string]: string;
}): boolean {
  const building = tags.building?.toLowerCase();
  const amenity = tags.amenity?.toLowerCase();
  const landuse = tags.landuse?.toLowerCase();
  const residential = tags.residential?.toLowerCase();

  return (
    building === "apartments" ||
    building === "residential" ||
    amenity === "residential" ||
    landuse === "residential" ||
    residential === "apartments" ||
    tags.name?.toLowerCase().includes("apartment") ||
    tags.name?.toLowerCase().includes("complex") ||
    tags.name?.toLowerCase().includes("tower") ||
    tags.name?.toLowerCase().includes("residence") ||
    tags.name?.toLowerCase().includes("villa") ||
    tags.name?.toLowerCase().includes("court") ||
    tags.name?.toLowerCase().includes("plaza") ||
    tags.name?.toLowerCase().includes("place")
  );
}

/**
 * Search for apartments using Overpass API with fallback to mock data
 */
export async function searchApartmentsOverpass(
  center: LatLng,
  radiusMeters: number = SEARCH_RADIUS_METERS
): Promise<OverpassElement[]> {
  try {
    // Overpass query to find apartment buildings
    const query = `
      [out:json][timeout:15];
      (
        way["building"~"apartments|residential"]["name"](around:${radiusMeters},${center.lat},${center.lng});
        way["amenity"="residential"]["name"](around:${radiusMeters},${center.lat},${center.lng});
        way["landuse"="residential"]["name"](around:${radiusMeters},${center.lat},${center.lng});
        relation["building"~"apartments|residential"]["name"](around:${radiusMeters},${center.lat},${center.lng});
      );
      out center;
    `;

    const response = await axios.post(
      "https://overpass-api.de/api/interpreter",
      query,
      {
        headers: {
          "Content-Type": "text/plain",
          "User-Agent": "PropertyFinder/1.0",
        },
        timeout: 20000,
      }
    );

    const data: OverpassResponse = response.data;

    // Filter results to only include valid apartment buildings
    const validApartments = data.elements.filter((element) =>
      isValidApartmentBuilding(element.tags)
    );

    // If no real results, return mock data
    if (validApartments.length === 0) {
      return createMockApartments(center, radiusMeters);
    }

    return validApartments;
  } catch (error) {
    console.error("Overpass API failed, using mock data:", error);
    return createMockApartments(center, radiusMeters);
  }
}

/**
 * Convert Overpass element to PlaceDetails
 */
export function overpassElementToPlaceDetails(
  element: OverpassElement
): PlaceDetails {
  const lat = element.lat || element.center?.lat || 0;
  const lng = element.lon || element.center?.lon || 0;

  return {
    place_id: `overpass_${element.id}`,
    name: element.tags.name || "Unnamed Apartment",
    formatted_address: buildAddress(element.tags),
    geometry: {
      location: { lat, lng },
      viewport: {
        northeast: { lat: lat + 0.001, lng: lng + 0.001 },
        southwest: { lat: lat - 0.001, lng: lng - 0.001 },
      },
    },
    types: ["lodging", "establishment"],
    rating: 4.0 + Math.random() * 1.0, // Mock rating between 4.0-5.0
    user_ratings_total: Math.floor(Math.random() * 500) + 50,
    price_level: Math.floor(Math.random() * 4) + 1,
    photos: [], // No photos from Overpass
    opening_hours: undefined,
    website: undefined,
    phone: undefined,
  };
}

/**
 * Build address from Overpass tags
 */
export function buildAddress(tags: { [key: string]: string }): string {
  const parts: string[] = [];

  if (tags["addr:housenumber"]) {
    parts.push(tags["addr:housenumber"]);
  }

  if (tags["addr:street"]) {
    parts.push(tags["addr:street"]);
  }

  if (tags["addr:city"]) {
    parts.push(tags["addr:city"]);
  }

  if (tags["addr:state"]) {
    parts.push(tags["addr:state"]);
  }

  if (tags["addr:postcode"]) {
    parts.push(tags["addr:postcode"]);
  }

  return parts.length > 0 ? parts.join(", ") : "Address not available";
}

/**
 * Sample points along a route at regular intervals
 */
export function sampleRoutePoints(
  polyline: LatLng[],
  intervalMeters: number
): LatLng[] {
  if (polyline.length < 2) return polyline;

  const samples: LatLng[] = [polyline[0]]; // Always include start point
  let currentDistance = 0;

  for (let i = 1; i < polyline.length; i++) {
    const segmentStart = polyline[i - 1];
    const segmentEnd = polyline[i];
    const segmentDistance = distance(
      point([segmentStart.lng, segmentStart.lat]),
      point([segmentEnd.lng, segmentEnd.lat]),
      { units: "meters" }
    );

    currentDistance += segmentDistance;

    if (currentDistance >= intervalMeters) {
      samples.push(segmentEnd);
      currentDistance = 0;
    }
  }

  // Always include the last point if it's not too close to the previous sample
  const lastPoint = polyline[polyline.length - 1];
  if (
    samples.length === 0 ||
    distance(
      point([samples[samples.length - 1].lng, samples[samples.length - 1].lat]),
      point([lastPoint.lng, lastPoint.lat]),
      { units: "meters" }
    ) >
      intervalMeters / 2
  ) {
    samples.push(lastPoint);
  }

  return samples;
}

/**
 * Filter apartments by proximity to route using Turf.js
 */
export function filterApartmentsByRouteProximity(
  apartments: PlaceDetails[],
  routePolyline: LatLng[]
): PlaceDetails[] {
  if (routePolyline.length < 2) {
    return apartments;
  }

  // Create route line from decoded polyline coordinates
  const routeLine = lineString(routePolyline.map((p) => [p.lng, p.lat]));

  // Filter apartments within MAX_DISTANCE_MILES from the route
  const apartmentsNearRoute = apartments.filter((apt) => {
    const pt = point([apt.geometry.location.lng, apt.geometry.location.lat]);
    const nearest = nearestPointOnLine(routeLine, pt);
    const distanceToRoute = distance(pt, nearest, { units: "miles" });
    return distanceToRoute <= MAX_DISTANCE_MILES;
  });

  // Sort by distance to route and limit to MAX_RESULTS
  const sortedApartments = apartmentsNearRoute
    .map((apt) => ({
      ...apt,
      distanceToRoute: distance(
        point([apt.geometry.location.lng, apt.geometry.location.lat]),
        nearestPointOnLine(
          routeLine,
          point([apt.geometry.location.lng, apt.geometry.location.lat])
        ),
        { units: "miles" }
      ),
    }))
    .sort((a, b) => a.distanceToRoute - b.distanceToRoute)
    .slice(0, MAX_RESULTS)
    .map(({ distanceToRoute, ...apt }) => apt); // Remove temp distance field

  return sortedApartments;
}

/**
 * Remove duplicate apartments based on proximity
 */
export function deduplicateApartments(
  apartments: PlaceDetails[]
): PlaceDetails[] {
  const deduplicated: PlaceDetails[] = [];
  const MIN_DISTANCE_METERS = 100; // Consider apartments within 100m as duplicates

  for (const apt of apartments) {
    const isDuplicate = deduplicated.some((existing) => {
      const dist = distance(
        point([apt.geometry.location.lng, apt.geometry.location.lat]),
        point([existing.geometry.location.lng, existing.geometry.location.lat]),
        { units: "meters" }
      );
      return dist < MIN_DISTANCE_METERS;
    });

    if (!isDuplicate) {
      deduplicated.push(apt);
    }
  }

  return deduplicated;
}

/**
 * Process apartment distances and create listings
 */
export async function processApartmentDistances(
  apartments: PlaceDetails[],
  route: RouteOption
): Promise<ApartmentListing[]> {
  const polyline = decodePolyline(route.overview_polyline.points);
  const routeLine = lineString(polyline.map((p) => [p.lng, p.lat]));

  return apartments.map((apt) => {
    const aptPoint = point([
      apt.geometry.location.lng,
      apt.geometry.location.lat,
    ]);
    const nearestPoint = nearestPointOnLine(routeLine, aptPoint);
    const distanceToRoute = distance(aptPoint, nearestPoint, {
      units: "miles",
    });

    return {
      place: apt,
      distanceToRoute,
      bucket: getBucketFromDistance(distanceToRoute),
    };
  });
}

/**
 * Get bucket from distance
 */
export function getBucketFromDistance(distanceMiles: number): DistanceBucket {
  if (distanceMiles <= 1) return "≤1mi";
  if (distanceMiles <= 2) return "≤2mi";
  return "≤3mi";
}

/**
 * Group apartments by distance buckets
 */
export function groupApartmentsByDistance(apartments: ApartmentListing[]) {
  const buckets: {
    "≤1mi": ApartmentListing[];
    "≤2mi": ApartmentListing[];
    "≤3mi": ApartmentListing[];
  } = {
    "≤1mi": [],
    "≤2mi": [],
    "≤3mi": [],
  };

  for (const apt of apartments) {
    buckets[apt.bucket].push(apt);
  }

  return buckets;
}
