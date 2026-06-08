#!/usr/bin/env node
/**
 * medino-scraper.mjs — Medino (medino.com) OTC medicine scraper
 *
 * Medino is a UK online pharmacy with competitive OTC medicine prices.
 * Uses fetch + cheerio. ScraperAPI proxy used if SCRAPER_API_KEY is set.
 *
 * Usage: node scripts/scrapers/medino-scraper.mjs
 */

import * as cheerio from 'cheerio';
import {
  pool, loadDbProducts, findBestMatch, upsertPrice, upsertMedicine,
  sleep, randDelay, fetchWithProxy, normaliseName,
  launchStealthBrowser, PAGE_HEADERS, genericProductExtract,
} from './scraper-utils.mjs';

const PHARMACY_NAME = 'Medino';
const SOURCE        = 'medino';
const BASE_URL      = 'https://medino.com';

const CATEGORIES = [
  { url: `${BASE_URL}/aches-pains`,            dbCat: 'medicine' },
  { url: `${BASE_URL}/allergy-and-hayfever`,   dbCat: 'medicine' },
  { url: `${BASE_URL}/allergy-hayfever`,       dbCat: 'medicine' },
  { url: `${BASE_URL}/cough-cold-flu`,         dbCat: 'medicine' },
  { url: `${BASE_URL}/ears-eyes-nose`,         dbCat: 'medicine' },
  { url: `${BASE_URL}/first-aid`,              dbCat: 'medicine' },
  { url: `${BASE_URL}/feminine-care`,          dbCat: 'medicine' },
  { url: `${BASE_URL}/sexual-health`,          dbCat: 'medicine' },
  { url: `${BASE_URL}/essentials`,             dbCat: 'medicine' },
  { url: `${BASE_URL}/travel`,                 dbCat: 'medicine' },
  { url: `${BASE_URL}/mother-child`,           dbCat: 'health' },
  { url: `${BASE_URL}/vitamins-supplements`,   dbCat: 'supplement' },
  { url: `${BASE_URL}/skincare`,               dbCat: 'skincare' },
  { url: `${BASE_URL}/beauty-cosmetics`,       dbCat: 'skincare' },
  { url: `${BASE_URL}/accessories`,            dbCat: 'health' },
  { url: `${BASE_URL}/popular-products`,       dbCat: 'medicine' },
];

const MAX_PAGES = 10;

function extractProducts(html, baseUrl) {
  const $ = cheerio.load(html);
  const products = [];
  const seen = new Set();

  // Try JSON-LD first
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
        products.push({
          name: prod.name,
          price,
          url: url.startsWith('http') ? url : `${BASE_URL}${url}`,
        });
      }
    } catch {}
  });

  if (products.length > 0) {
    const nextHref = $('a[rel="next"], a[aria-label="Next"], .pagination__next, a:contains("Next")').attr('href');
    const nextPage = nextHref ? (nextHref.startsWith('http') ? nextHref : `${BASE_URL}${nextHref}`) : null;
    return { products, nextPage };
  }

  // Generic card selectors
  const CARD_SELS = [
    '[data-testid*="product"]', '[data-test*="product"]',
    '.product-card', '.product-item', '.product-tile',
    '.product', 'article.product',
    '[class*="ProductCard" i]', '[class*="ProductItem" i]',
    '.catalogue-item', '.listing-item',
  ];

  let $cards = $([]);
  for (const sel of CARD_SELS) {
    $cards = $(sel);
    if ($cards.length > 0) break;
  }

  // Last resort: any element with 1 link and a price
  if ($cards.length === 0) {
    $('div, li, article').each((_, el) => {
      const $el = $(el);
      const links = $el.find('a[href]');
      if (links.length !== 1) return;
      const text = $el.text();
      if (!/£[\d.,]+/.test(text)) return;
      $cards = $cards.add(el);
    });
  }

  $cards.each((_, el) => {
    const $c = $(el);
    const text = $c.text();

    const pm = text.match(/£([\d.,]+)/);
    if (!pm) return;
    const price = parseFloat(pm[1].replace(',', ''));
    if (isNaN(price) || price < 0.3 || price > 500) return;

    const href = $c.find('a[href]').first().attr('href') || '';
    if (!href || href === '#' || seen.has(href)) return;

    const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    seen.add(href);

    const name = (
      $c.find('h2, h3, h4, [class*="name" i], [class*="title" i]').first().text().trim() ||
      $c.find('a[href]').first().text().trim()
    ).replace(/\s+/g, ' ').slice(0, 200);

    if (!name || name.length < 3) return;
    products.push({ name, price, url: fullUrl });
  });

  const nextHref = $('a[rel="next"], a[aria-label="Next"], .pagination__next, a:contains("Next"), a:contains("next")').attr('href');
  const nextPage = nextHref ? (nextHref.startsWith('http') ? nextHref : `${BASE_URL}${nextHref}`) : null;

  return { products, nextPage };
}

