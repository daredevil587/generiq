import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — GeneriQ",
  description: "How GeneriQ collects, uses and protects your data.",
};

export default function PrivacyPage() {
  const updated = "12 May 2026";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <div className="mb-8">
        <p className="text-xs text-[var(--color-muted)] mb-2">Last updated: {updated}</p>
        <h1 className="text-3xl font-bold text-[var(--color-foreground)]">Privacy Policy</h1>
        <p className="mt-3 text-[var(--color-muted)]">
          GeneriQ (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is committed to protecting your privacy.
          This policy explains what data we collect, why we collect it, and how we keep it safe.
        </p>
      </div>

      <div className="space-y-8 text-sm text-[var(--color-foreground)] leading-relaxed">

        <section>
          <h2 className="text-lg font-semibold mb-3">1. Who we are</h2>
          <p>
            GeneriQ is a UK health product price comparison service. We help people find the cheapest
            prices for medicines, supplements and skincare across UK pharmacies and retailers.
          </p>
          <p className="mt-2">
            <strong>Contact:</strong>{" "}
            <a href="mailto:yadavuttam5788@gmail.com" className="text-[var(--color-brand)] hover:underline">
              yadavuttam5788@gmail.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">2. Data we collect</h2>
          <p className="mb-3">We collect data in two ways:</p>
          <div className="space-y-4">
            <div className="bg-[var(--color-surface-2)] rounded-xl p-4">
              <h3 className="font-semibold mb-1">Data you provide</h3>
              <p className="text-[var(--color-muted)]">
                Currently GeneriQ does not require you to create an account or submit any personal
                information. Search queries you enter are not stored against your identity.
              </p>
            </div>
            <div className="bg-[var(--color-surface-2)] rounded-xl p-4">
              <h3 className="font-semibold mb-1">Data collected automatically</h3>
              <ul className="text-[var(--color-muted)] space-y-1 mt-1 list-disc list-inside">
                <li>Anonymous usage analytics (page views, search terms in aggregate)</li>
                <li>Standard server logs (IP address, browser type, referring page)</li>
                <li>Your dark/light mode preference (stored locally in your browser only)</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">3. Cookies</h2>
          <p className="mb-3">We use a minimal number of cookies:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-[var(--color-border)] rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-[var(--color-surface-2)] border-b border-[var(--color-border)]">
                  <th className="text-left px-4 py-2.5 font-semibold">Cookie</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Purpose</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                <tr>
                  <td className="px-4 py-2.5 font-mono text-xs">theme</td>
                  <td className="px-4 py-2.5 text-[var(--color-muted)]">Stores your dark/light mode preference</td>
                  <td className="px-4 py-2.5 text-[var(--color-muted)]">Persistent (localStorage)</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-mono text-xs">_vercel_*</td>
                  <td className="px-4 py-2.5 text-[var(--color-muted)]">Deployment and routing (Vercel infrastructure)</td>
                  <td className="px-4 py-2.5 text-[var(--color-muted)]">Session</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[var(--color-muted)]">
            We do not use advertising cookies or cross-site tracking cookies. You can clear cookies
            at any time through your browser settings.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">4. Third-party links and affiliate disclosures</h2>
          <p className="mb-2">
            GeneriQ contains links to third-party pharmacy and retailer websites (including Boots,
            Superdrug, Holland &amp; Barrett and Amazon). When you click a &ldquo;Buy&rdquo; link, you
            are leaving GeneriQ and visiting that retailer&apos;s website.
          </p>
          <p className="mb-2">
            Some of these links are <strong>affiliate links</strong> via the Awin network. This means
            GeneriQ may earn a small commission if you make a purchase after clicking a link, at no
            additional cost to you. Affiliate commissions help us keep the service free.
          </p>
          <p className="text-[var(--color-muted)]">
            We do not control the content or privacy practices of third-party websites and encourage
            you to read their privacy policies before making a purchase.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">5. How we use your data</h2>
          <ul className="space-y-2 text-[var(--color-muted)] list-disc list-inside">
            <li>To operate and improve the GeneriQ service</li>
            <li>To understand which searches and products are most useful to users</li>
            <li>To detect and prevent abuse or technical errors</li>
          </ul>
          <p className="mt-3">
            We do <strong>not</strong> sell your data to third parties, use it for advertising
            profiling, or share it with anyone other than essential infrastructure providers
            (Vercel for hosting, Railway for the database).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">6. Data retention</h2>
          <p className="text-[var(--color-muted)]">
            Server logs are retained for up to 30 days for security and debugging purposes, then
            automatically deleted. We do not store any personally identifiable search history.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">7. Your rights</h2>
          <p className="mb-2 text-[var(--color-muted)]">
            Under UK GDPR you have the right to:
          </p>
          <ul className="space-y-1 text-[var(--color-muted)] list-disc list-inside">
            <li>Request access to any personal data we hold about you</li>
            <li>Request deletion of your personal data</li>
            <li>Object to processing of your personal data</li>
            <li>Lodge a complaint with the ICO at <span className="font-medium">ico.org.uk</span></li>
          </ul>
          <p className="mt-3 text-[var(--color-muted)]">
            To exercise any of these rights, contact us at{" "}
            <a href="mailto:yadavuttam5788@gmail.com" className="text-[var(--color-brand)] hover:underline">
              yadavuttam5788@gmail.com
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">8. Changes to this policy</h2>
          <p className="text-[var(--color-muted)]">
            We may update this Privacy Policy from time to time. The &ldquo;Last updated&rdquo; date at
            the top of this page will reflect any changes. Continued use of GeneriQ after changes
            are posted constitutes your acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">9. Contact us</h2>
          <p className="text-[var(--color-muted)]">
            If you have any questions about this Privacy Policy, please contact us at{" "}
            <a href="mailto:yadavuttam5788@gmail.com" className="text-[var(--color-brand)] hover:underline font-medium">
              yadavuttam5788@gmail.com
            </a>.
          </p>
        </section>

      </div>

      <div className="mt-10 pt-6 border-t border-[var(--color-border)] flex gap-4 text-sm">
        <Link href="/terms" className="text-[var(--color-brand)] hover:underline">Terms of Service →</Link>
        <Link href="/" className="text-[var(--color-muted)] hover:text-[var(--color-brand)]">← Back to GeneriQ</Link>
      </div>
    </div>
  );
}
