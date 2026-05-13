"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import type { PriceRow } from "@/lib/medicines-dal";
import { formatGBP, pricePerUnit } from "@/lib/format-utils";
import { NHS_RX_CHARGE, PPC_ANNUAL, PPC_3MONTH } from "@/lib/config";

interface Props {
  prices: PriceRow[];
  medicineName?: string;
}

// Pharmacies with known student / NHS discounts
const STUDENT_DISCOUNTS: Record<string, { label: string; url: string }> = {
  "Superdrug": {
    label: "10% student discount",
    url:   "https://www.superdrug.com/student-discount",
  },
  "Boots": {
    label: "NHS & student offers",
    url:   "https://www.boots.com/offers/student-discount",
  },
  "Holland & Barrett": {
    label: "Student discount available",
    url:   "https://www.hollandandbarrett.com/info/student-discount/",
  },
};

const PHARMACY_COLORS: Record<string, string> = {
  "Pharmacy2U":      "bg-blue-600",
  "Boots":           "bg-sky-500",
  "Lloyds Pharmacy": "bg-indigo-600",
  "Well Pharmacy":   "bg-teal-600",
  "Day Lewis":       "bg-orange-500",
  "Holland & Barrett": "bg-orange-600",
  "Superdrug":       "bg-pink-600",
};

function pharmacyInitials(name: string) {
  return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 3);
}

