import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About GeneriQ — UK Medicine Price Comparison",
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold text-[var(--color-foreground)] mb-2">About GeneriQ</h1>
      <p className="text-[var(--color-muted)] text-lg mb-10">
        Helping UK patients find the best price for generic medicines.
      </p>

      <div className="space-y-8">
        <section className="bg-white border border-[var(--color-border)] rounded-2xl p-6">
          <h2 className="font-semibold text-[var(--color-foreground)] mb-3">What is GeneriQ?</h2>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed">
            GeneriQ is a UK medicine price comparison tool that helps patients and healthcare professionals find
            the most cost-effective generic equivalents of branded medicines. We draw on publicly available data
            from the MHRA (Medicines and Healthcare products Regulatory Agency) and the NHS Drug Tariff to
            provide transparent pricing information.
          </p>
        </section>

        <section className="bg-white border border-[var(--color-border)] rounded-2xl p-6">
          <h2 className="font-semibold text-[var(--color-foreground)] mb-3">Data Sources</h2>
          <ul className="space-y-3 text-sm text-[var(--color-muted)]">
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[var(--color-brand-light)] flex items-center justify-center shrink-0 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] inline-block" />
              </span>
              <span>
                <strong className="text-[var(--color-foreground)]">MHRA Products Database</strong> — Licensed medicine data
                from{" "}
                <a href="https://products.mhra.gov.uk" target="_blank" rel="noopener noreferrer" className="text-[var(--color-brand)] underline underline-offset-2">
                  products.mhra.gov.uk
                </a>
                , including SPCs and product licence numbers.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[var(--color-brand-light)] flex items-center justify-center shrink-0 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] inline-block" />
              </span>
              <span>
                <strong className="text-[var(--color-foreground)]">NHS Drug Tariff</strong> — Monthly Category C indicative
                prices published by NHSBSA for reimbursement of generic medicines.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[var(--color-brand-light)] flex items-center justify-center shrink-0 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] inline-block" />
              </span>
              <span>
                <strong className="text-[var(--color-foreground)]">Pharmacy Price Feeds</strong> — Live retail prices from
                UK online and high street pharmacies. <em>(Coming soon — currently showing representative placeholder prices.)</em>
              </span>
            </li>
          </ul>
        </section>

        <section className="bg-white border border-[var(--color-border)] rounded-2xl p-6">
          <h2 className="font-semibold text-[var(--color-foreground)] mb-3">Connecting Live Price Feeds</h2>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-3">
            The price comparison infrastructure is ready to receive live data. To connect a pharmacy price feed,
            implement the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">PharmacyPrice</code> interface
            in <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">src/lib/medicines-db.ts</code> and
            set <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">isPlaceholder: false</code>.
          </p>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed">
            For MHRA live search, set the following environment variables in{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">.env.local</code>:
          </p>
          <pre className="mt-3 bg-gray-50 border border-[var(--color-border)] rounded-lg p-3 text-xs font-mono text-gray-700 overflow-x-auto">
{`MHRA_SEARCH_SERVICE=your-service-name
MHRA_SEARCH_INDEX=your-index-name
MHRA_SEARCH_KEY=your-api-key
MHRA_SEARCH_API_VERSION=2020-06-30`}
          </pre>
        </section>

        <section className="bg-amber-50 border border-amber-100 rounded-2xl p-6">
          <h2 className="font-semibold text-amber-800 mb-3">Medical Disclaimer</h2>
          <p className="text-sm text-amber-700 leading-relaxed">
            GeneriQ is for informational purposes only. It does not constitute medical advice. Many medicines listed
            require a valid prescription from a registered UK prescriber. Always consult your GP or pharmacist before
            starting, stopping, or changing any medication. Prices shown may not reflect current retail prices — always
            verify directly with the pharmacy before purchase.
          </p>
        </section>
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-medium px-5 py-2.5 rounded-xl transition-colors text-sm"
        >
          Start comparing prices →
        </Link>
      </div>
    </div>
  );
}
