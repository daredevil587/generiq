#!/usr/bin/env node
/**
 * chemistdirect-scraper.mjs — Chemist Direct scraper
 *
 * Scrapes medicines, supplements, and skincare from chemistdirect.co.uk
 * Uses fetch + cheerio (no browser needed).
 *
 * Usage: node scripts/scrapers/chemistdirect-scraper.mjs
 */

import * as cheerio from 'cheerio';
import {
  pool, loadDbProducts, findBestMatch, upsertPrice, upsertMedicine, sleep,
} from './scraper-utils.mjs';

const PHARMACY_NAME = 'ChemistDirect';
const SOURCE        = 'chemist_direct';

const CATEGORIES = [
  { url: 'https://www.chemistdirect.co.uk/medicines', dbCat: 'medicine' },
  { url: 'https://www.chemistdirect.co.uk/vitamins-supplements', dbCat: 'supplement' },
  { url: 'https://www.chemistdirect.co.uk/beauty-skincare', dbCat: 'skincare' },
  { url: 'https://www.chemistdirect.co.uk/health-wellbeing', dbCat: 'supplement' },
];

const MAX_PAGES = 15;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
};

async function fetchPage(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function extractProducts(html, baseUrl) {
  const $ = cheerio.load(html);
  const products = [];

  // Try JSON-LD structured data first (most reliable)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      const items = data['@type'] === 'ItemList' ? data.itemListElement :
                    Array.isArray(data) ? data : [data];
      for (const item of items) {
        const product = item.item || item;
        if (product['@type'] === 'Product' && product.name) {
          const price = product.offers?.price || product.offers?.lowPrice;
          const url = product.url || product['@id'];
          if (price && url) {
            products.push({
              name: product.name,
              price: parseFloat(price),
              url: url.startsWith('http') ? url : `https://www.chemistdirect.co.uk${url}`,
              size: null,
            });
          }
        }
      }
    } catch {}
  });

  if (products.length > 0) {
    const nextPage = $('a.next, a[rel="next"], .pagination a:contains("Next"), link[rel="next"]').attr('href');
    return { products, nextPage: nextPage ? (nextPage.startsWith('http') ? nextPage : `https://www.chemistdirect.co.uk${nextPage}`) : null };
  }

  // Fallback: try common product card selectors
  const selectors = [
    '.product-item',
    '.product-card',
    '.product-list-item',
    '.products-grid .item',
    '.category-products .product',
    'li.product',
    '[data-product-id]',
    '.grid-item',
  ];

  let $cards = $([]);
  for (const sel of selectors) {
    $cards = $(sel);
    if ($cards.length > 0) break;
  }

  $cards.each((_, card) => {
    const $card = $(card);
    const name = $card.find('.product-name a, .product-item-link, h2 a, h3 a, .product-title a, .product-title').first().text().trim();
    const priceText = $card.find('.price, .product-price, .special-price .price, [data-price]').first().text().trim();
    const href = $card.find('a[href*="/"]').first().attr('href');

    const priceMatch = priceText.match(/£([\d.,]+)/);
    if (!name || !priceMatch || !href) return;

    const price = parseFloat(priceMatch[1].replace(',', ''));
    if (isNaN(price) || price <= 0) return;

    const url = href.startsWith('http') ? href : `https://www.chemistdirect.co.uk${href}`;
    products.push({ name, price, url, size: null });
  });

  const nextPage = $('a.next, a[rel="next"], .pagination a:contains("Next"), link[rel="next"]').attr('href');

  return {
    products,
    nextPage: nextPage ? (nextPage.startsWith('http') ? nextPage : `https://www.chemistdirect.co.uk${nextPage}`) : null,
  };
}

async function main() {
  console.log('\n=== Chemist Direct Scraper ===\n');

  const dbProducts = await loadDbProducts(['supplement', 'medicine', 'skincare']);
  console.log(`DB products loaded: ${dbProducts.length.toLocaleString()}`);

  const stats = { scraped: 0, matched: 0, updated: 0, created: 0, errors: 0 };

  for (const cat of CATEGORIES) {
    console.log(`\nCategory: ${cat.url.split('.co.uk/')[1]}`);
    let currentUrl = cat.url;

    for (let page = 1; page <= MAX_PAGES; page++) {
      process.stdout.write(`  page ${page}...`);

      try {
        const html = await fetchPage(currentUrl);
        const { products, nextPage } = extractProducts(html, cat.url);

        process.stdout.write(` ${products.length} products`);

        if (products.length === 0) {
          process.stdout.write(' (end)\n');
          break;
        }

        stats.scraped += products.length;
        let pageMatched = 0;

        for (const p of products) {
          const match = findBestMatch(p.name, dbProducts);
          if (match) {
            stats.matched++;
            pageMatched++;
            try {
              await upsertPrice({
                medicineId: match.product.id,
                pharmacyName: PHARMACY_NAME,
                pharmacyUrl: p.url,
                priceGbp: p.price,
                packSize: p.size,
                source: SOURCE,
              });
              stats.updated++;
            } catch (e) {
              stats.errors++;
            }
          } else {
            try {
              const newId = await upsertMedicine({
                name: p.name,
                category: cat.dbCat,
                source: SOURCE,
              });
              if (newId) {
                await upsertPrice({
                  medicineId: newId,
                  pharmacyName: PHARMACY_NAME,
                  pharmacyUrl: p.url,
                  priceGbp: p.price,
                  packSize: p.size,
                  source: SOURCE,
                });
                stats.created++;
                stats.updated++;
                dbProducts.push({ id: newId, name: p.name, category: cat.dbCat, norm: p.name.toLowerCase() });
              }
            } catch (e) {
              stats.errors++;
            }
          }
        }

        process.stdout.write(` matched:${pageMatched}\n`);

        if (!nextPage || products.length < 10) {
          process.stdout.write('  (last page)\n');
          break;
        }

        currentUrl = nextPage;
        await sleep(1000 + Math.random() * 1500);
      } catch (err) {
        process.stdout.write(` [error: ${err.message}]\n`);
        break;
      }
    }
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
