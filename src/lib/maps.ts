import { Loader } from '@googlemaps/js-api-loader'
import type { TravelMode, LatLng, RouteResult, PlaceDetails } from '@/types'

const loader = new Loader({
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  version: 'weekly',
  libraries: ['places', 'geometry'],
})

export async function loadGoogleMaps() {
  return loader.load()
}

export async function computeRoute(
  origin: string,
  destination: string,
  travelMode: TravelMode
): Promise<RouteResult> {
  const response = await fetch('/api/routes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      origin,
      destination,
      travelMode,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to compute route')
  }

  return response.json()
}

export async function searchApartmentsAlongRoute(
  polyline: string,
  maxResultCount = 60
): Promise<PlaceDetails[]> {
  const response = await fetch('/api/search-along-route', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      polyline,
      maxResultCount,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to search apartments')
  }

  const data = await response.json()
  return data.places || []
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const response = await fetch('/api/place-details', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      placeId,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to get place details')
  }

  return response.json()
}

export function decodePolyline(encoded: string): LatLng[] {
  const poly: LatLng[] = []
  let index = 0
  const len = encoded.length
  let lat = 0
  let lng = 0

  while (index < len) {
    let b: number
    let shift = 0
    let result = 0

    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)

    const dlat = result & 1 ? ~(result >> 1) : result >> 1
    lat += dlat

    shift = 0
    result = 0

    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)

    const dlng = result & 1 ? ~(result >> 1) : result >> 1
    lng += dlng

    poly.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    })
  }

  return poly
}

export function createBounds(points: LatLng[]): google.maps.LatLngBounds {
  const bounds = new google.maps.LatLngBounds()
  points.forEach((point) => {
    bounds.extend(new google.maps.LatLng(point.lat, point.lng))
  })
  return bounds
}

export const HOUSTON_CENTER: LatLng = {
  lat: 29.7604,
  lng: -95.3698,
}

export const DEFAULT_MAP_OPTIONS: google.maps.MapOptions = {
  zoom: 11,
  center: HOUSTON_CENTER,
  styles: [
    {
      featureType: 'all',
      elementType: 'geometry.fill',
      stylers: [{ weight: '2.00' }],
    },
    {
      featureType: 'all',
      elementType: 'geometry.stroke',
      stylers: [{ color: '#9c9c9c' }],
    },
    {
      featureType: 'all',
      elementType: 'labels.text',
      stylers: [{ visibility: 'on' }],
    },
    {
      featureType: 'landscape',
      elementType: 'all',
      stylers: [{ color: '#f2f2f2' }],
    },
    {
      featureType: 'landscape',
      elementType: 'geometry.fill',
      stylers: [{ color: '#ffffff' }],
    },
    {
      featureType: 'landscape.man_made',
      elementType: 'geometry.fill',
      stylers: [{ color: '#ffffff' }],
    },
    {
      featureType: 'poi',
      elementType: 'all',
      stylers: [{ visibility: 'off' }],
    },
    {
      featureType: 'road',
      elementType: 'all',
      stylers: [{ saturation: -100 }, { lightness: 45 }],
    },
    {
      featureType: 'road',
      elementType: 'geometry.fill',
      stylers: [{ color: '#eeeeee' }],
    },
    {
      featureType: 'road',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#7b7b7b' }],
    },
    {
      featureType: 'road',
      elementType: 'labels.text.stroke',
      stylers: [{ color: '#ffffff' }],
    },
    {
      featureType: 'road.highway',
      elementType: 'all',
      stylers: [{ visibility: 'simplified' }],
    },
    {
      featureType: 'road.arterial',
      elementType: 'labels.icon',
      stylers: [{ visibility: 'off' }],
    },
    {
      featureType: 'transit',
      elementType: 'all',
      stylers: [{ visibility: 'off' }],
    },
    {
      featureType: 'water',
      elementType: 'all',
      stylers: [{ color: '#46bcec' }, { visibility: 'on' }],
    },
    {
      featureType: 'water',
      elementType: 'geometry.fill',
      stylers: [{ color: '#c8d7d4' }],
    },
    {
      featureType: 'water',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#070707' }],
    },
    {
      featureType: 'water',
      elementType: 'labels.text.stroke',
      stylers: [{ color: '#ffffff' }],
    },
  ],
  disableDefaultUI: true,
  zoomControl: true,
  mapTypeControl: false,
  scaleControl: false,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: false,
} 