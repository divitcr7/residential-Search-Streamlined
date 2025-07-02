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
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Navigation className="h-5 w-5 text-accent-teal" />
        <h3 className="text-lg font-bold text-foreground">Choose Your Route</h3>
        <span className="text-sm text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
          {routes.length} option{routes.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-4">
        {routes.map((route, index) => (
          <motion.div
            key={route.route_id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className={cn(
                "cursor-pointer transition-all duration-200 border border-border/50 hover:shadow-elevated",
                selectedRouteIndex === index
                  ? "ring-2 ring-accent-teal/50 bg-accent-teal/5 border-accent-teal/30 shadow-elevated"
                  : "hover:bg-accent/30 hover:border-accent-teal/20 shadow-soft"
              )}
              onClick={() => onRouteSelect(index)}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-3">
                    {/* Route Summary */}
                    <div className="flex items-center gap-3">
                      <h4 className="text-base font-semibold text-foreground line-clamp-1">
                        {route.summary}
                      </h4>
                      {selectedRouteIndex === index && (
                        <span className="text-xs bg-accent-teal text-white px-2.5 py-1 rounded-full font-medium">
                          Selected
                        </span>
                      )}
                    </div>

                    {/* Transit Steps */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {route.legs[0]?.steps.map((step, stepIndex) => (
                        <TransitStepIcon key={stepIndex} step={step} />
                      ))}
                    </div>

                    {/* Route Info */}
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-1.5 text-foreground">
                        <Clock className="h-4 w-4 text-accent-teal" />
                        <span className="font-medium">
                          {route.legs[0]?.duration.text}
                        </span>
                      </div>

                      {route.fare && (
                        <div className="flex items-center gap-1.5 text-foreground">
                          <DollarSign className="h-4 w-4 text-accent-teal" />
                          <span className="font-medium">{route.fare.text}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{route.legs[0]?.distance.text}</span>
                      </div>
                    </div>

                    {/* Departure/Arrival Times for Transit */}
                    {route.legs[0]?.departure_time && (
                      <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 font-medium">
                        Depart:{" "}
                        <span className="text-foreground">
                          {new Date(
                            route.legs[0].departure_time.value * 1000
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {route.legs[0]?.arrival_time && (
                          <>
                            {" "}
                            • Arrive:{" "}
                            <span className="text-foreground">
                              {new Date(
                                route.legs[0].arrival_time.value * 1000
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <Button
                    variant={
                      selectedRouteIndex === index ? "default" : "outline"
                    }
                    size="sm"
                    disabled={isLoading}
                    className={cn(
                      "ml-4",
                      selectedRouteIndex === index &&
                        "bg-accent-teal hover:bg-accent-teal/90"
                    )}
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
      <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-1">
        <Navigation className="h-3 w-3" />
        <span className="font-medium">Walk</span>
      </div>
    );
  }

  if (step.travel_mode === "TRANSIT" && step.transit) {
    const vehicleType = step.transit.line.vehicle.type.toLowerCase();
    let icon = Bus;
    let bgColor = "bg-blue-100 text-blue-800";

    if (vehicleType.includes("subway") || vehicleType.includes("metro")) {
      icon = Train;
      bgColor = "bg-green-100 text-green-800";
    } else if (vehicleType.includes("train") || vehicleType.includes("rail")) {
      icon = Train;
      bgColor = "bg-purple-100 text-purple-800";
    }

    const IconComponent = icon;

    return (
      <div
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold",
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
        <span>{step.transit.line.short_name || step.transit.line.name}</span>
      </div>
    );
  }

  return null;
}
