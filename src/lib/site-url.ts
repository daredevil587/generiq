// Base URL for canonical links, sitemaps and OG tags.
// Set NEXT_PUBLIC_SITE_URL in Vercel env vars once you have a custom domain.
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
).replace(/\/$/, "");
