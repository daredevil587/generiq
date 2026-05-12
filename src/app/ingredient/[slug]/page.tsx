import { notFound } from "next/navigation";
import Link from "next/link";
import { getMedicinesByIngredient } from "@/lib/medicines-dal";
import MedicineCard from "@/components/MedicineCard";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { ingredientName } = await getMedicinesByIngredient(slug, 1, 0);
  if (!ingredientName) return {};
  const canonicalUrl = `${siteUrl}/ingredient/${slug}`;
  return {
    title: `${ingredientName} Medicines — UK Price Comparison | GeneriQ`,
    description: `Compare UK prices for all medicines containing ${ingredientName}. Find the cheapest option across Boots, Superdrug, Holland & Barrett and more.`,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${ingredientName} Medicines | GeneriQ`,
      description: `All UK medicines containing ${ingredientName} — sorted cheapest first.`,
      url: canonicalUrl,
      siteName: "GeneriQ",
      type: "website",
    },
  };
}

export default async function IngredientPage({ params }: Props) {
  const { slug } = await params;
  const { rows, total, ingredientName } = await getMedicinesByIngredient(slug, 60, 0);

  if (!ingredientName) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] mb-4">
        <Link href="/" className="hover:text-[var(--color-brand)]">Home</Link>
        <span>/</span>
        <Link href="/search?tab=medicines" className="hover:text-[var(--color-brand)]">Medicines</Link>
        <span>/</span>
        <span className="text-[var(--color-foreground)]">{ingredientName}</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-foreground)]">
          Medicines containing {ingredientName}
        </h1>
        <p className="text-[var(--color-muted)] mt-2 text-sm">
          {total} product{total !== 1 ? "s" : ""} — sorted cheapest first
        </p>
      </div>

      {rows.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {rows.map(m => <MedicineCard key={m.id} medicine={m} />)}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-[var(--color-muted)]">No medicines found for this ingredient.</p>
          <Link href="/search" className="mt-4 inline-block text-sm text-[var(--color-brand)] font-medium">
            Browse all →
          </Link>
        </div>
      )}
    </div>
  );
}
