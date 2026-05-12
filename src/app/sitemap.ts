import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";
import pool from "@/lib/db";

// Regenerate every 24 hours — covers new products added by scrapers
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl,                            lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${siteUrl}/search`,                lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
    { url: `${siteUrl}/search?tab=medicines`,  lastModified: new Date(), changeFrequency: "daily",   priority: 0.8 },
    { url: `${siteUrl}/search?tab=supplements`,lastModified: new Date(), changeFrequency: "daily",   priority: 0.8 },
    { url: `${siteUrl}/search?tab=skincare`,   lastModified: new Date(), changeFrequency: "daily",   priority: 0.8 },
    { url: `${siteUrl}/about`,                 lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/privacy`,               lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${siteUrl}/terms`,                 lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
  ];

  // All product pages — fetch only id + created_at to keep memory small
  const res = await pool.query<{ id: number; created_at: Date }>(
    "SELECT id, created_at FROM medicines ORDER BY id",
  );

  const productPages: MetadataRoute.Sitemap = res.rows.map((m) => ({
    url: `${siteUrl}/medicine/${m.id}`,
    lastModified: m.created_at,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticPages, ...productPages];
}
