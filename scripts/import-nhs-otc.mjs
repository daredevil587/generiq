import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseStringPromise } from 'xml2js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const t = line.trim();
  if (t && !t.startsWith('#') && t.includes('=')) {
    const [k, ...vs] = t.split('=');
    process.env[k.trim()] = vs.join('=').trim();
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const knownOTC = [
  'paracetamol', 'acetaminophen',
  'ibuprofen',
  'aspirin',
  'cetirizine',
  'loratadine',
  'omeprazole',
  'ranitidine',
  'loperamide',
  'immodium',
  'senokot', 'senna',
  'glycerol', 'glycerin',
  'psyllium husk',
  'bisacodyl',
  'docusate',
  'cimetidine',
  'famotidine',
  'antacid',
  'heartburn',
  'indigestion',
];

console.log('Parsing NHS dm+d VMP file...');
const xml = readFileSync('./nhs_dmd_extract/f_vmp2_3070526.xml', 'utf8');
const parsed = await parseStringPromise(xml);

const vmps = parsed.VIRTUAL_MED_PRODUCTS.VMPS?.[0].VMP || [];
console.log(`Found ${vmps.length} VMPs total`);

// Find OTC matches
const otcMatches = vmps.filter(vmp => {
  const nm = (vmp.NM?.[0] || '').toLowerCase();
  return knownOTC.some(otc => nm.includes(otc));
});

console.log(`\nFound ${otcMatches.length} potential OTC matches:`);

const toImport = [];
for (const vmp of otcMatches) {
  const name = vmp.NM?.[0];
  const abbrev = vmp.ABBREVNM?.[0];

  if (!name) continue;

  // Check if already in DB
  const existing = await pool.query(
    'SELECT id FROM medicines WHERE LOWER(name) = LOWER($1) LIMIT 1',
    [name]
  );

  if (existing.rows.length === 0) {
    toImport.push({ name, abbrev, source: 'nhs_dmd_5.1.0' });
    console.log(`  ✓ ${name}`);
  }
}

console.log(`\n${toImport.length} new OTC medicines to import`);

// Import
let imported = 0;
for (const med of toImport) {
  await pool.query(
    `INSERT INTO medicines (name, generic_name, category, description, active_ingredient, dosage_form, mhra_approved, source, created_at)
     VALUES ($1, $2, 'medicine', '', '', '', true, $3, NOW())
     ON CONFLICT DO NOTHING`,
    [med.name, med.abbrev || med.name, med.source]
  );
  imported++;
}

console.log(`✅ Imported ${imported} new OTC medicines`);
await pool.end();
