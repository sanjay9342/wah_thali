import type { Metadata, Viewport } from "next";
import { Nunito_Sans } from "next/font/google";
import { LegacyStorageCleanup } from "@/components/legacy-storage-cleanup";
import { NavigationPerformance } from "@/components/navigation-performance";
import { business } from "@/lib/business";
import "./globals.css";

const foodieSans = Nunito_Sans({
  variable: "--font-foodie-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://wahthali.in"),
  title: {
    default: "Wah Thali | Fresh Homestyle Thalis in Kolkata",
    template: "%s | Wah Thali",
  },
  description:
    "Order fresh homestyle thalis, biryani, Chinese combos, subscriptions, and corporate meals online from Wah Thali in Kolkata.",
  applicationName: "Wah Thali",
  keywords: [
    "Wah Thali",
    "thali delivery Kolkata",
    "homestyle food Kolkata",
    "biryani delivery Kolkata",
    "Indian food delivery",
    "corporate meals Kolkata",
    "fresh thali online",
  ],
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/wah-thali-icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/wah-thali-apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Wah Thali",
    description: "Fresh homestyle thalis, biryani, combos, loyalty rewards, and corporate meals in Kolkata.",
    url: "/",
    siteName: "Wah Thali",
    images: [
      {
        url: "/wah-thali-logo-cutout.png",
        width: 1200,
        height: 630,
        alt: "Wah Thali",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wah Thali | Fresh Homestyle Thalis in Kolkata",
    description: "Order fresh thalis, biryani, combos, subscriptions, and corporate meals online from Wah Thali.",
    images: ["/wah-thali-logo-cutout.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    google: "g0-T2eGUlGKcfn9fsfg6FIrBu2UCNagP5x0cvsUdjO4",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#8D0021",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://wahthali.in";
  const restaurantJsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: business.brandName,
    legalName: business.legalName,
    url: siteUrl,
    image: `${siteUrl}/wah-thali-logo-cutout.png`,
    telephone: `+91${business.phone}`,
    email: business.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address,
      addressLocality: business.city,
      addressRegion: business.state,
      addressCountry: "IN",
    },
    servesCuisine: ["Indian", "Thali", "Biryani", "Homestyle meals"],
    priceRange: "INR",
    openingHours: "Mo-Su 11:30-22:00",
    sameAs: [business.facebookUrl, business.instagramUrl, business.googleBusinessUrl],
    potentialAction: {
      "@type": "OrderAction",
      target: `${siteUrl}/menu`,
    },
  };

  return (
    <html
      lang="en"
      className={`${foodieSans.variable} ${foodieSans.className} h-full antialiased`}
      data-scroll-behavior="smooth"
    >
      <body className="wt-soft-type min-h-full flex flex-col font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd).replace(/</g, "\\u003c") }}
        />
        <LegacyStorageCleanup />
        <NavigationPerformance>{children}</NavigationPerformance>
      </body>
    </html>
  );
}
