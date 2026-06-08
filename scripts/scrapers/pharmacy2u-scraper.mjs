#!/usr/bin/env node
/**
 * pharmacy2u-scraper.mjs — Pharmacy2U OTC medicines scraper
 *
 * Pharmacy2U redesigned their site. This version uses:
 *  1. Updated URL patterns for their current site structure
 *  2. genericProductExtract() — works regardless of class names
 *  3. ScraperAPI proxy if SCRAPER_API_KEY env var is set
 *  4. Fallback HTML parsing with cheerio
 *
 * Usage: node scripts/scrapers/pharmacy2u-scraper.mjs
 */

import * as cheerio from 'cheerio';
import {
  pool, loadDbProducts, findBestMatch, upsertPrice, upsertMedicine,
  sleep, randDelay, launchStealthBrowser, PAGE_HEADERS, fetchWithProxy,
  genericProductExtract,
} from './scraper-utils.mjs';

const PHARMACY_NAME = 'Pharmacy2U';
const SOURCE        = 'pharmacy2u_scraper';

// P2U URL patterns — we try multiple formats since they've redesigned several times
const SEED_URLS = [
  // Current structure (2024-2025)
  { url: 'https://www.pharmacy2u.co.uk/otc-medicines/pain-relief',             dbCat: 'medicine' },
  { url: 'https://www.pharmacy2u.co.uk/otc-medicines/cold-flu-sore-throat',    dbCat: 'medicine' },
  { url: 'https://www.pharmacy2u.co.uk/otc-medicines/indigestion-heartburn',   dbCat: 'medicine' },
  { url: 'https://www.pharmacy2u.co.uk/otc-medicines/allergies-hayfever',      dbCat: 'medicine' },
  { url: 'https://www.pharmacy2u.co.uk/otc-medicines/vitamins-supplements',    dbCat: 'supplement' },
  // Alt structure
  { url: 'https://www.pharmacy2u.co.uk/shop/otc-medicines/pain-relief',        dbCat: 'medicine' },
  { url: 'https://www.pharmacy2u.co.uk/shop/otc-medicines/cold-and-flu',       dbCat: 'medicine' },
  // Old structure (may still work after redirect)
  { url: 'https://www.pharmacy2u.co.uk/Pharmacy/Medicines/Pain-Relief-and-Fever',            dbCat: 'medicine' },
  { url: 'https://www.pharmacy2u.co.uk/Pharmacy/Medicines/Cold-Flu-and-Sore-Throat-Medicines', dbCat: 'medicine' },
  { url: 'https://www.pharmacy2u.co.uk/Pharmacy/Medicines/Indigestion-and-Heartburn',        dbCat: 'medicine' },
  { url: 'https://www.pharmacy2u.co.uk/Pharmacy/Medicines/Constipation',                      dbCat: 'medicine' },
  { url: 'https://www.pharmacy2u.co.uk/Pharmacy/Medicines/Diarrhoea',                         dbCat: 'medicine' },
  { url: 'https://www.pharmacy2u.co.uk/Pharmacy/Medicines/Allergies',                         dbCat: 'medicine' },
  { url: 'https://www.pharmacy2u.co.uk/Pharmacy/Medicines/Antihistamines',                    dbCat: 'medicine' },
  { url: 'https://www.pharmacy2u.co.uk/Pharmacy/Medicines/Cough-and-Cold',                    dbCat: 'medicine' },
  { url: 'https://www.pharmacy2u.co.uk/Pharmacy/Medicines/Vitamins-and-Supplements',          dbCat: 'supplement' },
];

// Also search by common OTC medicine names directly
const SEARCH_TERMS = [
  { term: 'paracetamol',   dbCat: 'medicine' },
  { term: 'ibuprofen',     dbCat: 'medicine' },
  { term: 'aspirin',       dbCat: 'medicine' },
  { term: 'antihistamine', dbCat: 'medicine' },
  { term: 'omeprazole',    dbCat: 'medicine' },
  { term: 'loratadine',    dbCat: 'medicine' },
  { term: 'cetirizine',    dbCat: 'medicine' },
  { term: 'vitamin d',     dbCat: 'supplement' },
  { term: 'vitamin c',     dbCat: 'supplement' },
  { term: 'omega 3',       dbCat: 'supplement' },
  { term: 'multivitamin',  dbCat: 'supplement' },
  { term: 'zinc',          dbCat: 'supplement' },
  { term: 'folic acid',    dbCat: 'supplement' },
  { term: 'vitamin b12',   dbCat: 'supplement' },
];

const MAX_PAGES = 5;

// ── Cheerio HTML parser (fallback for non-JS pages) ───────────────────────────

