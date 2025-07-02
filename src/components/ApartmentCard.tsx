"use client";

import React from "react";
import { motion } from "framer-motion";
import { Star, ExternalLink, MapPin, Bus, Train, Route } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApartmentListing } from "@/types";

interface ApartmentCardProps {
  apartment: ApartmentListing;
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

function formatDistance(meters: number): string {
  const miles = meters * 0.000621371;
  return miles < 0.1 ? "<0.1 mi" : `${miles.toFixed(1)} mi`;
}

function getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
}

function getTransitIcon(type: string) {
  switch (type) {
    case "bus":
      return Bus;
    case "subway":
      return Train;
    case "train":
      return Train;
    default:
      return Route;
  }
}

function getTransitBadgeColor(type: string): string {
  switch (type) {
    case "bus":
      return "bg-blue-100 text-blue-700";
    case "subway":
      return "bg-green-100 text-green-700";
    case "train":
      return "bg-purple-100 text-purple-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function ApartmentCard({ apartment, className }: ApartmentCardProps) {
  const { place, distanceToRoute, bucket } = apartment;
  const bucketColor = getBucketColor(bucket);

  const photoUrl = place.photos?.[0]?.photo_reference
    ? getPhotoUrl(place.photos[0].photo_reference, 400)
    : null;

  const handleViewOnMaps = () => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      place.name + " " + place.formatted_address
    )}&query_place_id=${place.place_id}`;
    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.19, 1, 0.22, 1] }}
      whileHover={{ y: -4 }}
      className={cn("cursor-pointer", className)}
    >
      <Card
        className="overflow-hidden group bg-card border-border/50 shadow-elevated hover:shadow-floating transition-all duration-300 border-l-4 hover:border-l-accent-teal"
        style={{ borderLeftColor: bucketColor }}
      >
        <div className="relative">
          {photoUrl ? (
            <div className="aspect-[16/10] overflow-hidden bg-muted">
              <img
                src={photoUrl}
                alt={place.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="aspect-[16/10] bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center">
              <MapPin className="h-12 w-12 text-muted-foreground/50" />
            </div>
          )}

          {/* Distance Badge */}
          <div
            className="absolute top-3 left-3 px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-lg backdrop-blur-sm"
            style={{ backgroundColor: bucketColor }}
          >
            {formatDistance(distanceToRoute)}
          </div>

          {/* Rating Badge */}
          {place.rating && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/80 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              <span className="text-xs font-semibold text-white">
                {place.rating.toFixed(1)}
              </span>
              {place.user_ratings_total && (
                <span className="text-xs text-gray-300">
                  ({place.user_ratings_total})
                </span>
              )}
            </div>
          )}
        </div>

        <CardContent className="p-5">
          <div className="space-y-4">
            {/* Title and Address */}
            <div className="space-y-2">
              <h3 className="font-bold text-lg text-foreground leading-tight line-clamp-1 group-hover:text-accent-teal transition-colors duration-200">
                {place.name}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                {place.vicinity || place.formatted_address}
              </p>
            </div>

            {/* Distance Info */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <MapPin className="h-4 w-4 text-accent-teal" />
              <span className="font-medium">
                {formatDistance(distanceToRoute)} from route
              </span>
            </div>

            {/* Action Button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full bg-background hover:bg-accent-teal hover:text-white hover:border-accent-teal transition-all duration-200 font-medium"
              onClick={handleViewOnMaps}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View on Google Maps
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
