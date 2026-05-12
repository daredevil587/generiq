#!/usr/bin/env node
/**
 * awin-feed-importer.mjs
 *
 * Imports Boots and Superdrug prices from Awin affiliate product feed files.
 *
 * How to get Awin feeds:
 * 1. Register at https://www.awin.com/gb
 * 2. Apply to Boots (advertiser ID 5423) and Superdrug (advertiser ID 3965)
 * 3. Once approved, download product feeds:
 *    https://ui.awin.com/awin/publisher/product-feeds
 * 4. Save the CSV files to scripts/scrapers/feeds/:
 *    - boots-feed.csv
 *    - superdrug-feed.csv
 * 5. Run: node scripts/scrapers/awin-feed-importer.mjs
 *
 * Awin feed CSV columns (standard format):
 *   product_name, description, category, price, brand, in_stock,
 *   product_url, image_url, ean, mpn, ...
 *
 * Usage: node scripts/scrapers/awin-feed-importer.mjs
 */

import { createReadStream, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import {
  pool, loadDbProducts, findBestMatch, upsertPrice,
} from './scraper-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FEEDS_DIR = join(__dirname, 'feeds');

const FEED_CONFIG = [
  {
    file:         'boots-feed.csv',
    pharmacyName: 'Boots',
    source:       'boots_awin',
    categories:   ['supplement', 'skincare'],
    // Awin column names (may vary — check your actual feed)
    nameCol:      'product_name',
    priceCol:     'search_price',
    urlCol:       'aw_deep_link',
    sizeCol:      'specifications',
  },
  {
    file:         'superdrug-feed.csv',
    pharmacyName: 'Superdrug',
    source:       'superdrug_awin',
    categories:   ['skincare', 'supplement'],
    nameCol:      'product_name',
    priceCol:     'search_price',
    urlCol:       'aw_deep_link',
    sizeCol:      'specifications',
  },
];

async function parseCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let headers = null;
    const rl = createInterface({ input: createReadStream(filePath) });
    rl.on('line', (line) => {
      const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
      if (!headers) { headers = cols; return; }
      const row = {};
      headers.forEach((h, i) => { row[h] = cols[i] ?? ''; });
      rows.push(row);
    });
    rl.on('close', () => resolve(rows));
    rl.on('error', reject);
  });
}

async function importFeed(config, dbProducts) {
  const filePath = join(FEEDS_DIR, config.file);
  if (!existsSync(filePath)) {
    console.log(`  Feed file not found: ${config.file}`);
    console.log(`  → Download from Awin and save to scripts/scrapers/feeds/${config.file}`);
    return { matched: 0, updated: 0, unmatched: 0 };
  }

  console.log(`  Parsing ${config.file}...`);
  const rows = await parseCsv(filePath);
  console.log(`  ${rows.length.toLocaleString()} rows in feed`);

  let matched = 0, updated = 0, unmatched = 0;
  const unmatchedNames = [];

  for (const row of rows) {
    const name = row[config.nameCol];
    const priceStr = row[config.priceCol];
    const url = row[config.urlCol];

    if (!name || !priceStr || !url) continue;

    const price = parseFloat(priceStr.replace('£', '').replace(',', ''));
    if (isNaN(price) || price <= 0) continue;

    const match = findBestMatch(name, dbProducts);
    if (!match) {
      unmatched++;
      unmatchedNames.push(name);
      continue;
    }

    matched++;
    try {
      await upsertPrice({
        medicineId:   match.product.id,
        pharmacyName: config.pharmacyName,
        pharmacyUrl:  url,
        priceGbp:     price,
        packSize:     row[config.sizeCol] ?? null,
        source:       config.source,
      });
      updated++;
    } catch (e) {
      console.error(`    DB error: ${e.message}`);
    }
  }

  if (unmatchedNames.length > 0) {
    console.log(`  Sample unmatched (first 5):`);
    unmatchedNames.slice(0, 5).forEach(n => console.log(`    - ${n}`));
  }

  return { matched, updated, unmatched };
}

async function main() {
  console.log('\n=== Awin Feed Importer (Boots + Superdrug) ===\n');
  console.log(`Feed directory: ${FEEDS_DIR}\n`);

  const dbProducts = await loadDbProducts(['supplement', 'skincare']);
  console.log(`DB products loaded: ${dbProducts.length.toLocaleString()}\n`);

  for (const config of FEED_CONFIG) {
    console.log(`── ${config.pharmacyName} ──`);
    const stats = await importFeed(config, dbProducts);
    console.log(`  Matched: ${stats.matched}, Updated: ${stats.updated}, Unmatched: ${stats.unmatched}\n`);
  }

  await pool.end();
  console.log('Done!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
