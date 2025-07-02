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
  hideControls?: boolean;
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
  hideControls = false,
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<globalThis.Map<string, google.maps.Marker>>(
    new globalThis.Map()
  );
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  // Initialize Google Maps (try real maps first, fallback if needed)
  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current) return;

      try {
        console.log("Loading Google Maps for map display...");
        await loadGoogleMaps();

        const mapOptions = {
          ...DEFAULT_MAP_OPTIONS,
          center: HOUSTON_CENTER,
          zoom: route ? 12 : 11,
          backgroundColor: "#1a1a1a",
          // Disable controls when hideControls is true
          zoomControl: !hideControls,
          mapTypeControl: false,
          scaleControl: false,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: false,
          gestureHandling: hideControls ? "none" : "auto",
          draggable: !hideControls,
          scrollwheel: !hideControls,
          disableDoubleClickZoom: hideControls,
        };

        console.log("Creating Google Map...");
        googleMapRef.current = new google.maps.Map(mapRef.current, mapOptions);

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

        console.log("Google Maps initialized successfully");
      } catch (error) {
        console.error("Failed to initialize Google Maps:", error);

        // Show dark fallback only if Google Maps fails
        if (mapRef.current) {
          mapRef.current.style.backgroundColor = "#1a1a1a";
          mapRef.current.style.backgroundImage = `
            linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 25%, #1a1a1a 50%, #263c3f 75%, #1a1a1a 100%),
            radial-gradient(circle at 30% 40%, rgba(116, 104, 85, 0.3) 0%, transparent 30%),
            radial-gradient(circle at 70% 60%, rgba(23, 38, 60, 0.4) 0%, transparent 40%),
            radial-gradient(circle at 20% 80%, rgba(38, 65, 79, 0.2) 0%, transparent 35%),
            linear-gradient(45deg, transparent 30%, rgba(56, 65, 78, 0.1) 50%, transparent 70%),
            linear-gradient(-45deg, transparent 40%, rgba(116, 104, 85, 0.05) 60%, transparent 80%)
          `;

          // Add Houston-like map features
          mapRef.current.innerHTML = `
            <!-- Water areas (Buffalo Bayou, etc) -->
            <div style="
              position: absolute;
              top: 60%;
              left: 10%;
              width: 80%;
              height: 8px;
              background: #17263c;
              border-radius: 20px;
              opacity: 0.8;
            "></div>
            <div style="
              position: absolute;
              top: 40%;
              left: 60%;
              width: 35%;
              height: 6px;
              background: #17263c;
              border-radius: 15px;
              opacity: 0.6;
              transform: rotate(-15deg);
            "></div>
            
            <!-- Road network -->
            <div style="
              position: absolute;
              top: 50%;
              left: 0;
              width: 100%;
              height: 2px;
              background: linear-gradient(90deg, transparent, #38414e, #38414e, transparent);
              opacity: 0.8;
            "></div>
            <div style="
              position: absolute;
              top: 0;
              left: 50%;
              width: 2px;
              height: 100%;
              background: linear-gradient(180deg, transparent, #38414e, #38414e, transparent);
              opacity: 0.8;
            "></div>
            <div style="
              position: absolute;
              top: 30%;
              left: 20%;
              width: 60%;
              height: 1px;
              background: linear-gradient(90deg, transparent, #746855, transparent);
              opacity: 0.6;
              transform: rotate(25deg);
            "></div>
            
            <!-- Downtown area indicator -->
            <div style="
              position: absolute;
              top: 45%;
              left: 48%;
              width: 8px;
              height: 8px;
              background: rgba(213, 149, 99, 0.4);
              border-radius: 50%;
              box-shadow: 0 0 20px rgba(213, 149, 99, 0.3);
            "></div>
          `;
        }
      }
    };

    initMap();
  }, [route, hideControls]);

  // Update route polyline
  useEffect(() => {
    if (!googleMapRef.current || !route) {
      console.log("No map or route available for polyline");
      return;
    }

    console.log("Drawing route polyline for route:", route.route_id);

    // Clear existing polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }

    try {
      // Decode the route polyline
      const decodedPath = decodePolyline(route.overview_polyline.points);
      console.log(`Decoded ${decodedPath.length} points for route`);

      const polylinePath = decodedPath.map(
        (point) => new google.maps.LatLng(point.lat, point.lng)
      );

      // Create route polyline with bright visible color
      polylineRef.current = new google.maps.Polyline({
        path: polylinePath,
        geodesic: true,
        strokeColor: "#29d3c2", // bright teal
        strokeOpacity: 0.9,
        strokeWeight: 6, // Make it thicker so it's more visible
        zIndex: 1000, // Put it on top
        map: googleMapRef.current,
      });

      console.log("Route polyline created and added to map");

      // Fit bounds to route with padding
      const bounds = new google.maps.LatLngBounds();
      decodedPath.forEach((point) => {
        bounds.extend(new google.maps.LatLng(point.lat, point.lng));
      });

      // Include apartment markers in bounds if any
      apartments.forEach((apartment) => {
        bounds.extend(
          new google.maps.LatLng(apartment.position.lat, apartment.position.lng)
        );
      });

      // Fit bounds with padding
      googleMapRef.current.fitBounds(bounds, {
        top: 50,
        right: 50,
        bottom: 50,
        left: 50,
      });

      console.log("Map bounds fitted to route");
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
      <div
        ref={mapRef}
        className="w-full h-full"
        style={{
          minHeight: "100vh",
          backgroundColor: "#1a1a1a",
        }}
      />

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
