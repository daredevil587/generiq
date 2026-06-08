import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const envTxt = readFileSync(path.join(root, '.env.local'), 'utf8');
for (const line of envTxt.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const { Pool } = require('pg');

function toAscii(s) {
  return s
    .replace(/—/g, '-').replace(/–/g, '-').replace(/…/g, '...')
    .replace(/‘/g, "'").replace(/’/g, "'")
    .replace(/“/g, '"').replace(/”/g, '"')
    .replace(/ /g, ' ').replace(/°/g, ' degrees')
    .replace(/µ/g, 'u').replace(/[^\x00-\x7F]/g, '').trim();
}

function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === 'number') return isFinite(v) ? String(v) : 'NULL';
  return `'${toAscii(String(v)).replace(/'/g, "''")}'`;
}

const cols = ['id','name','generic_name','category','description','active_ingredient','dosage_form',
              'mhra_approved','brand_names','bnf_code','atc_code','source','created_at','gender','subcategory'];

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
const { rows } = await pool.query(`SELECT ${cols.join(',')} FROM medicines ORDER BY id LIMIT 100`);
await pool.end();

console.log(`Scanning ${rows.length} rows for SQL-breaking values...`);
let problems = 0;
for (const row of rows) {
  for (const col of cols) {
    const v = row[col];
    if (!v || typeof v !== 'string') continue;
    const ascii = toAscii(v);
    // Check for bytes outside printable ASCII range AFTER toAscii
    for (let i = 0; i < ascii.length; i++) {
      const code = ascii.charCodeAt(i);
      if (code < 0x20 || code > 0x7E) {
        console.log(`BAD CHAR id=${row.id} col=${col} pos=${i} code=0x${code.toString(16)}`);
        console.log(`  context: ${JSON.stringify(ascii.slice(Math.max(0,i-10), i+10))}`);
        problems++;
      }
    }
  }
}

if (problems === 0) {
  console.log('No bad chars found in first 100 rows after toAscii.');
  // Write first 100 rows as a single INSERT to test
  const sql = `INSERT OR IGNORE INTO medicines (${cols.join(', ')}) VALUES\n` +
    rows.map(r => `  (${cols.map(c => sqlVal(r[c])).join(', ')})`).join(',\n') + ';\n';
  writeFileSync(path.join(root, 'sql', 'test-rows-100.sql'), sql, 'utf8');
  console.log(`Written test-rows-100.sql (${(Buffer.byteLength(sql)/1024).toFixed(1)} KB)`);
}
