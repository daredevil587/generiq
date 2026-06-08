import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";
import BasketComparison from "@/components/BasketComparison";

export const metadata: Metadata = {
  title: "Basket Comparison - GeneriQ",
  description: "Compare a basket of saved health products and find the cheapest split or single-retailer option.",
  alternates: { canonical: `${siteUrl}/basket` },
};

export default function BasketPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--color-foreground)] mb-2">Basket comparison</h1>
        <p className="text-[var(--color-muted)] max-w-2xl">
          Compare saved and recently viewed products together. This first version finds the cheapest split basket and the best single-retailer total before delivery.
        </p>
      </div>
      <BasketComparison />
    </div>
  );
}
