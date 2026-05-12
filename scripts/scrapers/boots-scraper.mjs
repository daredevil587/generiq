#!/usr/bin/env node
/**
 * boots-scraper.mjs — Boots skincare + supplements scraper
 *
 * Usage: node scripts/scrapers/boots-scraper.mjs
 */

import { chromium } from 'playwright';
import {
  pool, loadDbProducts, findBestMatch, upsertPrice, sleep, randDelay,
  BROWSER_ARGS, PAGE_HEADERS,
} from './scraper-utils.mjs';

const PHARMACY_NAME = 'Boots';
const SOURCE        = 'boots_scraper';

// (url, category in DB)
const SEED_URLS = [
  // Skincare
  { url: 'https://www.boots.com/skin-care/face/face-moisturisers',      cat: 'skincare' },
  { url: 'https://www.boots.com/skin-care/face/face-serums',            cat: 'skincare' },
  { url: 'https://www.boots.com/skin-care/face/face-cleansers',         cat: 'skincare' },
  { url: 'https://www.boots.com/skin-care/face/face-toners-mists',      cat: 'skincare' },
  { url: 'https://www.boots.com/skin-care/face/eye-creams-gels',        cat: 'skincare' },
  { url: 'https://www.boots.com/skin-care/face/face-masks',             cat: 'skincare' },
  { url: 'https://www.boots.com/skin-care/sun-care',                    cat: 'skincare' },
  { url: 'https://www.boots.com/skin-care/body/body-moisturisers',      cat: 'skincare' },
  { url: 'https://www.boots.com/hair/shampoo',                          cat: 'skincare' },
  { url: 'https://www.boots.com/hair/conditioner',                      cat: 'skincare' },
  // Supplements
  { url: 'https://www.boots.com/vitamins-and-supplements/vitamins',     cat: 'supplement' },
  { url: 'https://www.boots.com/vitamins-and-supplements/minerals',     cat: 'supplement' },
  { url: 'https://www.boots.com/vitamins-and-supplements/fish-oils-omegas', cat: 'supplement' },
  { url: 'https://www.boots.com/vitamins-and-supplements/probiotics',   cat: 'supplement' },
  { url: 'https://www.boots.com/vitamins-and-supplements/herbal-supplements', cat: 'supplement' },
];

const MAX_PAGES = 8;

async function scrapeBootsPage(page, url) {
  const products = [];
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Accept cookies
    const cookieBtn = page.locator('#onetrust-accept-btn-handler, button:has-text("Accept all cookies"), button:has-text("Accept All")');
    if (await cookieBtn.count() > 0) {
      await cookieBtn.first().click().catch(() => {});
      await sleep(800);
    }

    // Wait for product grid
    await page.waitForSelector('[class*="product-grid"], [class*="productGrid"], [class*="plp"], [data-test*="product"]', { timeout: 12000 }).catch(() => {});

    const raw = await page.evaluate(() => {
      const results = [];
      const cards = document.querySelectorAll(
        '[data-test="product-grid-item"], [class*="product-grid-item"], [class*="ProductGridItem"], [class*="plp-product"]'
      );

      cards.forEach(card => {
        const nameEl  = card.querySelector('[class*="product-title"], [class*="ProductTitle"], [data-test="product-title"], h2, h3');
        const priceEl = card.querySelector('[class*="product-price"]:not([class*="was"]), [class*="ProductPrice"]:not([class*="was"]), [data-test="product-price"]');
        const linkEl  = card.querySelector('a[href*="/boots.com/"], a[href^="/"]');
        const sizeEl  = card.querySelector('[class*="product-size"], [class*="ProductSize"]');

        const name  = nameEl?.textContent?.trim();
        const price = priceEl?.textContent?.trim();
        const href  = linkEl?.getAttribute('href');
        const size  = sizeEl?.textContent?.trim() ?? null;

        if (name && price && href) results.push({ name, priceRaw: price, href, size });
      });

      return results;
    });

    for (const r of raw) {
      const priceMatch = r.priceRaw.match(/£([\d.,]+)/);
      if (!priceMatch) continue;
      const price = parseFloat(priceMatch[1].replace(',', ''));
      if (isNaN(price) || price <= 0) continue;

      const productUrl = r.href.startsWith('http')
        ? r.href
        : `https://www.boots.com${r.href}`;

      products.push({ name: r.name, price, url: productUrl, size: r.size });
    }
  } catch (err) {
    process.stderr.write(`  [page error: ${err.message}]\n`);
  }
  return products;
}

async function getNextPageUrl(page) {
  try {
    const nextBtn = await page.locator('[aria-label="Next page"], [class*="pagination"] a[rel="next"], button:has-text("Next")').first();
    if (await nextBtn.count() > 0) {
      const href = await nextBtn.getAttribute('href');
      if (href) return href.startsWith('http') ? href : `https://www.boots.com${href}`;
    }
  } catch (_) {}
  return null;
}

async function main() {
  console.log('\n=== Boots Scraper ===\n');

  const [suppProducts, skinProducts] = await Promise.all([
    loadDbProducts(['supplement']),
    loadDbProducts(['skincare']),
  ]);
  console.log(`DB products loaded: ${suppProducts.length} supplements, ${skinProducts.length} skincare`);

  const browser = await chromium.launch(BROWSER_ARGS);
  const context = await browser.newContext({
    extraHTTPHeaders: PAGE_HEADERS,
    viewport: { width: 1280, height: 800 },
    locale: 'en-GB',
  });
  const page = await context.newPage();
  page.on('console', () => {});
  page.on('pageerror', () => {});

  const stats = { scraped: 0, matched: 0, updated: 0, unmatched: 0 };
  const unmatchedNames = [];

  for (const seed of SEED_URLS) {
    const dbProducts = seed.cat === 'supplement' ? suppProducts : skinProducts;
    console.log(`\nCategory: ${seed.url.split('boots.com/')[1]} [${seed.cat}]`);

    let currentUrl = seed.url;
    for (let p = 0; p < MAX_PAGES; p++) {
      process.stdout.write(`  page ${p + 1}...`);
      const products = await scrapeBootsPage(page, currentUrl);
      process.stdout.write(` ${products.length} products`);

      if (products.length === 0) {
        process.stdout.write(' (empty)\n');
        break;
      }

      stats.scraped += products.length;
      let pageMatched = 0;

      for (const prod of products) {
        const match = findBestMatch(prod.name, dbProducts);
        if (!match) {
          stats.unmatched++;
          unmatchedNames.push(prod.name);
          continue;
        }
        stats.matched++;
        pageMatched++;
        try {
          await upsertPrice({
            medicineId:   match.product.id,
            pharmacyName: PHARMACY_NAME,
            pharmacyUrl:  prod.url,
            priceGbp:     prod.price,
            packSize:     prod.size,
            source:       SOURCE,
          });
          stats.updated++;
        } catch (e) {
          process.stderr.write(`  [db error: ${e.message}]\n`);
        }
      }

      process.stdout.write(` matched:${pageMatched}\n`);

      const nextUrl = await getNextPageUrl(page);
      if (!nextUrl) break;
      currentUrl = nextUrl;
      await randDelay(1200, 2800);
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
