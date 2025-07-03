"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, Navigation, Car, Bike, User, Bus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { loadGoogleMaps, HOUSTON_CENTER } from "@/lib/maps";
import { cn } from "@/lib/utils";
import type { TravelMode, RouteFormData, DistanceBucket } from "@/types";

interface RouteFormProps {
  onSubmit: (data: RouteFormData) => void;
  isLoading?: boolean;
  className?: string;
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

export function RouteForm({
  onSubmit,
  isLoading = false,
  className,
}: RouteFormProps) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [travelMode, setTravelMode] = useState<TravelMode>("DRIVE");
  const [maxDistance, setMaxDistance] = useState<DistanceBucket>("≤2mi");
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);

  const originInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const originAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(
    null
  );
  const destinationAutocompleteRef =
    useRef<google.maps.places.Autocomplete | null>(null);

  // Allow manual input - skip Google Maps autocomplete for now
  useEffect(() => {
    // Just enable the inputs immediately
    setIsGoogleMapsLoaded(true);

    // Optional: Try to initialize autocomplete in background but don't block
    const initAutocomplete = async () => {
      try {
        await loadGoogleMaps();

        if (originInputRef.current) {
          originAutocompleteRef.current = new google.maps.places.Autocomplete(
            originInputRef.current,
            {
              types: ["establishment", "geocode"],
              bounds: new google.maps.LatLngBounds(
                new google.maps.LatLng(
                  HOUSTON_CENTER.lat - 0.5,
                  HOUSTON_CENTER.lng - 0.5
                ),
                new google.maps.LatLng(
                  HOUSTON_CENTER.lat + 0.5,
                  HOUSTON_CENTER.lng + 0.5
                )
              ),
              strictBounds: false,
            }
          );

          originAutocompleteRef.current.addListener("place_changed", () => {
            const place = originAutocompleteRef.current?.getPlace();
            if (place?.formatted_address) {
              setOrigin(place.formatted_address);
            }
          });
        }

        if (destinationInputRef.current) {
          destinationAutocompleteRef.current =
            new google.maps.places.Autocomplete(destinationInputRef.current, {
              types: ["establishment", "geocode"],
              bounds: new google.maps.LatLngBounds(
                new google.maps.LatLng(
                  HOUSTON_CENTER.lat - 0.5,
                  HOUSTON_CENTER.lng - 0.5
                ),
                new google.maps.LatLng(
                  HOUSTON_CENTER.lat + 0.5,
                  HOUSTON_CENTER.lng + 0.5
                )
              ),
              strictBounds: false,
            });

          destinationAutocompleteRef.current.addListener(
            "place_changed",
            () => {
              const place = destinationAutocompleteRef.current?.getPlace();
              if (place?.formatted_address) {
                setDestination(place.formatted_address);
              }
            }
          );
        }
      } catch (error) {
        console.log("Autocomplete not available, using manual input");
      }
    };

    initAutocomplete();

    return () => {
      try {
        if (originAutocompleteRef.current) {
          google.maps.event.clearInstanceListeners(
            originAutocompleteRef.current
          );
        }
        if (destinationAutocompleteRef.current) {
          google.maps.event.clearInstanceListeners(
            destinationAutocompleteRef.current
          );
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    };
  }, []);

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

  const handleOriginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setOrigin(value);
  };

  const handleDestinationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDestination(value);
  };

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
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-muted-foreground z-10" />
                <Input
                  ref={originInputRef}
                  placeholder="Origin (e.g., Rice University)"
                  value={origin}
                  onChange={handleOriginChange}
                  className="pl-11 bg-background/60 backdrop-blur-sm border-white/20"
                />
              </div>

              <div className="relative">
                <Navigation className="absolute left-3 top-3 h-5 w-5 text-muted-foreground z-10" />
                <Input
                  ref={destinationInputRef}
                  placeholder="Destination (e.g., Houston Downtown)"
                  value={destination}
                  onChange={handleDestinationChange}
                  className="pl-11 bg-background/60 backdrop-blur-sm border-white/20"
                />
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
                        "flex items-center justify-center gap-2 p-3 rounded-lg border transition-all duration-120 hover:scale-105 active:scale-95 backdrop-blur-sm",
                        maxDistance === distance
                          ? "bg-accent-teal text-charcoal border-accent-teal shadow-lg"
                          : "bg-background/60 border-white/20 hover:bg-background/70 hover:text-accent-foreground"
                      )}
                    >
                      <span className="text-sm font-semibold">{distance}</span>
                    </button>
                  )
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {maxDistance === "≤1mi" &&
                  "Comprehensive search • Every apartment within 1 mile"}
                {maxDistance === "≤2mi" &&
                  "Ultra-dense search • Every apartment within 2 miles"}
                {maxDistance === "≤3mi" &&
                  "Maximum coverage • Every single apartment within 3 miles"}
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                Travel Mode
              </label>
              <div className="grid grid-cols-4 gap-2">
                {travelModes.map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTravelMode(mode)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-120 hover:scale-105 active:scale-95 backdrop-blur-sm",
                      travelMode === mode
                        ? "bg-accent-teal text-charcoal border-accent-teal shadow-lg"
                        : "bg-background/60 border-white/20 hover:bg-background/70 hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              variant="accent"
              size="lg"
              className="w-full backdrop-blur-sm"
              disabled={
                !origin.trim() ||
                !destination.trim() ||
                !isGoogleMapsLoaded ||
                isLoading
              }
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Finding Apartments...
                </div>
              ) : (
                "Find Apartments Along Route"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
