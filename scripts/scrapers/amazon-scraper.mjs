#!/usr/bin/env node
/**
 * amazon-scraper.mjs — Amazon.co.uk health & beauty products scraper
 *
 * Uses fetch + cheerio to scrape Amazon search result pages.
 * No browser required — lightweight and fast.
 *
 * Usage: node scripts/scrapers/amazon-scraper.mjs
 */

import * as cheerio from 'cheerio';
import {
  pool, loadDbProducts, findBestMatch, upsertPrice, upsertMedicine,
  sleep, normaliseName,
} from './scraper-utils.mjs';

const PHARMACY_NAME = 'Amazon';
const SOURCE        = 'amazon_uk';

// ── Request configuration ─────────────────────────────────────────────────────

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="126", "Not A(Brand";v="8", "Google Chrome";v="126"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

// ── Category search URLs ──────────────────────────────────────────────────────

const CATEGORY_SEARCHES = [
  { url: 'https://www.amazon.co.uk/s?k=vitamins+supplements&i=drugstore', category: 'supplement' },
  { url: 'https://www.amazon.co.uk/s?k=medicines+otc&i=drugstore',       category: 'otc' },
  { url: 'https://www.amazon.co.uk/s?k=skincare&i=beauty',               category: 'skincare' },
];

// Specific popular product searches
const PRODUCT_SEARCHES = [
  { term: 'omega 3',          category: 'supplement' },
  { term: 'vitamin d',        category: 'supplement' },
  { term: 'vitamin c',        category: 'supplement' },
  { term: 'paracetamol',      category: 'otc' },
  { term: 'ibuprofen',        category: 'otc' },
  { term: 'zinc',             category: 'supplement' },
  { term: 'magnesium',        category: 'supplement' },
  { term: 'probiotics',       category: 'supplement' },
  { term: 'collagen',         category: 'supplement' },
  { term: 'biotin',           category: 'supplement' },
  { term: 'iron supplement',  category: 'supplement' },
  { term: 'calcium',          category: 'supplement' },
  { term: 'multivitamin',     category: 'supplement' },
  { term: 'turmeric',         category: 'supplement' },
  { term: 'glucosamine',      category: 'supplement' },
  { term: 'cod liver oil',    category: 'supplement' },
  { term: 'folic acid',       category: 'supplement' },
  { term: 'vitamin b12',      category: 'supplement' },
  { term: 'cerave',           category: 'skincare' },
  { term: 'the ordinary',     category: 'skincare' },
];

const MAX_PAGES    = 3;   // pages per search (each page ≈ 16-48 results)
const DELAY_MIN_MS = 3000;
const DELAY_MAX_MS = 5000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function randDelay() {
  return sleep(DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS));
}

/**
 * Fetch a page with retries on transient failures.
 */
async function fetchPage(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: HEADERS,
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });

      if (res.status === 503 || res.status === 429) {
        console.warn(`  ⚠ HTTP ${res.status} — backing off (attempt ${attempt + 1})`);
        await sleep(5000 + attempt * 5000);
        continue;
      }

      if (!res.ok) {
        console.warn(`  ⚠ HTTP ${res.status} for ${url}`);
        return null;
      }

      return await res.text();
    } catch (err) {
      if (attempt < retries) {
        console.warn(`  ⚠ Fetch error: ${err.message} — retrying...`);
        await sleep(3000);
      } else {
        console.error(`  ✖ Fetch failed after ${retries + 1} attempts: ${err.message}`);
        return null;
      }
    }
  }
  return null;
}

// ── Parse search results ──────────────────────────────────────────────────────

function parseSearchResults(html) {
  const $ = cheerio.load(html);
  const products = [];

  // Amazon wraps each search result in a div with data-component-type="s-search-result"
  $('[data-component-type="s-search-result"]').each((_i, el) => {
    const card = $(el);

    // Skip sponsored/ad results that are not real product listings
    if (card.find('.s-label-popover-default').length > 0) return;

    // ── Product title & URL ──
    const titleAnchor = card.find('h2 a').first();
    const name = titleAnchor.find('span').text().trim() || titleAnchor.text().trim();
    let href = titleAnchor.attr('href') || '';

    if (!name || !href) return;

    // Build full URL
    if (href.startsWith('/')) {
      href = `https://www.amazon.co.uk${href}`;
    }
    // Strip tracking params but keep ASIN path
    try {
      const u = new URL(href);
      href = `https://www.amazon.co.uk${u.pathname}`;
    } catch { /* keep href as-is */ }

    // ── Price ──
    // Amazon uses .a-price .a-offscreen for the current price
    // There may be a "was" price too — we want the first (current) price
    const priceText = card.find('.a-price:not([data-a-strike]) .a-offscreen').first().text().trim();
    if (!priceText) return;

    const priceMatch = priceText.match(/£([\d.,]+)/);
    if (!priceMatch) return;

    const price = parseFloat(priceMatch[1].replace(',', ''));
    if (isNaN(price) || price <= 0) return;

    // ── Image URL ──
    const imageUrl = card.find('img.s-image').attr('src') || null;

    // ── Pack size / variant info ──
    // Sometimes shown beneath the title
    const sizeText = card.find('.a-size-base.a-color-secondary').first().text().trim() || null;

    products.push({ name, price, url: href, imageUrl, packSize: sizeText });
  });

  return products;
}

/**
 * Check if there is a "Next" page link and return its URL, or null.
 */
