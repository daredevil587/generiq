#!/usr/bin/env node
/**
 * well-pharmacy-scraper.mjs — Well Pharmacy (well.co.uk) scraper
 *
 * Well Pharmacy is the UK's third-largest pharmacy chain (750+ branches).
 * Uses Playwright + genericProductExtract to handle any page structure.
 * Discovers category pages from the site's own navigation menu.
 *
 * Usage: node scripts/scrapers/well-pharmacy-scraper.mjs
 */

import * as cheerio from 'cheerio';
import {
  pool, loadDbProducts, findBestMatch, upsertPrice, upsertMedicine,
  sleep, randDelay, launchStealthBrowser, PAGE_HEADERS, fetchWithProxy,
  genericProductExtract, normaliseName,
} from './scraper-utils.mjs';

const PHARMACY_NAME = 'Well Pharmacy';
const SOURCE        = 'well_pharmacy';
const BASE_URL      = 'https://www.well.co.uk';

// URL patterns to probe (Well redesigns periodically)
const PROBE_URLS = [
  `${BASE_URL}/shop`,
  `${BASE_URL}/shop/medicines`,
  `${BASE_URL}/shop/vitamins-supplements`,
  `${BASE_URL}/medicines`,
  `${BASE_URL}/vitamins-supplements`,
  `${BASE_URL}/health`,
  `${BASE_URL}/pharmacy`,
  `${BASE_URL}/online-pharmacy`,
];

// Category keywords for nav discovery
const CATEGORY_KEYWORDS = [
  'medicine', 'vitamin', 'supplement', 'pain', 'cold', 'flu', 'health',
  'pharmacy', 'allergy', 'skincare', 'skin', 'beauty',
];

const MAX_PAGES = 6;

// ── Check if a URL returns a product page ─────────────────────────────────────

async function probeUrl(url) {
  try {
    const html = await fetchWithProxy(url, { retries: 1, timeout: 12000 });
    if (!html) return false;
    return html.includes('£') && (html.includes('product') || html.includes('medicine'));
  } catch { return false; }
}

// ── Playwright discovery & extraction ─────────────────────────────────────────