function parseHtml(html, baseUrl) {
  const $ = cheerio.load(html);
  const products = [];
  const seen = new Set();

  // Try JSON-LD structured data first (most reliable)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      const items = data['@type'] === 'ItemList'
        ? data.itemListElement
        : Array.isArray(data) ? data : [data];
      for (const item of items) {
        const product = item.item || item;
        if (product['@type'] === 'Product' && product.name) {
          const price = parseFloat(product.offers?.price ?? product.offers?.lowPrice ?? 0);
          const url = product.url || product['@id'] || '';
          if (price > 0 && url && !seen.has(url)) {
            seen.add(url);
            products.push({
              name: product.name,
              price,
              url: url.startsWith('http') ? url : `https://www.pharmacy2u.co.uk${url}`,
            });
          }
        }
      }
    } catch {}
  });

  if (products.length > 0) return products;

  // Generic card extraction
  const CARD_SELS = [
    '[data-testid*="product"]', '[data-test*="product"]',
    '[class*="product-card" i]', '[class*="product-item" i]',
    '[class*="product-tile" i]', '[class*="plp-item" i]',
    'article', 'li.product', '.product',
  ];

  for (const sel of CARD_SELS) {
    $(sel).each((_, el) => {
      const $el = $(el);
      const text = $el.text();
      const priceMatch = text.match(/£\s*([\d,.]+)/);
      if (!priceMatch) return;

      const price = parseFloat(priceMatch[1].replace(',', ''));
      if (isNaN(price) || price < 0.3 || price > 500) return;

      const href = $el.find('a[href]').first().attr('href') || '';
      if (!href || seen.has(href)) return;

      const fullUrl = href.startsWith('http') ? href : `https://www.pharmacy2u.co.uk${href}`;
      seen.add(href);

      const name = (
        $el.find('h2, h3, h4, [class*="name" i], [class*="title" i]').first().text().trim() ||
        $el.find('a[href]').first().text().trim()
      ).replace(/\s+/g, ' ').slice(0, 200);

      if (name && name.length >= 3) {
        products.push({ name, price, url: fullUrl });
      }
    });

    if (products.length >= 3) break;
  }

  return products;
}

// ── Next page detection ───────────────────────────────────────────────────────

