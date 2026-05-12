// Pure client-safe formatting utilities — no pg imports

export function formatGBP(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "";
  if (n < 1) return `${Math.round(n * 100)}p`;
  return `£${n.toFixed(2)}`;
}

export function parseBrandNames(csv: string | null | undefined): string[] {
  if (!csv) return [];
  return csv.split(",").map((s) => s.trim()).filter(Boolean);
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

interface PackParsed { count: number; unit: string }

export function parsePackSize(packSize: string | null | undefined): PackParsed | null {
  if (!packSize) return null;
  const m = packSize.match(
    /(\d+(?:\.\d+)?)\s*(tablets?|capsules?|softgels?|caps?|gummies?|lozenges?|sachets?|patches?|strips?|doses?|sprays?|drops?|units?|ml|g(?:\b|$))/i,
  );
  if (!m) return null;
  const count = parseFloat(m[1]);
  if (count <= 1) return null;
  const raw = m[2].toLowerCase();
  const unit = raw
    .replace(/tablets?/, "tablet")
    .replace(/capsules?/, "capsule")
    .replace(/softgels?/, "softgel")
    .replace(/gummies?/, "gummy")
    .replace(/lozenges?/, "lozenge")
    .replace(/sachets?/, "sachet")
    .replace(/patches?/, "patch")
    .replace(/strips?/, "strip")
    .replace(/doses?/, "dose")
    .replace(/sprays?/, "spray")
    .replace(/drops?/, "drop")
    .replace(/units?/, "unit")
    .replace(/caps?$/, "cap");
  return { count, unit };
}

export function pricePerUnit(price: string | number, packSize: string | null | undefined): string | null {
  const parsed = parsePackSize(packSize);
  if (!parsed) return null;
  const val = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(val)) return null;
  const ppu = val / parsed.count;
  const formatted = ppu < 0.01
    ? `${(ppu * 100).toFixed(1)}p`
    : ppu < 1
    ? `${Math.round(ppu * 100)}p`
    : `£${ppu.toFixed(2)}`;
  return `${formatted}/${parsed.unit}`;
}
