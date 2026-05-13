#!/usr/bin/env node
/**
 * pharmacy2u-scraper.mjs — Pharmacy2U OTC medicines scraper
 * Browses P2U category pages, finds medicines with prices
 *
 * Usage: node scripts/scrapers/pharmacy2u-scraper.mjs
 */

import {
  pool, loadDbProducts, findBestMatch, upsertPrice, upsertMedicine, sleep, randDelay,
  launchStealthBrowser, PAGE_HEADERS,
} from './scraper-utils.mjs';

const PHARMACY_NAME = 'Pharmacy2U';
const SOURCE        = 'pharmacy2u_scraper';

const SEED_URLS = [
  'https://www.pharmacy2u.co.uk/Pharmacy/Medicines/Cold-Flu-and-Sore-Throat-Medicines',
  'https://www.pharmacy2u.co.uk/Pharmacy/Medicines/Pain-Relief-and-Fever',
  'https://www.pharmacy2u.co.uk/Pharmacy/Medicines/Indigestion-and-Heartburn',
  'https://www.pharmacy2u.co.uk/Pharmacy/Medicines/Constipation',
  'https://www.pharmacy2u.co.uk/Pharmacy/Medicines/Diarrhoea',
  'https://www.pharmacy2u.co.uk/Pharmacy/Medicines/Allergies',
  'https://www.pharmacy2u.co.uk/Pharmacy/Medicines/Antihistamines',
  'https://www.pharmacy2u.co.uk/Pharmacy/Medicines/Cough-and-Cold',
  'https://www.pharmacy2u.co.uk/Pharmacy/Medicines/Vitamins-and-Supplements',
];

const MAX_PAGES = 5;

async function scrapeP2uPage(page, url) {
  const products = [];
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Accept cookies
    const cookieBtn = page.locator('[class*="cookie"], button:has-text("Accept"), [id*="cookie"]');
    if (await cookieBtn.count() > 0) {
      await cookieBtn.first().click().catch(() => {});
      await sleep(800);
    }

    // Wait for product listings
    await page.waitForSelector('[class*="product"], [data-testid*="product"]', { timeout: 12000 }).catch(() => {});

    const raw = await page.evaluate(() => {
      const results = [];
      const cards = document.querySelectorAll(
        '[class*="ProductItem"], [class*="product-item"], [class*="ProductCard"], [data-testid*="product"]'
      );

      cards.forEach(card => {
        const nameEl = card.querySelector('[class*="product-name"], [class*="ProductName"], h2, h3, p[class*="name"]');
        const priceEl = card.querySelector('[class*="price"]:not([class*="was"]), [class*="Price"]:not([class*="was"]), [data-testid*="price"]');
        const linkEl = card.querySelector('a[href*="/pharmacy"], a[href*="pharmacy2u"]');
        const imgEl = card.querySelector('img');

        const name = nameEl?.textContent?.trim();
        const priceText = priceEl?.textContent?.trim();
        const href = linkEl?.getAttribute('href') ?? card.querySelector('a')?.getAttribute('href');
        const image = imgEl?.src || imgEl?.dataset?.src || null;

        if (name && priceText && href) {
          results.push({ name, priceRaw: priceText, href, image });
        }
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
        : `https://www.pharmacy2u.co.uk${r.href}`;

      products.push({ name: r.name, price, url: productUrl, image: r.image });
    }
  } catch (err) {
    process.stderr.write(`  [page error: ${err.message.slice(0, 80)}]\n`);
  }
  return products;
}

async function getNextPageUrl(page) {
  try {
    const nextLink = page.locator('a[aria-label="Next"], a[rel="next"], [class*="next"]').first();
    if (await nextLink.count() > 0) {
      const href = await nextLink.getAttribute('href');
      if (href && !href.includes('javascript')) {
        return href.startsWith('http') ? href : `https://www.pharmacy2u.co.uk${href}`;
      }
    }
  } catch (_) {}
  return null;
}

async function main() {
  console.log('\n=== Pharmacy2U OTC Scraper ===\n');

  const dbProducts = await loadDbProducts(['medicine']);
  console.log(`DB products loaded: ${dbProducts.length.toLocaleString()}`);

  const browser = await launchStealthBrowser();
  const context = await browser.newContext({
    extraHTTPHeaders: PAGE_HEADERS,
    viewport: { width: 1280, height: 800 },
    locale: 'en-GB',
  });
  const page = await context.newPage();
  page.on('console', () => {});
  page.on('pageerror', () => {});

  const stats = { scraped: 0, matched: 0, created: 0, updated: 0 };

  for (const seedUrl of SEED_URLS) {
    console.log(`\nCategory: ${seedUrl.split('Pharmacy/Medicines/')[1]}`);

    let currentUrl = seedUrl;
    for (let p = 0; p < MAX_PAGES; p++) {
      process.stdout.write(`  page ${p + 1}...`);
      const products = await scrapeP2uPage(page, currentUrl);
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
          medicineId = await upsertMedicine({ name: prod.name, category: 'medicine', source: SOURCE });
          if (!medicineId) continue;
          dbProducts.push({ id: medicineId, name: prod.name, category: 'medicine', norm: prod.name.toLowerCase() });
          stats.created++;
        }

        pageMatched++;
        try {
          await upsertPrice({
            medicineId,
            pharmacyName: PHARMACY_NAME,
            pharmacyUrl: prod.url,
            priceGbp: prod.price,
            packSize: null,
            imageUrl: prod.image,
            source: SOURCE,
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
