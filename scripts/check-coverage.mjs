import pg from 'pg';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,'')]; })
);

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

const { rows } = await pool.query(`
  SELECT
    COUNT(DISTINCT m.id) AS total_medicines,
    COUNT(DISTINCT pp.medicine_id) AS with_any_price,
    COUNT(DISTINCT CASE WHEN cnt.n >= 2 THEN pp.medicine_id END) AS with_2plus,
    COUNT(DISTINCT CASE WHEN cnt.n >= 3 THEN pp.medicine_id END) AS with_3plus
  FROM medicines m
  LEFT JOIN pharmacy_prices pp ON pp.medicine_id = m.id AND pp.source != 'nhs_drug_tariff'
  LEFT JOIN (
    SELECT medicine_id, COUNT(DISTINCT pharmacy_name) AS n
    FROM pharmacy_prices WHERE source != 'nhs_drug_tariff'
    GROUP BY medicine_id
  ) cnt ON cnt.medicine_id = m.id
`);

const { rows: pharmacies } = await pool.query(`
  SELECT pharmacy_name, COUNT(DISTINCT medicine_id) AS products
  FROM pharmacy_prices WHERE source != 'nhs_drug_tariff'
  GROUP BY pharmacy_name ORDER BY products DESC
`);

console.log('\n── Coverage ──');
console.log(`  Total medicines:        ${rows[0].total_medicines}`);
console.log(`  Have ≥1 retail price:   ${rows[0].with_any_price}`);
console.log(`  Have ≥2 pharmacies:     ${rows[0].with_2plus}`);
console.log(`  Have ≥3 pharmacies:     ${rows[0].with_3plus}`);

console.log('\n── Products per pharmacy ──');
for (const r of pharmacies) {
  console.log(`  ${r.pharmacy_name.padEnd(25)} ${r.products} products`);
}

await pool.end();
