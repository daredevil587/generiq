#!/usr/bin/env node
/**
 * run-all-scrapers.mjs
 *
 * Runs all scrapers sequentially, then removes estimated prices for products
 * that now have real prices.
 *
 * Anti-blocking strategy (in order of precedence):
 *   1. Shopify /products.json API (no bot detection — Well, Healthspan, Lloyds)
 *   2. ScraperAPI proxy (set SCRAPER_API_KEY in .env.local for Boots/Superdrug)
 *   3. Playwright stealth browser (for React-heavy sites like P2U)
 *   4. Direct fetch with stealth headers (for simpler sites)
 *
 * Usage:
 *   node scripts/scrapers/run-all-scrapers.mjs          # run once
 *   node scripts/scrapers/run-all-scrapers.mjs --watch  # run every 24 hours
 *   node scripts/scrapers/run-all-scrapers.mjs --only hb,lloyds  # run specific
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pool, removeEstimatedPrices } from './scraper-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Scraper registry ──────────────────────────────────────────────────────────
// tier: 1 = always run, 2 = run if not blocked, 3 = requires SCRAPER_API_KEY
const SCRAPERS = [
  // ── Tier 1: Shopify JSON API — fast, reliable, no bot detection ───────────
  { name: 'LloydsPharmacy',    file: 'lloyds-scraper.mjs',        tier: 1, categories: ['medicine', 'supplement', 'skincare'] },
  { name: 'Well Pharmacy',     file: 'well-pharmacy-scraper.mjs', tier: 1, categories: ['medicine', 'supplement'] },
  { name: 'Healthspan',        file: 'healthspan-scraper.mjs',    tier: 1, categories: ['supplement'] },
  { name: 'Holland & Barrett', file: 'hb-scraper.mjs',            tier: 1, categories: ['supplement'] },
  { name: 'Medino',            file: 'medino-scraper.mjs',        tier: 1, categories: ['medicine', 'supplement'] },

  // ── Tier 2: Fetch/cheerio scrapers — usually work without proxy ───────────
  { name: 'Chemist4U',         file: 'chemist4u-scraper.mjs',     tier: 2, categories: ['medicine', 'supplement', 'skincare'] },
  { name: 'ChemistDirect',     file: 'chemistdirect-scraper.mjs', tier: 2, categories: ['medicine', 'supplement', 'skincare'] },
  { name: 'Amazon UK',         file: 'amazon-scraper.mjs',        tier: 2, categories: ['supplement', 'skincare'] },

  // ── Tier 2: Playwright scrapers — stealth browser ────────────────────────
  { name: 'Pharmacy2U',        file: 'pharmacy2u-scraper.mjs',    tier: 2, categories: ['medicine', 'supplement'] },

  // ── Tier 3: Blocked sites — require ScraperAPI (set SCRAPER_API_KEY) ─────
  { name: 'Boots',             file: 'boots-scraper.mjs',         tier: 3, categories: ['supplement', 'skincare'] },
  { name: 'Superdrug',         file: 'superdrug-scraper.mjs',     tier: 3, categories: ['skincare', 'supplement'] },
];

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Parse --only flag ─────────────────────────────────────────────────────────

function getOnlyList() {
  const idx = process.argv.indexOf('--only');
  if (idx === -1) return null;
  return (process.argv[idx + 1] || '').toLowerCase().split(',').map(s => s.trim());
}

// ── Run scrapers ──────────────────────────────────────────────────────────────

async function runOnce() {
  const started = Date.now();
  const onlyList = getOnlyList();
  const hasProxy = !!process.env.SCRAPER_API_KEY;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`GeneriQ Price Scraper — ${new Date().toLocaleString('en-GB')}`);
  console.log('='.repeat(60));

  if (hasProxy) {
    console.log('✓ ScraperAPI proxy active — Boots + Superdrug will work');
  } else {
    console.log('ℹ No SCRAPER_API_KEY — Boots/Superdrug may be blocked');
    console.log('  Get a free key at scraperapi.com and add to .env.local');
  }

  // Filter scrapers to run
  const toRun = SCRAPERS.filter(s => {
    if (onlyList) {
      return onlyList.some(term =>
        s.name.toLowerCase().includes(term) ||
        s.file.toLowerCase().includes(term)
      );
    }
    // Skip tier 3 if no proxy key
    if (s.tier === 3 && !hasProxy) {
      console.log(`\n⏭ Skipping ${s.name} (requires ScraperAPI — no SCRAPER_API_KEY set)`);
      return false;
    }
    return true;
  });

  for (const scraper of toRun) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`▶ Running: ${scraper.name} [${scraper.categories.join(', ')}]`);
    const t0 = Date.now();
    try {
      execSync(
        `node "${join(__dirname, scraper.file)}"`,
        { stdio: 'inherit', timeout: 30 * 60 * 1000 }, // 30 min timeout per scraper
      );
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`✓ ${scraper.name} done in ${elapsed}s`);
    } catch (err) {
      console.error(`✗ ${scraper.name} failed: ${err.message?.slice(0, 100) || 'unknown error'}`);
    }
  }

  // Clean up estimated prices superseded by real ones
  console.log('\n── Cleaning up estimated prices ──');
  const removed = await removeEstimatedPrices(['supplement', 'skincare', 'medicine']);
  console.log(`  Removed ${removed} estimated price entries`);

  // Final DB summary
  const { rows } = await pool.query(`
    SELECT
      m.category,
      COUNT(DISTINCT m.id) AS medicines,
      COUNT(DISTINCT pp.id) AS price_entries,
      COUNT(DISTINCT pp.pharmacy_name) AS pharmacies
    FROM medicines m
    LEFT JOIN pharmacy_prices pp ON pp.medicine_id = m.id
    WHERE m.category IN ('supplement','skincare','medicine','health')
    GROUP BY m.category
    ORDER BY price_entries DESC
  `);

  const { rows: total } = await pool.query(`
    SELECT
      COUNT(DISTINCT m.id) AS total_medicines,
      COUNT(DISTINCT pp.medicine_id) AS with_prices,
      COUNT(DISTINCT pp.pharmacy_name) AS pharmacies
    FROM medicines m
    LEFT JOIN pharmacy_prices pp ON pp.medicine_id = m.id
  `);

  console.log('\n── Price coverage ──');
  for (const r of rows) {
    console.log(`  ${r.category.padEnd(12)} | ${String(r.medicines).padStart(6)} medicines | ${String(r.price_entries).padStart(6)} prices | ${r.pharmacies} pharmacies`);
  }

  console.log('\n── Totals ──');
  console.log(`  Medicines: ${total[0].total_medicines}`);
  console.log(`  With prices: ${total[0].with_prices}`);
  console.log(`  Pharmacies: ${total[0].pharmacies}`);

  const elapsed = ((Date.now() - started) / 1000 / 60).toFixed(1);
  console.log(`\nCompleted in ${elapsed} min`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  const watch = process.argv.includes('--watch');

  await runOnce();

  if (watch) {
    console.log(`\nScheduled — next run in 24 hours`);
    setInterval(async () => {
      try {
        await runOnce();
        console.log(`\nScheduled — next run in 24 hours`);
      } catch (err) {
        console.error('Scheduled run failed:', err);
      }
    }, INTERVAL_MS);
  } else {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
