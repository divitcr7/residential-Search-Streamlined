import { register, Histogram, Counter, Gauge } from "prom-client";

// Apartment search latency histogram
export const apartmentSearchLatency = new Histogram({
  name: "apartment_search_duration_seconds",
  help: "Duration of apartment search requests",
  labelNames: ["method", "status"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// API call counter
export const apiCallCounter = new Counter({
  name: "google_places_api_calls_total",
  help: "Total number of Google Places API calls",
  labelNames: ["api_type", "status"],
  registers: [register],
});

// Cache hit rate gauge
export const cacheHitRate = new Gauge({
  name: "cache_hit_rate",
  help: "Cache hit rate percentage",
  labelNames: ["cache_type"],
  registers: [register],
});

// Apartments found counter
export const apartmentsFoundCounter = new Counter({
  name: "apartments_found_total",
  help: "Total number of apartments found",
  labelNames: ["method"],
  registers: [register],
});

// Memory usage gauge
export const memoryUsage = new Gauge({
  name: "process_memory_usage_bytes",
  help: "Process memory usage in bytes",
  registers: [register],
});

export class MetricsCollector {
  private timers: Map<string, number> = new Map();

  startTimer(id: string): void {
    this.timers.set(id, Date.now());
  }

  endTimer(id: string, method: string, status: "success" | "error"): number {
    const startTime = this.timers.get(id);
    if (!startTime) return 0;

    const duration = (Date.now() - startTime) / 1000;
    apartmentSearchLatency.observe({ method, status }, duration);
    this.timers.delete(id);
    return duration;
  }

  recordApiCall(
    apiType: "nearby_search" | "sar" | "place_details",
    status: "success" | "error"
  ): void {
    apiCallCounter.inc({ api_type: apiType, status });
  }

  recordCacheHit(cacheType: string, hit: boolean): void {
    const rate = hit ? 100 : 0;
    cacheHitRate.set({ cache_type: cacheType }, rate);
  }

  recordApartmentsFound(method: "sar" | "nearby", count: number): void {
    apartmentsFoundCounter.inc({ method }, count);
  }

  updateMemoryUsage(): void {
    if (typeof process !== "undefined" && process.memoryUsage) {
      const usage = process.memoryUsage();
      memoryUsage.set(usage.heapUsed);
    }
  }
}

export const metrics = new MetricsCollector();
