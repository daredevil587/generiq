#!/usr/bin/env node
/**
 * healthspan-scraper.mjs — Healthspan (healthspan.co.uk) supplement scraper
 *
 * Healthspan is one of the UK's largest supplement retailers.
 * Uses Playwright with generic extraction — discovers category pages from
 * the site's own navigation, so it works regardless of URL structure changes.
 *
 * Usage: node scripts/scrapers/healthspan-scraper.mjs
 */

import * as cheerio from 'cheerio';
import {
  pool, loadDbProducts, findBestMatch, upsertPrice, upsertMedicine,
  sleep, randDelay, launchStealthBrowser, PAGE_HEADERS, fetchWithProxy,
  genericProductExtract, normaliseName,
} from './scraper-utils.mjs';

const PHARMACY_NAME = 'Healthspan';
const SOURCE        = 'healthspan';
const BASE_URL      = 'https://www.healthspan.co.uk';

// Known URL patterns to try first (saves navigation discovery time)
const KNOWN_CATEGORY_URLS = [
  `${BASE_URL}/vitamins`,
  `${BASE_URL}/vitamins-minerals`,
  `${BASE_URL}/minerals`,
  `${BASE_URL}/omega`,
  `${BASE_URL}/omega-3`,
  `${BASE_URL}/immune`,
  `${BASE_URL}/immune-support`,
  `${BASE_URL}/joints-bones`,
  `${BASE_URL}/energy`,
  `${BASE_URL}/gut-health`,
  `${BASE_URL}/sports-nutrition`,
  `${BASE_URL}/herbal`,
  `${BASE_URL}/shop`,
  `${BASE_URL}/supplements`,
  `${BASE_URL}/all-products`,
];

const MAX_PAGES = 8;

// ── Fetch-based HTML extractor ─────────────────────────────────────────────────

async function extractFromUrl(url) {
  const products = [];
  const seen = new Set();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const pageUrl = page === 1 ? url : `${url}?page=${page}`;
    try {
      const html = await fetchWithProxy(pageUrl, { retries: 2, timeout: 20000 });
      if (!html) break;

      const $ = cheerio.load(html);

      // Check page gave us useful content (has £ prices)
      if (!$.text().includes('£')) break;

      // Try JSON-LD
      const pageProducts = [];
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const data = JSON.parse($(el).html());
          const items = Array.isArray(data) ? data :
                       data['@type'] === 'ItemList' ? data.itemListElement : [data];
          for (const item of items) {
            const prod = item.item || item;
            if (prod['@type'] !== 'Product' || !prod.name) continue;
            const price = parseFloat(prod.offers?.price ?? prod.offers?.lowPrice ?? 0);
            const prodUrl = prod.url || '';
            if (!price || !prodUrl || seen.has(prodUrl)) continue;
            seen.add(prodUrl);
            pageProducts.push({
              name: prod.name,
              price,
              url: prodUrl.startsWith('http') ? prodUrl : `${BASE_URL}${prodUrl}`,
            });
          }
        } catch {}
      });

      if (pageProducts.length === 0) {
        // Generic extraction — find any product card
        const CARD_SELS = [
          '.product-card', '.product-item', '.product-tile',
          '[data-product]', '[class*="product" i]',
          '.item', '.grid-item', 'article',
        ];
        let $cards = $([]);
        for (const sel of CARD_SELS) {
          $cards = $(sel);
          if ($cards.length >= 3) break;
        }

        $cards.each((_, el) => {
          const $c = $(el);
          const text = $c.text();
          const pm = text.match(/£([\d.,]+)/);
          if (!pm) return;
          const price = parseFloat(pm[1].replace(',', ''));
          if (isNaN(price) || price < 0.5 || price > 300) return;

          const href = (
            $c.find('a[href]').first().attr('href') ||
            $c.closest('a').attr('href') || ''
          );
          if (!href || seen.has(href)) return;
          seen.add(href);

          const name = (
            $c.find('h1, h2, h3, h4, [class*="title" i], [class*="name" i]').first().text().trim() ||
            $c.find('a').first().text().trim()
          ).replace(/\s+/g, ' ').slice(0, 200);

          if (!name || name.length < 3) return;
          const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
          pageProducts.push({ name, price, url: fullUrl });
        });
      }

      if (pageProducts.length === 0) break;
      products.push(...pageProducts);

      // Check for next page
      const hasNext = $('a[rel="next"], .pagination__next, a:contains("Next"), [aria-label="Next"]').length > 0;
      if (!hasNext) break;
      await randDelay(600, 1200);
    } catch { break; }
  }

  return products;
}

// ── Playwright-based discovery for complex pages ──────────────────────────────

