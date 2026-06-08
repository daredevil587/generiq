"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatGBP } from "@/lib/format-utils";

interface SavedItem {
  id: number;
  name: string;
  category: string;
  min_price: string | null;
}

const KEY = "generiq_saved";

export default function SavedProducts() {
  const [items, setItems] = useState<SavedItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      setItems(stored ? JSON.parse(stored) : []);
    } catch {}
  }, []);

  function remove(id: number) {
    const next = items.filter(item => item.id !== id);
    setItems(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
        <p className="font-semibold text-[var(--color-foreground)] mb-2">No saved products yet</p>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          Open a product page and tap &quot;Save to watchlist&quot; to build your account-style watchlist on this device.
        </p>
        <Link href="/search" className="inline-flex items-center justify-center bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
          Find products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex-1 min-w-0">
            <Link href={`/medicine/${item.id}`} className="font-semibold text-sm text-[var(--color-foreground)] hover:text-[var(--color-brand)] transition-colors line-clamp-1">
              {item.name}
            </Link>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">{item.category}</p>
          </div>
          <div className="text-right shrink-0">
            {item.min_price && <p className="font-bold text-[var(--color-brand)] tabular-nums">{formatGBP(item.min_price)}</p>}
            <button onClick={() => remove(item.id)} className="text-xs text-[var(--color-muted)] hover:text-red-600 transition-colors">
              Remove
            </button>
          </div>
        </div>
      ))}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
        <p className="text-sm font-semibold text-[var(--color-foreground)] mb-1">Monthly price digest</p>
        <p className="text-xs text-[var(--color-muted)]">
          Product pages already support email price-drop alerts. Full account sync and monthly digest emails are the next backend step.
        </p>
      </div>
    </div>
  );
}