async function getNextPage(page) {
  try {
    const nextLink = page.locator(
      'a[aria-label="Next"], a[rel="next"], a:has-text("Next"), [class*="pagination"] a:last-child, [class*="next" i]'
    ).first();
    if (await nextLink.count() > 0) {
      const href = await nextLink.getAttribute('href');
      if (href && !href.includes('javascript')) {
        return href.startsWith('http') ? href : `https://www.pharmacy2u.co.uk${href}`;
      }
    }
  } catch {}
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== Pharmacy2U OTC Scraper (v2 — multi-strategy) ===\n');
  if (process.env.SCRAPER_API_KEY) {
    console.log('  ✓ ScraperAPI proxy active');
  }

  const dbProducts = await loadDbProducts(['medicine', 'supplement']);
  console.log(`DB products loaded: ${dbProducts.length.toLocaleString()}`);

  const stats = { scraped: 0, matched: 0, created: 0, updated: 0, skipped: 0 };
  const allProducts = [];
  const seenUrls = new Set();

  // ── Phase 1: Playwright scraper for dynamic pages ─────────────────────────
  console.log('\n── Phase 1: Playwright scraper ──');

  let browser;
  try {
    browser = await launchStealthBrowser();
    const context = await browser.newContext({
      extraHTTPHeaders: PAGE_HEADERS,
      viewport: { width: 1280, height: 900 },
      locale: 'en-GB',
      timezoneId: 'Europe/London',
    });
    const page = await context.newPage();
    page.on('console', () => {});
    page.on('pageerror', () => {});

    // Dismiss cookie banners
    page.on('dialog', d => d.dismiss().catch(() => {}));

    const triedUrls = new Set();

    for (const { url, dbCat } of SEED_URLS) {
      if (triedUrls.has(url)) continue;
      process.stdout.write(`  ${url.split('pharmacy2u.co.uk')[1]}...`);

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });

        // Accept cookies if banner appears
        const cookieBtn = page.locator(
          'button:has-text("Accept All"), button:has-text("Accept all"), button:has-text("Accept Cookies"), [id*="accept"], [class*="accept-cookie"]'
        );
        if (await cookieBtn.count() > 0) {
          await cookieBtn.first().click().catch(() => {});
          await sleep(600);
        }

        // Wait for any content to load
        await sleep(3000);

        // Check final URL after any redirects
        const finalUrl = page.url();
        if (finalUrl !== url) {
          process.stdout.write(` → ${finalUrl.split('pharmacy2u.co.uk')[1] || finalUrl}`);
        }
        triedUrls.add(finalUrl);

        // Use generic extractor
        const products = await genericProductExtract(page, 'https://www.pharmacy2u.co.uk');
        process.stdout.write(` ${products.length} products\n`);

        for (const p of products) {
          if (!seenUrls.has(p.href)) {
            seenUrls.add(p.href);
            allProducts.push({ ...p, dbCat });
          }
        }

        // Try pagination
        if (products.length > 0) {
          for (let pg = 1; pg < MAX_PAGES; pg++) {
            const nextUrl = await getNextPage(page);
            if (!nextUrl || triedUrls.has(nextUrl)) break;
            triedUrls.add(nextUrl);

            await page.goto(nextUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await sleep(2000);

            const more = await genericProductExtract(page, 'https://www.pharmacy2u.co.uk');
            if (more.length === 0) break;
            process.stdout.write(`    page ${pg + 1}: ${more.length} more\n`);
            for (const p of more) {
              if (!seenUrls.has(p.href)) {
                seenUrls.add(p.href);
                allProducts.push({ ...p, dbCat });
              }
            }
          }
        }

        await randDelay(800, 1800);
      } catch (err) {
        process.stdout.write(` [error: ${err.message.slice(0, 60)}]\n`);
      }
    }

    // ── Phase 2: Search by medicine name ──────────────────────────────────
    console.log('\n── Phase 2: Search by term ──');

    for (const { term, dbCat } of SEARCH_TERMS) {
      const searchUrl = `https://www.pharmacy2u.co.uk/search?q=${encodeURIComponent(term)}`;
      process.stdout.write(`  "${term}"...`);

      try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await sleep(2500);

        const products = await genericProductExtract(page, 'https://www.pharmacy2u.co.uk');
        process.stdout.write(` ${products.length} results\n`);

        for (const p of products) {
          if (!seenUrls.has(p.href)) {
            seenUrls.add(p.href);
            allProducts.push({ ...p, dbCat });
          }
        }

        await randDelay(1000, 2000);
      } catch (err) {
        process.stdout.write(` [error: ${err.message.slice(0, 60)}]\n`);
      }
    }

    await browser.close();
  } catch (err) {
    console.error('  Browser launch failed:', err.message);
    if (browser) await browser.close().catch(() => {});
  }

  // ── Phase 3: Fetch-based scraper (ScraperAPI or direct) ───────────────────
  // Re-try any URLs that produced 0 products using HTTP fetch + cheerio
  console.log('\n── Phase 3: Fetch fallback for zero-product URLs ──');

  const zeroUrls = SEED_URLS.filter(({ url }) => {
    const productsFromThisUrl = allProducts.filter(p =>
      p.href?.includes('pharmacy2u.co.uk')
    );
    return productsFromThisUrl.length === 0;
  }).slice(0, 5); // limit to avoid too many requests

  for (const { url, dbCat } of zeroUrls) {
    process.stdout.write(`  fetch ${url.split('pharmacy2u.co.uk')[1]}...`);
    try {
      const html = await fetchWithProxy(url, { render: !!process.env.SCRAPER_API_KEY, retries: 1 });
      if (!html) { process.stdout.write(' (null)\n'); continue; }
      const products = parseHtml(html, url);
      process.stdout.write(` ${products.length} products\n`);
      for (const p of products) {
        if (!seenUrls.has(p.url)) {
          seenUrls.add(p.url);
          allProducts.push({ name: p.name, price: p.price, href: p.url, dbCat });
        }
      }
      await randDelay(1000, 2000);
    } catch (err) {
      process.stdout.write(` [error: ${err.message.slice(0, 60)}]\n`);
    }
  }

  // ── Match & upsert ────────────────────────────────────────────────────────
  console.log(`\n── Matching ${allProducts.length} scraped products to DB ──`);
  stats.scraped = allProducts.length;

  for (const p of allProducts) {
    const match = findBestMatch(p.name, dbProducts);
    let medicineId;

    if (match) {
      medicineId = match.product.id;
      stats.matched++;
    } else {
      try {
        medicineId = await upsertMedicine({ name: p.name, category: p.dbCat, source: SOURCE });
        if (medicineId) {
          dbProducts.push({ id: medicineId, name: p.name, category: p.dbCat, norm: p.name.toLowerCase() });
          stats.created++;
        } else {
          stats.skipped++;
          continue;
        }
      } catch (e) {
        stats.skipped++;
        continue;
      }
    }

    try {
      await upsertPrice({
        medicineId,
        pharmacyName: PHARMACY_NAME,
        pharmacyUrl: p.href,
        priceGbp: p.price,
        packSize: null,
        imageUrl: p.imageUrl ?? null,
        source: SOURCE,
      });
      stats.updated++;
    } catch (e) {
      console.error(`  DB error: ${e.message}`);
    }
  }

  console.log('\n── Results ──');
  console.log(`  Scraped:  ${stats.scraped}`);
  console.log(`  Matched:  ${stats.matched}`);
  console.log(`  Created:  ${stats.created}`);
  console.log(`  Updated:  ${stats.updated}`);
  console.log(`  Skipped:  ${stats.skipped}`);

  await pool.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