async function discoverAndScrapeWithPlaywright() {
  console.log('  Using Playwright for dynamic discovery...');
  const browser = await launchStealthBrowser();
  const context = await browser.newContext({
    extraHTTPHeaders: PAGE_HEADERS,
    viewport: { width: 1280, height: 900 },
    locale: 'en-GB',
  });
  const page = await context.newPage();
  page.on('console', () => {});
  page.on('pageerror', () => {});

  const allProducts = [];
  const seenUrls = new Set();
  const visitedPages = new Set();

  try {
    // Visit homepage to discover category nav links
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2000);

    // Accept cookies
    const cookieBtn = page.locator('button:has-text("Accept"), button:has-text("Accept All"), [id*="accept"]');
    if (await cookieBtn.count() > 0) {
      await cookieBtn.first().click().catch(() => {});
      await sleep(600);
    }

    // Find all nav/category links
    const navLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('nav a[href], header a[href], [class*="nav" i] a[href], [class*="menu" i] a[href]'));
      return links
        .map(a => ({ href: a.href, text: a.textContent?.trim() || '' }))
        .filter(l => l.href && !l.href.includes('javascript:') && l.text.length > 0)
        .slice(0, 30);
    });

    // Filter links that look like product category pages
    const CATEGORY_KEYWORDS = ['vitamin', 'supplement', 'mineral', 'omega', 'immune', 'joint', 'sport', 'herbal', 'health', 'shop', 'all'];
    const categoryLinks = navLinks
      .filter(l => CATEGORY_KEYWORDS.some(kw => l.text.toLowerCase().includes(kw) || l.href.toLowerCase().includes(kw)))
      .map(l => l.href);

    console.log(`  Found ${categoryLinks.length} category links`);

    // Scrape each category
    for (const catUrl of categoryLinks.slice(0, 20)) {
      if (visitedPages.has(catUrl)) continue;
      visitedPages.add(catUrl);
      process.stdout.write(`  ${catUrl.replace(BASE_URL, '')}...`);

      try {
        await page.goto(catUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await sleep(2500);

        const products = await genericProductExtract(page, BASE_URL);
        process.stdout.write(` ${products.length} products\n`);

        for (const p of products) {
          if (!seenUrls.has(p.href)) {
            seenUrls.add(p.href);
            allProducts.push(p);
          }
        }

        // Pagination
        for (let pg = 1; pg < 5; pg++) {
          const nextUrl = await page.locator('a[rel="next"], [aria-label="Next"], a:has-text("Next")').first().getAttribute('href').catch(() => null);
          if (!nextUrl) break;
          const fullNext = nextUrl.startsWith('http') ? nextUrl : `${BASE_URL}${nextUrl}`;
          if (visitedPages.has(fullNext)) break;
          visitedPages.add(fullNext);

          await page.goto(fullNext, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await sleep(2000);
          const more = await genericProductExtract(page, BASE_URL);
          if (more.length === 0) break;
          process.stdout.write(`    +page ${pg + 1}: ${more.length} more\n`);
          for (const p of more) {
            if (!seenUrls.has(p.href)) { seenUrls.add(p.href); allProducts.push(p); }
          }
        }

        await randDelay(800, 1500);
      } catch (err) {
        process.stdout.write(` [error: ${err.message.slice(0, 50)}]\n`);
      }
    }
  } finally {
    await browser.close();
  }

  return allProducts;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== Healthspan Scraper ===\n');
  if (process.env.SCRAPER_API_KEY) console.log('  ✓ ScraperAPI proxy active');

  const dbProducts = await loadDbProducts(['supplement', 'skincare']);
  console.log(`DB products loaded: ${dbProducts.length.toLocaleString()}`);

  const stats    = { scraped: 0, matched: 0, created: 0, updated: 0, errors: 0 };
  const allItems = [];
  const seenUrls = new Set();

  // Phase 1: Try known URLs with direct fetch
  console.log('\n── Phase 1: Direct fetch of known URLs ──');
  for (const url of KNOWN_CATEGORY_URLS) {
    process.stdout.write(`  ${url.replace(BASE_URL, '')}...`);
    try {
      const products = await extractFromUrl(url);
      process.stdout.write(` ${products.length} products\n`);
      for (const p of products) {
        if (!seenUrls.has(p.url)) { seenUrls.add(p.url); allItems.push({ ...p, dbCat: 'supplement' }); }
      }
    } catch (err) {
      process.stdout.write(` [error: ${err.message.slice(0, 60)}]\n`);
    }
    await sleep(400);
  }

  // Phase 2: Playwright discovery if we got < 20 products
  if (allItems.length < 20) {
    console.log(`\n── Phase 2: Playwright discovery (fetched only ${allItems.length}) ──`);
    try {
      const discovered = await discoverAndScrapeWithPlaywright();
      for (const p of discovered) {
        if (!seenUrls.has(p.href)) {
          seenUrls.add(p.href);
          allItems.push({ name: p.name, price: p.price, url: p.href, dbCat: 'supplement', imageUrl: p.imageUrl });
        }
      }
    } catch (err) {
      console.error('  Playwright discovery failed:', err.message);
    }
  }

  console.log(`\nTotal unique: ${allItems.length}`);
  stats.scraped = allItems.length;

  for (const p of allItems) {
    const match = findBestMatch(p.name, dbProducts);
    let medicineId;

    if (match) {
      medicineId = match.product.id;
      stats.matched++;
    } else {
      try {
        medicineId = await upsertMedicine({ name: p.name, category: p.dbCat ?? 'supplement', source: SOURCE });
        if (medicineId) {
          dbProducts.push({ id: medicineId, name: p.name, category: 'supplement', norm: normaliseName(p.name) });
          stats.created++;
        } else continue;
      } catch { stats.errors++; continue; }
    }

    try {
      await upsertPrice({
        medicineId,
        pharmacyName: PHARMACY_NAME,
        pharmacyUrl: p.url,
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
