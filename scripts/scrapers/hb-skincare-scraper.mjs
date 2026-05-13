#!/usr/bin/env node
/**
 * hb-skincare-scraper.mjs — Holland & Barrett skincare/beauty category scraper
 * Browses H&B category pages, creates new medicine entries for unmatched products,
 * saves real prices + product images.
 *
 * Usage: node scripts/scrapers/hb-skincare-scraper.mjs
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import {
  pool, loadDbProducts, findBestMatch, upsertPrice, upsertMedicine, sleep, randDelay,
  PAGE_HEADERS,
} from './scraper-utils.mjs';

chromium.use(StealthPlugin());

const PHARMACY_NAME = 'Holland & Barrett';
const SOURCE        = 'hb_category_scraper';

const SEED_URLS = [
  'https://www.hollandandbarrett.com/shop/beauty-skincare/',
  'https://www.hollandandbarrett.com/shop/beauty-skincare/face/',
  'https://www.hollandandbarrett.com/shop/beauty-skincare/body/',
  'https://www.hollandandbarrett.com/shop/beauty-skincare/hair/',
  'https://www.hollandandbarrett.com/shop/beauty-skincare/lip-care/',
  'https://www.hollandandbarrett.com/shop/beauty-skincare/sun-care/',
];

const MAX_PAGES = 10;

async function scrapeHbPage(page, url) {
  const products = [];
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);

    // Dismiss consent banner
    const consent = page.locator('button:has-text("Accept All"), button:has-text("Accept all"), #onetrust-accept-btn-handler');
    if (await consent.count() > 0) {
      await consent.first().click().catch(() => {});
      await sleep(600);
    }

    await page.waitForSelector('a[data-testid="midi-product-card"]', { timeout: 10000 }).catch(() => {});

    const raw = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('a[data-testid="midi-product-card"]')];

      return cards.map(card => {
        const name  = card.getAttribute('title') || card.querySelector('span[class*="name"], span[class*="title"]')?.textContent?.trim();
        const img   = card.querySelector('img')?.src || card.querySelector('img')?.dataset?.src;
        const href  = card.href;
        // Find the first element whose text starts with £
        const allEls = [...card.querySelectorAll('*')];
        const priceEl = allEls.find(el => /^£[\d]/.test(el.textContent?.trim()));
        const priceText = priceEl?.textContent?.trim() ?? '';
        return { name, priceText, href, img };
      });
    });

    for (const r of raw) {
      if (!r.name || !r.href) continue;
      const priceMatch = r.priceText.match(/£([\d.,]+)/);
      if (!priceMatch) continue;
      const price = parseFloat(priceMatch[1].replace(',', ''));
      if (isNaN(price) || price <= 0) continue;
      products.push({ name: r.name, price, url: r.href, image: r.img ?? null });
    }
  } catch (err) {
    process.stderr.write(`  [page error: ${err.message.slice(0, 80)}]\n`);
  }
  return products;
}

async function getNextPageUrl(page) {
  try {
    const next = await page.locator('a[aria-label="Go to next page"], a[aria-label="Next page"], [class*="pagination"] a:last-child').first();
    if (await next.count() > 0) {
      const href = await next.getAttribute('href');
      if (href && !href.includes('javascript')) {
        return href.startsWith('http') ? href : `https://www.hollandandbarrett.com${href}`;
      }
    }
  } catch (_) {}
  return null;
}

async function main() {
  console.log('\n=== Holland & Barrett Skincare Scraper ===\n');

  const dbProducts = await loadDbProducts(['skincare', 'supplement']);
  console.log(`DB products loaded: ${dbProducts.length.toLocaleString()}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders(PAGE_HEADERS);
  page.on('console', () => {});
  page.on('pageerror', () => {});

  const stats = { scraped: 0, matched: 0, created: 0, updated: 0 };

  for (const seedUrl of SEED_URLS) {
    console.log(`\nCategory: ${seedUrl.split('hollandandbarrett.com/')[1]}`);

    let currentUrl = seedUrl;
    for (let p = 0; p < MAX_PAGES; p++) {
      process.stdout.write(`  page ${p + 1}...`);
      const products = await scrapeHbPage(page, currentUrl);
      process.stdout.write(` ${products.length} products`);

      if (products.length === 0) {
        process.stdout.write(' (empty)\n');
        break;
      }

      stats.scraped += products.length;
      let pageMatched = 0;

      for (const prod of products) {
        let match = findBestMatch(prod.name, dbProducts);
        let medicineId;

        if (match) {
          medicineId = match.product.id;
          stats.matched++;
        } else {
          medicineId = await upsertMedicine({ name: prod.name, category: 'skincare', source: SOURCE });
          if (!medicineId) continue;
          dbProducts.push({ id: medicineId, name: prod.name, category: 'skincare', norm: prod.name.toLowerCase() });
          stats.created++;
        }

        pageMatched++;
        try {
          await upsertPrice({
            medicineId,
            pharmacyName: PHARMACY_NAME,
            pharmacyUrl:  prod.url,
            priceGbp:     prod.price,
            packSize:     null,
            imageUrl:     prod.image,
            source:       SOURCE,
          });
          stats.updated++;
        } catch (e) {
          process.stderr.write(`  [db error: ${e.message}]\n`);
        }
      }

      process.stdout.write(` saved:${pageMatched}\n`);

      const nextUrl = await getNextPageUrl(page);
      if (!nextUrl) break;
      currentUrl = nextUrl;
      await randDelay(1500, 3000);
    }
  }

  await browser.close();

  console.log('\n── Results ──');
  console.log(`  Scraped:  ${stats.scraped}`);
  console.log(`  Matched:  ${stats.matched} (existing DB products)`);
  console.log(`  Created:  ${stats.created} (new products added)`);
  console.log(`  Saved:    ${stats.updated} prices with images`);

  await pool.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
