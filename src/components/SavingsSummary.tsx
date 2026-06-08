import { NHS_RX_CHARGE } from "@/lib/config";
import { formatGBP } from "@/lib/format-utils";
import type { PriceRow } from "@/lib/medicines-dal";

interface Props {
  prices: PriceRow[];
  category: string;
}

export default function SavingsSummary({ prices, category }: Props) {
  const retailPrices = prices
    .filter(p => p.source !== "nhs_drug_tariff")
    .sort((a, b) => parseFloat(a.price_gbp) - parseFloat(b.price_gbp));
  const cheapest = retailPrices[0] ?? null;
  const isMedicine = category === "medicine";

  if (!cheapest) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 mb-5">
        <p className="text-sm font-semibold text-[var(--color-foreground)]">No live retail price yet.</p>
        <p className="text-xs text-[var(--color-muted)] mt-1">
          Check the NHS, MHRA and retailer links before making a purchase decision.
        </p>
      </div>
    );
  }

  const retailPrice = parseFloat(cheapest.price_gbp);
  const difference = Math.abs(NHS_RX_CHARGE - retailPrice);
  const prescriptionIsCheaper = isMedicine && NHS_RX_CHARGE < retailPrice;
  const otcIsCheaper = isMedicine && retailPrice < NHS_RX_CHARGE;

  let message = `Cheapest today: ${cheapest.pharmacy_name} ${formatGBP(retailPrice)}.`;
  let detail = "Compare retailer stock, delivery and pack size before buying.";

  if (prescriptionIsCheaper) {
    message = `Prescription is cheaper than retail by ${formatGBP(difference)}.`;
    detail = `${cheapest.pharmacy_name} is ${formatGBP(retailPrice)}, while the NHS prescription charge is ${formatGBP(NHS_RX_CHARGE)} in England.`;
  } else if (otcIsCheaper) {
    message = `Cheapest today: ${cheapest.pharmacy_name} ${formatGBP(retailPrice)}. Save ${formatGBP(difference)} vs NHS prescription charge.`;
    detail = "Buying over the counter may be cheaper if the product is suitable without prescription.";
  }

  return (
    <div className="rounded-2xl border border-[var(--color-brand)]/25 bg-[var(--color-brand-light)] px-5 py-4 mb-5">
      <p className="text-sm sm:text-base font-bold text-[var(--color-brand-dark)]">{message}</p>
      <p className="text-xs text-[var(--color-brand-dark)]/75 mt-1">{detail}</p>
    </div>
  );
}
