"use client";

import { useState } from "react";
import { formatGBP } from "@/lib/format-utils";

interface Props {
  medicineId: number;
  medicineName: string;
  currentPrice: string | null;
}

export default function WatchPrice({ medicineId, medicineName, currentPrice }: Props) {
  const [open, setOpen]   = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "exists" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, medicineId, consent: true }),
      });
      const data = await res.json() as { alreadyExists?: boolean };
      if (res.ok) setStatus(data.alreadyExists ? "exists" : "done");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm font-medium text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors"
      >
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        Get notified when price drops
      </button>
    );
  }

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-[var(--color-foreground)] text-sm">Price drop alert</p>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            We&apos;ll email you if <strong>{medicineName}</strong> drops below{" "}
            {currentPrice ? formatGBP(currentPrice) : "its current price"}.
          </p>
        </div>
        <button onClick={() => setOpen(false)} className="text-[var(--color-muted)] hover:text-[var(--color-foreground)] ml-3 shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {status === "done" && (
        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 rounded-xl px-4 py-3 text-sm">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Check your inbox to confirm your alert.
        </div>
      )}

      {status === "exists" && (
        <div className="bg-[var(--color-brand-light)] text-[var(--color-brand)] rounded-xl px-4 py-3 text-sm">
          You already have an alert set for this medicine.
        </div>
      )}

      {(status === "idle" || status === "loading" || status === "error") && (
        <form onSubmit={submit}>
          <div className="flex gap-2 mb-3">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 min-w-0 text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 bg-[var(--color-surface)] text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-brand)]"
            />
            <button
              type="submit"
              disabled={status === "loading" || !consent}
              className="shrink-0 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-60"
            >
              {status === "loading" ? "…" : "Alert me"}
            </button>
          </div>

          {/* Email consent checkbox */}
          <label className="flex items-start gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-brand)] accent-[var(--color-brand)] shrink-0"
            />
            <span className="text-[11px] text-[var(--color-muted)] leading-snug group-hover:text-[var(--color-foreground)] transition-colors">
              I agree to receive price alert emails for this product. We&apos;ll only email you about price changes — no spam.{" "}
              <a href="/privacy" target="_blank" className="text-[var(--color-brand)] hover:underline">
                Privacy Policy
              </a>
            </span>
          </label>
        </form>
      )}

      {status === "error" && (
        <p className="mt-2 text-xs text-red-600">Something went wrong — please try again.</p>
      )}
    </div>
  );
}
