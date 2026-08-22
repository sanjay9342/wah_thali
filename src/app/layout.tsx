import type { Metadata, Viewport } from "next";
import { Chewy, Nunito } from "next/font/google";
import { LegacyStorageCleanup } from "@/components/legacy-storage-cleanup";
import { NavigationPerformance } from "@/components/navigation-performance";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

const chewy = Chewy({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Wah Thali | Fresh Homestyle Thalis in Kolkata",
  description:
    "Order fresh thalis, biryani, Chinese combos, subscriptions, and corporate meals from Wah Thali, a unit of Backyard Bol LLP.",
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
    description: "Fresh thalis, fast delivery, loyalty rewards, and corporate meals in Kolkata.",
    type: "website",
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
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${chewy.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LegacyStorageCleanup />
        <NavigationPerformance>{children}</NavigationPerformance>
      </body>
    </html>
  );
}
