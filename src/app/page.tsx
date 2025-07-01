"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
        data.travelMode
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
        <Map className="w-full h-full" />
      </div>

      {/* Floating Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
        className="absolute top-0 left-0 right-0 z-10 p-6"
      >
        <div className="flex justify-between items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.19, 1, 0.22, 1] }}
          >
            <h1 className="text-2xl font-bold text-white drop-shadow-lg">
              Property Finder
            </h1>
            <p className="text-sm text-white/80 drop-shadow">
              Apartments along your route
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.19, 1, 0.22, 1] }}
          >
            <ThemeToggle />
          </motion.div>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="absolute inset-0 flex items-center justify-center p-6 z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.19, 1, 0.22, 1] }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.4,
                ease: [0.19, 1, 0.22, 1],
              }}
              className="text-4xl font-bold text-white drop-shadow-lg mb-4 text-balance"
            >
              Find Your Perfect Commute
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.5,
                ease: [0.19, 1, 0.22, 1],
              }}
              className="text-lg text-white/90 drop-shadow text-balance"
            >
              Discover apartments within 1-3 miles of your daily route
            </motion.p>
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
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6, ease: [0.19, 1, 0.22, 1] }}
        className="absolute bottom-6 left-6 right-6 z-10"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            {
              icon: "🚗",
              title: "Multiple Travel Modes",
              description: "Drive, bike, or walk routes",
            },
            {
              icon: "📍",
              title: "Distance Buckets",
              description: "≤1mi, ≤2mi, ≤3mi from route",
            },
            {
              icon: "⭐",
              title: "Google Ratings",
              description: "Real reviews and photos",
            },
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: 0.7 + index * 0.1,
                ease: [0.19, 1, 0.22, 1],
              }}
              className="glass-card p-4 text-center"
            >
              <div className="text-2xl mb-2">{feature.icon}</div>
              <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
              <p className="text-sm text-white/70">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40 pointer-events-none" />
    </div>
  );
}
