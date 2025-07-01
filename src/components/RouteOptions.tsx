"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Clock,
  DollarSign,
  Bus,
  Train,
  MapPin,
  Navigation,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RouteOption, RouteStep } from "@/types";

interface RouteOptionsProps {
  routes: RouteOption[];
  selectedRouteIndex: number;
  onRouteSelect: (index: number) => void;
  isLoading?: boolean;
}

export function RouteOptions({
  routes,
  selectedRouteIndex,
  onRouteSelect,
  isLoading = false,
}: RouteOptionsProps) {
  if (!routes || routes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">
        Choose Your Route ({routes.length} option{routes.length > 1 ? "s" : ""})
      </h3>

      <div className="space-y-3">
        {routes.map((route, index) => (
          <motion.div
            key={route.route_id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-lg",
                selectedRouteIndex === index
                  ? "ring-2 ring-accent-teal bg-accent-teal/5"
                  : "hover:bg-accent/50"
              )}
              onClick={() => onRouteSelect(index)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {/* Route Summary */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-sm font-medium text-foreground">
                        {route.summary}
                      </div>
                      {selectedRouteIndex === index && (
                        <span className="text-xs bg-accent-teal text-charcoal px-2 py-1 rounded-full">
                          Selected
                        </span>
                      )}
                    </div>

                    {/* Transit Steps */}
                    <div className="flex items-center gap-1 mb-3 flex-wrap">
                      {route.legs[0]?.steps.map((step, stepIndex) => (
                        <TransitStepIcon key={stepIndex} step={step} />
                      ))}
                    </div>

                    {/* Route Info */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {route.legs[0]?.duration.text}
                      </div>

                      {route.fare && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          {route.fare.text}
                        </div>
                      )}

                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {route.legs[0]?.distance.text}
                      </div>
                    </div>

                    {/* Departure/Arrival Times for Transit */}
                    {route.legs[0]?.departure_time && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Depart:{" "}
                        {new Date(
                          route.legs[0].departure_time.value * 1000
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {route.legs[0]?.arrival_time && (
                          <>
                            {" "}
                            • Arrive:{" "}
                            {new Date(
                              route.legs[0].arrival_time.value * 1000
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <Button
                    variant={
                      selectedRouteIndex === index ? "accent" : "outline"
                    }
                    size="sm"
                    disabled={isLoading}
                  >
                    {selectedRouteIndex === index ? "Selected" : "Select"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

interface TransitStepIconProps {
  step: RouteStep;
}

function TransitStepIcon({ step }: TransitStepIconProps) {
  if (step.travel_mode === "WALKING") {
    return (
      <div className="flex items-center text-xs text-muted-foreground">
        <Navigation className="h-3 w-3 mr-1" />
        Walk
      </div>
    );
  }

  if (step.travel_mode === "TRANSIT" && step.transit) {
    const vehicleType = step.transit.line.vehicle.type.toLowerCase();
    let icon = Bus;
    let bgColor = "bg-blue-100 text-blue-700";

    if (vehicleType.includes("subway") || vehicleType.includes("metro")) {
      icon = Train;
      bgColor = "bg-green-100 text-green-700";
    } else if (vehicleType.includes("train") || vehicleType.includes("rail")) {
      icon = Train;
      bgColor = "bg-purple-100 text-purple-700";
    }

    const IconComponent = icon;

    return (
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
          bgColor
        )}
        style={{
          backgroundColor: step.transit.line.color
            ? `${step.transit.line.color}20`
            : undefined,
          color: step.transit.line.color || undefined,
        }}
      >
        <IconComponent className="h-3 w-3" />
        {step.transit.line.short_name || step.transit.line.name}
      </div>
    );
  }

  return null;
}
