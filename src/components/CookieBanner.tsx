"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/* ─── Cookie categories ──────────────────────────────────────────────────────── */

export type CookiePreferences = {
  essential: true;       // always on
  analytics: boolean;
  marketing: boolean;
};

const DEFAULT_PREFS: CookiePreferences = {
  essential: true,
  analytics: false,
  marketing: false,
};

const STORAGE_KEY = "gq_cookie_consent";

export function getConsent(): CookiePreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CookiePreferences) : null;
  } catch {
    return null;
  }
}

export function hasConsented(): boolean {
  return getConsent() !== null;
}

/* ─── Component ──────────────────────────────────────────────────────────────── */

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState<CookiePreferences>(DEFAULT_PREFS);

  useEffect(() => {
    // Show banner only if no consent stored
    if (!hasConsented()) {
      // Small delay so it doesn't flash on page load
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const save = useCallback((p: CookiePreferences) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    setVisible(false);
    setShowPrefs(false);
    // Dispatch event so analytics scripts can react
    window.dispatchEvent(new CustomEvent("cookie-consent-update", { detail: p }));
  }, []);

  const acceptAll = () => save({ essential: true, analytics: true, marketing: true });
  const rejectAll = () => save({ essential: true, analytics: false, marketing: false });
  const savePrefs = () => save(prefs);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop for preferences modal */}
      {showPrefs && (
        <div
          className="fixed inset-0 bg-black/40 z-[9998] backdrop-blur-sm"
          onClick={() => setShowPrefs(false)}
        />
      )}

      {/* ── Preferences modal ──────────────────────────────────────────────── */}
      {showPrefs && (
        <div className="fixed inset-x-4 bottom-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:bottom-6 sm:w-full sm:max-w-lg z-[9999] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl p-5 sm:p-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[var(--color-foreground)]">Cookie preferences</h2>
            <button
              onClick={() => setShowPrefs(false)}
              className="text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-xs text-[var(--color-muted)] mb-5 leading-relaxed">
            We use cookies to improve your experience. Essential cookies are required for the site to work.
            You can choose which optional cookies to allow.
          </p>

          <div className="space-y-3 mb-5">
            {/* Essential — always on */}
            <CookieRow
              label="Essential"
              description="Required for the site to function (theme, sessions)"
              checked={true}
              disabled={true}
            />
            {/* Analytics */}
            <CookieRow
              label="Analytics"
              description="Help us understand how visitors use GeneriQ (anonymous)"
              checked={prefs.analytics}
              onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))}
            />
            {/* Marketing */}
            <CookieRow
              label="Marketing"
              description="Used for affiliate link attribution (Awin network)"
              checked={prefs.marketing}
              onChange={(v) => setPrefs((p) => ({ ...p, marketing: v }))}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={savePrefs}
              className="flex-1 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Save preferences
            </button>
            <button
              onClick={acceptAll}
              className="flex-1 border border-[var(--color-border)] hover:border-[var(--color-brand)] text-[var(--color-foreground)] font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Accept all
            </button>
          </div>

          <p className="mt-3 text-center text-[10px] text-[var(--color-muted)]">
            Read our{" "}
            <Link href="/privacy" className="underline hover:text-[var(--color-brand)]">Privacy Policy</Link>
            {" "}for more details.
          </p>
        </div>
      )}

      {/* ── Main banner ────────────────────────────────────────────────────── */}
      {!showPrefs && (
        <div className="fixed inset-x-0 bottom-0 sm:bottom-4 sm:inset-x-4 sm:left-auto sm:right-4 sm:max-w-md z-[9999] animate-slide-up">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] sm:rounded-2xl shadow-2xl p-4 sm:p-5">
            {/* Cookie icon + text */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-[var(--color-brand-light)] flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-lg" role="img" aria-label="cookie">🍪</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-foreground)] mb-1">
                  We value your privacy
                </p>
                <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                  We use essential cookies to make GeneriQ work. We&apos;d also like to use analytics cookies
                  to understand how you use our site so we can improve it.
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 mb-2">
              <button
                onClick={acceptAll}
                className="flex-1 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                Accept all
              </button>
              <button
                onClick={rejectAll}
                className="flex-1 border border-[var(--color-border)] hover:border-[var(--color-brand)] text-[var(--color-foreground)] font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                Reject all
              </button>
            </div>

            <button
              onClick={() => setShowPrefs(true)}
              className="w-full text-center text-xs text-[var(--color-muted)] hover:text-[var(--color-brand)] py-1.5 transition-colors"
            >
              Manage preferences
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Toggle row ─────────────────────────────────────────────────────────────── */

function CookieRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
        disabled
          ? "border-[var(--color-border)] bg-[var(--color-surface-2)] opacity-70 cursor-not-allowed"
          : "border-[var(--color-border)] hover:border-[var(--color-brand)] cursor-pointer"
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--color-foreground)]">
          {label}
          {disabled && (
            <span className="ml-2 text-[10px] font-medium text-[var(--color-muted)] bg-[var(--color-surface)] px-1.5 py-0.5 rounded-full">
              Always on
            </span>
          )}
        </p>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">{description}</p>
      </div>

      {/* Toggle switch */}
      <div className="relative shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
          className="sr-only peer"
        />
        <div
          className={`w-10 h-6 rounded-full transition-colors ${
            checked
              ? "bg-[var(--color-brand)]"
              : "bg-[var(--color-border)]"
          } ${disabled ? "" : "peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-brand)] peer-focus-visible:ring-offset-2"}`}
          onClick={(e) => {
            if (disabled) return;
            e.preventDefault();
            onChange?.(!checked);
          }}
        >
          <div
            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              checked ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </div>
      </div>
    </label>
  );
}
