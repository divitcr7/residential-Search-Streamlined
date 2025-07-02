import { NextRequest, NextResponse } from "next/server";
import { placeDetailsCache } from "@/lib/cache/lru";
import { metrics } from "@/metrics/apartment";
import type { PlaceDetails } from "@/types";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

interface PlaceDetailsResponse {
  place: PlaceDetails;
  cached: boolean;
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

    // Fetch from Google Places API
    const url = "https://maps.googleapis.com/maps/api/place/details/json";
    const params = new URLSearchParams({
      place_id: placeId,
      fields:
        "place_id,name,formatted_address,geometry,rating,user_ratings_total,photos,website,url,formatted_phone_number,opening_hours,reviews",
      key: GOOGLE_MAPS_API_KEY,
    });

    const response = await fetch(`${url}?${params}`);

    if (!response.ok) {
      metrics.recordApiCall("place_details", "error");
      throw new Error(`Google Places API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "OK") {
      metrics.recordApiCall("place_details", "error");
      throw new Error(`Google Places API error: ${data.status}`);
    }

    metrics.recordApiCall("place_details", "success");

    const place: PlaceDetails = {
      place_id: data.result.place_id,
      name: data.result.name || "Unknown",
      formatted_address: data.result.formatted_address || "",
      geometry: {
        location: {
          lat: data.result.geometry?.location?.lat || 0,
          lng: data.result.geometry?.location?.lng || 0,
        },
      },
      rating: data.result.rating,
      user_ratings_total: data.result.user_ratings_total,
      photos:
        data.result.photos?.map((photo: any) => ({
          photo_reference: photo.photo_reference,
          height: photo.height,
          width: photo.width,
        })) || [],
      website: data.result.website,
      vicinity: data.result.vicinity,
    };

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
