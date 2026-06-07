#!/usr/bin/env node
/**
 * Fetch baby, pet, haircare, dental, and sports products from Open Food/Beauty/Pet Facts,
 * then import directly into Cloudflare D1 via wrangler d1 execute.
 *
 * Usage: node scripts/import-open-categories.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root   = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlDir = path.join(root, 'sql');

const SOURCES = [
  {
    name: 'baby',
    category: 'baby',
    source: 'openfoodfacts',
    url: 'https://world.openfoodfacts.org/cgi/search.pl?search_terms=baby+food&json=1&page_size=100',
  },
  {
    name: 'pet',
    category: 'pet',
    source: 'openpetfoodfacts',
    url: 'https://world.openpetfoodfacts.org/cgi/search.pl?action=process&json=1&page_size=200',
  },
  {
    name: 'haircare',
    category: 'haircare',
    source: 'openbeautyfacts',
    url: 'https://world.openbeautyfacts.org/category/hair-care.json?page_size=200',
  },
  {
    name: 'dental',
    category: 'dental',
    source: 'openbeautyfacts',
    url: 'https://world.openbeautyfacts.org/category/dental-care.json?page_size=200',
  },
  {
    name: 'sports',
    category: 'sports',
    source: 'openfoodfacts',
    url: 'https://world.openfoodfacts.org/cgi/search.pl?search_terms=protein+powder+sports&json=1&page_size=100',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clean(s) {
  if (!s) return null;
  const t = s.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
  return t || null;
}

function firstIngredient(text) {
  if (!text) return null;
  return clean(text.split(/[,;]/)[0])?.slice(0, 200) ?? null;
}

function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function subcategoryFromTags(tags, category) {
  if (!Array.isArray(tags)) return null;
  const en = tags.map(t => t.replace(/^[a-z]{2}:/, '').toLowerCase());
  if (category === 'haircare') {
    if (en.some(t => t.includes('shampoo')))         return 'shampoo';
    if (en.some(t => t.includes('conditioner')))     return 'conditioner';
    if (en.some(t => t.includes('hair-mask') || t.includes('hair-treatment'))) return 'treatment';
    if (en.some(t => t.includes('hair-color') || t.includes('hair-dye')))      return 'colour';
    return 'hair-care';
  }
  if (category === 'dental') {
    if (en.some(t => t.includes('toothpaste')))  return 'toothpaste';
    if (en.some(t => t.includes('mouthwash')))   return 'mouthwash';
    if (en.some(t => t.includes('floss')))       return 'floss';
    if (en.some(t => t.includes('whitening')))   return 'whitening';
    return 'dental';
  }
  if (category === 'sports') {
    if (en.some(t => t.includes('protein')))     return 'protein';
    if (en.some(t => t.includes('energy')))      return 'energy';
    if (en.some(t => t.includes('creatine')))    return 'creatine';
    return 'sports';
  }
  if (category === 'baby') {
    if (en.some(t => t.includes('formula')))     return 'formula';
    if (en.some(t => t.includes('snack')))       return 'snacks';
    return 'baby';
  }
  if (category === 'pet') {
    if (en.some(t => t.includes('cat')))         return 'cat';
    if (en.some(t => t.includes('dog')))         return 'dog';
    return 'pet';
  }
  return null;
}

function mapProduct(p, category, source) {
  const name = clean(p.product_name || p.product_name_en || p.product_name_gb);
  if (!name || name.length < 2) return null;
  return {
    name,
    generic:    clean(p.generic_name || p.generic_name_en) || name,
    brands:     clean(p.brands),
    desc:       clean(p.ingredients_text),
    ingredient: firstIngredient(p.ingredients_text),
    sub:        subcategoryFromTags(p.categories_tags, category),
  };
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchProducts(url, label) {
  process.stdout.write(`Fetching ${label}... `);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GeneriQ/1.0 (https://github.com/daredevil587/generiq; contact: yadavuttam587@gmail.com)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const products = data.products || [];
  console.log(`${products.length} products`);
  return products;
}

// ─── Build SQL ────────────────────────────────────────────────────────────────

function buildSQL(category, source, products) {
  const seen = new Set();
  const rows = [];

  for (const p of products) {
    const m = mapProduct(p, category, source);
    if (!m) continue;
    const key = m.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(m);
  }

  if (rows.length === 0) return null;

  const BATCH = 10;
  let sql = `-- ${category}: ${rows.length} products\n\n`;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    sql += `INSERT OR IGNORE INTO medicines (name, generic_name, category, description, active_ingredient, dosage_form, mhra_approved, brand_names, source, gender, subcategory) VALUES\n`;
    sql += batch.map(r =>
      `  (${sqlStr(r.name)}, ${sqlStr(r.generic || r.name)}, ${sqlStr(category)}, ${sqlStr(r.desc || '')}, ${sqlStr(r.ingredient || '')}, '', 0, ${sqlStr(r.brands)}, ${sqlStr(source)}, 'unisex', ${sqlStr(r.sub)})`
    ).join(',\n');
    sql += ';\n';
  }
  return { sql, count: rows.length };
}

// ─── D1 import ────────────────────────────────────────────────────────────────

function importToD1(sqlFile) {
  process.stdout.write(`  Importing to D1... `);
  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'generiq', '--remote', `--file="${sqlFile}"`],
    { cwd: root, encoding: 'utf8', timeout: 120_000, shell: true }
  );
  if (result.status === 0) {
    const match = result.stdout.match(/"Rows written":\s*(\d+)/);
    console.log(`OK (${match?.[1] ?? '?'} rows written)`);
    return true;
  } else {
    const err = (result.stderr || result.stdout || '').split('\n').find(l => l.includes('ERROR') || l.includes('error')) || 'unknown error';
    console.log(`FAILED: ${err.trim()}`);
    return false;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(sqlDir, { recursive: true });
  console.log('Importing new categories into Cloudflare D1...\n');

  for (const { name, category, source, url } of SOURCES) {
    try {
      const products = await fetchProducts(url, name);
      const result   = buildSQL(category, source, products);

      if (!result) {
        console.log(`  No valid products for ${category}, skipping.`);
        continue;
      }

      const file = path.join(sqlDir, `d1-import-${category}.sql`);
      writeFileSync(file, result.sql, 'utf8');
      console.log(`  ${result.count} unique products → ${path.basename(file)}`);
      importToD1(file);

    } catch (err) {
      console.error(`  FAILED ${name}: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
