import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDistance(meters: number): string {
  const miles = meters * 0.000621371
  if (miles < 0.1) {
    return `${Math.round(meters)} ft`
  }
  return `${miles.toFixed(1)} mi`
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

export function getBucketFromDistance(distanceMeters: number): 1 | 2 | 3 {
  const miles = distanceMeters * 0.000621371
  if (miles <= 1) return 1
  if (miles <= 2) return 2
  return 3
}

export function getBucketColor(bucket: 1 | 2 | 3): string {
  switch (bucket) {
    case 1:
      return '#29d3c2' // accent-teal
    case 2:
      return '#fbbf24' // amber-400
    case 3:
      return '#f87171' // red-400
  }
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function getGoogleMapsDirectionsUrl(
  origin: string,
  destination: string,
  placeId?: string
): string {
  const baseUrl = 'https://www.google.com/maps/dir/'
  const params = new URLSearchParams()
  
  if (placeId) {
    params.set('destination_place_id', placeId)
    return `${baseUrl}${encodeURIComponent(origin)}/${encodeURIComponent(destination)}?${params.toString()}`
  }
  
  return `${baseUrl}${encodeURIComponent(origin)}/${encodeURIComponent(destination)}`
}

export function getPhotoUrl(photoReference: string, maxWidth = 400): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
}

export function generateCacheKey(...parts: string[]): string {
  return parts.join(':')
} 