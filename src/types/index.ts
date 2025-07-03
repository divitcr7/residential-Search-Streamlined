export type TravelMode = "DRIVE" | "WALK" | "BICYCLE" | "TRANSIT";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface LatLngBounds {
  northeast: LatLng;
  southwest: LatLng;
}

export interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: LatLng;
  };
  rating?: number;
  user_ratings_total?: number;
  photos?: {
    photo_reference: string;
    height: number;
    width: number;
  }[];
  website?: string;
  vicinity?: string;
}

export interface ApartmentListing {
  place: PlaceDetails;
  distanceToRoute: number;
  bucket: DistanceBucket;
  nearestTransitStep?: {
    type: string; // 'bus', 'subway', 'train', 'walking'
    line_name?: string;
    line_color?: string;
    distance_to_step: number;
  };
}

export interface RouteResult {
  routes: RouteOption[];
  status: string;
}

export interface RouteFormData {
  origin: string;
  destination: string;
  travelMode: TravelMode;
  maxDistance: DistanceBucket;
}

export interface MapRef {
  fitBounds: (bounds: google.maps.LatLngBounds) => void;
  addMarkers: (apartments: ApartmentListing[]) => void;
  highlightMarker: (placeId: string) => void;
  clearHighlight: () => void;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// NEW: Transit-specific types
export interface TransitDetails {
  departure_time: string;
  arrival_time: string;
  line: {
    color: string;
    name: string;
    short_name: string;
    vehicle: {
      type: string;
      name: string;
      icon: string;
    };
  };
  headsign: string;
  num_stops: number;
}

export interface RouteStep {
  travel_mode: string;
  distance: {
    text: string;
    value: number;
  };
  duration: {
    text: string;
    value: number;
  };
  html_instructions: string;
  polyline: {
    points: string;
  };
  transit?: TransitDetails;
  start_location: LatLng;
  end_location: LatLng;
}

export interface RouteLeg {
  distance: {
    text: string;
    value: number;
  };
  duration: {
    text: string;
    value: number;
  };
  start_address: string;
  end_address: string;
  start_location: LatLng;
  end_location: LatLng;
  steps: RouteStep[];
  departure_time?: {
    text: string;
    time_zone: string;
    value: number;
  };
  arrival_time?: {
    text: string;
    time_zone: string;
    value: number;
  };
}

export interface RouteOption {
  route_id: string;
  summary: string;
  overview_polyline: {
    points: string;
  };
  bounds: LatLngBounds;
  legs: RouteLeg[];
  fare?: {
    currency: string;
    text: string;
    value: number;
  };
  warnings: string[];
  waypoint_order: number[];
  copyrights: string;
}

export interface PlacePhoto {
  photo_reference: string;
  height: number;
  width: number;
}

export type DistanceBucket = "≤1mi" | "≤2mi" | "≤3mi";

export interface SearchResult {
  routeOptions: RouteOption[];
  selectedRoute?: RouteOption;
  apartments: {
    "≤1mi": ApartmentListing[];
    "≤2mi": ApartmentListing[];
    "≤3mi": ApartmentListing[];
  };
  totalFound: number;
}
