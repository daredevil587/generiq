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
  SELECT COUNT(*) as total, source
  FROM medicines
  GROUP BY source
  ORDER BY total DESC
`);

console.log('Medicines by source:');
result.rows.forEach(r => console.log(`  ${r.source}: ${r.total}`));

const nhs = await pool.query(`
  SELECT COUNT(*) as count FROM medicines WHERE source = 'nhs_dmd_5.1.0'
`);

console.log(`\n✅ Imported ${nhs.rows[0].count} medicines from NHS dm+d OTC`);

const recentOTC = await pool.query(`
  SELECT name FROM medicines WHERE source = 'nhs_dmd_5.1.0' LIMIT 20
`);

console.log('\nSample OTC imported:');
recentOTC.rows.slice(0, 10).forEach(r => console.log(`  - ${r.name}`));

await pool.end();
