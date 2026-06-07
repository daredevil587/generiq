import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  const env = readFileSync(path.join(root, '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) { const v = m[2].trim().replace(/^["']|["']$/g, ''); if (!process.env[m[1]]) process.env[m[1]] = v; }
  }
} catch {}

const { Pool } = require('pg');
const BATCH = 50;

function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (v instanceof Date) return `'${v.toISOString().replace(/'/g, "''")}'`;
  if (typeof v === 'number') return isFinite(v) ? String(v) : 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function run(tableName, fileName, columns) {
  console.log(`Exporting ${tableName}...`);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  const { rows } = await pool.query(`SELECT ${columns.join(',')} FROM ${tableName} ORDER BY id`);
  await pool.end();

  let body = `-- ${tableName}: ${rows.length} rows\n\n`;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    body += `INSERT OR IGNORE INTO ${tableName} (${columns.join(', ')}) VALUES\n`;
    body += batch.map(r => `  (${columns.map(c => sqlVal(r[c])).join(', ')})`).join(',\n') + ';\n';
  }

  const out = path.join(root, 'sql', fileName);
  writeFileSync(out, body, 'utf8');
  const mb = (Buffer.byteLength(body, 'utf8') / 1024 / 1024).toFixed(2);
  console.log(`  -> ${fileName}  ${mb} MB`);
}

await run('pharmacy_prices', 'd1-data-prices.sql', [
  'id','medicine_id','pharmacy_name','pharmacy_url','price_gbp',
  'in_stock','delivery_info','pack_size','strength','last_updated',
  'source','offer_text','image_url',
]);

await run('ingredients', 'd1-data-ingredients.sql', [
  'id','medicine_id','ingredient_name','quantity','is_active',
]);

console.log('Done.');
