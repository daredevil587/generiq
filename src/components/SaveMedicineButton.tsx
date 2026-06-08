"use client";

import { useEffect, useState } from "react";

interface SavedItem {
  id: number;
  name: string;
  category: string;
  min_price: string | null;
}

const KEY = "generiq_saved";

export default function SaveMedicineButton({ id, name, category, min_price }: SavedItem) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      const items: SavedItem[] = stored ? JSON.parse(stored) : [];
      setSaved(items.some(item => item.id === id));
    } catch {}
  }, [id]);

  function toggle() {
    try {
      const stored = localStorage.getItem(KEY);
      const items: SavedItem[] = stored ? JSON.parse(stored) : [];
      const exists = items.some(item => item.id === id);
      const next = exists
        ? items.filter(item => item.id !== id)
        : [{ id, name, category, min_price }, ...items].slice(0, 50);
      localStorage.setItem(KEY, JSON.stringify(next));
      setSaved(!exists);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
        saved
          ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)]"
          : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
      }`}
    >
      {saved ? "Saved" : "Save to watchlist"}
    </button>
  );
}
