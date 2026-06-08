import Link from "next/link";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";
import { getRetailerCoverage } from "@/lib/medicines-dal";

export const metadata: Metadata = {
  title: "Retailer Coverage - GeneriQ",
  description: "See which pharmacies, retailers and official data sources GeneriQ compares, including update status and stock coverage.",
  alternates: { canonical: `${siteUrl}/coverage` },
};

function formatDate(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function CoveragePage() {
  const retailers = await getRetailerCoverage().catch(() => []);
  const officialSources = [
    {
      name: "MHRA Products Database",
      coverage: "Licensed medicine names, ingredients and regulatory signals",
      frequency: "Reference data",
      status: "Live",
      href: "https://products.mhra.gov.uk",
    },
    {
      name: "NHS Drug Tariff",
      coverage: "NHS reimbursement and prescription comparison reference prices",
      frequency: "Monthly source",
      status: "Live",
      href: "https://www.nhsbsa.nhs.uk/pharmacies-gp-practices-and-appliance-contractors/drug-tariff",
    },
    {
      name: "Open Food Facts / Open Beauty Facts",
      coverage: "Barcode lookup fallback for supplements, beauty and packaged health products",
      frequency: "Lookup on demand",
      status: "Live fallback",
      href: "https://world.openfoodfacts.org",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--color-foreground)] mb-2">Retailer coverage</h1>
        <p className="text-[var(--color-muted)] max-w-2xl">
          GeneriQ shows where price data comes from, how much coverage each retailer has, and what is still missing. This keeps health price comparison transparent.
        </p>
      </div>

      <section className="mb-8">
        <h2 className="font-bold text-[var(--color-foreground)] mb-4">Live retailer prices</h2>
        {retailers.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="hidden sm:grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-3 bg-[var(--color-surface-2)] text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              <span>Retailer</span>
              <span>Products</span>
              <span>Stock verified</span>
              <span>Last checked</span>
              <span>Source</span>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {retailers.map(retailer => (
                <Link
                  key={retailer.pharmacy_name}
                  href={`/pharmacy/${retailer.slug}`}
                  className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-2 sm:gap-3 px-4 py-4 hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  <span>
                    <span className="block font-semibold text-[var(--color-foreground)]">{retailer.pharmacy_name}</span>
                    <span className="block text-xs text-[var(--color-muted)]">Retail price feed</span>
                  </span>
                  <span className="text-sm text-[var(--color-muted)]">{retailer.product_count.toLocaleString()} products</span>
                  <span className="text-sm text-[var(--color-muted)]">{retailer.in_stock_count.toLocaleString()} rows</span>
                  <span className="text-sm text-[var(--color-muted)]">{formatDate(retailer.last_checked)}</span>
                  <span className="text-sm text-[var(--color-muted)]">{retailer.sources || "retailer"}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-muted)]">
            No live retailer coverage is available in the current database.
          </div>
        )}
      </section>

      <section>
        <h2 className="font-bold text-[var(--color-foreground)] mb-4">Official and open data sources</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {officialSources.map(source => (
            <a
              key={source.name}
              href={source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 hover:border-[var(--color-brand)] transition-colors"
            >
              <span className="text-xs bg-[var(--color-brand-light)] text-[var(--color-brand)] font-semibold px-2 py-1 rounded-full">{source.status}</span>
              <h3 className="font-bold text-[var(--color-foreground)] mt-3 mb-2">{source.name}</h3>
              <p className="text-sm text-[var(--color-muted)] mb-3">{source.coverage}</p>
              <p className="text-xs text-[var(--color-muted)]">Update: {source.frequency}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="font-bold text-[var(--color-foreground)] mb-2">Commercial disclosure</h2>
        <p className="text-sm text-[var(--color-muted)] leading-relaxed">
          GeneriQ may earn affiliate commission when users click through to some retailers. Price comparison should stay cheapest-first; any sponsored placement or pharmacy lead partnership must be clearly labelled and separated from organic cheapest-price results.
        </p>
      </section>
    </div>
  );
}
