import pg from 'pg';
import { readFileSync } from 'fs';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const t = line.trim();
  if (t && !t.startsWith('#') && t.includes('=')) {
    const [k, ...vs] = t.split('=');
    process.env[k.trim()] = vs.join('=').trim();
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const result = await pool.query(`
  SELECT COUNT(DISTINCT medicine_id) as count, source FROM pharmacy_prices 
  WHERE source = 'hb_category_scraper'
  GROUP BY source
`);

console.log('H&B scraper results:');
if (result.rows.length > 0) {
  console.log(`  Products with H&B prices: ${result.rows[0].count}`);
} else {
  console.log('  No H&B products found');
}

const detail = await pool.query(`
  SELECT pharmacy_name, COUNT(*) as count FROM pharmacy_prices
  WHERE source = 'hb_category_scraper'
  GROUP BY pharmacy_name
`);

console.log('\nBy pharmacy:');
detail.rows.forEach(r => console.log(`  ${r.pharmacy_name}: ${r.count}`));

await pool.end();
