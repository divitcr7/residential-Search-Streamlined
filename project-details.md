# Property Finder - Project Details

## Overview

Property Finder is an innovative web application designed to help users discover apartments along their daily commute routes. The application allows users to find housing options within 1-3 miles of their route, making their daily journey more convenient and efficient. Whether users drive, take transit, bike, or walk to work, Property Finder provides tailored apartment recommendations based on their specific commute patterns.

## Key Features

- **Multi-Modal Route Planning**: Support for driving, transit, biking, and walking routes
- **Smart Location Search**: Google Places autocomplete for accurate address input
- **Apartment Discovery**: Find apartments within customizable distance buckets (≤1mi, ≤2mi, ≤3mi)
- **Transit Integration**: Real-time transit information with multiple route options
- **Google Ratings**: See real reviews and photos for each property
- **Dark Theme**: Beautiful dark-themed Google Maps integration
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Framer Motion for animations
- **Maps**: Google Maps JavaScript API, Google Places API
- **UI Components**: Custom component library with shadcn/ui inspiration
- **State Management**: React hooks and context
- **Routing**: Next.js App Router

## Architecture

The application follows a modern React architecture using Next.js App Router for routing and server components. It leverages the following key components:

1. **Home Page**: Entry point with a search form for route input
2. **Results Page**: Displays apartments along the selected route
3. **ApartmentCard**: Component for displaying apartment details
4. **RouteForm**: Component for inputting origin, destination, and travel mode
5. **Map Component**: Interactive map showing routes and apartment locations

## Data Flow

1. User inputs origin, destination, and travel mode
2. Application fetches route options from Google Maps Directions API
3. For each route, the application searches for apartments along the route using Google Places API
4. Apartments are categorized into distance buckets (≤1mi, ≤2mi, ≤3mi) based on their proximity to the route
5. Results are displayed on the map and in a list view

## API Integration

The application integrates with the following Google Maps APIs:

- **Maps JavaScript API**: For rendering maps and markers
- **Places API**: For location autocomplete and apartment search
- **Directions API**: For route planning and visualization
- **Distance Matrix API**: For calculating distances between points

## Performance Optimizations

- **Caching**: Route and apartment data caching for improved performance
- **Optimized Rendering**: Efficient React rendering with proper memoization
- **Code Splitting**: Next.js automatic code splitting for faster loading

## Security Measures

- **API Keys Protection**: All API keys are stored in environment variables
- **Rate Limiting**: Implemented caching to reduce API calls
- **Input Validation**: All user inputs are validated and sanitized

## Future Enhancements

- **Saved Searches**: Allow users to save their favorite routes and apartments
- **Price Filtering**: Add filters for apartment price ranges
- **More Property Details**: Integrate with real estate APIs for more comprehensive information
- **User Accounts**: Enable user registration and personalized experiences
- **Mobile App**: Develop native mobile applications for iOS and Android

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Maps API Key with required APIs enabled

### Installation

1. Clone the repository
2. Install dependencies with `npm install` or `yarn install`
3. Set up environment variables in `.env.local`
4. Run the development server with `npm run dev` or `yarn dev`

### Environment Variables

| Variable                          | Required | Description                     |
| --------------------------------- | -------- | ------------------------------- |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes      | Client-side Google Maps API key |
| `GOOGLE_MAPS_API_KEY`             | Yes      | Server-side Google Maps API key |

## Deployment

The application can be deployed to various platforms:

- **Vercel**: Recommended for Next.js applications
- **Netlify**: Alternative deployment option
- **Self-hosted**: Can be deployed to any Node.js hosting environment

## License

This project is licensed under a Proprietary License. Any commercial use, redistribution, or deployment without explicit written permission is prohibited.