export default function PriceTable({ prices, medicineName }: Props) {
  const [nhsExpanded, setNhsExpanded] = useState(false);
  const [expandedId, setExpandedId]   = useState<number | null>(null);

  const nhsPrices = useMemo(
    () => [...prices.filter(p => p.source === "nhs_drug_tariff")]
            .sort((a, b) => parseFloat(a.price_gbp) - parseFloat(b.price_gbp)),
    [prices],
  );

  const retailPrices = useMemo(
    () => [...prices.filter(p => p.source !== "nhs_drug_tariff")]
            .sort((a, b) => parseFloat(a.price_gbp) - parseFloat(b.price_gbp)),
    [prices],
  );

  const nhsCheapest       = nhsPrices[0] ?? null;
  const retailCheapestVal = retailPrices[0] ? parseFloat(retailPrices[0].price_gbp) : null;
  const retailDearestVal  = retailPrices.at(-1) ? parseFloat(retailPrices.at(-1)!.price_gbp) : null;
  const retailSaving      = retailCheapestVal !== null && retailDearestVal !== null && retailDearestVal > retailCheapestVal
                              ? retailDearestVal - retailCheapestVal : null;

  const buyOtc    = retailCheapestVal !== null && retailCheapestVal < NHS_RX_CHARGE;
  const otcSaving = buyOtc && retailCheapestVal !== null ? NHS_RX_CHARGE - retailCheapestVal : null;
  const rxSaving  = !buyOtc && retailCheapestVal !== null ? retailCheapestVal - NHS_RX_CHARGE : null;

  if (prices.length === 0) {
    const shoppingUrl = medicineName
      ? `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(medicineName)}`
      : null;
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-[var(--color-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
        </div>
        <p className="font-semibold text-[var(--color-foreground)] mb-1">Check retailer for current price</p>
        <p className="text-sm text-[var(--color-muted)] mb-5">
          We don&apos;t have live pricing for this product yet.
        </p>
        {shoppingUrl && (
          <a
            href={shoppingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            Search on Google Shopping
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Savings hero — shown when retail prices exist ─────────────────── */}
      {retailPrices.length > 0 && (
        <div className="rounded-2xl overflow-hidden border border-[var(--color-border)]">
          {/* Cheapest option — prominent */}
          <div className="bg-[var(--color-brand)] px-5 py-5 sm:py-6">
            <div className="flex items-start justify-between gap-4">
              {/* Product image — shown if scraped */}
              {retailPrices[0].image_url && (
                <Image
                  src={retailPrices[0].image_url}
                  alt={retailPrices[0].pharmacy_name}
                  width={96}
                  height={96}
                  priority
                  unoptimized
                  className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-xl bg-white/10 border border-white/20 shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-1">Cheapest option</p>
                <p className="text-xl sm:text-2xl font-bold text-white leading-tight">
                  {retailPrices[0].pharmacy_name}
                </p>
                {retailPrices[0].pack_size && (
                  <p className="text-sm text-white/70 mt-0.5">{[retailPrices[0].strength, retailPrices[0].pack_size].filter(Boolean).join(" · ")}</p>
                )}
                {retailPrices[0].offer_text && (
                  <span className="inline-block mt-1.5 text-[10px] bg-amber-400/30 text-amber-100 font-semibold px-2 py-0.5 rounded-full">
                    {retailPrices[0].offer_text}
                  </span>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-3xl sm:text-4xl font-extrabold text-white tabular-nums leading-none">
                  {formatGBP(retailPrices[0].price_gbp)}
                </p>
                {pricePerUnit(retailPrices[0].price_gbp, retailPrices[0].pack_size) && (
                  <p className="text-xs text-white/60 tabular-nums mt-0.5">
                    {pricePerUnit(retailPrices[0].price_gbp, retailPrices[0].pack_size)}
                  </p>
                )}
                <a
                  href={`/go/${retailPrices[0].id}`}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  onClick={e => e.stopPropagation()}
                  className="inline-flex items-center gap-1 mt-2 text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1.5 rounded-full transition-colors"
                >
                  Buy now
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Savings bar — shown when multiple retail prices */}
          {retailSaving !== null && retailSaving > 0.01 && (
            <div className="bg-[var(--color-brand-light)] px-5 py-3 flex items-center justify-between gap-3 border-t border-[var(--color-brand)]/20">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--color-brand)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <p className="text-sm font-semibold text-[var(--color-brand-dark)]">
                  Save <span className="text-base">{formatGBP(retailSaving)}</span> vs {retailPrices.at(-1)!.pharmacy_name}
                </p>
              </div>
              <p className="text-xs text-[var(--color-brand-dark)] opacity-70 text-right hidden sm:block">
                by choosing the cheapest option
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── NHS Prescription ─────────────────────────────────────────────── */}
      {nhsCheapest && (
        <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
          <button
            onClick={() => setNhsExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 bg-[var(--color-brand-light)] hover:brightness-95 transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--color-brand)] text-white text-[10px] font-extrabold tracking-tight shrink-0">
                NHS
              </span>
              <div>
                <p className="font-semibold text-[var(--color-brand-dark)] text-sm leading-tight">NHS Prescription</p>
                <p className="text-xs text-[var(--color-brand-dark)] opacity-60 mt-0.5">Via prescription · tap for details</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className="text-[10px] text-[var(--color-brand-dark)] opacity-60 uppercase tracking-wide">NHS cost</p>
                <p className="text-xl font-bold text-[var(--color-brand)] tabular-nums">{formatGBP(nhsCheapest.price_gbp)}</p>
              </div>
              <svg className={`w-4 h-4 text-[var(--color-brand)] transition-transform duration-200 ${nhsExpanded ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {nhsExpanded && (
            <div className="bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
              {/* Cost breakdown */}
              <div className="px-4 py-4">
                <p className="text-sm text-[var(--color-foreground)] mb-3">
                  Via NHS prescription you pay{" "}
                  <strong>£{NHS_RX_CHARGE.toFixed(2)} per item</strong>{" "}
                  regardless of the medicine&apos;s actual cost.
                </p>
                <div className="rounded-lg border border-[var(--color-border)] overflow-hidden text-sm">
                  <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--color-surface-2)]">
                    <span className="text-[var(--color-muted)]">Medicine NHS cost</span>
                    <span className="font-semibold tabular-nums text-[var(--color-foreground)]">{formatGBP(nhsCheapest.price_gbp)}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2.5 border-t border-[var(--color-border)]">
                    <span className="text-[var(--color-muted)]">Your prescription charge</span>
                    <span className="font-bold tabular-nums text-[var(--color-foreground)]">£{NHS_RX_CHARGE.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* OTC vs prescription */}
              {retailCheapestVal !== null && (
                <div className="px-4 py-4">
                  <p className="text-sm font-semibold text-[var(--color-foreground)] mb-3">Is it cheaper to buy over the counter?</p>
                  <div className="rounded-lg border border-[var(--color-border)] overflow-hidden text-sm mb-3">
                    <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--color-surface-2)]">
                      <span className="text-[var(--color-muted)]">NHS prescription charge</span>
                      <span className="font-semibold tabular-nums">£{NHS_RX_CHARGE.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5 border-t border-[var(--color-border)]">
                      <span className="text-[var(--color-muted)]">Cheapest retail ({retailPrices[0]?.pharmacy_name})</span>
                      <span className="font-semibold tabular-nums">{formatGBP(retailCheapestVal)}</span>
                    </div>
                  </div>
                  {buyOtc ? (
                    <div className="flex items-center gap-3 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 px-3 py-3">
                      <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-bold text-green-800 dark:text-green-300">BUY AT PHARMACY — save {formatGBP(otcSaving!)}</p>
                        <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">Buying over the counter is cheaper than a prescription</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg bg-[var(--color-brand-light)] border border-[var(--color-brand)]/20 px-3 py-3">
                      <svg className="w-4 h-4 text-[var(--color-brand)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-bold text-[var(--color-brand-dark)]">
                          USE YOUR PRESCRIPTION{rxSaving !== null && rxSaving > 0 ? ` — save ${formatGBP(rxSaving)}` : ""}
                        </p>
                        <p className="text-xs text-[var(--color-brand-dark)] opacity-75 mt-0.5">Your prescription is cheaper than buying over the counter</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Exemptions */}
              <div className="px-4 py-4">
                <p className="text-sm font-semibold text-[var(--color-foreground)] mb-2">Free prescriptions — are you eligible?</p>
                <ul className="space-y-1.5 mb-3">
                  {[
                    "Under 16, or under 19 in full-time education",
                    "60 or over",
                    "Pregnant or new mother (within 12 months)",
                    "Qualifying long-term condition (diabetes, epilepsy etc.)",
                    "HC2/HC3 certificate holder (low income)",
                    "Receiving Universal Credit, Income Support or ESA",
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2 text-xs text-[var(--color-foreground)]">
                      <svg className="w-3.5 h-3.5 text-[var(--color-brand)] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <a href="https://www.nhs.uk/nhs-services/prescriptions-and-pharmacies/who-can-get-free-prescriptions/" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-brand)] hover:underline">
                  Check if you&apos;re exempt →
                </a>
              </div>

              {/* PPC */}
              <div className="px-4 py-3.5 bg-[var(--color-surface-2)]">
                <p className="text-xs text-[var(--color-foreground)]">
                  <strong>Multiple prescriptions?</strong>{" "}
                  A Prescription Prepayment Certificate (PPC) covers unlimited items for{" "}
                  <strong>£{PPC_3MONTH.toFixed(2)}/3 months</strong> or <strong>£{PPC_ANNUAL.toFixed(2)}/year</strong>.{" "}
                  <a href="https://www.nhsbsa.nhs.uk/help-nhs-prescription-costs/prescription-prepayment-certificates-ppcs" target="_blank" rel="noopener noreferrer"
                    className="text-[var(--color-brand)] font-semibold hover:underline">Get PPC →</a>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── All retail prices ────────────────────────────────────────────── */}
      {retailPrices.length > 1 && (
        <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--color-surface-2)] border-b border-[var(--color-border)]">
            <p className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide">All prices compared</p>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {retailPrices.map((p, i) => {
              const isCheapest = i === 0;
              const priceVal   = parseFloat(p.price_gbp);
              const diff       = retailCheapestVal !== null ? priceVal - retailCheapestVal : 0;
              const colorCls   = PHARMACY_COLORS[p.pharmacy_name] ?? "bg-gray-400";
              const isExpanded = expandedId === p.id;

              return (
                <div key={p.id}>
                  {/* ── Main row — click to expand image ── */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                    onKeyDown={e => e.key === "Enter" && setExpandedId(isExpanded ? null : p.id)}
                    className={`flex items-center gap-3 px-4 py-3.5 transition-colors cursor-pointer select-none ${
                      isCheapest ? "bg-[var(--color-brand-light)]" : "hover:bg-[var(--color-surface-2)]"
                    }`}
                  >
                    {/* Logo avatar */}
                    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-white text-xs font-bold shrink-0 ${colorCls}`}>
                      {pharmacyInitials(p.pharmacy_name)}
                    </span>

                    {/* Name + badges */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[var(--color-foreground)] truncate">{p.pharmacy_name}</p>
                      {(p.strength || p.pack_size) && (
                        <p className="text-xs text-[var(--color-muted)] truncate">{[p.strength, p.pack_size].filter(Boolean).join(" · ")}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {isCheapest && (
                          <span className="text-xs text-[var(--color-brand)] font-semibold">Cheapest</span>
                        )}
                        {p.offer_text && (
                          <span className="text-[10px] bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 font-semibold px-1.5 py-0.5 rounded-full">
                            {p.offer_text}
                          </span>
                        )}
                        {STUDENT_DISCOUNTS[p.pharmacy_name] && (
                          <a
                            href={STUDENT_DISCOUNTS[p.pharmacy_name].url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-[10px] bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-semibold px-1.5 py-0.5 rounded-full hover:opacity-80 transition-opacity"
                          >
                            🎓 {STUDENT_DISCOUNTS[p.pharmacy_name].label}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Stock */}
                    <div>
                      {p.in_stock ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                          <span className="hidden sm:inline">In stock</span>
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--color-muted)] whitespace-nowrap hidden sm:inline">Out of stock</span>
                      )}
                    </div>

                    {/* Price + per-unit */}
                    <div className="text-right shrink-0">
                      <p className={`font-bold tabular-nums ${isCheapest ? "text-[var(--color-brand)] text-lg" : "text-[var(--color-foreground)]"}`}>
                        {formatGBP(p.price_gbp)}
                        {diff > 0.005 && (
                          <span className="ml-1 text-xs font-normal text-[var(--color-muted)]">+{formatGBP(diff)}</span>
                        )}
                      </p>
                      {pricePerUnit(p.price_gbp, p.pack_size) && (
                        <p className="text-xs text-[var(--color-muted)] tabular-nums">{pricePerUnit(p.price_gbp, p.pack_size)}</p>
                      )}
                    </div>

                    {/* Expand chevron */}
                    <svg
                      className={`w-4 h-4 text-[var(--color-muted)] shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* ── Expanded panel — product image + buy button ── */}
                  {isExpanded && (
                    <div className="flex items-center gap-4 px-4 py-4 bg-[var(--color-surface-2)] border-t border-[var(--color-border)]">
                      {p.image_url ? (
                        <Image
                          src={p.image_url}
                          alt={`${p.pharmacy_name} product`}
                          width={96}
                          height={96}
                          unoptimized
                          className="w-24 h-24 object-contain rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shrink-0"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center shrink-0">
                          <svg className="w-8 h-8 text-[var(--color-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h.01M15 12h.01M12 12h.01M3 12c0 4.97 4.03 9 9 9s9-4.03 9-9-4.03-9-9-9-9 4.03-9 9z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-[var(--color-foreground)]">{p.pharmacy_name}</p>
                        <p className="text-2xl font-extrabold text-[var(--color-brand)] tabular-nums mt-0.5">{formatGBP(p.price_gbp)}</p>
                        {p.offer_text && (
                          <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mt-1">{p.offer_text}</p>
                        )}
                      </div>
                      <a
                        href={`/go/${p.id}`}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        onClick={e => e.stopPropagation()}
                        className="shrink-0 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm"
                      >
                        Buy now →
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--color-muted)] pt-1">
        NHS prices from NHS Drug Tariff — what the NHS pays. Retail prices may vary. Always verify with the pharmacy before purchase.
      </p>
    </div>
  );
}
