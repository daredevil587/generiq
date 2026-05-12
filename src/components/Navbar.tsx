"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-[var(--color-brand)] text-lg shrink-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="2"  y="2"  width="9" height="9" rx="2" fill="currentColor" opacity="0.9" />
            <rect x="13" y="2"  width="9" height="9" rx="2" fill="currentColor" opacity="0.5" />
            <rect x="2"  y="13" width="9" height="9" rx="2" fill="currentColor" opacity="0.5" />
            <rect x="13" y="13" width="9" height="9" rx="2" fill="currentColor" opacity="0.2" />
          </svg>
          GeneriQ
        </Link>

        {/* Desktop nav links — hidden on mobile (bottom nav handles it) */}
        <nav className="hidden sm:flex items-center gap-1 text-sm flex-1">
          {[
            { href: "/",       label: "Home"   },
            { href: "/search", label: "Search" },
            { href: "/about",  label: "About"  },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                pathname === href
                  ? "bg-[var(--color-brand-light)] text-[var(--color-brand)] font-medium"
                  : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {/* Mobile: show brand label only — nav is in BottomNav */}
          <span className="sm:hidden text-xs text-[var(--color-muted)] font-medium">GeneriQ</span>
        </div>
      </div>
    </header>
  );
}
