#!/usr/bin/env node
/**
 * hb-scraper.mjs — Holland & Barrett supplements scraper
 *
 * Scrapes category listing pages for vitamins & supplements,
 * matches products to the GeneriQ medicines DB, updates pharmacy_prices.
 *
 * Usage: node scripts/scrapers/hb-scraper.mjs
 */

import { chromium } from 'playwright';
import {
  pool, loadDbProducts, findBestMatch, upsertPrice, sleep, randDelay,
  BROWSER_ARGS, PAGE_HEADERS,
} from './scraper-utils.mjs';

const PHARMACY_NAME = 'Holland & Barrett';
const SOURCE        = 'holland_barrett';

// Category pages to scrape (each loads 24 products, paginate via ?start=N)
const SEED_URLS = [
  'https://www.hollandandbarrett.com/shop/vitamins-supplements/',
  'https://www.hollandandbarrett.com/shop/vitamins-supplements/vitamins/',
  'https://www.hollandandbarrett.com/shop/vitamins-supplements/minerals/',
  'https://www.hollandandbarrett.com/shop/vitamins-supplements/omega-fish-oils/',
  'https://www.hollandandbarrett.com/shop/vitamins-supplements/herbal-supplements/',
  'https://www.hollandandbarrett.com/shop/vitamins-supplements/sports-nutrition/',
  'https://www.hollandandbarrett.com/shop/vitamins-supplements/probiotics/',
  'https://www.hollandandbarrett.com/shop/vitamins-supplements/specialist-supplements/',
];

const MAX_PAGES_PER_CATEGORY = 10; // 10 × 40 = 400 products per category
const PAGE_SIZE = 40;

async function scrapeListingPage(page, url) {
  const products = [];
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 40000 });

    // Accept cookies if banner appears (only needed once per session)
    const cookieBtn = page.locator('button:has-text("Accept All"), button:has-text("ACCEPT ALL")');
    if (await cookieBtn.count() > 0) {
      await cookieBtn.first().click().catch(() => {});
      await sleep(800);
    }

    // Wait for product cards — H&B hydrates after load
    await page.waitForSelector('[data-test="product-card"]', { timeout: 20000 });
    await page.waitForTimeout(500);

    // Extract products from listing
    const raw = await page.evaluate(() => {
      const results = [];
      const cards = document.querySelectorAll('[data-test="product-card"]');

      cards.forEach(card => {
        const title   = card.querySelector('[data-test="product-card-title"]')?.textContent?.trim();
        const brand   = card.querySelector('[data-test="product-card-brand-name"]')?.textContent?.trim();
        const priceEl = card.querySelector('[data-test="product-card-price"]');
        // href lives on the card element itself as an attribute
        const href    = card.getAttribute('href');

        const name  = brand && title && !title.startsWith(brand) ? `${brand} ${title}` : title;
        const price = priceEl?.textContent?.trim() ?? card.innerText.match(/£[\d.]+/)?.[0];

        if (name && price && href) {
          results.push({ name, priceRaw: price, href, size: null });
        }
      });

      return results;
    });

    for (const r of raw) {
      const priceMatch = r.priceRaw.match(/£([\d.,]+)/);
      if (!priceMatch) continue;
      const price = parseFloat(priceMatch[1].replace(',', ''));
      if (isNaN(price) || price <= 0) continue;

      const url = r.href.startsWith('http')
        ? r.href
        : `https://www.hollandandbarrett.com${r.href}`;

      products.push({ name: r.name, price, url, size: r.size });
    }
  } catch (err) {
    process.stdout.write(`  [error: ${err.message}]\n`);
  }
  return products;
}

async function main() {
  console.log('\n=== Holland & Barrett Scraper ===\n');

  const dbProducts = await loadDbProducts(['supplement']);
  console.log(`DB supplement products loaded: ${dbProducts.length.toLocaleString()}`);

  const browser = await chromium.launch(BROWSER_ARGS);
  const context = await browser.newContext({
    extraHTTPHeaders: PAGE_HEADERS,
    viewport: { width: 1280, height: 800 },
    locale: 'en-GB',
  });
  const page = await context.newPage();

  // Suppress noisy console from page
  page.on('console', () => {});
  page.on('pageerror', () => {});

  const stats = { scraped: 0, matched: 0, updated: 0, unmatched: 0 };
  const unmatchedNames = [];

  for (const seedUrl of SEED_URLS) {
    console.log(`\nCategory: ${seedUrl.split('/shop/')[1] || seedUrl}`);

    for (let pageNum = 0; pageNum < MAX_PAGES_PER_CATEGORY; pageNum++) {
      const url = pageNum === 0 ? seedUrl : `${seedUrl}?page=${pageNum + 1}#products-list`;
      process.stdout.write(`  page ${pageNum + 1}...`);

      const products = await scrapeListingPage(page, url);
      process.stdout.write(` ${products.length} products`);

      if (products.length === 0) {
        process.stdout.write(' (end)\n');
        break;
      }

      stats.scraped += products.length;
      let pageMatched = 0;

      for (const p of products) {
        const match = findBestMatch(p.name, dbProducts);
        if (!match) {
          stats.unmatched++;
          unmatchedNames.push(p.name);
          continue;
        }
        stats.matched++;
        pageMatched++;
        try {
          await upsertPrice({
            medicineId:   match.product.id,
            pharmacyName: PHARMACY_NAME,
            pharmacyUrl:  p.url,
            priceGbp:     p.price,
            packSize:     p.size,
            source:       SOURCE,
          });
          stats.updated++;
        } catch (e) {
          process.stderr.write(`  [db error: ${e.message}]\n`);
        }
      }

      process.stdout.write(` matched:${pageMatched}\n`);

      if (products.length < PAGE_SIZE) {
        process.stdout.write('  (last page)\n');
        break;
      }

      await randDelay(1000, 2500);
    }
  }

  await browser.close();

  console.log('\n── Results ──');
  console.log(`  Scraped:   ${stats.scraped}`);
  console.log(`  Matched:   ${stats.matched}`);
  console.log(`  Updated:   ${stats.updated}`);
  console.log(`  Unmatched: ${stats.unmatched}`);

  if (unmatchedNames.length > 0) {
    console.log('\n  Sample unmatched (first 10):');
    unmatchedNames.slice(0, 10).forEach(n => console.log(`    - ${n}`));
  }

  await pool.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
