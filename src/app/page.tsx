import SearchBar from "@/components/SearchBar";
import MedicineCard from "@/components/MedicineCard";
import Link from "next/link";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";
import { getTopDeals } from "@/lib/medicines-dal";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "GeneriQ — Stop Overpaying for Your Health",
  description: "Compare UK prices for medicines, vitamins, supplements and skincare across Boots, Superdrug, Holland & Barrett and Amazon. Find the cheapest option instantly.",
  alternates: { canonical: siteUrl },
  openGraph: {
    title: "GeneriQ — Stop Overpaying for Your Health",
    description: "Compare UK prices for 36,000+ medicines, supplements and skincare. Cheapest prices instantly.",
    url: siteUrl,
    siteName: "GeneriQ",
    type: "website",
  },
};

const CATEGORIES = [
  {
    href:     "/search?tab=medicines",
    label:    "Medicines",
    desc:     "NHS-licensed drugs & Drug Tariff prices",
    gradient: "from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20",
    border:   "border-blue-100 hover:border-blue-300 dark:border-blue-900 dark:hover:border-blue-700",
    iconBg:   "bg-blue-600",
    icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
  },
  {
    href:     "/search?tab=supplements",
    label:    "Supplements",
    desc:     "Vitamins, minerals, protein & more",
    gradient: "from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20",
    border:   "border-amber-100 hover:border-amber-300 dark:border-amber-900 dark:hover:border-amber-700",
    iconBg:   "bg-amber-500",
    icon: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z",
  },
  {
    href:     "/search?tab=skincare",
    label:    "Skincare & Beauty",
    desc:     "Serums, moisturisers, SPF & makeup",
    gradient: "from-pink-50 to-pink-100/50 dark:from-pink-950/40 dark:to-pink-900/20",
    border:   "border-pink-100 hover:border-pink-300 dark:border-pink-900 dark:hover:border-pink-700",
    iconBg:   "bg-pink-500",
    icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  },
  {
    href:     "/search?tab=haircare",
    label:    "Hair Care",
    desc:     "Shampoo, conditioner & treatments",
    gradient: "from-violet-50 to-violet-100/50 dark:from-violet-950/40 dark:to-violet-900/20",
    border:   "border-violet-100 hover:border-violet-300 dark:border-violet-900 dark:hover:border-violet-700",
    iconBg:   "bg-violet-500",
    icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
  },
  {
    href:     "/search?tab=dental",
    label:    "Dental",
    desc:     "Toothpaste, mouthwash & whitening",
    gradient: "from-cyan-50 to-cyan-100/50 dark:from-cyan-950/40 dark:to-cyan-900/20",
    border:   "border-cyan-100 hover:border-cyan-300 dark:border-cyan-900 dark:hover:border-cyan-700",
    iconBg:   "bg-cyan-500",
    icon: "M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    href:     "/search?tab=baby",
    label:    "Baby",
    desc:     "Baby food, formula & snacks",
    gradient: "from-yellow-50 to-yellow-100/50 dark:from-yellow-950/40 dark:to-yellow-900/20",
    border:   "border-yellow-100 hover:border-yellow-300 dark:border-yellow-900 dark:hover:border-yellow-700",
    iconBg:   "bg-yellow-500",
    icon: "M12 3c-4.97 0-9 3.185-9 7.115 0 2.557 1.522 4.82 3.889 6.115-.16.59-.477 1.77-.555 2.053-.1.368.134.363.28.265.114-.076 1.809-1.252 2.542-1.762.574.1 1.167.154 1.773.154 4.97 0 9-3.184 9-7.115C21 6.185 16.97 3 12 3z",
  },
  {
    href:     "/search?tab=pet",
    label:    "Pet Care",
    desc:     "Dog, cat & small pet products",
    gradient: "from-orange-50 to-orange-100/50 dark:from-orange-950/40 dark:to-orange-900/20",
    border:   "border-orange-100 hover:border-orange-300 dark:border-orange-900 dark:hover:border-orange-700",
    iconBg:   "bg-orange-500",
    icon: "M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5",
  },
  {
    href:     "/search?tab=sports",
    label:    "Sports Nutrition",
    desc:     "Protein, creatine, energy & BCAA",
    gradient: "from-green-50 to-green-100/50 dark:from-green-950/40 dark:to-green-900/20",
    border:   "border-green-100 hover:border-green-300 dark:border-green-900 dark:hover:border-green-700",
    iconBg:   "bg-green-600",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
  },
];

