import { policies } from "@/lib/business";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://wahthali.in").replace(/\/$/, "");

const publicPaths = [
  "/",
  "/menu",
  "/offers",
  "/bulkorders",
  "/about",
  "/corporate",
  "/subscriptions",
  "/support",
  "/delivery-policy",
  "/privacy-security",
  "/data-deletion",
];

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const dynamic = "force-static";
export const revalidate = 86400;

export function GET() {
  const seenPaths = new Set<string>();
  const paths = [...publicPaths, ...policies.map((policy) => `/${policy.slug}`)].filter((path) => {
    if (seenPaths.has(path)) {
      return false;
    }
    seenPaths.add(path);
    return true;
  });

  const urls = paths.map((path) => `<url><loc>${escapeXml(`${siteUrl}${path}`)}</loc></url>`).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new Response(xml, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=86400",
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
