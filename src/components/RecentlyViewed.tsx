"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatGBP } from "@/lib/format-utils";

interface RecentItem {
  id: number;
  name: string;
  category: string;
  min_price: string | null;
}

export default function RecentlyViewed() {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("generiq_recent");
      if (stored) setItems(JSON.parse(stored));
    } catch {}
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide">
          Recently viewed
        </p>
        <button
          onClick={() => { setItems([]); try { localStorage.removeItem("generiq_recent"); } catch {} }}
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-brand)] transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/medicine/${item.id}`}
            className="shrink-0 flex flex-col gap-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 hover:border-[var(--color-brand)] transition-colors w-36"
          >
            <p className="text-xs font-medium text-[var(--color-foreground)] line-clamp-2 leading-tight">{item.name}</p>
            <p className="text-[10px] text-[var(--color-muted)]">{item.category}</p>
            {item.min_price && (
              <p className="text-sm font-bold text-[var(--color-brand)] mt-auto tabular-nums">
                {formatGBP(item.min_price)}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
