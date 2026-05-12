import SearchBar from "@/components/SearchBar";
import MedicineCard from "@/components/MedicineCard";
import RecentlyViewed from "@/components/RecentlyViewed";
import { searchMedicines, getAllCategories, getSkincareMeta, getSearchTabCounts } from "@/lib/medicines-dal";
import Link from "next/link";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";

interface Props {
  searchParams: Promise<{ q?: string; page?: string; tab?: string; gender?: string; subcategory?: string; sort?: string; priced?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const tab = params.tab ?? "";

  const tabLabel = tab === "medicines" ? "Medicines"
    : tab === "supplements" ? "Supplements"
    : tab === "skincare" ? "Skincare & Beauty"
    : "All products";

  const title = q
    ? `"${q}" — ${tabLabel} Price Comparison | GeneriQ`
    : `Search ${tabLabel} — Compare UK Prices | GeneriQ`;

  const description = q
    ? `Compare UK prices for "${q}" across Boots, Superdrug, Holland & Barrett and Amazon. Find the cheapest option instantly.`
    : `Browse and compare UK prices for ${tabLabel.toLowerCase()} across Boots, Superdrug, Holland & Barrett and Amazon.`;

  const params_ = new URLSearchParams();
  if (q) params_.set("q", q);
  if (tab) params_.set("tab", tab);
  const qs = params_.toString();
  const canonicalUrl = `${siteUrl}/search${qs ? `?${qs}` : ""}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "GeneriQ",
      type: "website",
    },
  };
}

const PAGE_SIZE = 20;

const TABS = [
  { key: "all",         label: "All" },
  { key: "medicines",   label: "Medicines" },
  { key: "supplements", label: "Supplements" },
  { key: "skincare",    label: "Skincare & Beauty" },
];

const GENDER_TABS = [
  { key: "",       label: "All"    },
  { key: "women",  label: "Women"  },
  { key: "men",    label: "Men"    },
  { key: "unisex", label: "Unisex" },
];

const SUBCATEGORY_LABELS: Record<string, string> = {
  serum:        "Serums",
  moisturiser:  "Moisturisers",
  cleanser:     "Cleansers",
  toner:        "Toners",
  "eye-cream":  "Eye Care",
  spf:          "SPF / Sun",
  "face-mask":  "Face Masks",
  shampoo:      "Shampoos",
  conditioner:  "Conditioners",
  "hair-care":  "Hair Care",
  body:         "Body",
  makeup:       "Makeup",
  "lip-care":   "Lip Care",
  "nail-care":  "Nail Care",
  shaving:      "Shaving",
  aftershave:   "Aftershave",
  "beard-care": "Beard Care",
  grooming:     "Grooming",
  skincare:     "General Skincare",
};

export default async function SearchPage({ searchParams }: Props) {
  const params      = await searchParams;
  const query       = params.q?.trim() ?? "";
  const tab         = TABS.find(t => t.key === params.tab)?.key ?? "all";
  const gender      = params.gender ?? "";
  const subcategory = params.subcategory ?? "";
  const page        = Math.max(1, parseInt(params.page ?? "1", 10));
  const offset      = (page - 1) * PAGE_SIZE;
  const sort        = ["relevance", "price_asc", "price_desc", "name_asc"].includes(params.sort ?? "")
                        ? (params.sort ?? "relevance")
                        : "relevance";
  const pricedOnly  = params.priced === "1";

  const [{ rows, total }, categories, skincareMeta, tabCounts] = await Promise.all([
    searchMedicines(query, PAGE_SIZE, offset, tab, gender || undefined, subcategory || undefined, sort, pricedOnly),
    getAllCategories(),
    tab === "skincare" ? getSkincareMeta() : Promise.resolve(null),
    getSearchTabCounts(query),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildHref(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    if (query)                                      p.set("q", query);
    const t = overrides.tab         ?? tab;         if (t && t !== "all") p.set("tab", t);
    const g = overrides.gender      ?? gender;      if (g)                p.set("gender", g);
    const s = overrides.subcategory ?? subcategory; if (s)                p.set("subcategory", s);
    const so = overrides.sort !== undefined ? overrides.sort : sort;
    if (so && so !== "relevance")                   p.set("sort", so);
    const pr = overrides.priced !== undefined ? overrides.priced : (pricedOnly ? "1" : "");
    if (pr)                                         p.set("priced", pr);
    if (overrides.page)                             p.set("page", overrides.page);
    const qs = p.toString();
    return `/search${qs ? `?${qs}` : ""}`;
  }

  function tabHref(t: string)    { return buildHref({ tab: t, gender: "", subcategory: "", page: "" }); }
  function genderHref(g: string) { return buildHref({ gender: g, subcategory: "", page: "" }); }
  function subHref(s: string)    { return buildHref({ subcategory: s === subcategory ? "" : s, page: "" }); }
  function sortHref(so: string)  { return buildHref({ sort: so, page: "" }); }
  function pricedHref()          { return buildHref({ priced: pricedOnly ? "" : "1", page: "" }); }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8">

      {/* Search bar */}
      <div className="max-w-2xl mb-5">
        <SearchBar initialValue={query} size="sm" />
      </div>

      {/* Recently viewed — only when not actively searching */}
      {!query && <RecentlyViewed />}

      {/* Category tabs — scrollable on mobile, with result counts */}
      <div className="flex gap-0.5 mb-5 border-b border-[var(--color-border)] overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => {
          const count = tabCounts[t.key as keyof typeof tabCounts];
          const active = tab === t.key;
          return (
            <Link key={t.key} href={tabHref(t.key)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}>
              {t.label}
              <span className={`text-xs rounded-full px-1.5 py-0.5 tabular-nums font-normal ${
                active
                  ? "bg-[var(--color-brand)] text-white"
                  : "bg-[var(--color-surface-2)] text-[var(--color-muted)]"
              }`}>
                {count.toLocaleString()}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Gender + subcategory filters — skincare only */}
      {tab === "skincare" && (
        <div className="mb-5">
          <div className="flex gap-2 flex-wrap">
            {GENDER_TABS.map((g) => (
              <Link key={g.key} href={genderHref(g.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  gender === g.key
                    ? "bg-pink-600 text-white border-pink-600"
                    : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-pink-400 hover:text-pink-600"
                }`}>
                {g.label}
                {skincareMeta && g.key !== "" && (
                  <span className="ml-1 text-xs opacity-70">
                    ({(skincareMeta.genders.find(x => x.gender === g.key)?.count ?? 0).toLocaleString()})
                  </span>
                )}
              </Link>
            ))}
          </div>

          {skincareMeta && skincareMeta.subcategories.length > 0 && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {skincareMeta.subcategories.slice(0, 16).map((s) => (
                <Link key={s.subcategory} href={subHref(s.subcategory)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                    subcategory === s.subcategory
                      ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)]"
                      : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                  }`}>
                  {SUBCATEGORY_LABELS[s.subcategory] ?? s.subcategory}
                  <span className="ml-1 opacity-60">({s.count.toLocaleString()})</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">

        {/* Sidebar — hidden on mobile, shown on lg+ */}
        <aside className="hidden lg:block lg:w-52 shrink-0">
          <h2 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-3">Categories</h2>
          <ul className="space-y-0.5">
            <li>
              <Link href={tabHref(tab)}
                className={`block text-sm px-3 py-1.5 rounded-lg transition-colors ${!query ? "bg-[var(--color-brand-light)] text-[var(--color-brand)] font-medium" : "text-[var(--color-muted)] hover:text-[var(--color-brand)]"}`}>
                All <span className="text-xs opacity-60">({total.toLocaleString()})</span>
              </Link>
            </li>
            {categories.slice(0, 18).map((cat) => (
              <li key={cat}>
                <Link href={`/search?q=${encodeURIComponent(cat)}&tab=${tab}`}
                  className={`block text-sm px-3 py-1.5 rounded-lg transition-colors truncate ${query === cat ? "bg-[var(--color-brand-light)] text-[var(--color-brand)] font-medium" : "text-[var(--color-muted)] hover:text-[var(--color-brand)]"}`}>
                  {cat}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {/* Results header */}
          <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
            <h1 className="text-base sm:text-lg font-semibold text-[var(--color-foreground)]">
              {query ? (
                <>
                  {total === 0 ? "No results" : `${total.toLocaleString()} result${total !== 1 ? "s" : ""}`} for{" "}
                  <span className="text-[var(--color-brand)]">&ldquo;{query}&rdquo;</span>
                </>
              ) : (
                <>
                  {tab === "skincare" && gender
                    ? `${GENDER_TABS.find(g => g.key === gender)?.label} skincare`
                    : tab === "skincare" && subcategory
                    ? SUBCATEGORY_LABELS[subcategory] ?? subcategory
                    : "All products"}{" "}
                  <span className="text-[var(--color-muted)] font-normal text-sm">({total.toLocaleString()})</span>
                </>
              )}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Priced only toggle */}
              <Link href={pricedHref()}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  pricedOnly
                    ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)]"
                    : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                }`}>
                Has prices
              </Link>
              {/* Sort */}
              {[
                { value: "relevance", label: "Best match" },
                { value: "price_asc", label: "Price ↑" },
                { value: "price_desc", label: "Price ↓" },
                { value: "name_asc", label: "A–Z" },
              ].map(opt => (
                <Link key={opt.value} href={sortHref(opt.value)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    sort === opt.value
                      ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)]"
                      : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                  }`}>
                  {opt.label}
                </Link>
              ))}
              {(query || gender || subcategory || sort !== "relevance" || pricedOnly) && (
                <Link href={tabHref(tab)} className="text-xs text-[var(--color-muted)] hover:text-[var(--color-brand)]">
                  Clear ×
                </Link>
              )}
            </div>
          </div>

          {rows.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                {rows.map((m) => <MedicineCard key={m.id} medicine={m} />)}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-1 flex-wrap">
                  {page > 1 ? (
                    <Link href={buildHref({ page: String(page - 1) })}
                      className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors bg-[var(--color-surface)]">
                      ←
                    </Link>
                  ) : (
                    <span className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg opacity-30 cursor-not-allowed">←</span>
                  )}

                  {(() => {
                    const pages: (number | "…")[] = [];
                    if (totalPages <= 7) {
                      for (let i = 1; i <= totalPages; i++) pages.push(i);
                    } else {
                      pages.push(1);
                      if (page > 3) pages.push("…");
                      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
                      if (page < totalPages - 2) pages.push("…");
                      pages.push(totalPages);
                    }
                    return pages.map((p, i) =>
                      p === "…" ? (
                        <span key={`e${i}`} className="px-2 py-1.5 text-sm text-[var(--color-muted)]">…</span>
                      ) : (
                        <Link key={p} href={buildHref({ page: String(p) })}
                          className={`px-3 py-1.5 text-sm border rounded-lg transition-colors ${
                            p === page
                              ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white"
                              : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                          }`}>
                          {p}
                        </Link>
                      )
                    );
                  })()}

                  {page < totalPages ? (
                    <Link href={buildHref({ page: String(page + 1) })}
                      className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors bg-[var(--color-surface)]">
                      →
                    </Link>
                  ) : (
                    <span className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg opacity-30 cursor-not-allowed">→</span>
                  )}

                  <span className="w-full text-center text-xs text-[var(--color-muted)] mt-1">
                    Page {page} of {totalPages.toLocaleString()} · {total.toLocaleString()} results
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-[var(--color-surface-2)] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-[var(--color-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              </div>
              <h2 className="font-semibold text-[var(--color-foreground)] mb-2">No products found</h2>
              <p className="text-sm text-[var(--color-muted)] mb-5">Try a different filter or search term.</p>
              <Link href="/search" className="text-sm text-[var(--color-brand)] font-medium">Browse all →</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
