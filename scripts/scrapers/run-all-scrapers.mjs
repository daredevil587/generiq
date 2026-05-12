#!/usr/bin/env node
/**
 * run-all-scrapers.mjs
 *
 * Runs all three scrapers sequentially, then removes any remaining
 * estimated prices for products that now have real prices.
 *
 * Usage:
 *   node scripts/scrapers/run-all-scrapers.mjs          # run once
 *   node scripts/scrapers/run-all-scrapers.mjs --watch  # run every 24 hours
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pool, removeEstimatedPrices } from './scraper-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCRAPERS = [
  { name: 'Holland & Barrett', file: 'hb-scraper.mjs' },
  // Boots and Superdrug block automated scraping (Akamai/Cloudflare).
  // Use Awin affiliate product feeds instead — run awin-feed-importer.mjs
  // once Awin approval is obtained for Boots (ID 5423) and Superdrug (ID 3965).
];

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function runOnce() {
  const started = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`GeneriQ Price Scraper — ${new Date().toLocaleString('en-GB')}`);
  console.log('='.repeat(60));

  for (const scraper of SCRAPERS) {
    console.log(`\n▶ Running: ${scraper.name}`);
    try {
      execSync(
        `node "${join(__dirname, scraper.file)}"`,
        { stdio: 'inherit', timeout: 30 * 60 * 1000 }, // 30 min timeout per scraper
      );
    } catch (err) {
      console.error(`✗ ${scraper.name} failed: ${err.message}`);
    }
  }

  // Clean up any leftover estimated prices for products that now have real prices
  console.log('\n── Cleaning up estimated prices ──');
  const removed = await removeEstimatedPrices(['supplement', 'skincare']);
  console.log(`  Removed ${removed} estimated price entries superseded by real prices`);

  // Final DB summary
  const { rows } = await pool.query(`
    SELECT m.category, pp.source, COUNT(*) AS cnt
    FROM pharmacy_prices pp
    JOIN medicines m ON m.id = pp.medicine_id
    WHERE m.category IN ('supplement','skincare')
    GROUP BY m.category, pp.source
    ORDER BY m.category, cnt DESC
  `);

  console.log('\n── Price coverage ──');
  for (const r of rows) {
    console.log(`  ${r.category} / ${r.source}: ${Number(r.cnt).toLocaleString()} entries`);
  }

  const elapsed = ((Date.now() - started) / 1000 / 60).toFixed(1);
  console.log(`\nCompleted in ${elapsed} min`);
}

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
