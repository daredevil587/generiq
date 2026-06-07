#!/usr/bin/env node
/**
 * Export Railway PostgreSQL data to Cloudflare D1-compatible SQL.
 * Writes one file per table; auto-splits tables > 4.5 MB into numbered parts.
 *
 * Usage:   node scripts/export-to-d1.mjs
 * Output:  sql/d1-data-medicines.sql  (or -1/-2/-3 if split needed)
 *          sql/d1-data-prices.sql
 *          sql/d1-data-ingredients.sql
 *
 * Requires DATABASE_URL in .env.local
 */

import { createRequire } from 'module';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const sqlDir = path.join(root, 'sql');

// Load .env.local
try {
  const env = readFileSync(path.join(root, '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) {
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  }
} catch { /* no .env.local — rely on process.env */ }

const { Pool } = require('pg');

function makePool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    keepAlive: true,
    max: 1,
  });
}

const BATCH      = 10;               // rows per INSERT statement
const MAX_BYTES  = 500 * 1024;       // 500 KB — small enough to process within wrangler's poll timeout

// D1's SQL uploader mishandles UTF-8 multi-byte continuation bytes (e.g. 0x94
// from em-dash U+2014 = E2 80 94). Normalise everything to 7-bit ASCII so the
// exported SQL is unambiguous for any encoding path wrangler takes.
function toAscii(s) {
  return s
    .replace(/—/g, '-')   // em dash        —  → -
    .replace(/–/g, '-')   // en dash         –  → -
    .replace(/‒/g, '-')   // figure dash     ‒  → -
    .replace(/‐/g, '-')   // hyphen          ‐  → -
    .replace(/…/g, '...') // ellipsis        …  → ...
    .replace(/‘/g, "'")   // left  ' quote   '  → '
    .replace(/’/g, "'")   // right ' quote   '  → '
    .replace(/“/g, '"')   // left  " quote   "  → "
    .replace(/”/g, '"')   // right " quote   "  → "
    .replace(/ /g, ' ')   // non-breaking space → space
    .replace(/°/g, ' degrees') // degree sign
    .replace(/µ/g, 'u')   // micro sign µ → u
    .replace(/é/g, 'e')   // é → e
    .replace(/è/g, 'e')   // è → e
    .replace(/ê/g, 'e')   // ê → e
    .replace(/ë/g, 'e')   // ë → e
    .replace(/à/g, 'a')   // à → a
    .replace(/â/g, 'a')   // â → a
    .replace(/ä/g, 'a')   // ä → a
    .replace(/ö/g, 'o')   // ö → o
    .replace(/ü/g, 'u')   // ü → u
    .replace(/ß/g, 'ss')  // ß → ss
    .replace(/ç/g, 'c')   // ç → c
    .replace(/ñ/g, 'n')   // ñ → n
    .replace(/[^\x00-\x7F]/g, '') // strip any remaining non-ASCII
    .trim();
}

function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === 'number') return isFinite(v) ? String(v) : 'NULL';
  return `'${toAscii(String(v)).replace(/'/g, "''")}'`;
}

function buildInserts(tableName, columns, rows) {
  let out = '';
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    out += `INSERT OR IGNORE INTO ${tableName} (${columns.join(', ')}) VALUES\n`;
    out += batch.map(row =>
      `  (${columns.map(c => sqlVal(row[c])).join(', ')})`
    ).join(',\n');
    out += ';\n';
  }
  return out;
}

function writeFiles(baseName, header, body) {
  mkdirSync(sqlDir, { recursive: true });

  const full = header + body;
  const fullBytes = Buffer.byteLength(full, 'utf8');

  if (fullBytes <= MAX_BYTES) {
    const file = path.join(sqlDir, `${baseName}.sql`);
    writeFileSync(file, full, 'utf8');
    const mb = (fullBytes / 1024 / 1024).toFixed(2);
    console.log(`  ${path.basename(file)}  ${mb} MB`);
    return;
  }

  // Split on STATEMENT boundaries only (never mid-INSERT).
  // Each element ends with ';\n' so it is a complete SQL statement.
  const statements = body.split(/(?<=;\n)/).filter(s => s.trim());
  let chunk = '';
  let part  = 1;

  const flush = () => {
    if (!chunk.trim()) return;
    const content = header + chunk;
    const file    = path.join(sqlDir, `${baseName}-${part}.sql`);
    writeFileSync(file, content, 'utf8');
    const mb = (Buffer.byteLength(content, 'utf8') / 1024 / 1024).toFixed(2);
    console.log(`  ${path.basename(file)}  ${mb} MB`);
    chunk = '';
    part++;
  };

  for (const stmt of statements) {
    const candidate = chunk + stmt;
    if (Buffer.byteLength(header + candidate, 'utf8') > MAX_BYTES && chunk.length > 0) {
      flush();
    }
    chunk += stmt;
  }
  if (chunk.trim()) flush();
}

async function exportTable(tableName, fileBase, columns) {
  console.error(`Exporting ${tableName}...`);
  // Fresh connection per table — avoids Railway proxy idle-timeout resets
  const pool = makePool();
  let rows;
  try {
    ({ rows } = await pool.query(
      `SELECT ${columns.join(', ')} FROM ${tableName} ORDER BY id`
    ));
  } catch (err) {
    await pool.end();
    if (err.code === '42P01') {
      console.error(`  ${tableName}: table does not exist — skipping`);
      return;
    }
    throw err;
  }
  await pool.end();

  if (rows.length === 0) {
    console.error(`  ${tableName}: 0 rows — skipping`);
    return;
  }
  console.error(`  ${tableName}: ${rows.length} rows`);

  const header = `-- ${tableName}: ${rows.length} rows\n` +
                 `-- Apply with: wrangler d1 execute generiq --remote --file=sql/${fileBase}.sql\n\n`;
  const body   = buildInserts(tableName, columns, rows);

  writeFiles(fileBase, header, body);
}

async function main() {
  mkdirSync(sqlDir, { recursive: true });
  console.log('\nOutput files:');

  await exportTable('medicines', 'd1-data-medicines', [
    'id', 'name', 'generic_name', 'category', 'description',
    'active_ingredient', 'dosage_form', 'mhra_approved', 'brand_names',
    'bnf_code', 'atc_code', 'source', 'created_at', 'gender', 'subcategory',
  ]);

  await exportTable('pharmacy_prices', 'd1-data-prices', [
    'id', 'medicine_id', 'pharmacy_name', 'pharmacy_url', 'price_gbp',
    'in_stock', 'delivery_info', 'pack_size', 'strength', 'last_updated',
    'source', 'offer_text', 'image_url',
  ]);

  await exportTable('ingredients', 'd1-data-ingredients', [
    'id', 'medicine_id', 'ingredient_name', 'quantity', 'is_active',
  ]);

  await exportTable('watchlist', 'd1-data-watchlist', [
    'id', 'email', 'medicine_id', 'current_price_gbp', 'confirmed', 'token', 'created_at',
  ]);

  console.log('\nDone. Run in order:');
  console.log('  npx wrangler d1 execute generiq --remote --file=sql/d1-data-medicines-1.sql');
  console.log('  npx wrangler d1 execute generiq --remote --file=sql/d1-data-medicines-2.sql');
  console.log('  npx wrangler d1 execute generiq --remote --file=sql/d1-data-medicines-3.sql');
  console.log('  npx wrangler d1 execute generiq --remote --file=sql/d1-data-prices.sql');
  console.log('  npx wrangler d1 execute generiq --remote --file=sql/d1-data-ingredients.sql');
}

main().catch(err => { console.error(err); process.exit(1); });
