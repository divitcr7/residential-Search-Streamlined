"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Car, MapPin, Star, Route } from "lucide-react";
import { RouteForm } from "@/components/RouteForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Map } from "@/components/ui/Map";
import { getRouteAndApartments } from "@/app/_actions/getRouteAndApartments";
import type { RouteFormData } from "@/types";

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleFormSubmit = async (data: RouteFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getRouteAndApartments(
        data.origin,
        data.destination,
        data.travelMode,
        undefined,
        data.maxDistance
      );

      // Store result in sessionStorage for the results page
      sessionStorage.setItem("searchResult", JSON.stringify(result));

      // Navigate to results page with search parameters
      const searchParams = new URLSearchParams({
        origin: data.origin,
        destination: data.destination,
        travelMode: data.travelMode,
      });

      router.push(`/results?${searchParams.toString()}`);
    } catch (err) {
      console.error("Search error:", err);
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Background Map */}
      <div className="absolute inset-0">
        <Map className="w-full h-full" hideControls />
      </div>

      {/* Floating Header */}
      <motion.header
        initial={{ opacity: 1, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-0 left-0 right-0 z-10 p-6"
      >
        <div className="flex justify-between items-center">
          <motion.div
            initial={{ opacity: 1, x: 0 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2"
          >
            <h1 className="text-2xl font-bold text-white">Property Finder</h1>
            <p className="text-sm text-white font-medium">
              Apartments along your route
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 1, x: 0 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <ThemeToggle />
          </motion.div>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="absolute inset-0 flex items-center justify-center p-6 z-10">
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="bg-black/60 backdrop-blur-sm rounded-xl px-6 py-4 mb-6">
              <motion.h2
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl font-bold text-white mb-4 text-balance"
              >
                Find Your Perfect Commute
              </motion.h2>
              <motion.p
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-lg text-white text-balance font-medium"
              >
                Discover apartments within 1-3 miles of your daily route
              </motion.p>
            </div>
          </div>

          <RouteForm onSubmit={handleFormSubmit} isLoading={isLoading} />

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 p-4 rounded-xl bg-destructive/90 backdrop-blur-sm text-destructive-foreground text-sm"
            >
              {error}
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Feature Highlights */}
      <motion.div
        initial={{ opacity: 1, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-6 left-6 right-6 z-10"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            {
              icon: Car,
              title: "Multiple Travel Modes",
              description: "Drive, bike, or walk routes",
            },
            {
              icon: Route,
              title: "Distance Buckets",
              description: "≤1mi, ≤2mi, ≤3mi from route",
            },
            {
              icon: Star,
              title: "Google Ratings",
              description: "Real reviews and photos",
            },
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4 text-center"
            >
              <div className="flex justify-center mb-2">
                <feature.icon className="h-6 w-6 text-accent-teal" />
              </div>
              <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
              <p className="text-sm text-white/90 font-medium">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Enhanced Gradient Overlay for better text contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60 pointer-events-none" />
    </div>
  );
}
