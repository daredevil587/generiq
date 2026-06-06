import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";
import { getDB } from "@/lib/db";

// Regenerate every 24 hours — covers new products added by scrapers
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl,                             lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${siteUrl}/search`,                 lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
    { url: `${siteUrl}/search?tab=medicines`,   lastModified: new Date(), changeFrequency: "daily",   priority: 0.8 },
    { url: `${siteUrl}/search?tab=supplements`, lastModified: new Date(), changeFrequency: "daily",   priority: 0.8 },
    { url: `${siteUrl}/search?tab=skincare`,    lastModified: new Date(), changeFrequency: "daily",   priority: 0.8 },
    { url: `${siteUrl}/about`,                  lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/privacy`,                lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${siteUrl}/terms`,                  lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
  ];

  // Fetch only id + created_at — falls back to static-only if D1 unavailable at build time
  try {
    const db = await getDB();
    const { results } = await db.prepare(
      "SELECT id, created_at FROM medicines ORDER BY id",
    ).all<{ id: number; created_at: string }>();

    const productPages: MetadataRoute.Sitemap = results.map((m) => ({
      url: `${siteUrl}/medicine/${m.id}`,
      lastModified: new Date(m.created_at),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    return [...staticPages, ...productPages];
  } catch {
    return staticPages;
  }
}
