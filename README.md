# 🏠 Property Finder

**Find Your Perfect Commute** - Discover apartments within 1-3 miles of your daily route.

[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-blueviolet.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.0-38B2AC.svg)](https://tailwindcss.com/)

## 🌟 Overview

Property Finder is an innovative web application that helps users discover apartments along their daily commute routes. Whether you drive, take transit, bike, or walk to work, our platform finds housing options within 1-3 miles of your route, making your daily journey convenient and efficient.

## Featured Images
<img width="1789" alt="image" src="https://github.com/user-attachments/assets/e2a046e2-b0b4-4407-b17e-0a796b397dbc" />

<img width="1799" alt="Screenshot 2025-07-03 at 9 58 27 AM" src="https://github.com/user-attachments/assets/00eb0eec-6060-4e38-8f99-6d1f952b39ed" />

<img width="1585" alt="Screenshot 2025-07-03 at 9 58 55 AM" src="https://github.com/user-attachments/assets/137f94f7-c33c-4c8a-b857-6cbcd75b49b3" />



### ✨ Key Features

- **🗺️ Multi-Modal Route Planning** - Support for driving, transit, biking, and walking routes
- **📍 Smart Location Search** - Google Places autocomplete for accurate address input
- **🏢 Apartment Discovery** - Find apartments within customizable distance buckets (≤1mi, ≤2mi, ≤3mi)
- **🚌 Transit Integration** - Real-time transit information with multiple route options
- **⭐ Google Ratings** - See real reviews and photos for each property
- **🌙 Dark Theme** - Beautiful dark-themed Google Maps integration
- **📱 Responsive Design** - Works seamlessly on desktop and mobile devices

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Maps API Key with the following APIs enabled:
  - Maps JavaScript API
  - Places API
  - Directions API
  - Distance Matrix API

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/property-finder.git
   cd property-finder
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Add your Google Maps API keys to `.env.local`:

   ```env
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_frontend_api_key_here
   GOOGLE_MAPS_API_KEY=your_backend_api_key_here
   ```

4. **Run the development server**

   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Framer Motion for animations
- **Maps**: Google Maps JavaScript API, Google Places API
- **UI Components**: Custom component library with shadcn/ui inspiration
- **State Management**: React hooks and context
- **Routing**: Next.js App Router

## 📖 Usage

1. **Enter Your Route**
   - Input your origin (home/current location)
   - Input your destination (work/target location)
   - Select your preferred travel mode

2. **Choose Your Route**
   - For transit: Select from multiple route options
   - View timing, cost, and duration for each option

3. **Discover Apartments**
   - Browse apartments categorized by distance from your route
   - Filter by transit stops (for transit routes)
   - View ratings, photos, and details

4. **Explore on Map**
   - See your route highlighted on the dark-themed map
   - View apartment locations with color-coded distance markers
   - Click markers for detailed apartment information

## 🤝 Contributing

**We welcome developers to contribute to this open-source project!**

### How to Contribute

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Commit your changes**
   ```bash
   git commit -m 'Add some amazing feature'
   ```
5. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
6. **Open a Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Use Tailwind CSS for styling
- Write meaningful commit messages
- Test your changes thoroughly
- Update documentation as needed

### Areas for Contribution

- 🐛 Bug fixes and performance improvements
- ✨ New features and enhancements
- 📚 Documentation improvements
- 🎨 UI/UX enhancements
- 🧪 Testing coverage
- 🌐 Internationalization

## 📝 API Documentation

### Environment Variables

| Variable                          | Required | Description                     |
| --------------------------------- | -------- | ------------------------------- |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes      | Client-side Google Maps API key |
| `GOOGLE_MAPS_API_KEY`             | Yes      | Server-side Google Maps API key |

### Google Maps API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable required APIs:
   - Maps JavaScript API
   - Places API
   - Directions API
   - Distance Matrix API
4. Create credentials (API Key)
5. Set up billing (required for Google Maps APIs)

## 🔒 Security

- **API Keys Protection**: All API keys are stored in environment variables and excluded from version control
- **Rate Limiting**: Implemented caching to reduce API calls
- **Input Validation**: All user inputs are validated and sanitized

## 📊 Performance

- **Caching**: Route and apartment data caching for improved performance
- **Optimized Rendering**: Efficient React rendering with proper memoization
- **Code Splitting**: Next.js automatic code splitting for faster loading

## 🐛 Troubleshooting

### Common Issues

**Maps not loading**

- Verify your Google Maps API key is correct
- Ensure all required APIs are enabled
- Check browser console for error messages

**Search not working**

- Confirm Places API is enabled
- Verify API key has proper permissions
- Check network connectivity

**No apartments found**

- Try different routes or locations
- Check if the area has apartment listings
- Verify API quotas haven't been exceeded

## 📄 License

This project is licensed under a **Proprietary License**.

⚠️ **IMPORTANT**: This software is provided for viewing and contribution purposes only. Any commercial use, redistribution, or deployment without explicit written permission from the author is strictly prohibited and may result in legal action.

For licensing inquiries, please contact: divit.patidar@gmail.com

## 🙏 Acknowledgments

- Google Maps Platform for location services
- Next.js team for the amazing framework
- Tailwind CSS for the utility-first CSS framework
- The open-source community for inspiration and tools

---

**Made with ❤️ for developers who value efficient commutes and quality housing.**
