import Link from "next/link";
import type { MedicineWithPrice } from "@/lib/medicines-dal";
import { formatGBP, parseBrandNames } from "@/lib/format-utils";

interface Props {
  medicine: MedicineWithPrice;
}

export default function MedicineCard({ medicine }: Props) {
  const brands = parseBrandNames(medicine.brand_names);
  const hasPrice = medicine.min_price !== null && medicine.min_price !== undefined;

  return (
    <Link
      href={`/medicine/${medicine.id}`}
      className="group block bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 sm:p-5 hover:border-[var(--color-brand)] hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[var(--color-foreground)] group-hover:text-[var(--color-brand)] transition-colors text-sm sm:text-base leading-snug">
            {medicine.name}
          </h3>
          {medicine.generic_name && medicine.generic_name !== medicine.name && (
            <p className="text-xs text-[var(--color-muted)] mt-0.5 truncate">{medicine.generic_name}</p>
          )}
          <p className="text-xs text-[var(--color-muted)] mt-0.5">{medicine.category}</p>
        </div>
        <div className="text-right shrink-0">
          {hasPrice ? (
            <>
              <p className="text-[10px] text-[var(--color-muted)] uppercase tracking-wide">from</p>
              <p className="text-lg font-bold text-[var(--color-brand)]">{formatGBP(medicine.min_price!)}</p>
            </>
          ) : (
            <span className="text-xs bg-[var(--color-brand-light)] text-[var(--color-brand)] font-medium px-2 py-0.5 rounded-full">
              View
            </span>
          )}
        </div>
      </div>

      {medicine.description && (
        <p className="mt-2.5 text-xs text-[var(--color-muted)] line-clamp-2">{medicine.description}</p>
      )}

      {brands.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {brands.slice(0, 3).map((b) => (
            <span key={b} className="text-xs bg-[var(--color-surface-2)] text-[var(--color-muted)] px-2 py-0.5 rounded-full">
              {b}
            </span>
          ))}
          {brands.length > 3 && (
            <span className="text-xs text-[var(--color-muted)]">+{brands.length - 3}</span>
          )}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-muted)]">
        <span className="flex items-center gap-1">
          {medicine.mhra_approved && (
            <svg className="w-3.5 h-3.5 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {medicine.mhra_approved ? "MHRA approved" : "Licensed"}
        </span>
        <span className="flex items-center gap-1 text-[var(--color-brand)] font-medium group-hover:gap-2 transition-all">
          {hasPrice ? "Compare prices" : "View details"}
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
