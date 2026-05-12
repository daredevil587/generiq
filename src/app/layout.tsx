import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GeneriQ — UK Medicine Price Comparison",
  description:
    "Compare UK pharmacy prices for medicines, supplements and skincare. Find the cheapest price for any health product.",
  keywords: ["generic medicine", "UK pharmacy prices", "NHS drug tariff", "medicine comparison"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Prevent dark-mode flash by reading localStorage before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme:dark)').matches;if(t==='dark'||(t===null&&d)){document.documentElement.classList.add('dark')}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--color-background)]">
        <Navbar />
        <main className="flex-1 pb-16 sm:pb-0">{children}</main>
        <footer className="hidden sm:block border-t border-[var(--color-border)] bg-[var(--color-surface)] mt-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-xs text-[var(--color-muted)]">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-3">
              <p>
                © {new Date().getFullYear()} GeneriQ. Data sourced from{" "}
                <a href="https://products.mhra.gov.uk" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-brand)] underline underline-offset-2">
                  MHRA
                </a>{" "}
                &amp; NHS Drug Tariff.
              </p>
              <p>Not medical advice. Always consult your pharmacist or GP.</p>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-4 pt-3 border-t border-[var(--color-border)]">
              <Link href="/privacy" className="hover:text-[var(--color-brand)] transition-colors">Privacy Policy</Link>
              <span>·</span>
              <Link href="/terms" className="hover:text-[var(--color-brand)] transition-colors">Terms of Service</Link>
              <span>·</span>
              <a href="mailto:yadavuttam5788@gmail.com" className="hover:text-[var(--color-brand)] transition-colors">Contact</a>
            </div>
          </div>
        </footer>
        <BottomNav />
      </body>
    </html>
  );
}
