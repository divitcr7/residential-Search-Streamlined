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
  {
    id: "≤1mi" as const,
    label: "≤ 1 mile",
    color: "bg-green-500",
    ringColor: "ring-green-500/30",
  },
  {
    id: "≤2mi" as const,
    label: "≤ 2 miles",
    color: "bg-amber-500",
    ringColor: "ring-amber-500/30",
  },
  {
    id: "≤3mi" as const,
    label: "≤ 3 miles",
    color: "bg-red-500",
    ringColor: "ring-red-500/30",
  },
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
    <div className="space-y-6">
      {/* Distance Filters */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-accent-teal" />
          Distance from Route
        </h4>
        <div className="flex gap-3 flex-wrap">
          {buckets.map((bucket) => (
            <motion.button
              key={bucket.id}
              onClick={() => onBucketChange(bucket.id)}
              className={cn(
                "flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border",
                selectedBucket === bucket.id
                  ? "bg-accent-teal text-white border-accent-teal shadow-md ring-2 ring-accent-teal/30"
                  : "bg-background border-border text-foreground hover:bg-accent hover:border-accent-teal/40 hover:shadow-soft"
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className={cn("w-2.5 h-2.5 rounded-full", bucket.color)} />
              <span>{bucket.label}</span>
              <span
                className={cn(
                  "bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold min-w-[24px] text-center",
                  selectedBucket === bucket.id && "bg-white/20 text-white"
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
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Bus className="h-4 w-4 text-accent-teal" />
            Transit Type
          </h4>
          <div className="flex gap-3 flex-wrap">
            {transitFilters.map((filter) => {
              const Icon = filter.icon;
              const count =
                transitCounts[filter.id as keyof typeof transitCounts] || 0;

              return (
                <motion.button
                  key={filter.id}
                  onClick={() => onTransitFilterChange(filter.id)}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border",
                    selectedTransitFilter === filter.id
                      ? "bg-accent-teal text-white border-accent-teal shadow-md ring-2 ring-accent-teal/30"
                      : "bg-background border-border text-foreground hover:bg-accent hover:border-accent-teal/40 hover:shadow-soft",
                    count === 0 && "opacity-50 cursor-not-allowed"
                  )}
                  whileHover={count > 0 ? { scale: 1.02 } : {}}
                  whileTap={count > 0 ? { scale: 0.98 } : {}}
                  disabled={count === 0}
                >
                  <Icon className="w-4 h-4" />
                  <span>{filter.label}</span>
                  <span
                    className={cn(
                      "bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold min-w-[24px] text-center",
                      selectedTransitFilter === filter.id &&
                        "bg-white/20 text-white"
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
