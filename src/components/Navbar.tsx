"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

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
            { href: "/basket", label: "Basket" },
            { href: "/alerts", label: "Alerts" },
            { href: "/coverage", label: "Coverage" },
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
        <div className="flex items-center gap-2">
          <ThemeToggle />
          
          <div className="h-6 w-px bg-[var(--color-border)] mx-1 hidden sm:block" />

          {status === "loading" ? (
            <div className="h-8 w-8 rounded-full bg-[var(--color-brand-light)] animate-pulse hidden sm:block" />
          ) : session ? (
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className={`flex items-center gap-2 px-2 py-1 rounded-full border border-[var(--color-border)] hover:bg-[var(--color-brand-light)] transition-colors ${
                  pathname === "/profile" ? "bg-[var(--color-brand-light)] border-[var(--color-brand)]" : ""
                }`}
              >
                {session.user?.image ? (
                  <img src={session.user.image} alt="" className="h-6 w-6 rounded-full" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-[var(--color-brand)] flex items-center justify-center text-[10px] text-white font-bold">
                    {session.user?.name?.[0] || session.user?.email?.[0] || "?"}
                  </div>
                )}
                <span className="text-xs font-medium hidden md:block">Profile</span>
              </Link>
              <button
                onClick={() => signOut()}
                className="text-xs text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors hidden sm:block"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className={`text-sm font-medium px-4 py-1.5 rounded-full transition-colors ${
                pathname === "/login"
                  ? "bg-[var(--color-brand)] text-white"
                  : "bg-[var(--color-brand-light)] text-[var(--color-brand)] hover:bg-[var(--color-brand)] hover:text-white"
              }`}
            >
              Sign In
            </Link>
          )}

          {/* Mobile: show brand label only — nav is in BottomNav */}
          <span className="sm:hidden text-xs text-[var(--color-muted)] font-medium">GeneriQ</span>
        </div>
      </div>
    </header>
  );
}
