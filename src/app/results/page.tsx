"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MapPin, AlertCircle } from "lucide-react";
import Link from "next/link";

import { Map } from "@/components/ui/Map";
import { ApartmentCard } from "@/components/ApartmentCard";
import { FilterChips } from "@/components/FilterChips";
import { RouteOptions } from "@/components/RouteOptions";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { getRouteAndApartments } from "@/app/_actions/getRouteAndApartments";
import { cn } from "@/lib/utils";

import type {
  SearchResult,
  TravelMode,
  DistanceBucket,
  ApartmentListing,
  RouteOption,
} from "@/types";

function ResultsContent() {
  const searchParams = useSearchParams();
  const origin = searchParams.get("origin");
  const destination = searchParams.get("destination");
  const travelMode = (searchParams.get("travelMode") || "DRIVE") as TravelMode;

  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [selectedBucket, setSelectedBucket] = useState<DistanceBucket>("≤1mi");
  const [selectedTransitFilter, setSelectedTransitFilter] = useState("all");
  const [highlightedApartmentId, setHighlightedApartmentId] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial search
  useEffect(() => {
    if (!origin || !destination) return;

    const performSearch = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getRouteAndApartments(
          origin,
          destination,
          travelMode
        );
        setSearchResult(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [origin, destination, travelMode]);

  // Handle route selection changes
  const handleRouteSelect = async (routeIndex: number) => {
    if (!origin || !destination || !searchResult) return;

    setSelectedRouteIndex(routeIndex);
    setIsLoading(true);

    try {
      const result = await getRouteAndApartments(
        origin,
        destination,
        travelMode,
        routeIndex
      );
      setSearchResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load route");
    } finally {
      setIsLoading(false);
    }
  };

  // Filter apartments based on selected bucket and transit type
  const filteredApartments = useMemo(() => {
    if (!searchResult) return [];

    let apartments = searchResult.apartments[selectedBucket] || [];

    // Apply transit filter
    if (selectedTransitFilter !== "all" && travelMode === "TRANSIT") {
      apartments = apartments.filter(
        (apt) => apt.nearestTransitStep?.type === selectedTransitFilter
      );
    }

    return apartments;
  }, [searchResult, selectedBucket, selectedTransitFilter, travelMode]);

  // Calculate transit counts for filter chips
  const transitCounts = useMemo(() => {
    if (!searchResult || travelMode !== "TRANSIT") return undefined;

    const apartments = searchResult.apartments[selectedBucket] || [];
    const counts = { all: apartments.length, bus: 0, subway: 0, train: 0 };

    apartments.forEach((apt) => {
      const type = apt.nearestTransitStep?.type;
      if (type === "bus") counts.bus++;
      else if (type === "subway") counts.subway++;
      else if (type === "train") counts.train++;
    });

    return counts;
  }, [searchResult, selectedBucket, travelMode]);

  // Map markers for apartments
  const apartmentMarkers = useMemo(() => {
    return filteredApartments.map((apartment) => ({
      id: apartment.place.place_id,
      position: apartment.place.geometry.location,
      title: apartment.place.name,
      apartment: apartment,
    }));
  }, [filteredApartments]);

  if (!origin || !destination) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Invalid Search</h2>
          <p className="text-muted-foreground mb-4">
            Origin and destination are required to show results.
          </p>
          <Link href="/">
            <Button>Back to Search</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold truncate">
                {origin} → {destination}
              </h1>
              <p className="text-sm text-muted-foreground">
                {travelMode.toLowerCase()} • {searchResult?.totalFound || 0}{" "}
                apartments found
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-120px)]">
          {/* Left Sidebar - Route Options and Apartments */}
          <div className="space-y-6 overflow-auto">
            {/* Route Options (for Transit mode with multiple routes) */}
            {searchResult?.routeOptions &&
              travelMode === "TRANSIT" &&
              searchResult.routeOptions.length > 1 && (
                <RouteOptions
                  routes={searchResult.routeOptions}
                  selectedRouteIndex={selectedRouteIndex}
                  onRouteSelect={handleRouteSelect}
                  isLoading={isLoading}
                />
              )}

            {/* Filter Chips */}
            {searchResult && !isLoading && (
              <FilterChips
                selectedBucket={selectedBucket}
                onBucketChange={setSelectedBucket}
                selectedTransitFilter={selectedTransitFilter}
                onTransitFilterChange={setSelectedTransitFilter}
                counts={{
                  "≤1mi": searchResult.apartments["≤1mi"]?.length || 0,
                  "≤2mi": searchResult.apartments["≤2mi"]?.length || 0,
                  "≤3mi": searchResult.apartments["≤3mi"]?.length || 0,
                }}
                transitCounts={transitCounts}
              />
            )}

            {/* Apartment Listings */}
            <div className="space-y-4">
              {isLoading ? (
                // Loading skeletons
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 w-full" />
                ))
              ) : error ? (
                // Error state
                <div className="text-center py-12">
                  <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    Error Loading Results
                  </h3>
                  <p className="text-muted-foreground mb-4">{error}</p>
                  <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                  >
                    Try Again
                  </Button>
                </div>
              ) : filteredApartments.length === 0 ? (
                // No results
                <div className="text-center py-12">
                  <MapPin className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    No Apartments Found
                  </h3>
                  <p className="text-muted-foreground">
                    Try adjusting your filters or search area.
                  </p>
                </div>
              ) : (
                // Apartment cards
                <AnimatePresence mode="popLayout">
                  {filteredApartments.map((apartment, index) => (
                    <motion.div
                      key={apartment.place.place_id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.1 }}
                      className={cn(
                        "transition-all duration-200",
                        highlightedApartmentId === apartment.place.place_id &&
                          "ring-2 ring-accent-teal scale-[1.02]"
                      )}
                      onMouseEnter={() =>
                        setHighlightedApartmentId(apartment.place.place_id)
                      }
                      onMouseLeave={() => setHighlightedApartmentId(null)}
                    >
                      <ApartmentCard apartment={apartment} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Right Side - Map */}
          <div className="relative rounded-lg overflow-hidden border border-border">
            <Map
              route={searchResult?.selectedRoute}
              apartments={apartmentMarkers}
              highlightedApartmentId={highlightedApartmentId}
              onApartmentMarkerClick={setHighlightedApartmentId}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-teal border-t-transparent" />
            <span className="text-sm font-medium">Loading results...</span>
          </div>
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
