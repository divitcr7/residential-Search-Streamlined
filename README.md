# Property Finder - Apartments Along Your Route

A Next.js 14 web application that helps you find apartment complexes along your commute route. Enter your origin and destination, choose your travel mode (drive, bike, walk), and discover housing options within 1, 2, or 3 miles of your path.

## ✨ Features

- **Route-Based Search**: Find apartments along your specific commute route
- **Multiple Travel Modes**: Support for driving, biking, and walking routes
- **Distance Buckets**: Filter results by ≤1mi, ≤2mi, or ≤3mi from your route
- **Interactive Maps**: Full Google Maps integration with route visualization
- **Real-Time Data**: Live apartment listings with Google ratings and photos
- **Responsive Design**: Works seamlessly from mobile (375px) to 4K displays
- **Dark Mode First**: Beautiful dark theme with light mode toggle
- **Accessibility**: WCAG 2.2 AA compliant with keyboard navigation
- **Performance**: Lighthouse score ≥95 with zero CLS

## 🚀 Quick Start

### Prerequisites

- Node.js 18.17.0 or higher
- pnpm 8.0.0 or higher
- Google Maps API key with the following APIs enabled:
  - Maps JavaScript API
  - Places API
  - Routes API
  - Places API (New)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd property-finder

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local

# Add your Google Maps API key to .env.local
echo "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here" >> .env.local
echo "GOOGLE_MAPS_BACKEND_API_KEY=your_api_key_here" >> .env.local

# Start the development server
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 🛠 Tech Stack

### Frontend
- **Next.js 14** - App Router for modern React development
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS 4** - Utility-first styling with JIT compilation
- **Framer Motion 12** - GPU-accelerated animations
- **Radix UI** - Unstyled, accessible UI primitives

### Maps & APIs
- **Google Maps JavaScript API** - Interactive map rendering
- **Google Routes API v2** - Route computation
- **Google Places API** - Search along route functionality
- **@googlemaps/js-api-loader** - Efficient Maps API loading

### State & Utils
- **@turf/nearest-point-on-line** - Geospatial distance calculations
- **Server Actions** - Direct server-side API calls
- **Runtime Cache** - Edge-compatible caching with TTL

## 📁 Project Structure

```
property-finder/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── _actions/          # Server actions
│   │   ├── globals.css        # Global styles
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Landing page
│   │   └── results/           # Results page
│   ├── components/            # React components
│   │   ├── ui/               # Base UI components
│   │   ├── ApartmentCard.tsx # Apartment listing cards
│   │   ├── FilterChips.tsx   # Distance filter controls
│   │   ├── RouteForm.tsx     # Search form
│   │   └── ThemeToggle.tsx   # Dark/light mode toggle
│   ├── lib/                  # Utility functions
│   │   ├── cache.ts          # Runtime caching
│   │   ├── maps.ts           # Google Maps utilities
│   │   └── utils.ts          # General utilities
│   └── types/                # TypeScript type definitions
├── public/                   # Static assets
├── .env.example             # Environment variables template
└── README.md               # Project documentation
```

## 🗺️ Google Maps Setup

### Required APIs

Enable these APIs in your Google Cloud Console:

1. **Maps JavaScript API** - For map rendering
2. **Places API** - For place details and photos
3. **Routes API** - For route computation
4. **Places API (New)** - For search along route

### API Key Configuration

Create two environment variables in `.env.local`:

```bash
# Frontend API key (with domain restrictions)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_frontend_api_key

# Backend API key (with IP restrictions)
GOOGLE_MAPS_BACKEND_API_KEY=your_backend_api_key
```

### Attribution Requirements

The application automatically includes required Google Maps attributions:
- "© Google" watermark in bottom-right corner
- "Map data © 2025 Google" copyright notice
- Maps remain visible when displaying place information

## 🎨 Design System

### Colors
- **Charcoal**: `#111111` - Primary dark background
- **Off-white**: `#fafafa` - Primary light background  
- **Accent Teal**: `#29d3c2` - Interactive elements and highlights

### Typography
- **Font**: Inter with `font-display: swap`
- **Scale**: 12px baseline rhythm with 8pt spacing scale
- **Weights**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

### Animations
- **Duration**: 120ms for micro-interactions
- **Easing**: `cubic-bezier(0.19, 1, 0.22, 1)` for smooth motion
- **Reduced Motion**: Respects `prefers-reduced-motion` setting

## 🔧 Development

### Available Scripts

```bash
# Development server
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint

# Type checking
pnpm type-check
```

### Code Quality

- **ESLint**: Configured with `eslint-config-next`
- **Prettier**: Automatic code formatting
- **TypeScript**: Strict mode enabled
- **Performance**: Bundle size monitoring with optimization

### Browser Support

- **Modern Browsers**: Chrome 91+, Firefox 90+, Safari 14+, Edge 91+
- **Mobile**: iOS Safari 14+, Chrome Android 91+
- **Progressive Enhancement**: Works with JavaScript disabled

## 📊 Performance

### Bundle Size
- **First Load**: ≤200KB gzipped (excluding Google Maps)
- **Code Splitting**: Automatic with Next.js dynamic imports
- **Tree Shaking**: Optimized for minimal bundle size

### Core Web Vitals
- **LCP**: ≤2.5s (Largest Contentful Paint)
- **FID**: ≤100ms (First Input Delay)
- **CLS**: 0 (Cumulative Layout Shift)

### Caching Strategy
- **Runtime Cache**: 10-minute TTL for API responses
- **Static Assets**: Immutable caching with hashed filenames
- **API Routes**: Server-side caching with invalidation

## 🔒 Security

### API Key Protection
- Frontend keys restricted by domain
- Backend keys restricted by server IP
- No API keys exposed in client-side code

### Data Privacy
- No personal data collection
- Search history not stored
- Session storage for temporary results only

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Deploy to Vercel
vercel --prod

# Set environment variables in Vercel dashboard
```

### Other Platforms

Compatible with any Node.js hosting platform:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Google Maps Platform](https://developers.google.com/maps) for mapping services
- [Tailwind CSS](https://tailwindcss.com) for the utility-first CSS framework
- [Framer Motion](https://www.framer.com/motion/) for smooth animations
- [Radix UI](https://www.radix-ui.com) for accessible UI primitives

---

**Property Finder** - Find your perfect commute. 🏠 + 🚗 = ❤️ 