import type { NextConfig } from "next";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  ? new URL((process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) as string).hostname
  : "tixqalkhnfmfvfepgrbd.supabase.co";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    viewTransition: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHostname,
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 24,
  },
};

export default nextConfig;
