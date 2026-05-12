import { notFound } from "next/navigation";
import Link from "next/link";
import { getMedicinesByPharmacy, getPharmacyList } from "@/lib/medicines-dal";
import MedicineCard from "@/components/MedicineCard";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { pharmacyName } = await getMedicinesByPharmacy(slug, 1, 0);
  if (!pharmacyName) return {};
  const canonicalUrl = `${siteUrl}/pharmacy/${slug}`;
  return {
    title: `${pharmacyName} Prices — UK Medicine Price Comparison | GeneriQ`,
    description: `Browse all ${pharmacyName} medicine and supplement prices. Compare against Boots, Superdrug, Holland & Barrett and more.`,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${pharmacyName} Prices | GeneriQ`,
      description: `All ${pharmacyName} products — compare prices across UK pharmacies.`,
      url: canonicalUrl,
      siteName: "GeneriQ",
      type: "website",
    },
  };
}

export async function generateStaticParams() {
  const pharmacies = await getPharmacyList();
  return pharmacies.map(p => ({ slug: p.slug }));
}

export const revalidate = 3600;

export default async function PharmacyPage({ params }: Props) {
  const { slug } = await params;
  const { rows, total, pharmacyName } = await getMedicinesByPharmacy(slug, 60, 0);

  if (!pharmacyName) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] mb-4">
        <Link href="/" className="hover:text-[var(--color-brand)]">Home</Link>
        <span>/</span>
        <span className="text-[var(--color-foreground)]">{pharmacyName}</span>
      </nav>

      {/* Header */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 sm:p-6 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-foreground)] mb-1">
          {pharmacyName}
        </h1>
        <p className="text-[var(--color-muted)] text-sm">
          {total.toLocaleString()} product{total !== 1 ? "s" : ""} with live prices — sorted cheapest first
        </p>
      </div>

      {rows.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {rows.map(m => <MedicineCard key={m.id} medicine={m} />)}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-[var(--color-muted)]">No products found for this pharmacy.</p>
          <Link href="/search" className="mt-4 inline-block text-sm text-[var(--color-brand)] font-medium">
            Browse all →
          </Link>
        </div>
      )}
    </div>
  );
}