function getNextPageUrl(html) {
  const $ = cheerio.load(html);
  const nextLink = $('a.s-pagination-next').attr('href');
  if (!nextLink) return null;
  if (nextLink.startsWith('/')) return `https://www.amazon.co.uk${nextLink}`;
  return nextLink;
}

// ── Deduplicate products by URL ───────────────────────────────────────────────

function deduplicateProducts(products) {
  const seen = new Map();
  for (const p of products) {
    const key = p.url;
    if (!seen.has(key)) {
      seen.set(key, p);
    }
  }
  return [...seen.values()];
}

// ── Guess category from product name when multiple categories are loaded ──────

function guessCategory(name) {
  const n = normaliseName(name);
  const skinKeywords = ['cerave', 'ordinary', 'moisturiser', 'cleanser', 'serum', 'spf', 'sunscreen', 'retinol', 'niacinamide', 'hyaluronic'];
  const otcKeywords  = ['paracetamol', 'ibuprofen', 'aspirin', 'antihistamine', 'cough', 'cold', 'flu', 'pain relief', 'hayfever', 'allergy'];

  if (skinKeywords.some(kw => n.includes(kw))) return 'skincare';
  if (otcKeywords.some(kw => n.includes(kw)))  return 'otc';
  return 'supplement';
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== Amazon.co.uk Scraper ===\n');

  // Load DB products for the categories we'll be scraping
  const categories = ['supplement', 'otc', 'skincare'];
  const dbProducts = await loadDbProducts(categories);
  console.log(`DB products loaded: ${dbProducts.length.toLocaleString()} across [${categories.join(', ')}]`);

  const allProducts = [];
  const stats = { scraped: 0, matched: 0, created: 0, updated: 0, errors: 0 };

  // ── 1. Scrape category search pages ─────────────────────────────────────────

  for (const { url, category } of CATEGORY_SEARCHES) {
    console.log(`\n🔍 Category search: ${url.split('k=')[1]?.split('&')[0] || url}`);
    let currentUrl = url;

    for (let page = 1; page <= MAX_PAGES; page++) {
      process.stdout.write(`  page ${page}...`);
      const html = await fetchPage(currentUrl);
      if (!html) {
        process.stdout.write(' (failed)\n');
        break;
      }

      const products = parseSearchResults(html);
      products.forEach(p => p.category = category);
      allProducts.push(...products);

      process.stdout.write(` ${products.length} products\n`);

      if (products.length === 0) break;

      // Check for next page
      const nextUrl = getNextPageUrl(html);
      if (!nextUrl || page >= MAX_PAGES) break;
      currentUrl = nextUrl;

      await randDelay();
    }

    await randDelay();
  }

  // ── 2. Scrape specific product searches ─────────────────────────────────────

  for (const { term, category } of PRODUCT_SEARCHES) {
    const encodedTerm = encodeURIComponent(term);
    const searchUrl = `https://www.amazon.co.uk/s?k=${encodedTerm}&i=drugstore`;

    process.stdout.write(`\n🔍 "${term}"...`);
    const html = await fetchPage(searchUrl);
    if (!html) {
      process.stdout.write(' (failed)\n');
      await randDelay();
      continue;
    }

    const products = parseSearchResults(html);
    products.forEach(p => p.category = category);
    allProducts.push(...products);

    process.stdout.write(` ${products.length} products\n`);

    await randDelay();
  }

  // ── 3. Deduplicate ──────────────────────────────────────────────────────────

  const unique = deduplicateProducts(allProducts);
  console.log(`\nTotal scraped: ${allProducts.length} → ${unique.length} unique products`);
  stats.scraped = unique.length;

  // ── 4. Match & upsert prices ────────────────────────────────────────────────

  console.log('\nMatching and upserting...');
  const unmatchedNames = [];

  for (const p of unique) {
    const match = findBestMatch(p.name, dbProducts);

    let medicineId;
    if (match) {
      medicineId = match.product.id;
      stats.matched++;
    } else {
      // Create a new medicine entry for unmatched products
      const cat = p.category || guessCategory(p.name);
      try {
        medicineId = await upsertMedicine({
          name: p.name,
          category: cat,
          source: SOURCE,
        });
        if (medicineId) {
          stats.created++;
          // Add to dbProducts so future matches can find it
          dbProducts.push({ id: medicineId, name: p.name, category: cat, norm: normaliseName(p.name) });
        } else {
          unmatchedNames.push(p.name);
          continue;
        }
      } catch (err) {
        console.error(`  ✖ Failed to create medicine "${p.name}": ${err.message}`);
        stats.errors++;
        continue;
      }
    }

    try {
      await upsertPrice({
        medicineId,
        pharmacyName: PHARMACY_NAME,
        pharmacyUrl:  p.url,
        priceGbp:     p.price,
        packSize:     p.packSize,
        imageUrl:     p.imageUrl,
        source:       SOURCE,
      });
      stats.updated++;
    } catch (err) {
      console.error(`  ✖ DB error for "${p.name}": ${err.message}`);
      stats.errors++;
    }
  }

  // ── 5. Summary ──────────────────────────────────────────────────────────────

  console.log('\n── Results ──');
  console.log(`  Scraped:       ${stats.scraped}`);
  console.log(`  Matched to DB: ${stats.matched}`);
  console.log(`  New created:   ${stats.created}`);
  console.log(`  Prices saved:  ${stats.updated}`);
  console.log(`  Errors:        ${stats.errors}`);

  if (unmatchedNames.length > 0) {
    console.log(`\n  Failed to process (first 10):`);
    unmatchedNames.slice(0, 10).forEach(n => console.log(`    - ${n}`));
  }

  await pool.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
