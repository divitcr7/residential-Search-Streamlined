import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Property Finder - Apartments Along Your Route",
  description:
    "Find apartment complexes along your commute route. Enter your origin and destination to discover housing options within 1, 2, or 3 miles of your path.",
  keywords: [
    "apartments",
    "housing",
    "route",
    "commute",
    "rental",
    "Google Maps",
  ],
  authors: [{ name: "Property Finder" }],
  creator: "Property Finder",
  publisher: "Property Finder",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Property Finder - Apartments Along Your Route",
    description:
      "Find apartment complexes along your commute route with Google Maps integration.",
    siteName: "Property Finder",
  },
  twitter: {
    card: "summary_large_image",
    title: "Property Finder - Apartments Along Your Route",
    description:
      "Find apartment complexes along your commute route with Google Maps integration.",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://maps.googleapis.com" />
        <link rel="preconnect" href="https://maps.gstatic.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://maps.googleapis.com" />
        <link rel="dns-prefetch" href="https://maps.gstatic.com" />
      </head>
      <body className={`${inter.className} font-sans antialiased min-h-screen`}>
        <div id="root" className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
