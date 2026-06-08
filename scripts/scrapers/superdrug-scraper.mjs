#!/usr/bin/env node
/**
 * superdrug-scraper.mjs — Superdrug skincare scraper
 *
 * Usage: node scripts/scrapers/superdrug-scraper.mjs
 */

import * as cheerio from 'cheerio';
import {
  pool, loadDbProducts, findBestMatch, upsertPrice, upsertMedicine, sleep, randDelay,
  launchStealthBrowser, PAGE_HEADERS, fetchWithProxy, genericProductExtract, normaliseName,
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

// ── ScraperAPI fetch for Superdrug (bypasses Cloudflare) ─────────────────────

function parseSuperdrugHtml(html) {
  const $ = cheerio.load(html);
  const products = [];
  const seen = new Set();

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      const items = Array.isArray(data) ? data :
                   data['@type'] === 'ItemList' ? data.itemListElement : [data];
      for (const item of items) {
        const prod = item.item || item;
        if (prod['@type'] !== 'Product' || !prod.name) continue;
        const price = parseFloat(prod.offers?.price ?? prod.offers?.lowPrice ?? 0);
        const url = prod.url || '';
        if (!price || !url || seen.has(url)) continue;
        seen.add(url);
        products.push({ name: prod.name, price, url: url.startsWith('http') ? url : `https://www.superdrug.com${url}`, size: null, image: null });
      }
    } catch {}
  });

  if (products.length > 0) return products;

  const SELS = [
    '[class*="ProductItem" i]', '[class*="product-item" i]',
    '[data-testid="product-card"]', '[class*="plp-item" i]',
    '.product-card', '.product', 'article.product',
  ];

  let $cards = $([]);
  for (const sel of SELS) { $cards = $(sel); if ($cards.length > 0) break; }

  $cards.each((_, el) => {
    const $c = $(el);
    const text = $c.text();
    const pm = text.match(/£([\d.,]+)/);
    if (!pm) return;
    const price = parseFloat(pm[1].replace(',', ''));
    if (isNaN(price) || price <= 0) return;
    const href = $c.find('a[href]').first().attr('href') || '';
    if (!href || seen.has(href)) return;
    seen.add(href);
    const name = ($c.find('h2, h3, [class*="name" i], [class*="title" i]').first().text().trim() || $c.find('a').first().text().trim()).replace(/\s+/g, ' ').slice(0, 200);
    if (!name || name.length < 3) return;
    const fullUrl = href.startsWith('http') ? href : `https://www.superdrug.com${href}`;
    products.push({ name, price, url: fullUrl, size: null, image: null });
  });

  return products;
}

async function scrapeSuperdrugViaProxy(url) {
  try {
    const html = await fetchWithProxy(url, { render: true, retries: 2, timeout: 40000 });
    if (!html) return [];
    return parseSuperdrugHtml(html);
  } catch (err) {
    process.stderr.write(`  [proxy error: ${err.message}]\n`);
    return [];
  }
}

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

        const imgEl   = card.querySelector('img');
        const name  = nameEl?.textContent?.trim();
        const price = priceEl?.textContent?.trim();
        const href  = linkEl?.getAttribute('href') ?? card.querySelector('a')?.getAttribute('href');
        const size  = sizeEl?.textContent?.trim() ?? null;
        const image = imgEl?.src || imgEl?.dataset?.src || null;

        if (name && price && href) results.push({ name, priceRaw: price, href, size, image });
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

      products.push({ name: r.name, price, url: productUrl, size: r.size, image: r.image });
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

  const useProxy = !!process.env.SCRAPER_API_KEY;
  if (useProxy) {
    console.log('  ✓ ScraperAPI proxy active — Superdrug Cloudflare blocking bypassed');
  } else {
    console.log('  ℹ No SCRAPER_API_KEY — using Playwright stealth (may be blocked by Cloudflare)');
    console.log('    To enable proxy: set SCRAPER_API_KEY=your_key in .env.local');
  }

  const dbProducts = await loadDbProducts(['skincare', 'supplement']);
  console.log(`DB products loaded: ${dbProducts.length.toLocaleString()}`);

  let browser;
  const page_holder = { page: null };

  if (!useProxy) {
    browser = await launchStealthBrowser();
    const context = await browser.newContext({
      extraHTTPHeaders: PAGE_HEADERS,
      viewport: { width: 1920, height: 1080 },
      locale: 'en-GB',
      timezoneId: 'Europe/London',
    });
    page_holder.page = await context.newPage();
    page_holder.page.on('console', () => {});
    page_holder.page.on('pageerror', () => {});
  }

  const stats = { scraped: 0, matched: 0, created: 0, updated: 0 };
  const allProducts = [];
  const seenUrls = new Set();

  for (const seedUrl of SEED_URLS) {
    console.log(`\nCategory: ${seedUrl.split('superdrug.com/')[1]}`);

    let currentUrl = seedUrl;
    for (let p = 0; p < MAX_PAGES; p++) {
      process.stdout.write(`  page ${p + 1}...`);

      let products;
      if (useProxy) {
        products = await scrapeSuperdrugViaProxy(currentUrl);
      } else {
        products = await scrapeSuperdrugPage(page_holder.page, currentUrl);
      }

      process.stdout.write(` ${products.length} products\n`);
      if (products.length === 0) break;

      for (const prod of products) {
        if (!seenUrls.has(prod.url)) {
          seenUrls.add(prod.url);
          allProducts.push(prod);
        }
      }

      if (!useProxy) {
        const nextUrl = await getNextPageUrl(page_holder.page);
        if (!nextUrl) break;
        currentUrl = nextUrl;
      } else {
        // Superdrug pagination: try ?start=N or page=N
        currentUrl = `${seedUrl}?start=${(p + 1) * 24}`;
      }

      await randDelay(useProxy ? 1500 : 1000, useProxy ? 3000 : 2500);
    }
  }

  if (browser) await browser.close();

  console.log(`\n── Matching ${allProducts.length} products ──`);
  stats.scraped = allProducts.length;

  for (const prod of allProducts) {
    const match = findBestMatch(prod.name, dbProducts);
    let medicineId;

    if (match) {
      medicineId = match.product.id;
      stats.matched++;
    } else {
      try {
        const cat = prod.name.toLowerCase().match(/vitamin|omega|zinc|magnesium|supplement|probiotic/) ? 'supplement' : 'skincare';
        medicineId = await upsertMedicine({ name: prod.name, category: cat, source: SOURCE });
        if (!medicineId) continue;
        dbProducts.push({ id: medicineId, name: prod.name, category: cat, norm: normaliseName(prod.name) });
        stats.created++;
      } catch { continue; }
    }

    try {
      await upsertPrice({
        medicineId,
        pharmacyName: PHARMACY_NAME,
        pharmacyUrl:  prod.url,
        priceGbp:     prod.price,
        packSize:     prod.size ?? null,
        imageUrl:     prod.image ?? null,
        source:       SOURCE,
      });
      stats.updated++;
    } catch (e) {
      process.stderr.write(`  [db error: ${e.message}]\n`);
    }
  }

  console.log('\n── Results ──');
  console.log(`  Scraped:  ${stats.scraped}`);
  console.log(`  Matched:  ${stats.matched}`);
  console.log(`  Created:  ${stats.created}`);
  console.log(`  Updated:  ${stats.updated}`);

  await pool.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
