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

const sources = await pool.query(`
  SELECT DISTINCT source, COUNT(*) as count FROM pharmacy_prices GROUP BY source ORDER BY count DESC
`);

console.log('=== Pharmacy Prices by Source ===\n');
let total = 0;
sources.rows.forEach(r => {
  console.log(`${r.source}: ${r.count}`);
  total += parseInt(r.count);
});

console.log(`\nTotal price records: ${total}`);

const medicines = await pool.query('SELECT COUNT(*) as count FROM pharmacy_prices WHERE pharmacy_prices.image_url IS NOT NULL');
console.log(`With images: ${medicines.rows[0].count}`);

await pool.end();
