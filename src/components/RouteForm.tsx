"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, Navigation, Car, Bike, User, Bus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TravelMode, RouteFormData, DistanceBucket } from "@/types";
import axios from "axios";

interface RouteFormProps {
  onSubmit: (data: RouteFormData) => void;
  isLoading?: boolean;
  className?: string;
}

interface NominatimResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
}

const travelModes: Array<{
  mode: TravelMode;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}> = [
  { mode: "DRIVE", icon: Car, label: "Drive" },
  { mode: "TRANSIT", icon: Bus, label: "Transit" },
  { mode: "BICYCLE", icon: Bike, label: "Bike" },
  { mode: "WALK", icon: User, label: "Walk" },
];

const HOUSTON_CENTER = { lat: 29.7604, lng: -95.3698 };

export function RouteForm({
  onSubmit,
  isLoading = false,
  className,
}: RouteFormProps) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [travelMode, setTravelMode] = useState<TravelMode>("DRIVE");
  const [maxDistance, setMaxDistance] = useState<DistanceBucket>("≤2mi");

  // Autocomplete states
  const [originSuggestions, setOriginSuggestions] = useState<NominatimResult[]>(
    []
  );
  const [destinationSuggestions, setDestinationSuggestions] = useState<
    NominatimResult[]
  >([]);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] =
    useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const originInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const originSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const destinationSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Search for places using Nominatim API
   */
  const searchPlaces = async (query: string): Promise<NominatimResult[]> => {
    if (!query.trim() || query.length < 3) {
      return [];
    }

    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search`,
        {
          params: {
            q: query,
            format: "json",
            limit: 5,
            addressdetails: 1,
            bounded: 1,
            viewbox: `${HOUSTON_CENTER.lng - 1},${HOUSTON_CENTER.lat - 1},${HOUSTON_CENTER.lng + 1},${HOUSTON_CENTER.lat + 1}`,
            countrycodes: "us",
          },
          headers: {
            "User-Agent": "PropertyFinder/1.0",
          },
        }
      );

      return response.data.map((result: any) => ({
        place_id: result.place_id,
        display_name: result.display_name,
        lat: result.lat,
        lon: result.lon,
        type: result.type,
        class: result.class,
      }));
    } catch (error) {
      console.error("Nominatim search error:", error);
      return [];
    }
  };

  /**
   * Handle origin input changes with debounced search
   */
  const handleOriginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setOrigin(value);

    // Clear existing timeout
    if (originSearchTimeoutRef.current) {
      clearTimeout(originSearchTimeoutRef.current);
    }

    if (value.length >= 3) {
      setIsSearching(true);
      // Debounce the search
      originSearchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await searchPlaces(value);
          setOriginSuggestions(results);
          setShowOriginSuggestions(true);
        } catch (error) {
          console.error("Origin search error:", error);
        } finally {
          setIsSearching(false);
        }
      }, 300); // 300ms delay
    } else {
      setOriginSuggestions([]);
      setShowOriginSuggestions(false);
      setIsSearching(false);
    }
  };

  /**
   * Handle destination input changes with debounced search
   */
  const handleDestinationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDestination(value);

    // Clear existing timeout
    if (destinationSearchTimeoutRef.current) {
      clearTimeout(destinationSearchTimeoutRef.current);
    }

    if (value.length >= 3) {
      setIsSearching(true);
      // Debounce the search
      destinationSearchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await searchPlaces(value);
          setDestinationSuggestions(results);
          setShowDestinationSuggestions(true);
        } catch (error) {
          console.error("Destination search error:", error);
        } finally {
          setIsSearching(false);
        }
      }, 300); // 300ms delay
    } else {
      setDestinationSuggestions([]);
      setShowDestinationSuggestions(false);
      setIsSearching(false);
    }
  };

  /**
   * Handle origin suggestion selection
   */
  const handleOriginSuggestionClick = (suggestion: NominatimResult) => {
    setOrigin(suggestion.display_name);
    setShowOriginSuggestions(false);
    setOriginSuggestions([]);
  };

  /**
   * Handle destination suggestion selection
   */
  const handleDestinationSuggestionClick = (suggestion: NominatimResult) => {
    setDestination(suggestion.display_name);
    setShowDestinationSuggestions(false);
    setDestinationSuggestions([]);
  };

  /**
   * Handle form submission
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (origin.trim() && destination.trim()) {
      onSubmit({
        origin: origin.trim(),
        destination: destination.trim(),
        travelMode,
        maxDistance,
      });
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        originInputRef.current &&
        !originInputRef.current.contains(event.target as Node)
      ) {
        setShowOriginSuggestions(false);
      }
      if (
        destinationInputRef.current &&
        !destinationInputRef.current.contains(event.target as Node)
      ) {
        setShowDestinationSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (originSearchTimeoutRef.current) {
        clearTimeout(originSearchTimeoutRef.current);
      }
      if (destinationSearchTimeoutRef.current) {
        clearTimeout(destinationSearchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("w-full max-w-md", className)}
    >
      <Card className="backdrop-blur-xl bg-background/40 border-white/30 shadow-2xl">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              {/* Origin Input */}
              <div className="relative" ref={originInputRef}>
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-muted-foreground z-10" />
                <Input
                  placeholder="Origin (e.g., Rice University)"
                  value={origin}
                  onChange={handleOriginChange}
                  className="pl-11 bg-background/60 backdrop-blur-sm border-white/20"
                  autoComplete="off"
                />

                {/* Origin Suggestions */}
                {showOriginSuggestions && originSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background/95 backdrop-blur-sm border border-white/20 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {originSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.place_id}
                        type="button"
                        className="w-full px-4 py-2 text-left hover:bg-white/10 transition-colors border-b border-white/10 last:border-b-0"
                        onClick={() => handleOriginSuggestionClick(suggestion)}
                      >
                        <div className="text-sm font-medium text-foreground">
                          {suggestion.display_name}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Destination Input */}
              <div className="relative" ref={destinationInputRef}>
                <Navigation className="absolute left-3 top-3 h-5 w-5 text-muted-foreground z-10" />
                <Input
                  placeholder="Destination (e.g., Houston Downtown)"
                  value={destination}
                  onChange={handleDestinationChange}
                  className="pl-11 bg-background/60 backdrop-blur-sm border-white/20"
                  autoComplete="off"
                />

                {/* Destination Suggestions */}
                {showDestinationSuggestions &&
                  destinationSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background/95 backdrop-blur-sm border border-white/20 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {destinationSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.place_id}
                          type="button"
                          className="w-full px-4 py-2 text-left hover:bg-white/10 transition-colors border-b border-white/10 last:border-b-0"
                          onClick={() =>
                            handleDestinationSuggestionClick(suggestion)
                          }
                        >
                          <div className="text-sm font-medium text-foreground">
                            {suggestion.display_name}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
              </div>

              {/* Fixed height search indicator to prevent layout shift */}
              <div className="h-6 flex items-center justify-center">
                {isSearching && (
                  <div className="text-center text-sm text-muted-foreground">
                    Searching locations...
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                Max Distance from Route
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["≤1mi", "≤2mi", "≤3mi"] as DistanceBucket[]).map(
                  (distance) => (
                    <button
                      key={distance}
                      type="button"
                      onClick={() => setMaxDistance(distance)}
                      className={cn(
                        "px-3 py-2 text-sm rounded-md transition-colors",
                        maxDistance === distance
                          ? "bg-primary text-primary-foreground"
                          : "bg-background/60 backdrop-blur-sm border-white/20 hover:bg-white/10"
                      )}
                    >
                      {distance}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                Travel Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                {travelModes.map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTravelMode(mode)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                      travelMode === mode
                        ? "bg-primary text-primary-foreground"
                        : "bg-background/60 backdrop-blur-sm border-white/20 hover:bg-white/10"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              disabled={!origin.trim() || !destination.trim() || isLoading}
              className="w-full bg-primary hover:bg-primary/90 transition-colors"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-2" />
                  Searching...
                </>
              ) : (
                "Find Route & Apartments"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
