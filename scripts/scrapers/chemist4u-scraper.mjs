#!/usr/bin/env node
/**
 * chemist4u-scraper.mjs — Chemist 4 U scraper
 *
 * Scrapes medicines and supplements from chemist-4-u.com
 * Uses fetch + cheerio (no browser needed).
 *
 * Usage: node scripts/scrapers/chemist4u-scraper.mjs
 */

import * as cheerio from 'cheerio';
import {
  pool, loadDbProducts, findBestMatch, upsertPrice, upsertMedicine, sleep,
} from './scraper-utils.mjs';

const PHARMACY_NAME = 'Chemist4U';
const SOURCE        = 'chemist4u';

const BASE = 'https://www.chemist-4-u.com';
const CATEGORIES = [
  // Medicines — condition pages (real URLs from sitemap)
  { url: `${BASE}/pain-relief`,            dbCat: 'medicine' },
  { url: `${BASE}/cold-flu`,               dbCat: 'medicine' },
  { url: `${BASE}/hay-fever-allergies`,    dbCat: 'medicine' },
  { url: `${BASE}/dry-eye`,                dbCat: 'medicine' },
  { url: `${BASE}/ear-infections`,         dbCat: 'medicine' },
  { url: `${BASE}/ear-wax`,                dbCat: 'medicine' },
  { url: `${BASE}/acid-reflux-heartburn`,  dbCat: 'medicine' },
  { url: `${BASE}/constipation`,           dbCat: 'medicine' },
  { url: `${BASE}/diarrhoea`,              dbCat: 'medicine' },
  { url: `${BASE}/nausea`,                 dbCat: 'medicine' },
  { url: `${BASE}/travel-sickness`,        dbCat: 'medicine' },
  { url: `${BASE}/trapped-wind`,           dbCat: 'medicine' },
  { url: `${BASE}/first-aid`,              dbCat: 'medicine' },
  { url: `${BASE}/dental-care`,            dbCat: 'medicine' },
  { url: `${BASE}/insomnia`,               dbCat: 'medicine' },
  { url: `${BASE}/chesty-cough`,           dbCat: 'medicine' },
  { url: `${BASE}/dry-cough`,              dbCat: 'medicine' },
  { url: `${BASE}/sore-throat`,            dbCat: 'medicine' },
  { url: `${BASE}/nasal-congestion`,       dbCat: 'medicine' },
  { url: `${BASE}/athletes-foot`,          dbCat: 'medicine' },
  { url: `${BASE}/thrush`,                 dbCat: 'medicine' },
  { url: `${BASE}/oral-thrush`,            dbCat: 'medicine' },
  { url: `${BASE}/cold-sores`,             dbCat: 'medicine' },
  { url: `${BASE}/diabetes`,               dbCat: 'medicine' },
  { url: `${BASE}/contraception`,          dbCat: 'medicine' },
  { url: `${BASE}/menopause-hrt`,          dbCat: 'medicine' },
  { url: `${BASE}/cystitis-uti`,           dbCat: 'medicine' },
  { url: `${BASE}/haemorrhoids-piles`,     dbCat: 'medicine' },
  { url: `${BASE}/quit-smoking`,           dbCat: 'medicine' },
  { url: `${BASE}/malaria-tablets`,        dbCat: 'medicine' },
  { url: `${BASE}/head-lice`,              dbCat: 'medicine' },
  { url: `${BASE}/threadworms`,            dbCat: 'medicine' },
  { url: `${BASE}/infant-child`,           dbCat: 'medicine' },
  { url: `${BASE}/home-testing`,           dbCat: 'health' },
  // Supplements
  { url: `${BASE}/vitamins-minerals`,      dbCat: 'supplement' },
  { url: `${BASE}/weight-loss`,            dbCat: 'supplement' },
  // Skincare
  { url: `${BASE}/skincare`,               dbCat: 'skincare' },
  { url: `${BASE}/beauty`,                 dbCat: 'skincare' },
  { url: `${BASE}/suncare`,                dbCat: 'skincare' },
  { url: `${BASE}/dry-skin`,               dbCat: 'skincare' },
  { url: `${BASE}/eczema-dermatitis`,      dbCat: 'skincare' },
  { url: `${BASE}/acne`,                   dbCat: 'skincare' },
  { url: `${BASE}/psoriasis`,              dbCat: 'skincare' },
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

function extractProducts(html) {
  const $ = cheerio.load(html);
  const products = [];

  $('li.product-item, .product-item').each((_, card) => {
    const $card = $(card);
    const name = $card.find('.product-item-name a, h3 a').first().text().trim();
    const priceAttr = $card.find('[data-price-amount]').first().attr('data-price-amount');
    const href = $card.find('a[href]').first().attr('href');

    if (!name || !priceAttr || !href) return;

    const price = parseFloat(priceAttr);
    if (isNaN(price) || price <= 0) return;

    const url = href.startsWith('http') ? href : `https://www.chemist-4-u.com${href}`;
    products.push({ name, price, url, size: null });
  });

  // Pagination: Chemist4U uses ?p=N
  const nextPage = $('a.action.next, a[title="Next"]').attr('href');

  return {
    products,
    nextPage: nextPage ? (nextPage.startsWith('http') ? nextPage : `https://www.chemist-4-u.com${nextPage}`) : null,
  };
}

async function main() {
  console.log('\n=== Chemist 4 U Scraper ===\n');

  const dbProducts = await loadDbProducts(['supplement', 'medicine', 'skincare']);
  console.log(`DB products loaded: ${dbProducts.length.toLocaleString()}`);

  const stats = { scraped: 0, matched: 0, updated: 0, created: 0, errors: 0 };

  for (const cat of CATEGORIES) {
    console.log(`\nCategory: ${cat.url.split('.com/')[1]}`);
    let currentUrl = cat.url;

    for (let page = 1; page <= MAX_PAGES; page++) {
      process.stdout.write(`  page ${page}...`);

      try {
        const html = await fetchPage(currentUrl);
        const { products, nextPage } = extractProducts(html);

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
            // Create new product
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
                // Add to dbProducts for future matching
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
