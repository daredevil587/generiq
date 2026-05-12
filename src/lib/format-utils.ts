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
