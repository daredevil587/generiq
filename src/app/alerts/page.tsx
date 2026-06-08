import Link from "next/link";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Price Alerts - GeneriQ",
  description: "Get notified when medicine and health product prices drop on GeneriQ.",
  alternates: { canonical: `${siteUrl}/alerts` },
};

export default function AlertsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-[var(--color-foreground)] mb-3">Price alerts</h1>
        <p className="text-[var(--color-muted)] mb-6">
          Product pages now support email price-drop alerts. Open a product, compare the current cheapest price, then choose &quot;Get notified when price drops&quot;.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {[
            ["1", "Search", "Find a medicine or health product."],
            ["2", "Compare", "Check the cheapest live price and NHS guidance."],
            ["3", "Alert", "Enter your email on the product page."],
          ].map(([num, title, desc]) => (
            <div key={num} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
              <span className="inline-flex w-7 h-7 rounded-full bg-[var(--color-brand)] text-white items-center justify-center text-xs font-bold mb-3">{num}</span>
              <p className="font-semibold text-[var(--color-foreground)]">{title}</p>
              <p className="text-xs text-[var(--color-muted)] mt-1">{desc}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-[var(--color-brand-light)] border border-[var(--color-brand)]/20 p-4 mb-6">
          <p className="text-sm font-semibold text-[var(--color-brand-dark)] mb-1">How alerts work</p>
          <p className="text-xs text-[var(--color-brand-dark)]/75">
            When a price drops below what you last saw, we&apos;ll send you an email. Alerts are free and you can set them on any product page.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/search" className="inline-flex items-center justify-center bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
            Search products
          </Link>
          <Link href="/profile" className="inline-flex items-center justify-center border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-brand)] hover:border-[var(--color-brand)] font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
            View watchlist
          </Link>
        </div>
      </div>
    </div>
  );
}
