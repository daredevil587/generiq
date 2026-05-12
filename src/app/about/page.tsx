import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About GeneriQ — Health Product Price Comparison",
  description: "Compare prices for medicines, supplements and skincare across UK pharmacies and globally. Stop overpaying for your health.",
};

const CATEGORIES = [
  {
    label: "Medicines",
    count: "945+",
    desc: "NHS-licensed drugs with real Drug Tariff prices. Find cheaper generic equivalents of branded medicines.",
    iconBg: "bg-blue-600",
    icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
    href: "/search?tab=medicines",
  },
  {
    label: "Supplements",
    count: "5,994+",
    desc: "Vitamins, minerals, protein, omega-3, probiotics and more. Compare across Boots, H&B and Amazon.",
    iconBg: "bg-amber-500",
    icon: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z",
    href: "/search?tab=supplements",
  },
  {
    label: "Skincare & Beauty",
    count: "5,282+",
    desc: "Serums, moisturisers, SPF, shampoos and makeup. Filter by gender, subcategory and brand.",
    iconBg: "bg-pink-500",
    icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
    href: "/search?tab=skincare",
  },
];

const DATA_SOURCES = [
  {
    title: "MHRA Products Database",
    desc: "Licensed medicine data from products.mhra.gov.uk — product licences, active ingredients and regulatory status.",
    href: "https://products.mhra.gov.uk",
  },
  {
    title: "NHS Drug Tariff",
    desc: "Monthly Category C indicative prices published by NHSBSA — what the NHS pays for generic medicines.",
    href: "https://www.nhsbsa.nhs.uk/pharmacies-gp-practices-and-appliance-contractors/drug-tariff",
  },
  {
    title: "Open Food Facts & Open Beauty Facts",
    desc: "Open-source product databases used to populate the supplements and skincare catalogues.",
    href: "https://world.openfoodfacts.org",
  },
  {
    title: "Holland & Barrett Live Prices",
    desc: "Real scraped prices from hollandandbarrett.com, updated daily for supplements and health products.",
    href: "https://www.hollandandbarrett.com",
  },
  {
    title: "Awin Affiliate Feeds",
    desc: "Product and price feeds from Boots and Superdrug via the Awin affiliate network (approval pending).",
    href: "https://www.awin.com",
  },
];

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">

      {/* Header */}
      <h1 className="text-3xl font-bold text-[var(--color-foreground)] mb-2">About GeneriQ</h1>
      <p className="text-[var(--color-muted)] text-lg mb-10">
        Compare prices for medicines, supplements and skincare across UK pharmacies and globally.
        Stop overpaying for your health.
      </p>

      <div className="space-y-6">

        {/* What is GeneriQ */}
        <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
          <h2 className="font-semibold text-[var(--color-foreground)] mb-3">What is GeneriQ?</h2>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-3">
            GeneriQ is a UK health product price comparison service covering over{" "}
            <strong className="text-[var(--color-foreground)]">36,000 products</strong> across three categories:
            prescription medicines, supplements and skincare &amp; beauty. We help anyone — patients, carers,
            shoppers — find the cheapest legitimate price without having to check five websites manually.
          </p>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed">
            We draw on publicly available NHS data, open product databases and live price feeds from UK
            pharmacies and retailers. Prices are ranked cheapest first — always.
          </p>
        </section>

        {/* What we cover */}
        <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
          <h2 className="font-semibold text-[var(--color-foreground)] mb-4">What we cover</h2>
          <div className="space-y-4">
            {CATEGORIES.map((cat) => (
              <Link key={cat.href} href={cat.href}
                className="flex items-start gap-4 p-4 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-brand)] transition-colors group">
                <div className={`w-10 h-10 rounded-lg ${cat.iconBg} flex items-center justify-center shrink-0`}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-sm text-[var(--color-foreground)] group-hover:text-[var(--color-brand)] transition-colors">{cat.label}</p>
                    <span className="text-xs bg-[var(--color-brand-light)] text-[var(--color-brand)] px-2 py-0.5 rounded-full font-medium">{cat.count}</span>
                  </div>
                  <p className="text-xs text-[var(--color-muted)]">{cat.desc}</p>
                </div>
                <svg className="w-4 h-4 text-[var(--color-muted)] group-hover:text-[var(--color-brand)] shrink-0 mt-3 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </section>

        {/* Data sources */}
        <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
          <h2 className="font-semibold text-[var(--color-foreground)] mb-4">Data sources</h2>
          <ul className="space-y-4">
            {DATA_SOURCES.map((src) => (
              <li key={src.title} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-[var(--color-brand-light)] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] inline-block" />
                </span>
                <span className="text-sm text-[var(--color-muted)]">
                  <a href={src.href} target="_blank" rel="noopener noreferrer"
                    className="font-semibold text-[var(--color-foreground)] hover:text-[var(--color-brand)] transition-colors">
                    {src.title}
                  </a>
                  {" — "}{src.desc}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Mission */}
        <section className="bg-[var(--color-brand)] rounded-2xl p-6 text-white">
          <h2 className="font-semibold mb-3">Our mission</h2>
          <p className="text-sm leading-relaxed text-white/90 mb-3">
            The same medicine, vitamin or skincare product can cost dramatically different amounts depending
            on where you buy it. A Vitamin C supplement at Holland &amp; Barrett might be twice the price of
            the same product on Amazon. Ibuprofen from Boots can cost three times more than the generic
            equivalent at a local pharmacy.
          </p>
          <p className="text-sm leading-relaxed text-white/90">
            GeneriQ fixes the information gap. We&apos;re starting in the UK and building towards a global
            comparison platform — because the price disparity is even greater between countries. The same
            pill that costs £2 in the UK can cost $40 in the USA, or be almost free in India.
          </p>
        </section>

        {/* Disclaimer */}
        <section className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800 rounded-2xl p-6">
          <h2 className="font-semibold text-amber-800 dark:text-amber-300 mb-3">Medical disclaimer</h2>
          <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
            GeneriQ is for informational purposes only and does not constitute medical advice. Many medicines
            require a valid UK prescription. Always consult your GP or pharmacist before starting, stopping
            or changing any medication. Prices shown are for comparison only — always verify with the
            pharmacy before purchase.
          </p>
        </section>

        {/* Contact */}
        <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
          <h2 className="font-semibold text-[var(--color-foreground)] mb-2">Contact</h2>
          <p className="text-sm text-[var(--color-muted)]">
            Questions, feedback or partnership enquiries:{" "}
            <a href="mailto:yadavuttam5788@gmail.com" className="text-[var(--color-brand)] hover:underline font-medium">
              yadavuttam5788@gmail.com
            </a>
          </p>
        </section>

      </div>

      <div className="mt-8 flex flex-wrap gap-3 justify-center">
        <Link href="/search" className="inline-flex items-center gap-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-medium px-5 py-2.5 rounded-xl transition-colors text-sm">
          Browse all products →
        </Link>
        <Link href="/privacy" className="inline-flex items-center gap-2 border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-brand)] hover:border-[var(--color-brand)] font-medium px-5 py-2.5 rounded-xl transition-colors text-sm">
          Privacy Policy
        </Link>
        <Link href="/terms" className="inline-flex items-center gap-2 border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-brand)] hover:border-[var(--color-brand)] font-medium px-5 py-2.5 rounded-xl transition-colors text-sm">
          Terms of Service
        </Link>
      </div>
    </div>
  );
}
