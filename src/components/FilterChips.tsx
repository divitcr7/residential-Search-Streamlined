"use client";

import { motion } from "framer-motion";
import { MapPin, Bus, Train, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DistanceBucket } from "@/types";

interface FilterChipsProps {
  selectedBucket: DistanceBucket;
  onBucketChange: (bucket: DistanceBucket) => void;
  selectedTransitFilter: string;
  onTransitFilterChange: (filter: string) => void;
  counts: {
    "≤1mi": number;
    "≤2mi": number;
    "≤3mi": number;
  };
  transitCounts?: {
    all: number;
    bus: number;
    subway: number;
    train: number;
  };
}

const buckets = [
  { id: "≤1mi" as const, label: "≤ 1 mile", color: "bg-green-500" },
  { id: "≤2mi" as const, label: "≤ 2 miles", color: "bg-yellow-500" },
  { id: "≤3mi" as const, label: "≤ 3 miles", color: "bg-red-500" },
];

const transitFilters = [
  { id: "all", label: "All Transit", icon: MapPin },
  { id: "bus", label: "Bus Only", icon: Bus },
  { id: "subway", label: "Subway Only", icon: Train },
  { id: "train", label: "Train Only", icon: Train },
];

export function FilterChips({
  selectedBucket,
  onBucketChange,
  selectedTransitFilter,
  onTransitFilterChange,
  counts,
  transitCounts,
}: FilterChipsProps) {
  return (
    <div className="space-y-4">
      {/* Distance Filters */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">
          Distance from Route
        </h4>
        <div className="flex gap-2 flex-wrap">
          {buckets.map((bucket) => (
            <motion.button
              key={bucket.id}
              onClick={() => onBucketChange(bucket.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-200",
                selectedBucket === bucket.id
                  ? "bg-accent-teal text-charcoal shadow-lg scale-105"
                  : "bg-background/80 text-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className={cn("w-2 h-2 rounded-full", bucket.color)} />
              {bucket.label}
              <span
                className={cn(
                  "bg-background text-foreground rounded-full px-2 py-0.5 text-xs min-w-[20px] text-center",
                  selectedBucket === bucket.id && "bg-charcoal text-off-white"
                )}
              >
                {counts[bucket.id]}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Transit Type Filters */}
      {transitCounts && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            Transit Type
          </h4>
          <div className="flex gap-2 flex-wrap">
            {transitFilters.map((filter) => {
              const Icon = filter.icon;
              const count =
                transitCounts[filter.id as keyof typeof transitCounts] || 0;

              return (
                <motion.button
                  key={filter.id}
                  onClick={() => onTransitFilterChange(filter.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-200",
                    selectedTransitFilter === filter.id
                      ? "bg-accent-teal text-charcoal shadow-lg scale-105"
                      : "bg-background/80 text-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={count === 0}
                >
                  <Icon className="w-4 h-4" />
                  {filter.label}
                  <span
                    className={cn(
                      "bg-background text-foreground rounded-full px-2 py-0.5 text-xs min-w-[20px] text-center",
                      selectedTransitFilter === filter.id &&
                        "bg-charcoal text-off-white"
                    )}
                  >
                    {count}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
