import { Loader } from "@googlemaps/js-api-loader";
import type { TravelMode, LatLng, RouteResult, PlaceDetails } from "@/types";

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const loader = apiKey
  ? new Loader({
      apiKey: apiKey,
      version: "weekly",
      libraries: ["places", "geometry"],
    })
  : null;

export async function loadGoogleMaps() {
  if (!loader || !apiKey) {
    throw new Error("Google Maps API key not configured");
  }
  return loader.load();
}

export async function computeRoute(
  origin: string,
  destination: string,
  travelMode: TravelMode
): Promise<RouteResult> {
  const response = await fetch("/api/routes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      origin,
      destination,
      travelMode,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to compute route");
  }

  return response.json();
}

export async function searchApartmentsAlongRoute(
  polyline: string,
  maxResultCount = 500 // Increased for comprehensive coverage
): Promise<PlaceDetails[]> {
  const response = await fetch("/api/search-along-route", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      polyline,
      maxResultCount,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to search apartments");
  }

  const data = await response.json();
  return data.places || [];
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const response = await fetch("/api/place-details", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      placeId,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to get place details");
  }

  return response.json();
}

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

export function createBounds(points: LatLng[]): google.maps.LatLngBounds {
  const bounds = new google.maps.LatLngBounds();
  points.forEach((point) => {
    bounds.extend(new google.maps.LatLng(point.lat, point.lng));
  });
  return bounds;
}

export const HOUSTON_CENTER: LatLng = {
  lat: 29.7604,
  lng: -95.3698,
};

export const DEFAULT_MAP_OPTIONS: google.maps.MapOptions = {
  zoom: 11,
  center: HOUSTON_CENTER,
  styles: [
    // Dark theme map styles
    {
      elementType: "geometry",
      stylers: [{ color: "#1a1a1a" }],
    },
    {
      elementType: "labels.text.stroke",
      stylers: [{ color: "#1a1a1a" }],
    },
    {
      elementType: "labels.text.fill",
      stylers: [{ color: "#746855" }],
    },
    {
      featureType: "administrative.locality",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "poi",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ color: "#263c3f" }],
    },
    {
      featureType: "poi.park",
      elementType: "labels.text.fill",
      stylers: [{ color: "#6b9a76" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#38414e" }],
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: "#212a37" }],
    },
    {
      featureType: "road",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9ca5b3" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [{ color: "#746855" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry.stroke",
      stylers: [{ color: "#1f2835" }],
    },
    {
      featureType: "road.highway",
      elementType: "labels.text.fill",
      stylers: [{ color: "#f3d19c" }],
    },
    {
      featureType: "transit",
      elementType: "geometry",
      stylers: [{ color: "#2f3948" }],
    },
    {
      featureType: "transit.station",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#17263c" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.fill",
      stylers: [{ color: "#515c6d" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.stroke",
      stylers: [{ color: "#17263c" }],
    },
  ],
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  scaleControl: false,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: false,
};
