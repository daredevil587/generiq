import type { PriceRow } from "@/lib/medicines-dal";

interface Props {
  prices: PriceRow[];
  mhraApproved: boolean | number;
}

function formatDate(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function ProductTrustDashboard({ prices, mhraApproved }: Props) {
  const retailPrices = prices.filter(p => p.source !== "nhs_drug_tariff");
  const lastChecked = prices.reduce<string | null>((latest, price) => {
    if (!price.last_updated) return latest;
    if (!latest) return price.last_updated;
    return new Date(price.last_updated) > new Date(latest) ? price.last_updated : latest;
  }, null);
  const verifiedRetailers = retailPrices.filter(p => Boolean(p.pharmacy_url)).length;
  const stockVerified = retailPrices.some(p => Boolean(p.in_stock));
  const hasNhs = prices.some(p => p.source === "nhs_drug_tariff");
  const sourceLabels = [
    hasNhs ? "NHS Drug Tariff" : null,
    mhraApproved ? "MHRA" : null,
    retailPrices.length ? "Retailer feeds" : null,
  ].filter(Boolean);

  const confidence = retailPrices.length >= 3 && stockVerified
    ? "High"
    : retailPrices.length >= 1
    ? "Medium"
    : hasNhs
    ? "Reference only"
    : "Needs price data";

  const items = [
    { label: "Last checked", value: formatDate(lastChecked) },
    { label: "Data source", value: sourceLabels.join(", ") || "Product database" },
    { label: "Price confidence", value: confidence },
    { label: "Retailer verified", value: `${verifiedRetailers}/${retailPrices.length} links` },
    { label: "Stock verified", value: stockVerified ? "Yes" : "Not yet" },
  ];

  return (
    <section className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 sm:p-6 mb-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-bold text-[var(--color-foreground)] text-base">Trust dashboard</h2>
        <span className="text-xs bg-[var(--color-brand-light)] text-[var(--color-brand)] font-semibold px-2.5 py-1 rounded-full">
          {retailPrices.length} retailer{retailPrices.length === 1 ? "" : "s"}
        </span>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {items.map(item => (
          <div key={item.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-3">
            <dt className="text-[10px] uppercase tracking-wide text-[var(--color-muted)] mb-1">{item.label}</dt>
            <dd className="text-sm font-semibold text-[var(--color-foreground)] leading-snug">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
