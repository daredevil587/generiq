# GeneriQ — UK Medicine Price Comparison

Compare medicine and health product prices across UK pharmacies. Find cheaper generics, NHS prescription savings, and price drops.

---

## What Works Right Now (localhost:3000)

- Search 38,000+ medicines by name or active ingredient
- Compare prices across LloydsPharmacy, Chemist4U, Holland & Barrett, Well, Medino, Healthspan, Boots, Superdrug, Amazon, Pharmacy2U
- NHS prescription charge vs retail price comparison
- Generic alternatives (same active ingredient, lower price)
- Save to watchlist (localStorage — no login needed)
- Price drop email alerts (WatchPrice component)
- Basket comparison (compare saved products across retailers)
- Ingredient search — type "ibuprofen" and find all ibuprofen products
- Affiliate redirect (`/go/[id]`) logs clicks and redirects to pharmacy
- Profile page with saved watchlist
- Barcode scanner (OCR via camera)
- MHRA approval badge, BNF codes, NHS eligibility checker
- Cookie consent banner
- SEO: structured data (JSON-LD), canonical URLs, sitemap, OG tags
- Dark/light mode

---

## Database (Railway PostgreSQL)

| Stat | Value |
|------|-------|
| Total medicines | 38,924 |
| Have ≥1 retail price | 3,305 (8.5%) |
| Have ≥2 pharmacies to compare | 399 (1%) |

**Pharmacies currently in DB:**

| Pharmacy | Products |
|----------|----------|
| LloydsPharmacy | 2,762 |
| Chemist4U | 314 |
| Holland & Barrett | 289 |
| Well Pharmacy | 191 |
| Medino | 78 |
| Healthspan | 73 |
| Boots | 57 |
| Amazon UK | 41 |
| Superdrug | 32 |
| Pharmacy2U | 24 |

---

## What Was Fixed Today

