#!/usr/bin/env node
/**
 * lloyds-scraper.mjs — LloydsPharmacy product scraper
 *
 * Uses Shopify's global /products.json endpoint — all products in ~10 pages,
 * no per-collection iteration needed. Completes in ~2 minutes vs hours.
 *
 * Usage: node scripts/scrapers/lloyds-scraper.mjs
 */

import {
  pool, loadDbProducts, findBestMatch, upsertPrice, upsertMedicine,
  sleep, PAGE_HEADERS,
} from './scraper-utils.mjs';

const PHARMACY_NAME = 'LloydsPharmacy';
const SOURCE        = 'lloyds_pharmacy';
const BASE_URL      = 'https://lloydspharmacy.com';
const PAGE_LIMIT    = 250;

// ── Product type / tag → DB category ─────────────────────────────────────────

const MEDICINE_KW   = ['medicine','pharmacy','otc','pain','cold','flu','allergy','antihistamine','cough','sleep','digestion','stomach','laxative','eye','ear','antiseptic','wound','first-aid','decongestant','antifungal','antibiotic','hayfever','heartburn','indigestion','diarrhoea','constipation','sickness','nausea','migraine','ibuprofen','paracetamol','aspirin'];
const SUPPLEMENT_KW = ['vitamin','supplement','mineral','omega','fish oil','protein','sports','probiotic','collagen','calcium','magnesium','zinc','iron','b12','vegan','immune','energy','holland','barrett'];
const SKINCARE_KW   = ['skin','beauty','moistur','serum','spf','sunscreen','face','lip','hair','body wash','shampoo','body lotion','anti-aging','personal care','cleanser','toner','exfoliat','foundation','mascara','lipstick'];

function classifyProduct(p) {
  const text = [
    p.product_type,
    ...(p.tags || []),
    p.title,
    ...(p.collections || []),
  ].join(' ').toLowerCase();

  if (MEDICINE_KW.some(kw => text.includes(kw)))   return 'medicine';
  if (SUPPLEMENT_KW.some(kw => text.includes(kw))) return 'supplement';
  if (SKINCARE_KW.some(kw => text.includes(kw)))   return 'skincare';
  return 'health';
}

// ── Extract pack size from name ───────────────────────────────────────────────

function extractPackSize(name) {
  if (!name) return null;
  const m = name.match(/(\d+\s*(?:tablets?|caps(?:ules)?|softgels?|gummies?|sachets?|lozenges?|ml|g(?:\b)|mg|l\b|s\b|pack))/i);
  return m ? m[1].trim() : null;
}

// ── Fetch all products via global /products.json ──────────────────────────────

async function fetchAllProducts() {
  const products = [];
  let page = 1;

  console.log('  Fetching all products via /products.json (global endpoint)...');

  while (true) {
    const url = `${BASE_URL}/products.json?limit=${PAGE_LIMIT}&page=${page}`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': PAGE_HEADERS['User-Agent'],
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        console.error(`  HTTP ${res.status} on page ${page} — stopping`);
        break;
      }

      const data = await res.json();
      if (!data.products || data.products.length === 0) break;

      for (const p of data.products) {
        const variant = p.variants?.[0];
        if (!variant) continue;
        const price = parseFloat(variant.price);
        if (isNaN(price) || price <= 0) continue;

        const category = classifyProduct(p);
        const productUrl = `${BASE_URL}/products/${p.handle}`;
        const imageUrl = p.images?.[0]?.src || null;
        const packSize = (variant.title && variant.title !== 'Default Title')
          ? variant.title
          : extractPackSize(p.title);

        products.push({
          name:     p.title,
          price,
          url:      productUrl,
          packSize: packSize || null,
          imageUrl,
          category,
        });
      }

      process.stdout.write(`  Page ${page}: +${data.products.length} (total: ${products.length})\n`);
      if (data.products.length < PAGE_LIMIT) break;
      page++;
      await sleep(400);
    } catch (err) {
      console.error(`  Page ${page} error: ${err.message}`);
      break;
    }
  }

  return products;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== LloydsPharmacy Scraper (global products.json) ===\n');

  // Load DB products for matching
  const dbProducts = await loadDbProducts(['medicine', 'supplement', 'skincare', 'health']);
  console.log(`DB products loaded: ${dbProducts.length.toLocaleString()}\n`);

  const scraped = await fetchAllProducts();

  // Deduplicate by URL
  const unique = [...new Map(scraped.map(p => [p.url, p])).values()];
  console.log(`\nTotal unique products: ${unique.length}\n`);

  const stats = { matched: 0, created: 0, updated: 0, errors: 0 };

  for (const p of unique) {
    const match = findBestMatch(p.name, dbProducts);

    let medicineId;
    if (match) {
      medicineId = match.product.id;
      stats.matched++;
    } else {
      try {
        medicineId = await upsertMedicine({ name: p.name, category: p.category, source: SOURCE });
        stats.created++;
        dbProducts.push({ id: medicineId, name: p.name, category: p.category, norm: p.name.toLowerCase() });
      } catch (err) {
        process.stderr.write(`  [create error] ${p.name}: ${err.message}\n`);
        stats.errors++;
        continue;
      }
    }

    try {
      await upsertPrice({
        medicineId,
        pharmacyName: PHARMACY_NAME,
        pharmacyUrl:  p.url,
        priceGbp:     p.price,
        packSize:     p.packSize,
        source:       SOURCE,
        imageUrl:     p.imageUrl,
      });
      stats.updated++;
    } catch (err) {
      process.stderr.write(`  [db error] ${p.name}: ${err.message}\n`);
      stats.errors++;
    }
  }

  console.log('\n── Results ──');
  console.log(`  Scraped:  ${unique.length}`);
  console.log(`  Matched:  ${stats.matched}`);
  console.log(`  Created:  ${stats.created}`);
  console.log(`  Updated:  ${stats.updated}`);
  console.log(`  Errors:   ${stats.errors}`);

  await pool.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
