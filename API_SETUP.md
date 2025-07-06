# API Setup Guide

## OpenRouteService API Key Setup

The app currently uses **mock data** for testing. To get real routing data, you'll need to set up a free OpenRouteService API key:

### Step 1: Get Your Free API Key

1. Go to [OpenRouteService Developer Portal](https://openrouteservice.org/dev/#/signup)
2. Sign up for a **free account** (no credit card required)
3. Verify your email address
4. Log in to your dashboard
5. Click "Request a token" or "Create new token"
6. Copy your API key

### Step 2: Configure Your Environment

1. Create a `.env.local` file in your project root (if it doesn't exist)
2. Add your API key:

```bash
NEXT_PUBLIC_OPENROUTESERVICE_API_KEY=your_actual_api_key_here

# Optional: Configure apartment search limits
NEXT_PUBLIC_APT_RESULT_CAP=20
NEXT_PUBLIC_APT_ROUTE_RADIUS_MI=1
```

### Step 3: Restart Your Development Server

```bash
npm run dev
```

## Current Status

✅ **Mock Mode Active**: The app works with mock data when no API key is configured
✅ **UI Layout Fixed**: Search suggestions no longer cause layout shifts
✅ **Debounced Search**: Reduced API calls with 300ms debounce
✅ **Fallback Routing**: Mock routes are generated when API is unavailable
✅ **Smart Apartment Filtering**: Only shows actual apartment buildings near your route
✅ **Configurable Results**: Limit results and search radius via environment variables

## Free Tier Limits

- **OpenRouteService**: 2,000 requests per day (free)
- **Overpass API**: Unlimited (free, but be respectful)
- **Nominatim**: Unlimited (free, but be respectful)

## Optional: Premium Map Tiles

For better-looking maps, you can also get a free MapTiler API key:

1. Go to [MapTiler](https://www.maptiler.com/)
2. Sign up for a free account
3. Get your API key
4. Add to `.env.local`:

```bash
NEXT_PUBLIC_MAPTILER_API_KEY=your_maptiler_key_here
```

## Testing

The app now works in **three modes**:

1. **Mock Mode**: No API key configured - uses mock data
2. **API Mode**: Valid API key - uses real OpenRouteService data
3. **Fallback Mode**: API key exists but API fails - falls back to mock data

You can test the app immediately with mock data, then upgrade to real data when you get your API key!

## Apartment Filtering Features

The app now uses **smart filtering** to show only relevant apartments:

### 🏠 **Building Type Filtering**
- Only shows buildings tagged as `apartments` or `residential`
- Automatically filters out schools, offices, shops, hospitals, etc.
- Uses OSM tags to ensure data quality

### 📍 **Proximity Filtering**
- Only shows apartments within **1 mile** of your route (configurable)
- Uses Turf.js for accurate geospatial calculations
- Sorts results by distance to route

### 🎯 **Result Limits**
- Maximum **20 results** to keep UI clean (configurable)
- Deduplicates nearby apartments (within 100m)
- Shows closest apartments first

### ⚙️ **Configuration**
Customize the filtering via environment variables:
```bash
# Maximum number of apartment results
NEXT_PUBLIC_APT_RESULT_CAP=20

# Maximum distance from route (in miles)
NEXT_PUBLIC_APT_ROUTE_RADIUS_MI=1
```
