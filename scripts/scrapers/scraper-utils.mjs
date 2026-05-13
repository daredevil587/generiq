/**
 * scraper-utils.mjs
 * Shared utilities: DB connection, product matching, price upsert.
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium as playwrightChromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

const __dirname = dirname(fileURLToPath(import.meta.url));

for (const line of readFileSync(join(__dirname, '..', '..', '.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (t && !t.startsWith('#') && t.includes('=')) {
    const [k, ...vs] = t.split('=');
    process.env[k.trim()] = vs.join('=').trim();
  }
}

const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Name normalisation ────────────────────────────────────────────────────────

export function normaliseName(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/[''`´]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(tablets?|capsules?|softgels?|gummies?|liquid|spray|gel|cream|serum|lotion|oil|ml|mg|g\b|x\d+|\d+\s*pack)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordSet(s) {
  return new Set(normaliseName(s).split(' ').filter(w => w.length > 2));
}

export function matchScore(dbName, scrapedName) {
  const dbWords  = wordSet(dbName);
  const scrWords = wordSet(scrapedName);
  if (dbWords.size === 0 || scrWords.size === 0) return 0;
  let overlap = 0;
  for (const w of dbWords) if (scrWords.has(w)) overlap++;
  // Jaccard similarity
  const union = new Set([...dbWords, ...scrWords]).size;
  return overlap / union;
}

// ── Load DB products into memory for fast matching ────────────────────────────

export async function loadDbProducts(categories) {
  const placeholders = categories.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await pool.query(
    `SELECT id, name, category FROM medicines WHERE category IN (${placeholders})`,
    categories,
  );
  // Pre-compute normalised name for each row
  return rows.map(r => ({ ...r, norm: normaliseName(r.name) }));
}

// ── Match a scraped product to best DB entry ──────────────────────────────────

export function findBestMatch(scrapedName, dbProducts, minScore = 0.35) {
  let best = null;
  let bestScore = 0;
  for (const p of dbProducts) {
    const score = matchScore(p.name, scrapedName);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return bestScore >= minScore ? { product: best, score: bestScore } : null;
}

// ── Upsert price ──────────────────────────────────────────────────────────────

export async function upsertPrice({ medicineId, pharmacyName, pharmacyUrl, priceGbp, packSize, source, imageUrl }) {
  await pool.query(`
    INSERT INTO pharmacy_prices
      (medicine_id, pharmacy_name, pharmacy_url, price_gbp, in_stock, pack_size, image_url, source, last_updated)
    VALUES ($1, $2, $3, $4, true, $5, $6, $7, NOW())
    ON CONFLICT (medicine_id, pharmacy_name)
    DO UPDATE SET
      price_gbp    = EXCLUDED.price_gbp,
      pharmacy_url = EXCLUDED.pharmacy_url,
      pack_size    = EXCLUDED.pack_size,
      image_url    = COALESCE(EXCLUDED.image_url, pharmacy_prices.image_url),
      source       = EXCLUDED.source,
      last_updated = NOW()
  `, [medicineId, pharmacyName, pharmacyUrl, priceGbp, packSize ?? null, imageUrl ?? null, source]);
}

// ── Insert or get existing medicine by name + category ───────────────────────

export async function upsertMedicine({ name, category, source }) {
  const existing = await pool.query(
    'SELECT id FROM medicines WHERE name = $1 AND category = $2 LIMIT 1',
    [name, category],
  );
  if (existing.rows.length > 0) return existing.rows[0].id;
  const { rows } = await pool.query(`
    INSERT INTO medicines (name, generic_name, category, description, active_ingredient, dosage_form, mhra_approved, source, created_at)
    VALUES ($1, $1, $2, '', '', '', false, $3, NOW())
    RETURNING id
  `, [name, category, source]);
  return rows[0]?.id ?? null;
}

// ── Remove estimated prices once real ones exist ──────────────────────────────

export async function removeEstimatedPrices(categories) {
  const placeholders = categories.map((_, i) => `$${i + 1}`).join(',');
  const { rowCount } = await pool.query(`
    DELETE FROM pharmacy_prices pp
    USING medicines m
    WHERE pp.medicine_id = m.id
      AND m.category IN (${placeholders})
      AND pp.source = 'estimated'
      AND EXISTS (
        SELECT 1 FROM pharmacy_prices pp2
        WHERE pp2.medicine_id = pp.medicine_id
          AND pp2.source != 'estimated'
      )
  `, categories);
  return rowCount;
}

// ── Playwright browser helpers ────────────────────────────────────────────────

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export function randDelay(minMs = 800, maxMs = 2000) {
  return sleep(minMs + Math.random() * (maxMs - minMs));
}

export const BROWSER_ARGS = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
  ],
};

export const PAGE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-GB,en;q=0.9',
};

export async function launchStealthBrowser() {
  playwrightChromium.use(StealthPlugin());
  return playwrightChromium.launch(BROWSER_ARGS);
}
