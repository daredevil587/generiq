#!/usr/bin/env node
/**
 * boots-scraper.mjs — Boots skincare + supplements scraper
 *
 * Usage: node scripts/scrapers/boots-scraper.mjs
 */

import * as cheerio from 'cheerio';
import {
  pool, loadDbProducts, findBestMatch, upsertPrice, upsertMedicine, sleep, randDelay,
  launchStealthBrowser, PAGE_HEADERS, fetchWithProxy, genericProductExtract, normaliseName,
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

// ── ScraperAPI fetch strategy (for when Boots blocks Playwright) ──────────────

function parseBootsHtml(html) {
  const $ = cheerio.load(html);
  const products = [];
  const seen = new Set();

  // Try JSON-LD structured data
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
        products.push({ name: prod.name, price, url: url.startsWith('http') ? url : `https://www.boots.com${url}`, size: null, image: prod.image ?? null });
      }
    } catch {}
  });

  if (products.length > 0) return products;

  // Generic card selectors
  const CARD_SELS = [
    '[data-test="product-grid-item"]', '[class*="product-grid-item" i]',
    '[class*="ProductGridItem" i]', '[class*="plp-product" i]',
    '.product-card', '.product-item', '[class*="product-tile" i]',
    'article.product', '.product',
  ];

  let $cards = $([]);
  for (const sel of CARD_SELS) {
    $cards = $(sel);
    if ($cards.length > 0) break;
  }

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

    const name = (
      $c.find('h2, h3, [class*="title" i], [class*="name" i]').first().text().trim() ||
      $c.find('a').first().text().trim()
    ).replace(/\s+/g, ' ').slice(0, 200);

    if (!name || name.length < 3) return;

    const fullUrl = href.startsWith('http') ? href : `https://www.boots.com${href}`;
    const imgEl = $c.find('img').first();
    const image = imgEl.attr('src') || imgEl.attr('data-src') || null;

    products.push({ name, price, url: fullUrl, size: null, image });
  });

  return products;
}

async function scrapeBootsPage(page, url) {
  const products = [];
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Accept cookies
    const cookieBtn = page.locator('#onetrust-accept-btn-handler, button:has-text("Accept all cookies"), button:has-text("Accept All")');
    if (await cookieBtn.count() > 0) {
      await cookieBtn.first().click().catch(() => {});
      await sleep(1000);
    }

    // Wait for any product content
    await page.waitForSelector(
      '[class*="product"], [data-test*="product"], [class*="plp"], article',
      { timeout: 15000 }
    ).catch(() => {});
    await sleep(1000);

    // Try generic extractor first
    const generic = await genericProductExtract(page, 'https://www.boots.com');
    for (const p of generic) {
      products.push({ name: p.name, price: p.price, url: p.href, size: null, image: p.imageUrl ?? null });
    }

    // Fallback to explicit card selectors if generic found nothing
    if (products.length === 0) {
      const raw = await page.evaluate(() => {
        const results = [];
        const SELS = [
          '[data-test="product-grid-item"]', '[class*="product-grid-item"]',
          '[class*="ProductGridItem"]', '[class*="plp-product"]',
          '.product-card', '.product-item',
        ];
        let cards = [];
        for (const sel of SELS) {
          cards = Array.from(document.querySelectorAll(sel));
          if (cards.length > 0) break;
        }

        cards.forEach(card => {
          const nameEl  = card.querySelector('h2, h3, [class*="title"], [data-test*="title"]');
          const priceEl = card.querySelector('[class*="price"]:not([class*="was"]), [data-test*="price"]');
          const linkEl  = card.querySelector('a[href]');
          const imgEl   = card.querySelector('img');

          const name  = nameEl?.textContent?.trim();
          const price = priceEl?.textContent?.trim();
          const href  = linkEl?.getAttribute('href');
          const image = imgEl?.src || null;

          if (name && price && href) results.push({ name, priceRaw: price, href, image });
        });
        return results;
      });

      for (const r of raw) {
        const pm = r.priceRaw.match(/£([\d.,]+)/);
        if (!pm) continue;
        const price = parseFloat(pm[1].replace(',', ''));
        if (isNaN(price) || price <= 0) continue;
        const productUrl = r.href.startsWith('http') ? r.href : `https://www.boots.com${r.href}`;
        products.push({ name: r.name, price, url: productUrl, size: null, image: r.image ?? null });
      }
    }
  } catch (err) {
    process.stderr.write(`  [page error: ${err.message}]\n`);
  }
  return products;
}

// ── ScraperAPI direct fetch for Boots (bypasses Akamai) ──────────────────────

async function scrapeBootsViaProxy(url) {
  try {
    const html = await fetchWithProxy(url, { render: true, retries: 2, timeout: 40000 });
    if (!html) return [];
    return parseBootsHtml(html);
  } catch (err) {
    process.stderr.write(`  [proxy error: ${err.message}]\n`);
    return [];
  }
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

  const useProxy = !!process.env.SCRAPER_API_KEY;
  if (useProxy) {
    console.log('  ✓ ScraperAPI proxy active — Boots Akamai blocking bypassed');
  } else {
    console.log('  ℹ No SCRAPER_API_KEY — using Playwright stealth (may be blocked by Akamai)');
    console.log('    To enable proxy: set SCRAPER_API_KEY=your_key in .env.local');
    console.log('    Free tier at scraperapi.com (1000 requests/month)');
  }

  const dbProducts = await loadDbProducts(['supplement', 'skincare']);
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

  for (const seed of SEED_URLS) {
    console.log(`\nCategory: ${seed.url.split('boots.com/')[1]} [${seed.cat}]`);

    let currentUrl = seed.url;
    for (let p = 0; p < MAX_PAGES; p++) {
      process.stdout.write(`  page ${p + 1}...`);

      let products;
      if (useProxy) {
        products = await scrapeBootsViaProxy(currentUrl);
      } else {
        products = await scrapeBootsPage(page_holder.page, currentUrl);
      }

      process.stdout.write(` ${products.length} products`);

      if (products.length === 0) {
        process.stdout.write(' (empty)\n');
        break;
      }

      for (const prod of products) {
        if (!seenUrls.has(prod.url)) {
          seenUrls.add(prod.url);
          allProducts.push({ ...prod, dbCat: seed.cat });
        }
      }

      process.stdout.write('\n');

      if (!useProxy) {
        const nextUrl = await getNextPageUrl(page_holder.page);
        if (!nextUrl) break;
        currentUrl = nextUrl;
      } else {
        // Boots proxy pagination: try ?pageNumber=N
        const nextUrl = `${seed.url}?pageNumber=${p + 2}`;
        currentUrl = nextUrl;
      }

      await randDelay(useProxy ? 1500 : 1200, useProxy ? 3000 : 2800);
    }
  }

  if (browser) await browser.close();

  // Match & upsert
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
        medicineId = await upsertMedicine({ name: prod.name, category: prod.dbCat, source: SOURCE });
        if (!medicineId) continue;
        dbProducts.push({ id: medicineId, name: prod.name, category: prod.dbCat, norm: normaliseName(prod.name) });
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
