import type { TravelMode, LatLng, PlaceDetails } from "@/types";
import axios from "axios";

const OPENROUTE_API_KEY = process.env.NEXT_PUBLIC_OPENROUTESERVICE_API_KEY;

/**
 * Map travel mode to OpenRouteService profile
 */
function mapTravelModeToProfile(mode: TravelMode): string {
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
 * Get route using OpenRouteService
 */
export async function computeRoute(
  origin: string,
  destination: string,
  travelMode: TravelMode
): Promise<any> {
  if (!OPENROUTE_API_KEY) {
    throw new Error("OpenRouteService API key not configured");
  }

  try {
    // Geocode addresses first
    const [startCoords, endCoords] = await Promise.all([
      geocodeAddress(origin),
      geocodeAddress(destination),
    ]);

    if (!startCoords || !endCoords) {
      throw new Error("Failed to geocode addresses");
    }

    const profile = mapTravelModeToProfile(travelMode);

    const response = await axios.post(
      `https://api.openrouteservice.org/v2/directions/${profile}`,
      {
        coordinates: [
          [startCoords.lng, startCoords.lat],
          [endCoords.lng, endCoords.lat],
        ],
        format: "geojson",
        instructions: true,
        elevation: false,
      },
      {
        headers: {
          Authorization: OPENROUTE_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const feature = response.data.features[0];
    if (!feature) {
      throw new Error("No route found");
    }

    const properties = feature.properties;
    const geometry = feature.geometry;

    // Convert coordinates to polyline format
    const polylinePoints = encodePolyline(
      geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }))
    );

    // Calculate bounds
    const coordinates = geometry.coordinates;
    const lats = coordinates.map(([lng, lat]: [number, number]) => lat);
    const lngs = coordinates.map(([lng, lat]: [number, number]) => lng);

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
      routes: [
        {
          route_id: `ors_${Date.now()}`,
          summary: `${(properties.summary.distance / 1000).toFixed(1)} km, ${Math.round(
            properties.summary.duration / 60
          )} min`,
          overview_polyline: {
            points: polylinePoints,
          },
          bounds,
          legs: [
            {
              distance: {
                text: `${(properties.summary.distance / 1000).toFixed(1)} km`,
                value: properties.summary.distance,
              },
              duration: {
                text: `${Math.round(properties.summary.duration / 60)} min`,
                value: properties.summary.duration,
              },
              start_address: origin,
              end_address: destination,
              start_location: startCoords,
              end_location: endCoords,
              steps: [], // We can populate this if needed
            },
          ],
          fare: undefined,
          warnings: [],
          waypoint_order: [],
          copyrights: "© OpenStreetMap contributors",
        },
      ],
      status: "OK",
    };
  } catch (error) {
    console.error("OpenRouteService error:", error);
    throw error;
  }
}

/**
 * Search for apartments using Overpass API (deprecated - use getRouteAndApartments action instead)
 */
export async function searchApartmentsAlongRoute(
  polyline: string,
  maxResultCount = 500
): Promise<PlaceDetails[]> {
  console.warn(
    "searchApartmentsAlongRoute is deprecated. Use getRouteAndApartments action instead."
  );
  return [];
}

/**
 * Get place details using Overpass/Nominatim (deprecated - use place details API instead)
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const response = await fetch(
    `/api/placeDetails?id=${encodeURIComponent(placeId)}`
  );

  if (!response.ok) {
    throw new Error("Failed to get place details");
  }

  const data = await response.json();
  return data.place;
}

/**
 * Simple polyline encoding for OpenRouteService coordinates
 */
function encodePolyline(coordinates: LatLng[]): string {
  let encodedString = "";
  let lat = 0;
  let lng = 0;

  for (const coord of coordinates) {
    const latE5 = Math.round(coord.lat * 1e5);
    const lngE5 = Math.round(coord.lng * 1e5);

    const dLat = latE5 - lat;
    const dLng = lngE5 - lng;

    encodedString += encodeValue(dLat) + encodeValue(dLng);

    lat = latE5;
    lng = lngE5;
  }

  return encodedString;
}

function encodeValue(value: number): string {
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
 * Decode polyline to coordinates
 */
export function decodePolyline(encoded: string): LatLng[] {
  const poly: LatLng[] = [];
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

    poly.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return poly;
}

/**
 * Create bounds from points (MapLibre GL compatible)
 */
export function createBounds(
  points: LatLng[]
): [[number, number], [number, number]] {
  if (points.length === 0) {
    return [
      [-95.3698, 29.7604],
      [-95.3698, 29.7604],
    ]; // Houston center fallback
  }

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);

  return [
    [Math.min(...lngs), Math.min(...lats)], // southwest
    [Math.max(...lngs), Math.max(...lats)], // northeast
  ];
}

// Houston center coordinates
export const HOUSTON_CENTER: LatLng = {
  lat: 29.7604,
  lng: -95.3698,
};

// Default map options for MapLibre GL
export const DEFAULT_MAP_OPTIONS = {
  center: [-95.3698, 29.7604] as [number, number],
  zoom: 11,
  style: {
    version: 8,
    sources: {
      "osm-tiles": {
        type: "raster",
        tiles: [
          "https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "&copy; OpenStreetMap contributors, &copy; CartoDB",
      },
    },
    layers: [
      {
        id: "osm-dark",
        type: "raster",
        source: "osm-tiles",
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  },
};