1. **LloydsPharmacy scraper rewritten** — was iterating 1,304 collections (timed out at #8). Now uses Shopify global `/products.json` endpoint → gets all 5,765 products in ~2 minutes.

2. **Duplicate pharmacy name fixed** — `Lloyds Pharmacy` (17 rows) merged into `LloydsPharmacy`.

3. **Chemist4U categories expanded** — was 7 hardcoded URLs, many wrong. Now 43 real URLs from their sitemap.

4. **Medino categories fixed** — was guessing URLs (all 404). Now using real discovered URLs.

5. **DB connection pool limited** — `max: 3` added to prevent exhausting Railway's connection limit when multiple scrapers run in parallel.

6. **Generic alternatives keyword extraction fixed** — `getGenericAlternatives` was taking the first word of the medicine name ("Almus" from "Almus Children's Ibuprofen") instead of the drug name. Now uses a stop-word list to skip brand names, dose forms, and adjectives, returning the actual drug word ("ibuprofen").

---

## TODO TOMORROW

### 1. Re-run Scrapers With Fixed URLs (30 minutes)

```bash
# Run Chemist4U with the corrected 43 categories
node scripts/scrapers/chemist4u-scraper.mjs

# Run Medino with the correct URLs
node scripts/scrapers/medino-scraper.mjs

# Run Holland & Barrett (may need re-run for fresh prices)
node scripts/scrapers/hb-scraper.mjs

# Run Well Pharmacy
node scripts/scrapers/well-pharmacy-scraper.mjs

# Run all at once
node scripts/scrapers/run-all-scrapers.mjs
```

### 2. Get ScraperAPI Key (5 minutes, free)

Boots (57 products) and Superdrug (32 products) return 403 without a proxy.

1. Go to **scraperapi.com** → sign up → copy your API key
2. Add to `.env.local`:
   ```
   SCRAPER_API_KEY=your_key_here
   ```
3. Re-run:
   ```bash
   node scripts/scrapers/boots-scraper.mjs
   node scripts/scrapers/superdrug-scraper.mjs
   ```

### 3. Set Up Google OAuth (15 minutes)

Auth works with phone OTP today. To enable Google/Facebook login:

1. Go to **console.cloud.google.com** → Create project → Credentials → OAuth 2.0
2. Authorised redirect URI: `http://localhost:3000/api/auth/callback/google`
3. Add to `.env.local`:
   ```
   AUTH_GOOGLE_ID=your_client_id
   AUTH_GOOGLE_SECRET=your_client_secret
   ```

### 4. Commit All Changes to Git

Nothing has been committed. 30+ new files and 28 modified files will be lost if anything goes wrong.

```bash
git add -A
git commit -m "Add scrapers, auth, all feature components, ingredient search, affiliate redirect"
```

### 5. Deploy to Cloudflare (1-2 hours)

The site only runs on localhost. To make it live:

1. **Create Cloudflare D1 database**:
   ```bash
   npx wrangler d1 create generiq-db
   ```
2. **Create D1 schema**:
   ```bash
   npx wrangler d1 execute generiq-db --file=sql/d1-schema.sql
   ```
3. **Sync data from PostgreSQL → D1**:
   ```bash
   node scripts/scrapers/sync-pg-to-d1.mjs
   ```
4. **Update `wrangler.toml`** with the D1 binding ID
5. **Deploy**:
   ```bash
   npx opennextjs-cloudflare build
   npx wrangler deploy
   ```

### 6. Fix ChemistDirect (Blocked)

`chemistdirect.co.uk` returns 403 for all scraping. Either:
- Get ScraperAPI key (same one as Boots/Superdrug)
- Or remove ChemistDirect from the scraper list

---

## File Structure (Key Files)

```
src/
  app/
    page.tsx              — Homepage with category tiles
    search/page.tsx       — Search results
    medicine/[id]/page.tsx — Product detail with all price widgets
    basket/page.tsx       — Basket comparison
    profile/page.tsx      — Saved products / watchlist
    alerts/page.tsx       — Price alerts
    go/[id]/route.ts      — Affiliate redirect (tracks clicks)
    ingredient/[slug]/    — Ingredient search results page
    api/
      autocomplete/       — Search suggestions (medicines + ingredients)
      medicines/[id]/     — JSON API for basket comparison
      auth/               — NextAuth routes + OTP

  components/
    SearchBar.tsx         — Search with autocomplete + barcode scan
    PriceTable.tsx        — Price comparison table with Buy links
    SavingsSummary.tsx    — NHS vs retail savings banner
    GenericEquivalence.tsx — Generic alternatives explanation
    PriceHistorySnapshot.tsx — Lowest/average/highest prices
    ProductTrustDashboard.tsx — Data freshness, source confidence
    SaveMedicineButton.tsx — Save to watchlist (localStorage)
    SavedProducts.tsx     — Watchlist display on profile page
    BasketComparison.tsx  — Multi-product basket comparison
    WatchPrice.tsx        — Price drop email alert signup
    NhsEligibilityChecker.tsx — Free prescription eligibility checker
    BottomNav.tsx         — Mobile bottom navigation (Search/Compare/Basket/Alerts/Saved)
    Navbar.tsx            — Desktop top navigation
    AuthUI.tsx            — Login with Google/Facebook/Phone OTP

  lib/
    medicines-dal.ts      — All DB queries (search, prices, alternatives, autocomplete)
    medicines-db.ts       — DB adapter (PostgreSQL in dev, D1 in prod)
    config.ts             — NHS charge, PPC amounts
    format-utils.ts       — Price formatting, slugify

  auth.ts                 — NextAuth v5 config (JWT, phone OTP, Google, Facebook)

scripts/scrapers/
  lloyds-scraper.mjs      — LloydsPharmacy via Shopify /products.json
  chemist4u-scraper.mjs   — Chemist4U (43 categories)
  hb-scraper.mjs          — Holland & Barrett
  well-pharmacy-scraper.mjs — Well Pharmacy (Playwright)
  healthspan-scraper.mjs  — Healthspan
  medino-scraper.mjs      — Medino
  pharmacy2u-scraper.mjs  — Pharmacy2U (Playwright)
  boots-scraper.mjs       — Boots (needs ScraperAPI key)
  superdrug-scraper.mjs   — Superdrug (needs ScraperAPI key)
  amazon-scraper.mjs      — Amazon UK
  run-all-scrapers.mjs    — Runs all scrapers in sequence
  sync-pg-to-d1.mjs       — Sync PostgreSQL → Cloudflare D1

sql/
  d1-schema.sql           — Cloudflare D1 schema
  d1-sync-medicines.sql   — Data sync SQL
```

---

## Environment Variables Needed

`.env.local` (create this file, never commit it):

```env
# Required — Railway PostgreSQL
DATABASE_URL=postgresql://...

# Required — NextAuth
AUTH_SECRET=any-random-32-char-string

# Optional — enables Google login
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# Optional — enables Facebook login
AUTH_FACEBOOK_ID=
AUTH_FACEBOOK_SECRET=

# Optional — enables SMS OTP (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Optional — enables Boots + Superdrug scraping + ChemistDirect
SCRAPER_API_KEY=
```

`.dev.vars` (Cloudflare dev — only Twilio placeholders, do NOT add OAuth here):

```env
TWILIO_ACCOUNT_SID="placeholder"
TWILIO_AUTH_TOKEN="placeholder"
TWILIO_PHONE_NUMBER="placeholder"
```

---

## Running Locally

```bash
npm install
npm run dev     # starts on localhost:3000
```
