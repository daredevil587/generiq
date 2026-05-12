import SearchBar from "@/components/SearchBar";
import Link from "next/link";

export const revalidate = 3600;

const CATEGORIES = [
  {
    href:      "/search?tab=medicines",
    label:     "Medicines",
    desc:      "NHS-licensed drugs & Drug Tariff prices",
    gradient:  "from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20",
    border:    "border-blue-100 hover:border-blue-300 dark:border-blue-900 dark:hover:border-blue-700",
    iconBg:    "bg-blue-600",
    icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
  },
  {
    href:      "/search?tab=supplements",
    label:     "Supplements",
    desc:      "Vitamins, minerals, protein & more",
    gradient:  "from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20",
    border:    "border-amber-100 hover:border-amber-300 dark:border-amber-900 dark:hover:border-amber-700",
    iconBg:    "bg-amber-500",
    icon: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z",
  },
  {
    href:      "/search?tab=skincare",
    label:     "Skincare & Beauty",
    desc:      "Serums, moisturisers, SPF & makeup",
    gradient:  "from-pink-50 to-pink-100/50 dark:from-pink-950/40 dark:to-pink-900/20",
    border:    "border-pink-100 hover:border-pink-300 dark:border-pink-900 dark:hover:border-pink-700",
    iconBg:    "bg-pink-500",
    icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
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

export default function HomePage() {
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
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h2 className="text-center text-xs font-semibold text-[var(--color-muted)] uppercase tracking-widest mb-6">
          Browse by category
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.href}
              href={cat.href}
              className={`group flex sm:flex-col items-center sm:items-center text-left sm:text-center gap-4 sm:gap-0 p-5 sm:p-6 rounded-2xl border-2 bg-gradient-to-br transition-all ${cat.gradient} ${cat.border}`}
            >
              <div className={`w-12 h-12 rounded-xl ${cat.iconBg} flex items-center justify-center shrink-0 sm:mb-4 group-hover:scale-110 transition-transform shadow-sm`}>
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-[var(--color-foreground)] mb-0.5">{cat.label}</h3>
                <p className="text-xs text-[var(--color-muted)]">{cat.desc}</p>
              </div>
              <svg className="w-4 h-4 text-[var(--color-muted)] ml-auto sm:hidden shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </section>

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
