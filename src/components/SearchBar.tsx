"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Props {
  initialValue?: string;
  autoFocus?: boolean;
  size?: "sm" | "lg";
}

export default function SearchBar({ initialValue = "", autoFocus = false, size = "lg" }: Props) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
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

  function selectSuggestion(s: string) {
    setQuery(s);
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(s)}`);
  }

  const inputClass =
    size === "lg"
      ? "w-full pl-11 pr-28 py-3.5 text-base rounded-xl border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent transition"
      : "w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent transition";

  return (
    <div ref={ref} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
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
          {size === "lg" && (
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              Search
            </button>
          )}
        </div>
      </form>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <li key={s}>
              <button type="button" onClick={() => selectSuggestion(s)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--color-brand-light)] hover:text-[var(--color-brand)] transition-colors flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-[var(--color-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
