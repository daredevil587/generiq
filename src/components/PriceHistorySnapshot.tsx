import { formatGBP } from "@/lib/format-utils";
import type { PriceRow } from "@/lib/medicines-dal";

interface Props {
  prices: PriceRow[];
}

export default function PriceHistorySnapshot({ prices }: Props) {
  const retail = prices
    .filter(p => p.source !== "nhs_drug_tariff")
    .map(p => ({ ...p, value: parseFloat(p.price_gbp) }))
    .filter(p => !Number.isNaN(p.value))
    .sort((a, b) => a.value - b.value);

  if (retail.length === 0) return null;

  const lowest = retail[0];
  const highest = retail[retail.length - 1];
  const average = retail.reduce((sum, p) => sum + p.value, 0) / retail.length;

  return (
    <section className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 sm:p-6 mt-5">
      <h2 className="font-bold text-[var(--color-foreground)] text-base mb-1">Price history snapshot</h2>
      <p className="text-xs text-[var(--color-muted)] mb-4">
        Full time-series tracking is the next step. This snapshot uses the latest prices currently stored.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
          <p className="text-xs text-[var(--color-muted)] mb-1">Lowest current price</p>
          <p className="text-2xl font-extrabold text-[var(--color-brand)] tabular-nums">{formatGBP(lowest.value)}</p>
          <p className="text-xs text-[var(--color-muted)] mt-1 truncate">{lowest.pharmacy_name}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
          <p className="text-xs text-[var(--color-muted)] mb-1">Average current price</p>
          <p className="text-2xl font-extrabold text-[var(--color-brand)] tabular-nums">{formatGBP(average)}</p>
          <p className="text-xs text-[var(--color-muted)] mt-1">{retail.length} retailer prices</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
          <p className="text-xs text-[var(--color-muted)] mb-1">Spread to highest</p>
          <p className="text-2xl font-extrabold text-[var(--color-brand)] tabular-nums">{formatGBP(highest.value - lowest.value)}</p>
          <p className="text-xs text-[var(--color-muted)] mt-1 truncate">Highest: {highest.pharmacy_name}</p>
        </div>
      </div>
    </section>
  );
}
