import { NextResponse } from "next/server";
import pool from "@/lib/db";

interface Params { params: Promise<{ code: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { code } = await params;
  const clean = code.replace(/\D/g, "").slice(0, 20);
  if (!clean) return NextResponse.json({ found: false, name: null }, { status: 400 });

  // 1. Check our own medicines table first
  const row = await pool.query<{ id: number; name: string }>(
    "SELECT id, name FROM medicines WHERE barcode = $1 LIMIT 1",
    [clean],
  );
  if (row.rows.length > 0) {
    return NextResponse.json({ found: true, id: row.rows[0].id, name: row.rows[0].name });
  }

  // 2. Fall back to Open Food Facts, then Open Beauty Facts
  const sources = [
    `https://world.openfoodfacts.org/api/v0/product/${clean}.json`,
    `https://world.openbeautyfacts.org/api/v0/product/${clean}.json`,
  ];

  for (const url of sources) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "GeneriQ/1.0 (https://generiq.app)" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.status === 1 && data.product) {
        const name: string =
          data.product.product_name_en ||
          data.product.product_name ||
          data.product.abbreviated_product_name ||
          "";
        if (name.trim()) {
          return NextResponse.json({ found: false, name: name.trim() });
        }
      }
    } catch {
      // timeout or network error — try next source
    }
  }

  return NextResponse.json({ found: false, name: null });
}
