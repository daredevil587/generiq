#!/usr/bin/env node
/**
 * bulk-import-supplements-skincare.mjs
 *
 * Fetches supplements from Open Food Facts and skincare from Open Beauty Facts,
 * then bulk-imports into the GeneriQ medicines table.
 *
 * Usage: node scripts/bulk-import-supplements-skincare.mjs
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Env ───────────────────────────────────────────────────────────────────────
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (t && !t.startsWith('#') && t.includes('=')) {
    const [k, ...vs] = t.split('=');
    process.env[k.trim()] = vs.join('=').trim();
  }
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE    = 100;   // Open Food/Beauty Facts hard-caps at 100 per page
const MAX_PAGES    = 60;    // per category (60 × 100 = up to 6,000 per category)
const REQ_DELAY_MS = 600;   // ms between API requests (be polite)
const RETRY_DELAY  = [2000, 5000, 10000]; // backoff for failed requests
const BATCH_COMMIT = 200;   // db inserts per commit

const FIELDS = 'product_name,brands,categories,ingredients_text,quantity,countries_tags';

const FOOD_FACTS_BASE   = 'https://world.openfoodfacts.org/cgi/search.pl';
const BEAUTY_FACTS_BASE = 'https://world.openbeautyfacts.org/cgi/search.pl';

const BEAUTY_CATEGORIES = [
  // Already fetched — will early-exit quickly
  'face-creams', 'moisturizers', 'moisturisers', 'face-serums', 'serums',
  'sunscreens', 'sun-care', 'facial-cleansers', 'cleansers', 'face-washes',
  'face-toners', 'toners', 'eye-creams', 'eye-care', 'body-lotions',
  'body-moisturizers', 'body-creams', 'shampoos', 'conditioners',
  'hair-care', 'lip-care', 'face-masks', 'exfoliants',
  // New categories for extra volume
  'foundations',
  'lipsticks',
  'mascaras',
  'nail-polishes',
  'nail-care',
  'deodorants',
  'antiperspirants',
  'shower-gels',
  'body-washes',
  'soaps',
  'bath-products',
  'perfumes',
  'fragrances',
  'aftershaves',
  'beard-care',
  'hair-masks',
  'hair-oils',
  'hair-styling',
  'lip-balms',
  'bb-creams',
  'cc-creams',
  'primers',
  'concealers',
  'bronzers',
  'blushes',
  'eyeshadows',
  'eyeliners',
  'makeup-removers',
  'baby-care',
  'hand-creams',
  'foot-care',
  'stretch-mark-creams',
  'anti-cellulite',
  'self-tanners',
  'after-sun',
  // Top-up pass — ingredient-led and product-type categories
  'face-oils',
  'facial-oils',
  'body-oils',
  'micellar-water',
  'micellar-waters',
  'tinted-moisturizers',
  'tinted-moisturisers',
  'setting-sprays',
  'setting-powders',
  'face-scrubs',
  'body-scrubs',
  'exfoliating-scrubs',
  'retinol',
  'niacinamide',
  'hyaluronic-acid',
  'vitamin-c-serums',
  'eye-serums',
  'neck-creams',
  'night-creams',
  'day-creams',
  'spf-moisturizers',
  'spf-creams',
  'sun-protection',
  'after-shave-balms',
  'shaving-creams',
  'shaving-gels',
  'intimate-care',
  'feminine-hygiene',
  'dental-care',
  'toothpastes',
  'mouthwashes',
  'teeth-whitening',
  'dry-shampoos',
  'hair-serums',
  'scalp-care',
  'hair-growth',
  'eyelash-serums',
  'brow-products',
  'highlighters',
  'contour',
  'setting-products',
  'makeup-primers',
  'skin-tints',
  'cushion-foundations',
  'powder-foundations',
  'loose-powders',
  'compact-powders',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function clean(str, maxLen = 255) {
  if (!str) return null;
  return str.replace(/\s+/g, ' ').trim().slice(0, maxLen) || null;
}

async function fetchPage(url, attempt = 0) {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'GeneriQ/1.0 (medicine price comparison; contact@generiq.app)' },
      signal: AbortSignal.timeout(30_000),
    });
    if (resp.status === 429 || resp.status === 503) {
      const delay = RETRY_DELAY[Math.min(attempt, RETRY_DELAY.length - 1)];
      process.stdout.write(` [${resp.status}, retry in ${delay / 1000}s]`);
      await sleep(delay);
      return fetchPage(url, attempt + 1);
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (err) {
    if (attempt < RETRY_DELAY.length) {
      const delay = RETRY_DELAY[attempt];
      process.stdout.write(` [err: ${err.message}, retry in ${delay / 1000}s]`);
      await sleep(delay);
      return fetchPage(url, attempt + 1);
    }
    process.stdout.write(` [FAILED: ${err.message}]`);
    return null;
  }
}

// ── DB helpers ────────────────────────────────────────────────────────────────
const INSERT_MED = `
  INSERT INTO medicines
    (name, generic_name, category, description, active_ingredient,
     dosage_form, mhra_approved, brand_names, bnf_code, atc_code, source)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
`;

async function loadExistingNames() {
  const res = await pool.query(
    "SELECT LOWER(name) AS n FROM medicines WHERE category IN ('supplement','skincare')",
  );
  return new Set(res.rows.map(r => r.n));
}

// ── Product normalisation ─────────────────────────────────────────────────────
function normaliseProduct(p, category) {
  const name = clean(p.product_name);
  if (!name || name.length < 3) return null;

  const brands    = clean(p.brands);
  const cats      = (p.categories || '').toLowerCase();
  const ings      = clean(p.ingredients_text, 1000);
  const qty       = clean(p.quantity, 80);
  const countries = (p.countries_tags || []).join(',');

  // For supplements: prefer English/UK products
  if (category === 'supplement') {
    const hasEn = countries.includes('en:') || countries.includes('united-kingdom') ||
                  countries.includes('united-states') || countries === '';
    if (!hasEn) return null;
  }

  // Build a sensible description
  let desc = '';
  if (category === 'supplement') {
    if (cats.includes('vitamin'))          desc = 'Vitamin supplement.';
    else if (cats.includes('omega') || cats.includes('fish-oil')) desc = 'Omega fatty acid supplement.';
    else if (cats.includes('probiotic'))   desc = 'Probiotic supplement.';
    else if (cats.includes('mineral'))     desc = 'Mineral supplement.';
    else if (cats.includes('protein'))     desc = 'Protein supplement.';
    else if (cats.includes('herbal'))      desc = 'Herbal supplement.';
    else                                   desc = 'Dietary supplement.';
  } else {
    if (cats.includes('serum'))            desc = 'Skincare serum.';
    else if (cats.includes('moisturis'))   desc = 'Moisturiser.';
    else if (cats.includes('cleanser') || cats.includes('wash')) desc = 'Facial cleanser.';
    else if (cats.includes('toner'))       desc = 'Facial toner.';
    else if (cats.includes('sunscreen') || cats.includes('spf')) desc = 'Sun protection.';
    else if (cats.includes('eye'))         desc = 'Eye care.';
    else if (cats.includes('shampoo'))     desc = 'Shampoo.';
    else if (cats.includes('conditioner')) desc = 'Conditioner.';
    else if (cats.includes('body'))        desc = 'Body lotion.';
    else                                   desc = 'Skincare product.';
  }
  if (brands) desc += ` Brand: ${brands.split(',')[0].trim()}.`;
  if (qty)    desc += ` Size: ${qty}.`;
  if (ings)   desc += ` Key ingredients: ${ings.slice(0, 200)}.`;

  const activeIng = ings
    ? ings.split(/[,;]/)[0].trim().slice(0, 255)
    : name;

  const dosageForm = category === 'supplement'
    ? (cats.includes('tablet') ? 'Tablets' : cats.includes('capsule') ? 'Capsules' : cats.includes('liquid') ? 'Liquid' : 'Supplement')
    : 'Topical';

  return {
    name,
    generic_name:     name,
    category,
    description:      desc.slice(0, 500),
    active_ingredient: activeIng,
    dosage_form:      dosageForm,
    mhra_approved:    false,
    brand_names:      brands,
    bnf_code:         null,
    atc_code:         null,
    source:           category === 'supplement' ? 'openfoodfacts' : 'openbeautyfacts',
  };
}

// ── Fetch + import one category ───────────────────────────────────────────────
async function importCategory(baseUrl, tag, category, existing, stats) {
  let inserted       = 0;
  let skipped        = 0;
  let pendingRows    = [];
  let emptyPageRun   = 0;  // consecutive pages with 0 new products

  async function flushBatch() {
    if (!pendingRows.length) return;
    for (const r of pendingRows) {
      try {
        await pool.query(INSERT_MED, [
          r.name, r.generic_name, r.category, r.description,
          r.active_ingredient, r.dosage_form, r.mhra_approved,
          r.brand_names, r.bnf_code, r.atc_code, r.source,
        ]);
        existing.add(r.name.toLowerCase());
        inserted++;
      } catch (_) { /* duplicate or constraint error — skip */ }
    }
    pendingRows = [];
    stats.total_inserted += inserted;
  }

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${baseUrl}?action=process&tagtype_0=categories&tag_contains_0=contains&tag_0=${tag}&json=1&page_size=${PAGE_SIZE}&page=${page}&fields=${FIELDS}`;
    process.stdout.write(`  page ${page}...`);
    const data = await fetchPage(url);
    await sleep(REQ_DELAY_MS);

    if (!data || !Array.isArray(data.products)) {
      process.stdout.write(' no data\n');
      break;
    }

    const products = data.products;
    process.stdout.write(` ${products.length} raw`);

    if (products.length === 0) {
      process.stdout.write(' (end)\n');
      break;
    }

    let pageInserted = 0;
    for (const p of products) {
      const norm = normaliseProduct(p, category);
      if (!norm) { skipped++; continue; }
      if (existing.has(norm.name.toLowerCase())) { skipped++; continue; }

      existing.add(norm.name.toLowerCase()); // optimistic dedup
      pendingRows.push(norm);
      pageInserted++;

      if (pendingRows.length >= BATCH_COMMIT) {
        const before = inserted;
        await flushBatch();
        process.stdout.write(` +${inserted - before}`);
      }
    }

    process.stdout.write(` queued:${pageInserted}\n`);

    if (pageInserted === 0) emptyPageRun++;
    else emptyPageRun = 0;

    // Stop when API is exhausted or 4 consecutive pages yield nothing new
    if (products.length === 0 || emptyPageRun >= 4) break;
  }

  await flushBatch();
  console.log(`  → ${tag}: ${inserted} inserted, ${skipped} skipped/duplicate`);
  return inserted;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n=== GeneriQ Bulk Import: Supplements & Skincare ===\n');
  console.log(`Config: PAGE_SIZE=${PAGE_SIZE}, MAX_PAGES=${MAX_PAGES}, target ~${PAGE_SIZE * MAX_PAGES} per source`);
  console.log(`Delay between requests: ${REQ_DELAY_MS}ms\n`);

  const existing = await loadExistingNames();
  console.log(`Pre-existing supplement/skincare products: ${existing.size}\n`);

  const stats = { total_inserted: 0 };

  // ── 1. Supplements from Open Food Facts ────────────────────────────────────
  console.log('── SUPPLEMENTS (Open Food Facts) ──');
  const suppTags = [
    // All previously fetched — early-exit after 4 zero-yield pages
    'dietary-supplements', 'vitamins', 'food-supplements',
    'nutritional-supplements', 'herbal-supplements',
    'vitamin-c', 'vitamin-d', 'omega-3', 'probiotics',
    'protein-supplements', 'minerals', 'multivitamins',
    'collagen-supplements', 'sports-nutrition', 'weight-loss-supplements',
    'energy-supplements', 'nootropics', 'adaptogens', 'iron-supplements',
    'calcium-supplements', 'zinc-supplements', 'magnesium-supplements',
    'biotin', 'coenzyme-q10', 'melatonin', 'creatine', 'amino-acids',
    'meal-replacements', 'plant-proteins', 'whey-proteins',
  ];
  for (const tag of suppTags) {
    console.log(`\nFetching: ${tag}`);
    await importCategory(FOOD_FACTS_BASE, tag, 'supplement', existing, stats);
  }

  // ── 2. Skincare from Open Beauty Facts ────────────────────────────────────
  console.log('\n── SKINCARE (Open Beauty Facts) ──');
  for (const cat of BEAUTY_CATEGORIES) {
    console.log(`\nFetching: ${cat}`);
    await importCategory(BEAUTY_FACTS_BASE, cat, 'skincare', existing, stats);
  }

  // ── Final counts ───────────────────────────────────────────────────────────
  console.log('\n── FINAL DB COUNTS ──');
  const counts = await pool.query(`
    SELECT category, COUNT(*) AS cnt
    FROM medicines
    WHERE category IN ('supplement', 'skincare')
    GROUP BY category
    ORDER BY category
  `);
  for (const row of counts.rows) {
    console.log(`  ${row.category}: ${Number(row.cnt).toLocaleString()} products`);
  }
  console.log(`\nTotal new products inserted this run: ${stats.total_inserted.toLocaleString()}`);

  await pool.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
