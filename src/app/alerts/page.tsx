import Link from "next/link";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Price Alerts — GeneriQ",
  description: "Get notified when medicine prices drop. Coming soon to GeneriQ.",
  alternates: { canonical: `${siteUrl}/alerts` },
};

export default function AlertsPage() {
  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-[var(--color-brand-light)] flex items-center justify-center mx-auto mb-6">
        <svg className="w-7 h-7 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-[var(--color-foreground)] mb-3">Price Alerts</h1>
      <p className="text-[var(--color-muted)] mb-2">
        Get notified when the price of any medicine drops below your target.
      </p>
      <p className="text-sm text-[var(--color-muted)] mb-8">
        This feature is coming soon — we&apos;re working on it!
      </p>
      <Link href="/" className="inline-flex items-center gap-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm">
        Search medicines now
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