// ── Playwright discovery fallback ─────────────────────────────────────────────

async function discoverViaPlaywright(baseUrl) {
  const browser = await launchStealthBrowser();
  const context = await browser.newContext({ extraHTTPHeaders: PAGE_HEADERS, viewport: { width: 1280, height: 900 }, locale: 'en-GB' });
  const page = await context.newPage();
  page.on('console', () => {});
  page.on('pageerror', () => {});

  const allProducts = [];
  const seenUrls = new Set();
  const visited = new Set();

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2000);

    const cookieBtn = page.locator('button:has-text("Accept"), button:has-text("Accept All"), [id*="accept"]');
    if (await cookieBtn.count() > 0) { await cookieBtn.first().click().catch(() => {}); await sleep(600); }

    const navLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll('nav a, header a, [class*="nav" i] a, [class*="menu" i] a'))
        .map(a => a.href || '')
        .filter(h => h && !h.includes('javascript:') && !h.includes('#'))
        .slice(0, 30)
    );

    const KEYWORDS = ['medicine', 'otc', 'vitamin', 'supplement', 'pain', 'cold', 'health', 'allergy', 'skincare'];
    const catLinks = navLinks.filter(l => KEYWORDS.some(kw => l.toLowerCase().includes(kw)));
    console.log(`  Discovered ${catLinks.length} category links via nav`);

    for (const catUrl of catLinks.slice(0, 20)) {
      if (visited.has(catUrl)) continue;
      visited.add(catUrl);
      process.stdout.write(`  ${catUrl.replace(baseUrl, '')}...`);

      try {
        await page.goto(catUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await sleep(2500);

        const products = await genericProductExtract(page, baseUrl);
        process.stdout.write(` ${products.length} products\n`);
        for (const p of products) {
          if (!seenUrls.has(p.href)) { seenUrls.add(p.href); allProducts.push(p); }
        }
        await randDelay(700, 1500);
      } catch (err) { process.stdout.write(` [${err.message.slice(0, 50)}]\n`); }
    }
  } finally { await browser.close(); }

  return allProducts;
}

async function main() {
  console.log('\n=== Medino Scraper ===\n');
  if (process.env.SCRAPER_API_KEY) console.log('  ✓ ScraperAPI proxy active');

  const dbProducts = await loadDbProducts(['medicine', 'supplement', 'skincare']);
  console.log(`DB products loaded: ${dbProducts.length.toLocaleString()}`);

  const stats    = { scraped: 0, matched: 0, created: 0, updated: 0, errors: 0 };
  const allItems = [];
  const seenUrls = new Set();

  let usedPlaywright = false;
  for (const { url: catUrl, dbCat } of CATEGORIES) {
    console.log(`\n${catUrl.replace(BASE_URL, '')}`);

    let currentUrl = catUrl;
    for (let page = 1; page <= MAX_PAGES; page++) {
      process.stdout.write(`  page ${page}...`);
      try {
        const html = await fetchWithProxy(currentUrl, { retries: 2, timeout: 20000 });
        if (!html) { process.stdout.write(' (null)\n'); break; }

        const { products, nextPage } = extractProducts(html, catUrl);
        process.stdout.write(` ${products.length} products\n`);

        if (products.length === 0) break;

        for (const p of products) {
          if (!seenUrls.has(p.url)) {
            seenUrls.add(p.url);
            allItems.push({ ...p, dbCat });
          }
        }

        if (!nextPage) break;
        currentUrl = nextPage;
        await randDelay(800, 1800);
      } catch (err) {
        process.stdout.write(` [error: ${err.message.slice(0, 60)}]\n`);
        break;
      }
    }

    await sleep(500);
  }

  // If very few products found via direct fetch, use Playwright discovery
  if (allItems.length < 50 && !usedPlaywright) {
    console.log(`\n── Playwright discovery (only ${allItems.length} via fetch) ──`);
    usedPlaywright = true;
    try {
      const discovered = await discoverViaPlaywright(BASE_URL);
      for (const p of discovered) {
        if (!seenUrls.has(p.href)) {
          seenUrls.add(p.href);
          const lower = (p.name + ' ' + p.href).toLowerCase();
          const dbCat = lower.match(/vitamin|supplement|omega|zinc|magnesium|probiotic/) ? 'supplement' :
                        lower.match(/moistur|serum|cleanser|skin/) ? 'skincare' : 'medicine';
          allItems.push({ name: p.name, price: p.price, url: p.href, dbCat });
        }
      }
    } catch (err) { console.error('Playwright discovery failed:', err.message); }
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
        medicineId = await upsertMedicine({ name: p.name, category: p.dbCat, source: SOURCE });
        if (medicineId) {
          dbProducts.push({ id: medicineId, name: p.name, category: p.dbCat, norm: normaliseName(p.name) });
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
        imageUrl: null,
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
