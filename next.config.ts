import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Only wire up Cloudflare bindings during `next dev` — not during `next build`.
// The production build (pages:build) uses the real Cloudflare environment.
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {};

export default nextConfig;
