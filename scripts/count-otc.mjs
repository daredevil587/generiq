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

const otcNames = ['Paracetamol', 'Ibuprofen', 'Aspirin', 'Omeprazole', 'Cetirizine', 'Loperamide'];

console.log('OTC medicines in database:\n');
for (const name of otcNames) {
  const res = await pool.query(
    "SELECT COUNT(*) as count FROM medicines WHERE LOWER(name) LIKE LOWER($1)",
    [`%${name}%`]
  );
  console.log(`${name}: ${res.rows[0].count} variants`);
}

console.log('\n--- Total medicines with retail prices ---');
const prices = await pool.query(`
  SELECT COUNT(DISTINCT pp.medicine_id) as medicines_with_prices
  FROM pharmacy_prices pp
  WHERE pp.source != 'nhs_drug_tariff'
`);
console.log(`Medicines with pharmacy prices: ${prices.rows[0].medicines_with_prices}`);

await pool.end();
