import type { Metadata } from "next";
import Link from "next/link";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Terms of Service — GeneriQ",
  description: "Terms and conditions for using the GeneriQ price comparison service.",
  alternates: { canonical: `${siteUrl}/terms` },
};

export default function TermsPage() {
  const updated = "12 May 2026";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <div className="mb-8">
        <p className="text-xs text-[var(--color-muted)] mb-2">Last updated: {updated}</p>
        <h1 className="text-3xl font-bold text-[var(--color-foreground)]">Terms of Service</h1>
        <p className="mt-3 text-[var(--color-muted)]">
          Please read these terms carefully before using GeneriQ. By using this service you agree
          to be bound by these terms.
        </p>
      </div>

      <div className="space-y-8 text-sm text-[var(--color-foreground)] leading-relaxed">

        <section>
          <h2 className="text-lg font-semibold mb-3">1. About GeneriQ</h2>
          <p>
            GeneriQ is a price comparison service for health products including medicines,
            supplements and skincare. We help users find the most competitive prices from UK
            pharmacies and retailers. GeneriQ is operated by Uttam Yadav.
          </p>
          <p className="mt-2">
            <strong>Contact:</strong>{" "}
            <a href="mailto:yadavuttam5788@gmail.com" className="text-[var(--color-brand)] hover:underline">
              yadavuttam5788@gmail.com
            </a>
          </p>
        </section>

        <section>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-5 mb-4">
            <h2 className="text-base font-bold text-amber-900 dark:text-amber-300 mb-2">
              ⚠ Important disclaimer — not medical advice
            </h2>
            <p className="text-amber-800 dark:text-amber-400 text-sm leading-relaxed">
              GeneriQ provides price comparison information only. Nothing on this website
              constitutes medical advice, diagnosis or treatment. Always consult a qualified
              healthcare professional — your GP, pharmacist or specialist — before starting,
              stopping or changing any medication or health product. Do not use this site as a
              substitute for professional medical advice.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">2. Price information disclaimer</h2>
          <p className="mb-2">
            All prices displayed on GeneriQ are for <strong>informational purposes only</strong>.
          </p>
          <ul className="space-y-2 text-[var(--color-muted)] list-disc list-inside">
            <li>Prices are sourced from pharmacy websites, NHS Drug Tariff data and affiliate product feeds and may not reflect the current price at time of purchase.</li>
            <li>Prices can change at any time without notice. GeneriQ is not responsible for price discrepancies between what is displayed and what a retailer charges.</li>
            <li>Availability and stock levels shown are indicative only and may not be accurate.</li>
            <li>Always verify the final price on the retailer&apos;s website before completing any purchase.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">3. Affiliate links disclosure</h2>
          <p className="mb-2">
            GeneriQ participates in affiliate programmes including the{" "}
            <strong>Awin affiliate network</strong>. Some links on this site — marked or
            unmarked — may be affiliate links.
          </p>
          <p className="mb-2 text-[var(--color-muted)]">
            This means that if you click a link to a third-party retailer and make a purchase,
            GeneriQ may receive a commission from that retailer. This commission comes at{" "}
            <strong>no additional cost to you</strong> — you pay the same price you would by
            visiting the retailer directly.
          </p>
          <p className="text-[var(--color-muted)]">
            Affiliate relationships do not influence which products we show or the order in which
            prices are ranked. We always rank by price, cheapest first.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">4. NHS and prescription medicines</h2>
          <ul className="space-y-2 text-[var(--color-muted)] list-disc list-inside">
            <li>NHS Drug Tariff prices shown are what the NHS pays suppliers — not necessarily what you pay.</li>
            <li>The England NHS prescription charge is currently £9.90 per item (subject to change). Free for eligible patients.</li>
            <li>Many medicines listed on GeneriQ require a valid UK prescription. It is illegal to obtain prescription-only medicines without a valid prescription.</li>
            <li>GeneriQ does not facilitate the sale or dispensing of medicines. We link to third-party licensed pharmacies only.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">5. Acceptable use</h2>
          <p className="mb-2">You agree not to:</p>
          <ul className="space-y-1 text-[var(--color-muted)] list-disc list-inside">
            <li>Use automated scraping, bots or crawlers to extract data from GeneriQ</li>
            <li>Use the service for any unlawful purpose</li>
            <li>Attempt to interfere with, disrupt or damage the service</li>
            <li>Misrepresent price information obtained from GeneriQ</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">6. Intellectual property</h2>
          <p className="text-[var(--color-muted)]">
            The GeneriQ name, logo, design and original content are the property of GeneriQ / Uttam Yadav.
            Medicine data is sourced from public datasets including MHRA, NHS Drug Tariff and
            Open Food Facts/Open Beauty Facts, which are used under their respective open licences.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">7. Limitation of liability</h2>
          <p className="text-[var(--color-muted)]">
            To the fullest extent permitted by law, GeneriQ shall not be liable for any direct,
            indirect, incidental or consequential loss arising from your use of, or inability to
            use, this service — including but not limited to purchasing decisions made based on
            prices displayed. We provide the service &ldquo;as is&rdquo; without warranties of
            any kind.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">8. Third-party websites</h2>
          <p className="text-[var(--color-muted)]">
            GeneriQ contains links to third-party websites. We are not responsible for the content,
            privacy practices or accuracy of information on those sites. Links do not constitute
            an endorsement. You access third-party sites at your own risk.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">9. Governing law</h2>
          <p className="text-[var(--color-muted)]">
            These terms are governed by the laws of England and Wales. Any disputes shall be
            subject to the exclusive jurisdiction of the courts of England and Wales.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">10. Changes to these terms</h2>
          <p className="text-[var(--color-muted)]">
            We reserve the right to update these Terms of Service at any time. The &ldquo;Last
            updated&rdquo; date at the top will reflect changes. Continued use of GeneriQ after
            changes are posted constitutes your acceptance of the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">11. Contact</h2>
          <p className="text-[var(--color-muted)]">
            Questions about these Terms of Service? Contact us at{" "}
            <a href="mailto:yadavuttam5788@gmail.com" className="text-[var(--color-brand)] hover:underline font-medium">
              yadavuttam5788@gmail.com
            </a>.
          </p>
        </section>

      </div>

      <div className="mt-10 pt-6 border-t border-[var(--color-border)] flex gap-4 text-sm">
        <Link href="/privacy" className="text-[var(--color-brand)] hover:underline">Privacy Policy →</Link>
        <Link href="/" className="text-[var(--color-muted)] hover:text-[var(--color-brand)]">← Back to GeneriQ</Link>
      </div>
    </div>
  );
}
