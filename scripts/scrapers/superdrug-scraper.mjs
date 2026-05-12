#!/usr/bin/env node
/**
 * superdrug-scraper.mjs — Superdrug skincare scraper
 *
 * Usage: node scripts/scrapers/superdrug-scraper.mjs
 */

import { chromium } from 'playwright';
import {
  pool, loadDbProducts, findBestMatch, upsertPrice, sleep, randDelay,
  BROWSER_ARGS, PAGE_HEADERS,
} from './scraper-utils.mjs';

const PHARMACY_NAME = 'Superdrug';
const SOURCE        = 'superdrug_scraper';

const SEED_URLS = [
  'https://www.superdrug.com/skin/face/face-moisturisers',
  'https://www.superdrug.com/skin/face/face-serums',
  'https://www.superdrug.com/skin/face/face-cleansers',
  'https://www.superdrug.com/skin/face/face-toners',
  'https://www.superdrug.com/skin/face/eye-treatments',
  'https://www.superdrug.com/skin/face/face-masks',
  'https://www.superdrug.com/skin/sun-care',
  'https://www.superdrug.com/skin/body/body-lotion',
  'https://www.superdrug.com/hair/shampoo',
  'https://www.superdrug.com/hair/conditioner',
  'https://www.superdrug.com/make-up/face/foundation',
  'https://www.superdrug.com/make-up/eyes/mascara',
  'https://www.superdrug.com/make-up/lips/lipstick',
  'https://www.superdrug.com/health-pharmacy/vitamins-supplements',
];

const MAX_PAGES = 8;

async function scrapeSuperdrugPage(page, url) {
  const products = [];
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Accept cookies
    const cookieBtn = page.locator('#onetrust-accept-btn-handler, button:has-text("Accept All"), button:has-text("Accept Cookies")');
    if (await cookieBtn.count() > 0) {
      await cookieBtn.first().click().catch(() => {});
      await sleep(800);
    }

    // Wait for product listing
    await page.waitForSelector('[class*="product"], [class*="Product"], [data-testid*="product"]', { timeout: 12000 }).catch(() => {});

    const raw = await page.evaluate(() => {
      const results = [];
      const cards = document.querySelectorAll(
        '[class*="ProductItem"], [class*="product-item"], [data-testid="product-card"], [class*="plp-item"]'
      );

      cards.forEach(card => {
        const nameEl  = card.querySelector('[class*="ProductName"], [class*="product-name"], [data-testid="product-name"], h2, h3, p[class*="name"]');
        const priceEl = card.querySelector('[class*="ProductPrice"]:not([class*="Was"]):not([class*="was"]), [class*="product-price"]:not([class*="was"]), [data-testid="product-price"]');
        const linkEl  = card.querySelector('a[href*="/p-"], a[href*="/superdrug.com/"]');
        const sizeEl  = card.querySelector('[class*="ProductSize"], [class*="product-size"], [class*="variant"]');

        const name  = nameEl?.textContent?.trim();
        const price = priceEl?.textContent?.trim();
        const href  = linkEl?.getAttribute('href') ?? card.querySelector('a')?.getAttribute('href');
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
        : `https://www.superdrug.com${r.href}`;

      products.push({ name: r.name, price, url: productUrl, size: r.size });
    }
  } catch (err) {
    process.stderr.write(`  [page error: ${err.message}]\n`);
  }
  return products;
}

async function getNextPageUrl(page) {
  try {
    const nextLink = page.locator('a[aria-label="Next"], a[rel="next"], [class*="pagination"] a:last-child').first();
    if (await nextLink.count() > 0) {
      const href = await nextLink.getAttribute('href');
      if (href && !href.includes('javascript')) {
        return href.startsWith('http') ? href : `https://www.superdrug.com${href}`;
      }
    }
  } catch (_) {}
  return null;
}

async function main() {
  console.log('\n=== Superdrug Scraper ===\n');

  const dbProducts = await loadDbProducts(['skincare', 'supplement']);
  console.log(`DB products loaded: ${dbProducts.length.toLocaleString()}`);

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

  for (const seedUrl of SEED_URLS) {
    console.log(`\nCategory: ${seedUrl.split('superdrug.com/')[1]}`);

    let currentUrl = seedUrl;
    for (let p = 0; p < MAX_PAGES; p++) {
      process.stdout.write(`  page ${p + 1}...`);
      const products = await scrapeSuperdrugPage(page, currentUrl);
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
