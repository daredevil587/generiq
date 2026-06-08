#!/usr/bin/env node
/**
 * sync-pg-to-d1.mjs
 * Export data from PostgreSQL (Railway) and generate SQL files for D1 import.
 * Then apply them to the local D1 database.
 */

import pg from 'pg';
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');

// Load .env.local
for (const line of readFileSync(join(rootDir, '.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (t && !t.startsWith('#') && t.includes('=')) {
    const [k, ...vs] = t.split('=');
    process.env[k.trim()] = vs.join('=').trim();
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  return "'" + String(val).replace(/'/g, "''") + "'";
}

async function main() {
  console.log('Connecting to PostgreSQL...');
  
  // Get counts
  const counts = await pool.query(`
    SELECT 'medicines' as tbl, COUNT(*)::int as cnt FROM medicines
    UNION ALL SELECT 'prices', COUNT(*)::int FROM pharmacy_prices
    UNION ALL SELECT 'ingredients', COUNT(*)::int FROM ingredients
  `);
  console.log('\nPostgreSQL data:');
  counts.rows.forEach(r => console.log(`  ${r.tbl}: ${Number(r.cnt).toLocaleString()}`));

  // Export new prices (sources from scrapers)
  console.log('\nExporting prices from scrapers...');
  const { rows: prices } = await pool.query(`
    SELECT medicine_id, pharmacy_name, pharmacy_url, price_gbp, in_stock, 
           pack_size, strength, source, image_url, last_updated
    FROM pharmacy_prices 
    WHERE source IN ('chemist4u', 'lloyds_pharmacy', 'holland_barrett', 'amazon_uk', 'chemist_direct')
    ORDER BY medicine_id
  `);
  console.log(`  Found ${prices.length} scraper prices`);

  if (prices.length > 0) {
    // Build SQL for prices
    const chunks = [];
    for (let i = 0; i < prices.length; i += 50) {
      const batch = prices.slice(i, i + 50);
      const values = batch.map(p => 
        `(${escapeSql(p.medicine_id)}, ${escapeSql(p.pharmacy_name)}, ${escapeSql(p.pharmacy_url)}, ${escapeSql(p.price_gbp)}, ${escapeSql(p.in_stock ? 1 : 0)}, ${escapeSql(p.pack_size)}, ${escapeSql(p.strength)}, ${escapeSql(p.source)}, ${escapeSql(p.image_url)}, ${escapeSql(p.last_updated?.toISOString?.() || null)})`
      ).join(',\n  ');
      chunks.push(`INSERT OR REPLACE INTO pharmacy_prices (medicine_id, pharmacy_name, pharmacy_url, price_gbp, in_stock, pack_size, strength, source, image_url, last_updated) VALUES\n  ${values};`);
    }
    const pricesSql = chunks.join('\n');
    writeFileSync(join(rootDir, 'sql', 'd1-sync-prices.sql'), pricesSql);
    console.log(`  Written to sql/d1-sync-prices.sql (${chunks.length} batches)`);
  }

  // Export new medicines that were created by scrapers
  console.log('\nExporting new medicines from scrapers...');
  const { rows: meds } = await pool.query(`
    SELECT id, name, generic_name, category, description, active_ingredient, 
           dosage_form, mhra_approved, brand_names, bnf_code, atc_code, source,
           created_at, gender, subcategory, barcode
    FROM medicines 
    WHERE source IN ('chemist4u', 'lloyds_pharmacy', 'amazon_uk', 'chemist_direct')
    ORDER BY id
  `);
  console.log(`  Found ${meds.length} new medicines from scrapers`);

  if (meds.length > 0) {
    const chunks = [];
    for (let i = 0; i < meds.length; i += 50) {
      const batch = meds.slice(i, i + 50);
      const values = batch.map(m =>
        `(${escapeSql(m.id)}, ${escapeSql(m.name)}, ${escapeSql(m.generic_name)}, ${escapeSql(m.category)}, ${escapeSql(m.description)}, ${escapeSql(m.active_ingredient)}, ${escapeSql(m.dosage_form)}, ${escapeSql(m.mhra_approved ? 1 : 0)}, ${escapeSql(m.brand_names)}, ${escapeSql(m.bnf_code)}, ${escapeSql(m.atc_code)}, ${escapeSql(m.source)}, ${escapeSql(m.created_at?.toISOString?.() || null)}, ${escapeSql(m.gender)}, ${escapeSql(m.subcategory)}, ${escapeSql(m.barcode)})`
      ).join(',\n  ');
      chunks.push(`INSERT OR IGNORE INTO medicines (id, name, generic_name, category, description, active_ingredient, dosage_form, mhra_approved, brand_names, bnf_code, atc_code, source, created_at, gender, subcategory, barcode) VALUES\n  ${values};`);
    }
    const medsSql = chunks.join('\n');
    writeFileSync(join(rootDir, 'sql', 'd1-sync-medicines.sql'), medsSql);
    console.log(`  Written to sql/d1-sync-medicines.sql (${chunks.length} batches)`);
  }

  // Price summary by source
  console.log('\n── Price summary by source ──');
  const { rows: summary } = await pool.query(`
    SELECT source, COUNT(*) as cnt 
    FROM pharmacy_prices 
    GROUP BY source 
    ORDER BY cnt DESC
  `);
  summary.forEach(r => console.log(`  ${r.source}: ${Number(r.cnt).toLocaleString()}`));

  await pool.end();

  // Now apply to local D1
  console.log('\n── Syncing to local D1 ──');
  
  if (meds.length > 0) {
    console.log('  Importing new medicines...');
    try {
      execSync('npx wrangler d1 execute generiq --local --file=sql/d1-sync-medicines.sql', { 
        cwd: rootDir, stdio: 'pipe', timeout: 60000 
      });
      console.log(`  ✓ ${meds.length} medicines imported`);
    } catch (e) {
      console.log(`  ✗ Medicine import error: ${e.message.slice(0, 200)}`);
    }
  }

  if (prices.length > 0) {
    console.log('  Importing scraper prices...');
    try {
      execSync('npx wrangler d1 execute generiq --local --file=sql/d1-sync-prices.sql', { 
        cwd: rootDir, stdio: 'pipe', timeout: 60000 
      });
      console.log(`  ✓ ${prices.length} prices imported`);
    } catch (e) {
      console.log(`  ✗ Price import error: ${e.message.slice(0, 200)}`);
    }
  }

  // Verify D1 counts
  console.log('\n── Local D1 verification ──');
  try {
    const result = execSync(
      'npx wrangler d1 execute generiq --local --command="SELECT \'medicines\' as tbl, COUNT(*) as cnt FROM medicines UNION ALL SELECT \'prices\', COUNT(*) FROM pharmacy_prices UNION ALL SELECT \'ingredients\', COUNT(*) FROM ingredients"',
      { cwd: rootDir, encoding: 'utf8', timeout: 30000 }
    );
    const match = result.match(/"results":\s*\[([\s\S]*?)\]/);
    if (match) {
      const data = JSON.parse('[' + match[1] + ']');
      data.forEach(r => console.log(`  ${r.tbl}: ${r.cnt}`));
    }
  } catch (e) {
    console.log('  Verification failed:', e.message.slice(0, 100));
  }

  console.log('\nSync complete!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
