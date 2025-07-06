import { NextRequest, NextResponse } from "next/server";
import { placeDetailsCache } from "@/lib/cache/lru";
import { metrics } from "@/metrics/apartment";
import type { PlaceDetails } from "@/types";
import axios from "axios";

interface PlaceDetailsResponse {
  place: PlaceDetails;
  cached: boolean;
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
 * Build address from OSM tags
 */
function buildAddress(tags: { [key: string]: string }): string {
  const parts: string[] = [];

  if (tags["addr:housenumber"]) parts.push(tags["addr:housenumber"]);
  if (tags["addr:street"]) parts.push(tags["addr:street"]);
  if (tags["addr:city"]) parts.push(tags["addr:city"]);
  if (tags["addr:state"]) parts.push(tags["addr:state"]);
  if (tags["addr:postcode"]) parts.push(tags["addr:postcode"]);

  return parts.join(" ") || "Address not available";
}

/**
 * Convert Overpass element to PlaceDetails
 */
function overpassElementToPlaceDetails(element: OverpassElement): PlaceDetails {
  const lat = element.lat || element.center?.lat || 0;
  const lng = element.lon || element.center?.lon || 0;
  const name =
    element.tags?.name || element.tags?.["addr:housename"] || "Building";
  const address = buildAddress(element.tags);

  return {
    place_id: `osm_${element.type}_${element.id}`,
    name,
    formatted_address: address,
    geometry: {
      location: { lat, lng },
    },
    rating: undefined,
    user_ratings_total: undefined,
    photos: [],
    website: element.tags?.website,
    vicinity: address,
  };
}

/**
 * Fetch place details from Overpass API
 */
async function fetchPlaceDetailsFromOverpass(
  placeId: string
): Promise<PlaceDetails | null> {
  try {
    // Parse the OSM place ID (format: osm_type_id)
    const parts = placeId.split("_");
    if (parts.length !== 3 || parts[0] !== "osm") {
      throw new Error("Invalid OSM place ID format");
    }

    const [, type, id] = parts;

    // Query Overpass API for the specific element
    const overpassQuery = `
      [out:json][timeout:25];
      (
        ${type}(${id});
      );
      out center meta;
    `;

    const response = await axios.post(
      "https://overpass-api.de/api/interpreter",
      overpassQuery,
      {
        headers: {
          "Content-Type": "text/plain",
          "User-Agent": "PropertyFinder/1.0",
        },
        timeout: 30000,
      }
    );

    const data: OverpassResponse = response.data;

    if (data.elements.length === 0) {
      return null;
    }

    const element = data.elements[0];
    return overpassElementToPlaceDetails(element);
  } catch (error) {
    console.error("Overpass API error:", error);
    return null;
  }
}

/**
 * Fallback to Nominatim for geocoding if Overpass fails
 */
async function fetchPlaceDetailsFromNominatim(
  query: string
): Promise<PlaceDetails | null> {
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search`,
      {
        params: {
          q: query,
          format: "json",
          limit: 1,
          addressdetails: 1,
          extratags: 1,
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
      place_id: `nominatim_${result.place_id}`,
      name: result.display_name || result.name || "Unknown Location",
      formatted_address: result.display_name || "Address not available",
      geometry: {
        location: {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
        },
      },
      rating: undefined,
      user_ratings_total: undefined,
      photos: [],
      website: result.extratags?.website,
      vicinity: result.display_name || "Address not available",
    };
  } catch (error) {
    console.error("Nominatim API error:", error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("id");

  if (!placeId) {
    return NextResponse.json(
      { error: "Place ID is required" },
      { status: 400 }
    );
  }

  try {
    // Check cache first
    const cached = placeDetailsCache.get(placeId);
    if (cached) {
      metrics.recordCacheHit("place_details", true);
      return NextResponse.json({
        place: cached,
        cached: true,
      } as PlaceDetailsResponse);
    }

    metrics.recordCacheHit("place_details", false);

    let place: PlaceDetails | null = null;

    // Try Overpass API first for OSM place IDs
    if (placeId.startsWith("osm_")) {
      place = await fetchPlaceDetailsFromOverpass(placeId);
      metrics.recordApiCall("place_details", place ? "success" : "error");
    }

    // Fallback to Nominatim if Overpass fails or for non-OSM IDs
    if (!place) {
      // If it's not an OSM ID, treat it as a search query
      const query = placeId.startsWith("osm_") ? placeId : placeId;
      place = await fetchPlaceDetailsFromNominatim(query);
      metrics.recordApiCall("place_details", place ? "success" : "error");
    }

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    // Cache the result
    placeDetailsCache.set(placeId, place);

    return NextResponse.json({
      place,
      cached: false,
    } as PlaceDetailsResponse);
  } catch (error) {
    console.error("Place details API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch place details" },
      { status: 500 }
    );
  }
}
