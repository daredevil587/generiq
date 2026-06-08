import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getMedicineById,
  getPricesByMedicineId,
  getIngredientsByMedicineId,
  getGenericAlternatives,
  parseBrandNames,
} from "@/lib/medicines-dal";
import { formatGBP } from "@/lib/format-utils";
import { NHS_RX_CHARGE, PPC_ANNUAL } from "@/lib/config";
import PriceTable from "@/components/PriceTable";
import BackButton from "@/components/BackButton";
import TrackView from "@/components/TrackView";
import WatchPrice from "@/components/WatchPrice";
import NhsEligibilityChecker from "@/components/NhsEligibilityChecker";
import SavingsSummary from "@/components/SavingsSummary";
import ProductTrustDashboard from "@/components/ProductTrustDashboard";
import GenericEquivalence from "@/components/GenericEquivalence";
import PriceHistorySnapshot from "@/components/PriceHistorySnapshot";
import SaveMedicineButton from "@/components/SaveMedicineButton";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";
import { slugify } from "@/lib/format-utils";

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

  const alternatives = await getGenericAlternatives(
    numId,
    medicine.generic_name,
    medicine.active_ingredient,
  );

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

  // Retail min price (for TrackView and WatchPrice)
  const retailMinPrice = retailPrices[0]?.price_gbp ?? null;

  // NHS prescription charge and PPC constants
  // NHS constants imported from @/lib/config

  // ── Feature E: cheaper alternative with same ingredient ──────────────────
  const retailCheapestVal = retailPrices[0] ? parseFloat(retailPrices[0].price_gbp) : null;
  const cheaperAlternative = alternatives.find(
    alt => alt.min_price !== null && parseFloat(alt.min_price) < (retailCheapestVal ?? Infinity)
  ) ?? null;

  // ── Feature D: annual savings calculator ─────────────────────────────────
  const otcSavingPerItem = retailCheapestVal !== null ? NHS_RX_CHARGE - retailCheapestVal : null;
  const buyOtcIsCheaper  = retailCheapestVal !== null && retailCheapestVal < NHS_RX_CHARGE;

  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
    <TrackView id={medicine.id} name={medicine.name} category={medicine.category} min_price={retailMinPrice} />
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
          <SaveMedicineButton
            id={medicine.id}
            name={medicine.name}
            category={medicine.category}
            min_price={retailMinPrice}
          />
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

        {/* B — What is this used for */}
        {medicine.description && (
          <div className="mt-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] px-4 py-3">
            <p className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-1">What is this used for?</p>
            <p className="text-sm text-[var(--color-foreground)] leading-relaxed">{medicine.description}</p>
          </div>
        )}

        {medicine.dosage_form && (
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            <span className="font-medium text-[var(--color-foreground)]">Form: </span>{medicine.dosage_form}
          </p>
        )}

        {/* Active ingredients — linked to ingredient pages */}
        {ingredients.filter(i => i.is_active).length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-[var(--color-muted)] font-medium mb-2 uppercase tracking-wide">Active ingredients</p>
            <div className="flex flex-wrap gap-2">
              {ingredients.filter(i => i.is_active).map((ing) => (
                <a
                  key={ing.id}
                  href={`/ingredient/${slugify(ing.ingredient_name)}`}
                  className="text-xs bg-[var(--color-brand-light)] text-[var(--color-brand)] px-2.5 py-1 rounded-full font-medium hover:opacity-80 transition-opacity"
                >
                  {ing.ingredient_name}{ing.quantity ? ` ${ing.quantity}` : ""}
                </a>
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

      <ProductTrustDashboard prices={prices} mhraApproved={medicine.mhra_approved} />

      <SavingsSummary prices={prices} category={medicine.category} />

      {/* E — Same ingredient, lower price banner */}
      {cheaperAlternative && (
        <div className="flex items-center gap-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-2xl px-5 py-4 mb-5">
          <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-green-800 dark:text-green-300">
              Same ingredient available for {formatGBP(String(parseFloat(cheaperAlternative.min_price!) ))} less
            </p>
            <p className="text-xs text-green-700 dark:text-green-400 mt-0.5 truncate">
              {cheaperAlternative.name} — same active ingredient, lower price
            </p>
          </div>
          <Link
            href={`/medicine/${cheaperAlternative.id}`}
            className="shrink-0 text-xs font-semibold text-green-700 dark:text-green-400 hover:underline"
          >
            View →
          </Link>
        </div>
      )}

      <GenericEquivalence medicine={medicine} ingredients={ingredients} />

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

      <PriceHistorySnapshot prices={prices} />

      {/* Feature 3 — How to Save More Tips */}
      {medicine.category === 'medicine' && (
        <div className="mt-5">
          {buyOtcIsCheaper && (
            <div className="flex gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl px-5 py-4 mb-3">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C6.5 6.253 2 10.423 2 15.5c0 5.078 4.5 9.247 10 9.247s10-4.169 10-9.247c0-5.077-4.5-9.247-10-9.247z" />
              </svg>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <span className="font-semibold">💡 Buy without prescription:</span> {medicine.name} at {formatGBP(retailCheapestVal!)} is cheaper than the NHS prescription charge. No prescription needed.
              </p>
            </div>
          )}
          {cheaperAlternative && (
            <div className="flex gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl px-5 py-4 mb-3">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C6.5 6.253 2 10.423 2 15.5c0 5.078 4.5 9.247 10 9.247s10-4.169 10-9.247c0-5.077-4.5-9.247-10-9.247z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <span className="font-semibold">💡 Same ingredient, lower price:</span> {cheaperAlternative.name} has the same active ingredient for {formatGBP(String(parseFloat(cheaperAlternative.min_price!)))}.
                </p>
                <Link href={`/medicine/${cheaperAlternative.id}`} className="text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline mt-1 inline-block">
                  Compare →
                </Link>
              </div>
            </div>
          )}
          {retailCheapestVal !== null && retailCheapestVal > 20 && (
            <div className="flex gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl px-5 py-4 mb-3">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C6.5 6.253 2 10.423 2 15.5c0 5.078 4.5 9.247 10 9.247s10-4.169 10-9.247c0-5.077-4.5-9.247-10-9.247z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <span className="font-semibold">💡 Take multiple medicines?</span> A Prescription Prepayment Certificate (PPC) at {formatGBP(String(PPC_ANNUAL))}/year covers all your prescriptions with no per-item charge.
                </p>
                <a href="https://www.nhsbsa.nhs.uk/help-nhs-prescription-costs/prescription-prepayment-certificates-ppcs" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline mt-1 inline-block">
                  Learn about PPC →
                </a>
              </div>
            </div>
          )}
          <div className="flex gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl px-5 py-4">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C6.5 6.253 2 10.423 2 15.5c0 5.078 4.5 9.247 10 9.247s10-4.169 10-9.247c0-5.077-4.5-9.247-10-9.247z" />
            </svg>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <span className="font-semibold">💡 Repeat prescriptions:</span> Ask your GP to set up online repeat prescription ordering to avoid repeat trips to the pharmacy.
            </p>
          </div>
        </div>
      )}

      {/* D — Annual savings calculator (medicines only — not supplements/skincare) */}
      {retailCheapestVal !== null && medicine.category === 'medicine' && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 sm:p-6 mt-5">
          <h2 className="font-bold text-[var(--color-foreground)] text-base mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--color-brand)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            How much could you save per year?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {/* Per prescription */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-center">
              <p className="text-xs text-[var(--color-muted)] mb-1">Per prescription</p>
              <p className="text-2xl font-extrabold tabular-nums text-[var(--color-brand)]">
                {buyOtcIsCheaper ? formatGBP(otcSavingPerItem!) : `£${NHS_RX_CHARGE.toFixed(2)}`}
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-1">
                {buyOtcIsCheaper ? "saved buying OTC" : "NHS charge per item"}
              </p>
            </div>
            {/* 12 per year */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-center">
              <p className="text-xs text-[var(--color-muted)] mb-1">12 prescriptions/year</p>
              <p className="text-2xl font-extrabold tabular-nums text-[var(--color-brand)]">
                {buyOtcIsCheaper
                  ? formatGBP(otcSavingPerItem! * 12)
                  : formatGBP(NHS_RX_CHARGE * 12)}
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-1">
                {buyOtcIsCheaper ? "annual OTC saving" : "annual prescription cost"}
              </p>
            </div>
            {/* PPC comparison */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-center">
              <p className="text-xs text-[var(--color-muted)] mb-1">With annual PPC</p>
              <p className="text-2xl font-extrabold tabular-nums text-[var(--color-brand)]">
                {formatGBP(PPC_ANNUAL)}
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-1">covers unlimited items</p>
            </div>
          </div>
          <p className="text-xs text-[var(--color-muted)] leading-relaxed">
            {buyOtcIsCheaper
              ? `Buying ${medicine.name} over the counter at ${formatGBP(retailCheapestVal)} is cheaper than the £${NHS_RX_CHARGE.toFixed(2)} NHS prescription charge. No prescription needed.`
              : `If you take multiple medicines, a Prescription Prepayment Certificate (PPC) at ${formatGBP(PPC_ANNUAL)}/year covers all your prescriptions with no per-item charge.`}
            {" "}
            <a href="https://www.nhsbsa.nhs.uk/help-nhs-prescription-costs/prescription-prepayment-certificates-ppcs"
              target="_blank" rel="noopener noreferrer"
              className="text-[var(--color-brand)] font-medium hover:underline">
              Learn about PPC →
            </a>
          </p>
        </div>
      )}

      {/* Feature 2 — NHS Eligibility Calculator */}
      {medicine.category === 'medicine' && (
        <NhsEligibilityChecker
          medicineId={medicine.id}
          medicineName={medicine.name}
          retailPrice={retailCheapestVal}
        />
      )}

      {/* Generic alternatives */}
      {alternatives.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 sm:p-6 mt-5">
          <h2 className="font-bold text-[var(--color-foreground)] text-base mb-1 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--color-brand)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            Also compare
          </h2>
          <p className="text-xs text-[var(--color-muted)] mb-4">
            Same active ingredient — check if a cheaper option is available
          </p>
          <div className="divide-y divide-[var(--color-border)]">
            {alternatives.map((alt) => (
              <Link
                key={alt.id}
                href={`/medicine/${alt.id}`}
                className="flex items-center gap-3 py-3 group hover:bg-[var(--color-surface-2)] -mx-5 px-5 sm:-mx-6 sm:px-6 transition-colors first:rounded-t-xl last:rounded-b-xl"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-[var(--color-foreground)] group-hover:text-[var(--color-brand)] transition-colors leading-snug truncate">
                    {alt.name}
                  </p>
                  {alt.dosage_form && (
                    <p className="text-xs text-[var(--color-muted)] mt-0.5">{alt.dosage_form}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {alt.min_price ? (
                    <>
                      <p className="text-[10px] text-[var(--color-muted)] uppercase tracking-wide">from</p>
                      <p className="font-bold text-[var(--color-brand)] tabular-nums">{formatGBP(alt.min_price)}</p>
                    </>
                  ) : (
                    <span className="text-xs text-[var(--color-muted)]">View</span>
                  )}
                </div>
                <svg className="w-4 h-4 text-[var(--color-muted)] group-hover:text-[var(--color-brand)] shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Price drop alert */}
      <div className="mt-5">
        <WatchPrice
          medicineId={medicine.id}
          medicineName={medicine.name}
          currentPrice={retailMinPrice}
        />
      </div>

      {/* Disclaimer */}
      <div className="mt-5 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl p-4">
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          <strong>Important:</strong> Prices are for comparison purposes only and may vary. Many medicines require a valid UK prescription. Always consult your GP or pharmacist. NHS prescription charge is currently £{NHS_RX_CHARGE.toFixed(2)}/item (free for eligible patients).
        </p>
      </div>

    </div>
    </>
  );
}
