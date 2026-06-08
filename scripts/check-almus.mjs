import pg from 'pg';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,'')]; })
);
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

// Find ALL medicine rows named like Almus Ibuprofen children
const { rows } = await pool.query(`
  SELECT m.id, m.name, pp.pharmacy_name, pp.price_gbp
  FROM medicines m
  LEFT JOIN pharmacy_prices pp ON pp.medicine_id = m.id
  WHERE LOWER(m.name) LIKE '%almus%ibuprofen%'
  ORDER BY m.id, pp.price_gbp
`);

console.log('\n── Almus Ibuprofen — medicine rows + linked prices:');
for (const r of rows) {
  console.log(`  medicine_id=${r.id} | ${(r.pharmacy_name || 'NO PRICE').padEnd(20)} | £${r.price_gbp || '—'} | ${r.name.slice(0,70)}`);
}

// Check children ibuprofen across ALL medicine rows
const { rows: all } = await pool.query(`
  SELECT m.id, m.name, COUNT(DISTINCT pp.pharmacy_name) AS pharmacies,
         STRING_AGG(pp.pharmacy_name || ' £' || pp.price_gbp, ' | ' ORDER BY pp.price_gbp) AS price_list
  FROM medicines m
  LEFT JOIN pharmacy_prices pp ON pp.medicine_id = m.id AND pp.source != 'nhs_drug_tariff'
  WHERE LOWER(m.name) LIKE '%children%ibuprofen%' OR LOWER(m.name) LIKE '%ibuprofen%children%'
  GROUP BY m.id, m.name
  ORDER BY pharmacies DESC, m.name
`);

console.log('\n── All "children ibuprofen" medicines — how many pharmacies per row:');
for (const r of all) {
  console.log(`  [${r.id}] pharmacies=${r.pharmacies} | ${r.name.slice(0,60)}`);
  if (r.price_list) console.log(`         prices: ${r.price_list}`);
}

await pool.end();
