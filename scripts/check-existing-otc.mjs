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

const tests = [
  'Paracetamol 1g effervescent tablets sugar free',
  'Ibuprofen 200mg/5ml oral suspension sugar free',
  'Omeprazole 20mg/5ml oral suspension sugar free',
];

console.log('Checking if OTC medicines already in DB:\n');
for (const name of tests) {
  const res = await pool.query('SELECT id FROM medicines WHERE LOWER(name) = LOWER($1)', [name]);
  console.log(`${name}`);
  console.log(`  ${res.rows.length > 0 ? '✓ Already exists (ID: ' + res.rows[0].id + ')' : '✗ NOT found - would be imported'}\n`);
}

await pool.end();
