"use client";

import { useState, useMemo } from "react";
import type { PriceRow } from "@/lib/medicines-dal";
import { formatGBP } from "@/lib/format-utils";

const RX_CHARGE   = 9.90;
const PPC_ANNUAL  = 111.60;
const PPC_3MONTH  = 30.25;

interface Props {
  prices: PriceRow[];
}

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

export default function PriceTable({ prices }: Props) {
  const [nhsExpanded, setNhsExpanded] = useState(false);

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

  const buyOtc    = retailCheapestVal !== null && retailCheapestVal < RX_CHARGE;
  const otcSaving = buyOtc && retailCheapestVal !== null ? RX_CHARGE - retailCheapestVal : null;
  const rxSaving  = !buyOtc && retailCheapestVal !== null ? retailCheapestVal - RX_CHARGE : null;

  if (prices.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-[var(--color-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
        </div>
        <p className="font-semibold text-[var(--color-foreground)] mb-1">Price data coming soon</p>
        <p className="text-sm text-[var(--color-muted)]">
          Live pharmacy prices will be added as feeds are connected.
        </p>
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
              <div>
                <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-1">Cheapest option</p>
                <p className="text-xl sm:text-2xl font-bold text-white leading-tight">
                  {retailPrices[0].pharmacy_name}
                </p>
                {retailPrices[0].pack_size && (
                  <p className="text-sm text-white/70 mt-0.5">{[retailPrices[0].strength, retailPrices[0].pack_size].filter(Boolean).join(" · ")}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-3xl sm:text-4xl font-extrabold text-white tabular-nums leading-none">
                  {formatGBP(retailPrices[0].price_gbp)}
                </p>
                {retailPrices[0].pharmacy_url && (
                  <a
                    href={retailPrices[0].pharmacy_url}
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
                )}
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
                  <strong>£{RX_CHARGE.toFixed(2)} per item</strong>{" "}
                  regardless of the medicine&apos;s actual cost.
                </p>
                <div className="rounded-lg border border-[var(--color-border)] overflow-hidden text-sm">
                  <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--color-surface-2)]">
                    <span className="text-[var(--color-muted)]">Medicine NHS cost</span>
                    <span className="font-semibold tabular-nums text-[var(--color-foreground)]">{formatGBP(nhsCheapest.price_gbp)}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2.5 border-t border-[var(--color-border)]">
                    <span className="text-[var(--color-muted)]">Your prescription charge</span>
                    <span className="font-bold tabular-nums text-[var(--color-foreground)]">£{RX_CHARGE.toFixed(2)}</span>
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
                      <span className="font-semibold tabular-nums">£{RX_CHARGE.toFixed(2)}</span>
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

              return (
                <div key={p.id} className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${isCheapest ? "bg-[var(--color-brand-light)]" : "hover:bg-[var(--color-surface-2)]"}`}>
                  {/* Logo avatar */}
                  <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-white text-xs font-bold shrink-0 ${colorCls}`}>
                    {pharmacyInitials(p.pharmacy_name)}
                  </span>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-[var(--color-foreground)] truncate">{p.pharmacy_name}</p>
                    {(p.strength || p.pack_size) && (
                      <p className="text-xs text-[var(--color-muted)] truncate">{[p.strength, p.pack_size].filter(Boolean).join(" · ")}</p>
                    )}
                    {isCheapest && <span className="text-xs text-[var(--color-brand)] font-semibold">Cheapest</span>}
                  </div>

                  {/* Stock */}
                  <div className="hidden sm:block">
                    {p.in_stock ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        In stock
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-muted)]">Out of stock</span>
                    )}
                  </div>

                  {/* Price + buy link */}
                  <div className="text-right shrink-0">
                    <p className={`font-bold tabular-nums ${isCheapest ? "text-[var(--color-brand)] text-lg" : "text-[var(--color-foreground)]"}`}>
                      {formatGBP(p.price_gbp)}
                    </p>
                    {diff > 0.005 && (
                      <p className="text-xs text-[var(--color-muted)] tabular-nums">+{formatGBP(diff)}</p>
                    )}
                  </div>

                  {p.pharmacy_url && (
                    <a
                      href={p.pharmacy_url}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      onClick={e => e.stopPropagation()}
                      className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                        isCheapest
                          ? "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dark)]"
                          : "border border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                      }`}
                    >
                      Buy
                    </a>
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