const HOW_IT_WORKS = [
  {
    num: "1",
    title: "Search any product",
    desc:  "Medicine, vitamin, supplement or skincare — by name or ingredient.",
    icon:  "M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z",
  },
  {
    num: "2",
    title: "Compare UK prices",
    desc:  "See Boots, Superdrug, H&B and Amazon sorted cheapest first.",
    icon:  "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    num: "3",
    title: "Save money",
    desc:  "Click through to buy at the cheapest verified price.",
    icon:  "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  },
];

export default async function HomePage() {
  const deals = await getTopDeals(6).catch(() => []);

  return (
    <div className="min-h-screen">

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="border-b border-[var(--color-border)]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[var(--color-brand-light)] text-[var(--color-brand)] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            36,000+ medicines, supplements &amp; skincare
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold text-[var(--color-foreground)] leading-tight mb-4">
            Stop overpaying<br />
            <span className="text-[var(--color-brand)]">for your health.</span>
          </h1>

          <p className="text-[var(--color-muted)] text-base sm:text-lg mb-8 max-w-lg mx-auto">
            Compare UK prices for medicines, vitamins and skincare across Boots, Superdrug, Holland &amp; Barrett and Amazon. Find the cheapest option instantly.
          </p>

          <SearchBar autoFocus size="lg" />

          <p className="mt-4 text-xs text-[var(--color-muted)]">
            Try: ibuprofen, vitamin C, CeraVe, omega-3, sertraline
          </p>
        </div>
      </section>

      {/* ── Category tiles ─────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h2 className="text-center text-xs font-semibold text-[var(--color-muted)] uppercase tracking-widest mb-6">
          Browse by category
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.href}
              href={cat.href}
              className={`group flex flex-col items-center text-center gap-0 p-4 sm:p-5 rounded-2xl border-2 bg-gradient-to-br transition-all ${cat.gradient} ${cat.border}`}
            >
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${cat.iconBg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm`}>
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                </svg>
              </div>
              <h3 className="font-semibold text-sm text-[var(--color-foreground)] mb-0.5 leading-tight">{cat.label}</h3>
              <p className="text-xs text-[var(--color-muted)] leading-snug hidden sm:block">{cat.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Live deals ─────────────────────────────────────────────────────── */}
      {deals.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-lg text-[var(--color-foreground)]">Compare prices right now</h2>
            <Link href="/search" className="text-sm text-[var(--color-brand)] font-semibold hover:underline underline-offset-2">
              Browse all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {deals.map((m) => (
              <MedicineCard key={m.id} medicine={m} />
            ))}
          </div>
        </section>
      )}

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <h2 className="text-center font-bold text-lg text-[var(--color-foreground)] mb-10">How GeneriQ works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.num} className="flex sm:flex-col items-start sm:items-center gap-4 sm:gap-0 sm:text-center">
                <div className="w-10 h-10 rounded-full bg-[var(--color-brand)] flex items-center justify-center shrink-0 sm:mb-4">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={step.icon} />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--color-foreground)] text-sm mb-1">{step.title}</h3>
                  <p className="text-xs text-[var(--color-muted)]">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust strip ────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--color-border)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs text-[var(--color-muted)]">
          {[
            { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", label: "MHRA data" },
            { icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z", label: "NHS Drug Tariff" },
            { icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", label: "Updated daily" },
            { icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", label: "No account needed" },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
              </svg>
              {label}
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
