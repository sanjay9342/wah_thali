import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wah Thali | Fresh Indian Meals",
  description:
    "Order thalis, biryani, Chinese combos, subscriptions, and corporate meals from Wah Thali.",
  manifest: "/manifest.json",
  openGraph: {
    title: "Wah Thali",
    description: "Fresh thalis, fast delivery, loyalty rewards, and corporate meals.",
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
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
