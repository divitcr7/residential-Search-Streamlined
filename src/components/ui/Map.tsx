"use client";

import React, { useRef, useEffect } from "react";
import {
  loadGoogleMaps,
  DEFAULT_MAP_OPTIONS,
  HOUSTON_CENTER,
  decodePolyline,
} from "@/lib/maps";
import type { RouteOption, ApartmentListing } from "@/types";

interface ApartmentMarker {
  id: string;
  position: { lat: number; lng: number };
  title: string;
  apartment: ApartmentListing;
}

interface MapProps {
  route?: RouteOption;
  apartments?: ApartmentMarker[];
  highlightedApartmentId?: string | null;
  onApartmentMarkerClick?: (apartmentId: string) => void;
  isLoading?: boolean;
  className?: string;
}

function getBucketColor(bucket: string): string {
  switch (bucket) {
    case "≤1mi":
      return "#10b981"; // green
    case "≤2mi":
      return "#f59e0b"; // amber
    case "≤3mi":
      return "#ef4444"; // red
    default:
      return "#6b7280"; // gray
  }
}

export function Map({
  route,
  apartments = [],
  highlightedApartmentId,
  onApartmentMarkerClick,
  isLoading = false,
  className = "",
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<globalThis.Map<string, google.maps.Marker>>(
    new globalThis.Map()
  );
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  // Initialize map
  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current) return;

      try {
        await loadGoogleMaps();

        googleMapRef.current = new google.maps.Map(mapRef.current, {
          ...DEFAULT_MAP_OPTIONS,
          center: HOUSTON_CENTER,
          zoom: 10,
        });

        // Add Google attribution
        const attribution = document.createElement("div");
        attribution.innerHTML = "© Google | Map data © 2025 Google";
        attribution.style.cssText = `
          position: absolute;
          bottom: 8px;
          right: 8px;
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          z-index: 1000;
          pointer-events: none;
        `;
        mapRef.current.appendChild(attribution);
      } catch (error) {
        console.error("Failed to initialize Google Maps:", error);
      }
    };

    initMap();
  }, []);

  // Update route polyline
  useEffect(() => {
    if (!googleMapRef.current || !route) return;

    // Clear existing polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }

    try {
      // Decode the route polyline
      const decodedPath = decodePolyline(route.overview_polyline.points);
      const polylinePath = decodedPath.map(
        (point) => new google.maps.LatLng(point.lat, point.lng)
      );

      // Create route polyline
      polylineRef.current = new google.maps.Polyline({
        path: polylinePath,
        geodesic: true,
        strokeColor: "#29d3c2", // accent-teal
        strokeOpacity: 1.0,
        strokeWeight: 4,
        map: googleMapRef.current,
      });

      // Fit bounds to route
      const bounds = new google.maps.LatLngBounds();
      decodedPath.forEach((point) => {
        bounds.extend(new google.maps.LatLng(point.lat, point.lng));
      });

      // Include apartment markers in bounds
      apartments.forEach((apartment) => {
        bounds.extend(
          new google.maps.LatLng(apartment.position.lat, apartment.position.lng)
        );
      });

      googleMapRef.current.fitBounds(bounds);
    } catch (error) {
      console.error("Failed to decode route polyline:", error);
    }
  }, [route, apartments]);

  // Update apartment markers
  useEffect(() => {
    if (!googleMapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current.clear();

    // Add new markers
    apartments.forEach((apartmentMarker) => {
      const { apartment } = apartmentMarker;
      const bucketColor = getBucketColor(apartment.bucket);

      const marker = new google.maps.Marker({
        position: apartmentMarker.position,
        map: googleMapRef.current!,
        title: apartmentMarker.title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: bucketColor,
          fillOpacity: 0.8,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 10,
        },
        zIndex:
          apartment.bucket === "≤1mi" ? 3 : apartment.bucket === "≤2mi" ? 2 : 1,
      });

      // Add click listener
      marker.addListener("click", () => {
        if (onApartmentMarkerClick) {
          onApartmentMarkerClick(apartmentMarker.id);
        }
      });

      markersRef.current.set(apartmentMarker.id, marker);
    });
  }, [apartments, onApartmentMarkerClick]);

  // Handle highlighted apartment
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const isHighlighted = id === highlightedApartmentId;

      if (isHighlighted) {
        marker.setZIndex(1000);
        marker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#29d3c2", // accent-teal
          fillOpacity: 1.0,
          strokeColor: "#ffffff",
          strokeWeight: 3,
          scale: 14,
        });
      } else {
        // Reset to original style
        const apartmentMarker = apartments.find((apt) => apt.id === id);
        if (apartmentMarker) {
          const bucketColor = getBucketColor(apartmentMarker.apartment.bucket);
          marker.setZIndex(
            apartmentMarker.apartment.bucket === "≤1mi"
              ? 3
              : apartmentMarker.apartment.bucket === "≤2mi"
                ? 2
                : 1
          );
          marker.setIcon({
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: bucketColor,
            fillOpacity: 0.8,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: 10,
          });
        }
      }
    });
  }, [highlightedApartmentId, apartments]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div ref={mapRef} className="w-full h-full" />

      {isLoading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
          <div className="flex items-center gap-2 bg-background/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-border">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-teal border-t-transparent" />
            <span className="text-sm font-medium">Loading map...</span>
          </div>
        </div>
      )}
    </div>
  );
}
