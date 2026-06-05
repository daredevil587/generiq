import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

interface Params { params: Promise<{ code: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { code } = await params;
  const clean = code.replace(/\D/g, "").slice(0, 20);
  if (!clean) return NextResponse.json({ found: false, name: null }, { status: 400 });

  const db = await getDB();
  const row = await db.prepare(
    "SELECT id, name FROM medicines WHERE barcode = ?1 LIMIT 1",
  ).bind(clean).first<{ id: number; name: string }>();

  if (row) {
    return NextResponse.json({ found: true, id: row.id, name: row.name });
  }

  // Fall back to Open Food Facts, then Open Beauty Facts
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
      const data = await res.json() as { status?: number; product?: { product_name_en?: string; product_name?: string; abbreviated_product_name?: string } };
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
