"use client";

import { useEffect } from "react";

interface Props {
  id: number;
  name: string;
  category: string;
  min_price: string | null;
}

export default function TrackView({ id, name, category, min_price }: Props) {
  useEffect(() => {
    try {
      const KEY = "generiq_recent";
      const stored = localStorage.getItem(KEY);
      const items: Props[] = stored ? JSON.parse(stored) : [];
      const next = [{ id, name, category, min_price }, ...items.filter(i => i.id !== id)].slice(0, 10);
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }, [id, name, category, min_price]);

  return null;
}
