"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const BarcodeScanner = dynamic(() => import("./BarcodeScanner"), { ssr: false });

interface Props {
  initialValue?: string;
  autoFocus?: boolean;
  size?: "sm" | "lg";
}

export default function SearchBar({ initialValue = "", autoFocus = false, size = "lg" }: Props) {
  const [query, setQuery] = useState(initialValue);
  type Suggestion = { type: 'medicine' | 'ingredient'; label: string; href: string };
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(q)}`, {
        signal: abortRef.current.signal,
      });
      if (res.ok) setSuggestions(await res.json());
    } catch { /* aborted */ }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    fetchSuggestions(val);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOpen(false);
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    else router.push("/search");
  }

  function selectSuggestion(s: Suggestion) {
    setOpen(false);
    if (s.type === 'ingredient') {
      router.push(s.href);
    } else {
      setQuery(s.label);
      router.push(s.href);
    }
  }

  const inputClass =
    size === "lg"
      ? "w-full pl-11 pr-[9.5rem] py-3.5 text-base rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent transition"
      : "w-full pl-9 pr-10 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent transition";

  return (
    <>
    <div ref={ref} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          {/* Search icon */}
          <svg className={`absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] ${size === "lg" ? "w-5 h-5" : "w-4 h-4"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>

          <input
            type="search"
            value={query}
            onChange={handleChange}
            onFocus={() => query.length >= 2 && setOpen(true)}
            placeholder="Search medicine name or active ingredient…"
            autoFocus={autoFocus}
            className={inputClass}
            autoComplete="off"
            aria-label="Search medicines"
          />

          {/* Right-side buttons */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {/* OCR camera scan button */}
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              aria-label="Scan medicine label with camera"
              title="Scan medicine label"
              className={`flex items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-brand)] hover:border-[var(--color-brand)] transition-colors bg-[var(--color-surface)] ${size === "lg" ? "w-9 h-9" : "w-7 h-7"}`}
            >
              <svg className={size === "lg" ? "w-4 h-4" : "w-3.5 h-3.5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Search submit button — lg only */}
            {size === "lg" && (
              <button type="submit" className="bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                Search
              </button>
            )}
          </div>
        </div>
      </form>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <li key={`${s.type}-${s.label}`}>
              <button
                type="button"
                onClick={() => selectSuggestion(s)}
                className="w-full text-left px-4 py-2.5 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-brand-light)] hover:text-[var(--color-brand)] transition-colors flex items-center gap-2"
              >
                {s.type === 'ingredient' ? (
                  <svg className="w-3.5 h-3.5 text-[var(--color-brand)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-[var(--color-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                )}
                <span className="flex-1">{s.label}</span>
                {s.type === 'ingredient' && (
                  <span className="text-[10px] font-semibold text-[var(--color-brand)] bg-[var(--color-brand-light)] px-1.5 py-0.5 rounded-full shrink-0">ingredient</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>

    {/* Barcode scanner modal — lazy loaded */}
    {scannerOpen && <BarcodeScanner onClose={() => setScannerOpen(false)} />}
    </>
  );
}
