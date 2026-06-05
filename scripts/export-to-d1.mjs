#!/usr/bin/env node
/**
 * Export Railway PostgreSQL data to Cloudflare D1-compatible SQL.
 *
 * Usage:
 *   node scripts/export-to-d1.mjs
 *
 * Output: sql/d1-data.sql  (ready for: wrangler d1 execute generiq --file=sql/d1-data.sql)
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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (v instanceof Date) return `'${v.toISOString().replace("'", "''")}'`;
  if (typeof v === 'number') return isFinite(v) ? String(v) : 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function exportTable(tableName, columns) {
  console.error(`Exporting ${tableName}...`);
  const { rows } = await pool.query(
    `SELECT ${columns.join(', ')} FROM ${tableName} ORDER BY id`
  );
  if (rows.length === 0) {
    console.error(`  ${tableName}: 0 rows`);
    return '';
  }

  const BATCH = 500;
  let out = `-- ${tableName}: ${rows.length} rows\n`;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    out += `INSERT OR IGNORE INTO ${tableName} (${columns.join(', ')}) VALUES\n`;
    out += batch
      .map(row => `  (${columns.map(c => sqlVal(row[c])).join(', ')})`)
      .join(',\n');
    out += ';\n';
  }
  console.error(`  ${tableName}: ${rows.length} rows exported`);
  return out + '\n';
}

async function main() {
  let sql = `-- GeneriQ D1 data export generated ${new Date().toISOString()}\n`;
  sql += `-- Apply with: wrangler d1 execute generiq --file=sql/d1-data.sql\n\n`;
  sql += `PRAGMA journal_mode=WAL;\n\n`;

  sql += await exportTable('medicines', [
    'id', 'name', 'generic_name', 'category', 'description',
    'active_ingredient', 'dosage_form', 'mhra_approved', 'brand_names',
    'bnf_code', 'atc_code', 'source', 'created_at', 'gender', 'subcategory',
  ]);

  sql += await exportTable('pharmacy_prices', [
    'id', 'medicine_id', 'pharmacy_name', 'pharmacy_url', 'price_gbp',
    'in_stock', 'delivery_info', 'pack_size', 'strength', 'last_updated',
    'source', 'offer_text', 'image_url',
  ]);

  sql += await exportTable('ingredients', [
    'id', 'medicine_id', 'ingredient_name', 'quantity', 'is_active',
  ]);

  sql += await exportTable('watchlist', [
    'id', 'email', 'medicine_id', 'current_price_gbp', 'confirmed', 'token', 'created_at',
  ]);

  mkdirSync(path.join(root, 'sql'), { recursive: true });
  const out = path.join(root, 'sql', 'd1-data.sql');
  writeFileSync(out, sql, 'utf8');
  const mb = (Buffer.byteLength(sql, 'utf8') / 1024 / 1024).toFixed(1);
  console.error(`\nWrote ${out} (${mb} MB)`);

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
