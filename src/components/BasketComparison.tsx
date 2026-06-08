"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatGBP } from "@/lib/format-utils";
import type { MedicineRow, PriceRow } from "@/lib/medicines-dal";

interface StoredItem {
  id: number;
  name: string;
  category: string;
  min_price: string | null;
}

interface BasketItem {
  medicine: MedicineRow;
  prices: PriceRow[];
}

function readStoredProducts() {
  try {
    const saved = JSON.parse(localStorage.getItem("generiq_saved") || "[]") as StoredItem[];
    const recent = JSON.parse(localStorage.getItem("generiq_recent") || "[]") as StoredItem[];
    const byId = new Map<number, StoredItem>();
    [...saved, ...recent].forEach(item => byId.set(item.id, item));
    return Array.from(byId.values());
  } catch {
    return [];
  }
}

export default function BasketComparison() {
  const [available, setAvailable] = useState<StoredItem[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [items, setItems] = useState<BasketItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const products = readStoredProducts();
    setAvailable(products);
    setSelected(products.slice(0, 4).map(p => p.id));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const loaded = await Promise.all(selected.map(async id => {
          const res = await fetch(`/api/medicines/${id}`);
          if (!res.ok) return null;
          return await res.json() as BasketItem;
        }));
        if (!cancelled) setItems(loaded.filter(Boolean) as BasketItem[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (selected.length > 0) load();
    else setItems([]);
    return () => { cancelled = true; };
  }, [selected]);

  const summary = useMemo(() => {
    const totals = new Map<string, number>();
    let splitTotal = 0;
    for (const item of items) {
      const retail = item.prices
        .filter(p => p.source !== "nhs_drug_tariff")
        .map(p => ({ ...p, value: parseFloat(p.price_gbp) }))
        .filter(p => !Number.isNaN(p.value))
        .sort((a, b) => a.value - b.value);
      if (retail[0]) splitTotal += retail[0].value;
      for (const price of retail) totals.set(price.pharmacy_name, (totals.get(price.pharmacy_name) ?? 0) + price.value);
    }
    const singleRetailer = Array.from(totals.entries()).sort((a, b) => a[1] - b[1])[0] ?? null;
    return { splitTotal, singleRetailer };
  }, [items]);

  function toggle(id: number) {
    setSelected(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="font-bold text-[var(--color-foreground)] mb-2">Choose products</h2>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          Basket comparison uses products saved or recently viewed on this device.
        </p>
        {available.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--color-muted)] mb-4">No saved or recent products yet.</p>
            <Link href="/search" className="inline-flex bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
              Search products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {available.map(item => (
              <label key={item.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-3 cursor-pointer">
                <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} className="w-4 h-4" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-[var(--color-foreground)] truncate">{item.name}</span>
                  <span className="block text-xs text-[var(--color-muted)]">{item.category}</span>
                </span>
                {item.min_price && <span className="text-sm font-bold text-[var(--color-brand)]">{formatGBP(item.min_price)}</span>}
              </label>
            ))}
          </div>
        )}
      </section>

      {selected.length > 0 && (
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
          <h2 className="font-bold text-[var(--color-foreground)] mb-4">Basket result</h2>
          {loading ? (
            <p className="text-sm text-[var(--color-muted)]">Loading prices...</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                <div className="rounded-xl bg-[var(--color-brand-light)] border border-[var(--color-brand)]/20 p-4">
                  <p className="text-xs text-[var(--color-brand-dark)]/70 mb-1">Cheapest split basket</p>
                  <p className="text-3xl font-extrabold text-[var(--color-brand)] tabular-nums">{formatGBP(summary.splitTotal)}</p>
                  <p className="text-xs text-[var(--color-brand-dark)]/70 mt-1">Best current price per product, before delivery.</p>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                  <p className="text-xs text-[var(--color-muted)] mb-1">Best single retailer total</p>
                  <p className="text-3xl font-extrabold text-[var(--color-brand)] tabular-nums">
                    {summary.singleRetailer ? formatGBP(summary.singleRetailer[1]) : "N/A"}
                  </p>
                  <p className="text-xs text-[var(--color-muted)] mt-1">
                    {summary.singleRetailer ? summary.singleRetailer[0] : "No retailer covers the selected basket yet."}
                  </p>
                </div>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {items.map(item => {
                  const cheapest = item.prices
                    .filter(p => p.source !== "nhs_drug_tariff")
                    .sort((a, b) => parseFloat(a.price_gbp) - parseFloat(b.price_gbp))[0];
                  return (
                    <Link key={item.medicine.id} href={`/medicine/${item.medicine.id}`} className="flex items-center gap-3 py-3 hover:text-[var(--color-brand)] transition-colors">
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold truncate">{item.medicine.name}</span>
                        <span className="block text-xs text-[var(--color-muted)]">{cheapest?.pharmacy_name ?? "No retail price"}</span>
                      </span>
                      <span className="font-bold text-[var(--color-brand)]">{cheapest ? formatGBP(cheapest.price_gbp) : "View"}</span>
                    </Link>
                  );
                })}
              </div>
              <p className="text-xs text-[var(--color-muted)] mt-4">
                Delivery costs and multibuy offers are not included yet. Treat this as a price-first comparison.
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
