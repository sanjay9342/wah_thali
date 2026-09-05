import type { MetadataRoute } from "next";
import { policies } from "@/lib/business";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://wahthali.in").replace(/\/$/, "");

const publicRoutes: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/menu", changeFrequency: "daily", priority: 0.95 },
  { path: "/offers", changeFrequency: "daily", priority: 0.85 },
  { path: "/bulkorders", changeFrequency: "monthly", priority: 0.75 },
  { path: "/about", changeFrequency: "monthly", priority: 0.75 },
  { path: "/corporate", changeFrequency: "monthly", priority: 0.7 },
  { path: "/subscriptions", changeFrequency: "monthly", priority: 0.65 },
  { path: "/support", changeFrequency: "monthly", priority: 0.6 },
  { path: "/delivery-policy", changeFrequency: "monthly", priority: 0.55 },
  { path: "/privacy-security", changeFrequency: "monthly", priority: 0.5 },
  { path: "/data-deletion", changeFrequency: "yearly", priority: 0.4 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const policyRoutes = policies.map((policy) => ({
    path: `/${policy.slug}`,
    changeFrequency: "yearly" as const,
    priority: 0.45,
  }));
  const seenPaths = new Set<string>();

  return [...publicRoutes, ...policyRoutes]
    .filter((route) => {
      if (seenPaths.has(route.path)) {
        return false;
      }
      seenPaths.add(route.path);
      return true;
    })
    .map((route) => ({
      url: `${siteUrl}${route.path}`,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    }));
}
