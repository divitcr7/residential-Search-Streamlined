"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, Navigation, Car, Bike, User, Bus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { loadGoogleMaps, HOUSTON_CENTER } from "@/lib/maps";
import { cn } from "@/lib/utils";
import type { TravelMode, RouteFormData } from "@/types";

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
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);

  const originInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const originAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(
    null
  );
  const destinationAutocompleteRef =
    useRef<google.maps.places.Autocomplete | null>(null);

  // Load Google Maps and initialize autocomplete
  useEffect(() => {
    const initAutocomplete = async () => {
      try {
        await loadGoogleMaps();
        setIsGoogleMapsLoaded(true);

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
        console.error("Failed to initialize Google Maps autocomplete:", error);
      }
    };

    initAutocomplete();

    return () => {
      if (originAutocompleteRef.current) {
        google.maps.event.clearInstanceListeners(originAutocompleteRef.current);
      }
      if (destinationAutocompleteRef.current) {
        google.maps.event.clearInstanceListeners(
          destinationAutocompleteRef.current
        );
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.19, 1, 0.22, 1] }}
      className={cn("w-full max-w-md", className)}
    >
      <Card className="backdrop-blur-lg bg-background/30 border-white/20 shadow-2xl">
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
                  className="pl-11 bg-background/50"
                  disabled={!isGoogleMapsLoaded}
                />
              </div>

              <div className="relative">
                <Navigation className="absolute left-3 top-3 h-5 w-5 text-muted-foreground z-10" />
                <Input
                  ref={destinationInputRef}
                  placeholder="Destination (e.g., University of Houston)"
                  value={destination}
                  onChange={handleDestinationChange}
                  className="pl-11 bg-background/50"
                  disabled={!isGoogleMapsLoaded}
                />
              </div>
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
                      "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-120 hover:scale-105 active:scale-95",
                      travelMode === mode
                        ? "bg-accent-teal text-charcoal border-accent-teal shadow-lg"
                        : "bg-background/50 border-border hover:bg-accent hover:text-accent-foreground"
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
              className="w-full"
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
