import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getMedicineById,
  getPricesByMedicineId,
  getIngredientsByMedicineId,
  parseBrandNames,
} from "@/lib/medicines-dal";
import PriceTable from "@/components/PriceTable";
import BackButton from "@/components/BackButton";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return {};

  const [medicine, prices] = await Promise.all([
    getMedicineById(numId),
    getPricesByMedicineId(numId),
  ]);
  if (!medicine) return {};

  const retailPrices = prices.filter(p => p.source !== "nhs_drug_tariff");
  const minPrice = retailPrices.length > 0
    ? Math.min(...retailPrices.map(p => parseFloat(p.price_gbp)))
    : null;

  const priceText = minPrice !== null ? ` Prices from £${minPrice.toFixed(2)}.` : "";
  const canonicalUrl = `${siteUrl}/medicine/${numId}`;

  return {
    title: `${medicine.name} Price Comparison UK — Find Cheapest | GeneriQ`,
    description: `Compare ${medicine.name} prices across Boots, Superdrug, Pharmacy2U and more. Find the cheapest option instantly.${priceText}`,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${medicine.name} — Cheapest UK Price | GeneriQ`,
      description: `Find the cheapest price for ${medicine.name} across UK pharmacies.${priceText}`,
      url: canonicalUrl,
      siteName: "GeneriQ",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${medicine.name} — Cheapest UK Price | GeneriQ`,
      description: `Find the cheapest price for ${medicine.name} across UK pharmacies.${priceText}`,
    },
  };
}

export default async function MedicinePage({ params }: Props) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) notFound();

  const [medicine, prices, ingredients] = await Promise.all([
    getMedicineById(numId),
    getPricesByMedicineId(numId),
    getIngredientsByMedicineId(numId),
  ]);

  if (!medicine) notFound();

  const brands = parseBrandNames(medicine.brand_names);

  // JSON-LD structured data for Google rich results
  const retailPrices = prices.filter(p => p.source !== "nhs_drug_tariff")
    .sort((a, b) => parseFloat(a.price_gbp) - parseFloat(b.price_gbp));
  const activeIngredients = ingredients.filter(i => i.is_active);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": medicine.name,
    "description": medicine.description || `${medicine.name} — UK price comparison`,
    "url": `${siteUrl}/medicine/${medicine.id}`,
    ...(activeIngredients.length > 0 && {
      "activeIngredient": activeIngredients.map(i =>
        i.quantity ? `${i.ingredient_name} ${i.quantity}` : i.ingredient_name
      ).join(", "),
    }),
    ...(medicine.dosage_form && { "dosageForm": medicine.dosage_form }),
    ...(brands.length > 0 && {
      "brand": { "@type": "Brand", "name": brands[0] },
    }),
    ...(retailPrices.length > 0 && {
      "offers": {
        "@type": "AggregateOffer",
        "lowPrice": parseFloat(retailPrices[0].price_gbp).toFixed(2),
        "highPrice": parseFloat(retailPrices[retailPrices.length - 1].price_gbp).toFixed(2),
        "priceCurrency": "GBP",
        "offerCount": retailPrices.length,
        "offers": retailPrices.map(p => ({
          "@type": "Offer",
          "seller": { "@type": "Organization", "name": p.pharmacy_name },
          "price": parseFloat(p.price_gbp).toFixed(2),
          "priceCurrency": "GBP",
          "availability": p.in_stock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          ...(p.pharmacy_url && { "url": p.pharmacy_url }),
        })),
      },
    }),
  };

  // Map DB category to tab key and display label
  const tabKey   = medicine.category === "supplement" ? "supplements"
                 : medicine.category === "skincare"   ? "skincare"
                 : "medicines";
  const tabLabel = medicine.category === "supplement" ? "Supplements"
                 : medicine.category === "skincare"   ? "Skincare & Beauty"
                 : "Medicines";
  const fallbackHref = `/search?tab=${tabKey}`;

  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

      {/* Back button + breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
        <BackButton fallbackHref={fallbackHref} label={`Back to ${tabLabel}`} />

        <nav className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] overflow-x-auto whitespace-nowrap">
          <Link href="/" className="hover:text-[var(--color-brand)] shrink-0">Home</Link>
          <span>/</span>
          <Link href={fallbackHref} className="hover:text-[var(--color-brand)] shrink-0">{tabLabel}</Link>
          <span>/</span>
          <span className="text-[var(--color-foreground)] truncate max-w-[160px] sm:max-w-xs">{medicine.name}</span>
        </nav>
      </div>

      {/* Header card */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 sm:p-6 mb-5">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs bg-[var(--color-brand-light)] text-[var(--color-brand)] font-medium px-2.5 py-0.5 rounded-full">
            {medicine.category}
          </span>
          {medicine.mhra_approved && (
            <span className="text-xs bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              MHRA Approved
            </span>
          )}
        </div>

        {/* Title row */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-foreground)] leading-tight">{medicine.name}</h1>
            {medicine.generic_name && medicine.generic_name !== medicine.name && (
              <p className="text-sm text-[var(--color-muted)] mt-1">Generic: {medicine.generic_name}</p>
            )}
          </div>
          <div className="text-right space-y-1.5 shrink-0">
            {medicine.bnf_code && (
              <div>
                <p className="text-[10px] text-[var(--color-muted)] uppercase tracking-wide">BNF Code</p>
                <p className="font-mono text-sm text-[var(--color-foreground)]">{medicine.bnf_code}</p>
              </div>
            )}
          </div>
        </div>

        {medicine.description && (
          <p className="mt-4 text-[var(--color-muted)] text-sm leading-relaxed">{medicine.description}</p>
        )}

        {medicine.dosage_form && (
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            <span className="font-medium text-[var(--color-foreground)]">Form: </span>{medicine.dosage_form}
          </p>
        )}

        {/* Active ingredients */}
        {ingredients.filter(i => i.is_active).length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-[var(--color-muted)] font-medium mb-2 uppercase tracking-wide">Active ingredients</p>
            <div className="flex flex-wrap gap-2">
              {ingredients.filter(i => i.is_active).map((ing) => (
                <span key={ing.id} className="text-xs bg-[var(--color-brand-light)] text-[var(--color-brand)] px-2.5 py-1 rounded-full font-medium">
                  {ing.ingredient_name}{ing.quantity ? ` ${ing.quantity}` : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Brand names */}
        {brands.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-muted)] mb-1.5 uppercase tracking-wide">Also sold as</p>
            <div className="flex flex-wrap gap-1.5">
              {brands.map((b) => (
                <span key={b} className="text-xs bg-[var(--color-surface-2)] text-[var(--color-muted)] px-2 py-0.5 rounded-full">{b}</span>
              ))}
            </div>
          </div>
        )}

        {/* MHRA link */}
        <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
          <a
            href={`https://products.mhra.gov.uk/search/?search=${encodeURIComponent(medicine.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--color-brand)] hover:text-[var(--color-brand-dark)] font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View on MHRA Products
          </a>
        </div>
      </div>

      {/* Price comparison */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 sm:p-6">
        <h2 className="font-bold text-[var(--color-foreground)] text-lg mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Price Comparison
        </h2>
        <PriceTable prices={prices} medicineName={medicine.name} />
      </div>

      {/* Disclaimer */}
      <div className="mt-5 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl p-4">
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          <strong>Important:</strong> Prices are for comparison purposes only and may vary. Many medicines require a valid UK prescription. Always consult your GP or pharmacist. NHS prescription charge is currently £{(9.90).toFixed(2)}/item (free for eligible patients).
        </p>
      </div>

    </div>
    </>
  );
}
