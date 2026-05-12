#!/usr/bin/env node
/**
 * generate-prices.mjs
 *
 * Generates realistic estimated retail prices for bulk-imported supplements
 * and skincare products that currently have no pharmacy_prices entries.
 *
 * Prices are based on typical UK retail ranges per category.
 * source='estimated' in pharmacy_prices distinguishes them from scraped data.
 * pharmacy_url links to the retailer's search page so click-throughs still work.
 *
 * Usage: node scripts/generate-prices.mjs
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (t && !t.startsWith('#') && t.includes('=')) {
    const [k, ...vs] = t.split('=');
    process.env[k.trim()] = vs.join('=').trim();
  }
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BATCH_SIZE = 500;

// ── Retailer configs ──────────────────────────────────────────────────────────

const SUPP_RETAILERS = [
  { name: 'Holland & Barrett', searchBase: 'https://www.hollandandbarrett.com/search/?query=', mult: 1.00, delivery: 'Free over £25' },
  { name: 'Boots',             searchBase: 'https://www.boots.com/search?q=',                  mult: 1.12, delivery: 'Free click & collect' },
  { name: 'Amazon UK',         searchBase: 'https://www.amazon.co.uk/s?k=',                    mult: 0.88, delivery: 'Prime delivery' },
];

const SKIN_RETAILERS = [
  { name: 'Boots',     searchBase: 'https://www.boots.com/search?q=',             mult: 1.00, delivery: 'Free click & collect' },
  { name: 'Superdrug', searchBase: 'https://www.superdrug.com/search?query=',     mult: 0.94, delivery: 'Free over £10' },
  { name: 'Amazon UK', searchBase: 'https://www.amazon.co.uk/s?k=',              mult: 0.86, delivery: 'Prime delivery' },
];

// ── Price range helpers ───────────────────────────────────────────────────────

function rand(min, max) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function roundRetail(price) {
  // Snap to .49 or .99 endings — realistic UK retail
  const base = Math.floor(price);
  const frac = price - base;
  if (frac < 0.25) return base - 0.01 < 0 ? 0.99 : (base - 0.01);
  if (frac < 0.75) return base + 0.49;
  return base + 0.99;
}

function basePrice(m) {
  const text = (m.category + ' ' + m.description + ' ' + (m.dosage_form || '')).toLowerCase();

  if (m.category === 'supplement') {
    if (text.includes('protein') || text.includes('whey') || text.includes('creatine'))   return rand(18, 38);
    if (text.includes('meal replacement'))                                                  return rand(20, 42);
    if (text.includes('omega') || text.includes('fish oil') || text.includes('krill'))     return rand(10, 24);
    if (text.includes('probiotic'))                                                         return rand(12, 28);
    if (text.includes('collagen'))                                                          return rand(14, 32);
    if (text.includes('vitamin d') || text.includes('vitamin b'))                          return rand(6, 16);
    if (text.includes('vitamin'))                                                           return rand(7, 18);
    if (text.includes('mineral') || text.includes('zinc') || text.includes('magnesium') ||
        text.includes('calcium') || text.includes('iron'))                                  return rand(6, 16);
    if (text.includes('sport') || text.includes('energy') || text.includes('amino'))       return rand(14, 34);
    if (text.includes('herbal') || text.includes('plant'))                                 return rand(8, 20);
    return rand(8, 20);
  }

  // skincare
  if (text.includes('retinol') || text.includes('tretinoin'))                              return rand(16, 48);
  if (text.includes('vitamin c serum') || text.includes('niacinamide') ||
      text.includes('hyaluronic'))                                                          return rand(12, 40);
  if (text.includes('serum'))                                                               return rand(12, 38);
  if (text.includes('eye cream') || text.includes('eye serum') || text.includes('eye care')) return rand(12, 36);
  if (text.includes('night cream') || text.includes('day cream') || text.includes('neck')) return rand(10, 30);
  if (text.includes('sunscreen') || text.includes('spf') || text.includes('sun protect'))  return rand(8, 24);
  if (text.includes('moistur'))                                                             return rand(8, 28);
  if (text.includes('cleanser') || text.includes('face wash') || text.includes('wash'))   return rand(6, 18);
  if (text.includes('toner') || text.includes('micellar'))                                 return rand(6, 18);
  if (text.includes('face mask') || text.includes('exfoliant') || text.includes('scrub')) return rand(7, 22);
  if (text.includes('shampoo') || text.includes('conditioner') || text.includes('hair'))  return rand(5, 16);
  if (text.includes('body lotion') || text.includes('body cream') || text.includes('body oil')) return rand(5, 18);
  if (text.includes('perfume') || text.includes('fragrance') || text.includes('aftershave')) return rand(18, 60);
  if (text.includes('foundation') || text.includes('concealer') || text.includes('primer')) return rand(8, 30);
  if (text.includes('lipstick') || text.includes('lip gloss') || text.includes('lip'))    return rand(6, 22);
  if (text.includes('mascara') || text.includes('eyeliner') || text.includes('eyeshadow')) return rand(7, 22);
  if (text.includes('deodorant') || text.includes('antiperspirant'))                       return rand(3, 10);
  if (text.includes('shower gel') || text.includes('body wash') || text.includes('soap')) return rand(3, 10);
  if (text.includes('toothpaste') || text.includes('mouthwash') || text.includes('dental')) return rand(3, 10);
  return rand(8, 22);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== GeneriQ: Generate Supplement/Skincare Prices ===\n');

  // Find all supplement/skincare products with no price entries
  const { rows: products } = await pool.query(`
    SELECT m.id, m.name, m.category, m.description, m.dosage_form
    FROM   medicines m
    WHERE  m.category IN ('supplement', 'skincare')
    AND    NOT EXISTS (
             SELECT 1 FROM pharmacy_prices pp WHERE pp.medicine_id = m.id
           )
    ORDER  BY m.id
  `);

  console.log(`Products needing prices: ${products.length.toLocaleString()}`);
  if (products.length === 0) {
    console.log('Nothing to do.');
    await pool.end();
    return;
  }

  const INSERT_PRICE = `
    INSERT INTO pharmacy_prices
      (medicine_id, pharmacy_name, pharmacy_url, price_gbp,
       in_stock, delivery_info, pack_size, source)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT DO NOTHING
  `;

  let inserted = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    for (const m of batch) {
      const retailers = m.category === 'supplement' ? SUPP_RETAILERS : SKIN_RETAILERS;
      const base = basePrice(m);
      const slug = encodeURIComponent(m.name.slice(0, 60));

      for (const r of retailers) {
        const price = roundRetail(base * r.mult);
        const url   = r.searchBase + slug;
        try {
          await pool.query(INSERT_PRICE, [
            m.id, r.name, url, price, true, r.delivery, null, 'estimated',
          ]);
          inserted++;
        } catch (_) { /* skip duplicate */ }
      }
    }

    const done = Math.min(i + BATCH_SIZE, products.length);
    process.stdout.write(`\r  Processed ${done.toLocaleString()} / ${products.length.toLocaleString()} products (${inserted.toLocaleString()} prices inserted)`);
  }

  console.log('\n');

  // Final summary
  const { rows } = await pool.query(`
    SELECT m.category, COUNT(DISTINCT m.id) AS products, COUNT(pp.id) AS prices
    FROM   medicines m
    JOIN   pharmacy_prices pp ON pp.medicine_id = m.id
    WHERE  m.category IN ('supplement', 'skincare')
    GROUP  BY m.category ORDER BY m.category
  `);

  console.log('── Final counts ──');
  for (const r of rows) {
    console.log(`  ${r.category}: ${Number(r.products).toLocaleString()} products, ${Number(r.prices).toLocaleString()} price entries`);
  }

  await pool.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
