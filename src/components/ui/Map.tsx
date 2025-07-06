"use client";

import React, { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
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

/**
 * Decode polyline to coordinates
 */
function decodePolyline(encoded: string): [number, number][] {
  const poly: [number, number][] = [];
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

    poly.push([lng / 1e5, lat / 1e5]);
  }

  return poly;
}

const HOUSTON_CENTER: [number, number] = [-95.3698, 29.7604];

// Map style using OpenStreetMap
const MAP_STYLE = {
  version: 8,
  sources: {
    "osm-tiles": {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm-tiles",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
} as maplibregl.StyleSpecification;

// Dark theme map style
const DARK_MAP_STYLE = {
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
} as maplibregl.StyleSpecification;

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
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<globalThis.Map<string, maplibregl.Marker>>(
    new globalThis.Map<string, maplibregl.Marker>()
  );
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapRef.current) return;

    try {
      console.log("Initializing MapLibre GL map...");

      const map = new maplibregl.Map({
        container: mapRef.current,
        style: DARK_MAP_STYLE,
        center: HOUSTON_CENTER,
        zoom: route ? 10 : 11,
        interactive: !hideControls,
        attributionControl: { compact: false },
      });

      if (!hideControls) {
        map.addControl(new maplibregl.NavigationControl({}), "top-right");
        map.addControl(
          new maplibregl.ScaleControl({ unit: "metric" }),
          "bottom-left"
        );
      }

      map.on("load", () => {
        console.log("MapLibre GL map loaded successfully");
        setMapLoaded(true);
      });

      map.on("error", (e: any) => {
        console.error("MapLibre GL error:", e);
      });

      mapInstanceRef.current = map;

      return () => {
        map.remove();
        mapInstanceRef.current = null;
      };
    } catch (error) {
      console.error("Failed to initialize MapLibre GL:", error);
    }
  }, [route, hideControls]);

  // Update route polyline
  useEffect(() => {
    if (!mapInstanceRef.current || !route || !mapLoaded) return;

    const map = mapInstanceRef.current;

    try {
      // Remove existing route layer if it exists
      if (map.getLayer("route")) {
        map.removeLayer("route");
      }
      if (map.getSource("route")) {
        map.removeSource("route");
      }

      // Decode polyline and create GeoJSON
      const coordinates = decodePolyline(route.overview_polyline.points);

      const routeGeoJSON = {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates,
        },
      };

      // Add route source and layer
      map.addSource("route", {
        type: "geojson",
        data: routeGeoJSON,
      });

      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#3b82f6",
          "line-width": 4,
          "line-opacity": 0.8,
        },
      });

      // Fit map to route bounds
      const bounds = new maplibregl.LngLatBounds();
      coordinates.forEach(([lng, lat]) => {
        bounds.extend([lng, lat]);
      });

      map.fitBounds(bounds, {
        padding: 50,
        duration: 1000,
      });

      console.log("Route polyline added to map");
    } catch (error) {
      console.error("Failed to add route to map:", error);
    }
  }, [route, mapLoaded]);

  // Update apartment markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;

    const map = mapInstanceRef.current;

    try {
      // Clear existing markers
      markersRef.current.forEach((marker) => {
        marker.remove();
      });
      markersRef.current.clear();

      // Add new markers
      apartments.forEach((apartment) => {
        const { position, title, apartment: apt } = apartment;
        const color = getBucketColor(apt.bucket);

        // Create marker element
        const markerElement = document.createElement("div");
        markerElement.className = "apartment-marker";
        markerElement.style.cssText = `
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background-color: ${color};
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: all 0.2s ease;
        `;

        // Add hover effect
        markerElement.addEventListener("mouseenter", () => {
          markerElement.style.transform = "scale(1.5)";
          markerElement.style.zIndex = "1000";
        });

        markerElement.addEventListener("mouseleave", () => {
          markerElement.style.transform = "scale(1)";
          markerElement.style.zIndex = "1";
        });

        // Add click handler
        markerElement.addEventListener("click", () => {
          if (onApartmentMarkerClick) {
            onApartmentMarkerClick(apartment.id);
          }
        });

        // Create marker
        const marker = new maplibregl.Marker({
          element: markerElement,
        })
          .setLngLat([position.lng, position.lat])
          .addTo(map);

        // Add popup
        const popup = new maplibregl.Popup({
          offset: 25,
          closeButton: false,
          closeOnClick: false,
        }).setHTML(`
          <div class="apartment-popup">
            <h3 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600;">${title}</h3>
            <p style="margin: 0; font-size: 12px; color: #666;">${apt.distanceToRoute.toFixed(1)} mi from route</p>
          </div>
        `);

        marker.setPopup(popup);
        markersRef.current.set(apartment.id, marker);
      });

      console.log(`Added ${apartments.length} apartment markers to map`);
    } catch (error) {
      console.error("Failed to add apartment markers:", error);
    }
  }, [apartments, mapLoaded, onApartmentMarkerClick]);

  // Handle highlighted apartment
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;

    markersRef.current.forEach((marker, id) => {
      const element = marker.getElement();
      if (id === highlightedApartmentId) {
        element.style.transform = "scale(1.8)";
        element.style.zIndex = "1000";
        element.style.boxShadow = "0 4px 8px rgba(0,0,0,0.4)";
        marker.getPopup()?.addTo(mapInstanceRef.current!);
      } else {
        element.style.transform = "scale(1)";
        element.style.zIndex = "1";
        element.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
        marker.getPopup()?.remove();
      }
    });
  }, [highlightedApartmentId, mapLoaded]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`relative ${className}`}>
        <div className="absolute inset-0 bg-gray-900 rounded-lg flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p>Loading map...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div
        ref={mapRef}
        className="w-full h-full min-h-[400px] rounded-lg overflow-hidden"
        style={{ background: "#1a1a1a" }}
      />

      {/* Map attribution */}
      <div className="absolute bottom-2 right-2 text-xs text-gray-400 bg-black bg-opacity-60 px-2 py-1 rounded">
        © OpenStreetMap contributors
      </div>

      {/* Loading indicator */}
      {!mapLoaded && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-75 rounded-lg flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p>Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
}