async function scrapeWithPlaywright(startUrls) {
  const browser = await launchStealthBrowser();
  const context = await browser.newContext({
    extraHTTPHeaders: PAGE_HEADERS,
    viewport: { width: 1280, height: 900 },
    locale: 'en-GB',
    timezoneId: 'Europe/London',
  });
  const page = await context.newPage();
  page.on('console', () => {});
  page.on('pageerror', () => {});

  const allProducts = [];
  const seenUrls = new Set();
  const visitedPages = new Set();
  let categoryLinks = [];

  try {
    // Discover categories from homepage / probe URLs
    for (const startUrl of [BASE_URL, ...startUrls]) {
      if (categoryLinks.length >= 10) break;
      try {
        await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await sleep(2000);

        // Accept cookies
        const cookieBtn = page.locator(
          'button:has-text("Accept"), button:has-text("Accept All"), [id*="accept"], [class*="accept"]'
        );
        if (await cookieBtn.count() > 0) {
          await cookieBtn.first().click().catch(() => {});
          await sleep(600);
        }

        // Find category nav links
        const found = await page.evaluate((keywords) => {
          const links = Array.from(document.querySelectorAll(
            'nav a, header a, [class*="nav" i] a, [class*="menu" i] a, [class*="category" i] a, aside a'
          ));
          return links
            .map(a => ({ href: a.href || '', text: (a.textContent || '').trim().toLowerCase() }))
            .filter(l =>
              l.href && !l.href.includes('javascript:') && !l.href.includes('#') &&
              keywords.some(kw => l.text.includes(kw) || l.href.toLowerCase().includes(kw))
            )
            .map(l => l.href);
        }, CATEGORY_KEYWORDS);

        for (const link of found) {
          if (!categoryLinks.includes(link)) categoryLinks.push(link);
        }

        // If we got products on this page itself, capture them
        const pageProducts = await genericProductExtract(page, BASE_URL);
        if (pageProducts.length > 0) {
          console.log(`  Found ${pageProducts.length} products on ${startUrl.replace(BASE_URL, '')}`);
          for (const p of pageProducts) {
            if (!seenUrls.has(p.href)) { seenUrls.add(p.href); allProducts.push(p); }
          }
        }
      } catch {}
    }

    console.log(`  Discovered ${categoryLinks.length} category links`);

    // Scrape each category with pagination
    for (const catUrl of categoryLinks.slice(0, 25)) {
      if (visitedPages.has(catUrl)) continue;
      visitedPages.add(catUrl);
      process.stdout.write(`  ${catUrl.replace(BASE_URL, '') || '/'}...`);

      try {
        await page.goto(catUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await sleep(2500);

        const products = await genericProductExtract(page, BASE_URL);
        process.stdout.write(` ${products.length} products\n`);

        for (const p of products) {
          if (!seenUrls.has(p.href)) { seenUrls.add(p.href); allProducts.push(p); }
        }

        // Pagination
        for (let pg = 1; pg < MAX_PAGES; pg++) {
          const nextHref = await page.locator(
            'a[rel="next"], [aria-label="Next"], a:has-text("Next"), [class*="next" i]'
          ).first().getAttribute('href').catch(() => null);

          if (!nextHref) break;
          const nextUrl = nextHref.startsWith('http') ? nextHref : `${BASE_URL}${nextHref}`;
          if (visitedPages.has(nextUrl)) break;
          visitedPages.add(nextUrl);

          await page.goto(nextUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await sleep(2000);
          const more = await genericProductExtract(page, BASE_URL);
          if (more.length === 0) break;
          process.stdout.write(`    +page ${pg + 1}: ${more.length}\n`);
          for (const p of more) {
            if (!seenUrls.has(p.href)) { seenUrls.add(p.href); allProducts.push(p); }
          }
        }

        await randDelay(700, 1500);
      } catch (err) {
        process.stdout.write(` [${err.message.slice(0, 50)}]\n`);
      }
    }
  } finally {
    await browser.close();
  }

  return allProducts;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== Well Pharmacy Scraper ===\n');
  if (process.env.SCRAPER_API_KEY) console.log('  ✓ ScraperAPI proxy active');

  const dbProducts = await loadDbProducts(['medicine', 'supplement', 'skincare']);
  console.log(`DB products loaded: ${dbProducts.length.toLocaleString()}`);

  // Probe which URLs are live
  console.log('\nProbing URL patterns...');
  const liveUrls = [];
  for (const url of PROBE_URLS) {
    const alive = await probeUrl(url);
    if (alive) {
      liveUrls.push(url);
      console.log(`  ✓ ${url.replace(BASE_URL, '')}`);
    }
  }
  if (liveUrls.length === 0) {
    console.log('  No product pages found via direct fetch — starting Playwright discovery from homepage');
    liveUrls.push(BASE_URL);
  }

  // Scrape with Playwright
  const scraped = await scrapeWithPlaywright(liveUrls);
  console.log(`\nTotal scraped: ${scraped.length}`);

  const stats = { scraped: scraped.length, matched: 0, created: 0, updated: 0, errors: 0 };

  for (const p of scraped) {
    // Guess category from name/URL
    const lower = (p.name + ' ' + p.href).toLowerCase();
    const dbCat = lower.match(/vitamin|supplement|omega|zinc|magnesium|probiotic/) ? 'supplement' :
                  lower.match(/moistur|serum|cleanser|sunscreen|skin/) ? 'skincare' : 'medicine';

    const match = findBestMatch(p.name, dbProducts);
    let medicineId;

    if (match) {
      medicineId = match.product.id;
      stats.matched++;
    } else {
      try {
        medicineId = await upsertMedicine({ name: p.name, category: dbCat, source: SOURCE });
        if (medicineId) {
          dbProducts.push({ id: medicineId, name: p.name, category: dbCat, norm: normaliseName(p.name) });
          stats.created++;
        } else continue;
      } catch { stats.errors++; continue; }
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
    } catch { stats.errors++; }
  }

  console.log('\n── Results ──');
  console.log(`  Scraped:  ${stats.scraped}`);
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
