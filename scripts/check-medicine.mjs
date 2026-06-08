import pg from 'pg';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,'')]; })
);
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

const search = process.argv[2] || 'ibuprofen';

// Find the medicine
const { rows: medicines } = await pool.query(
  `SELECT id, name, generic_name, active_ingredient, category FROM medicines WHERE LOWER(name) LIKE $1 LIMIT 5`,
  [`%${search.toLowerCase()}%`]
);
console.log('\n── Medicines matching:', search);
for (const m of medicines) console.log(`  [${m.id}] ${m.name} | generic: ${m.generic_name} | ingredient: ${m.active_ingredient}`);

if (medicines[0]) {
  const { rows: prices } = await pool.query(
    `SELECT pharmacy_name, price_gbp, pharmacy_url FROM pharmacy_prices WHERE medicine_id = $1 ORDER BY price_gbp`,
    [medicines[0].id]
  );
  console.log(`\n── Prices for [${medicines[0].id}] ${medicines[0].name}:`);
  for (const p of prices) console.log(`  ${p.pharmacy_name.padEnd(25)} £${p.price_gbp}  ${p.pharmacy_url || '(no url)'}`);

  const { rows: ingredients } = await pool.query(
    `SELECT ingredient_name, quantity, is_active FROM ingredients WHERE medicine_id = $1`,
    [medicines[0].id]
  );
  console.log(`\n── Ingredients:`);
  for (const i of ingredients) console.log(`  ${i.is_active ? '[active]' : '[inactive]'} ${i.ingredient_name} ${i.quantity || ''}`);

  // Find all DB medicines with same active ingredient
  if (medicines[0].active_ingredient || ingredients[0]) {
    const ing = ingredients.find(i => i.is_active)?.ingredient_name || medicines[0].active_ingredient;
    if (ing) {
      const { rows: alts } = await pool.query(
        `SELECT m.id, m.name, MIN(pp.price_gbp) AS min_price, COUNT(DISTINCT pp.pharmacy_name) AS pharmacies
         FROM medicines m
         LEFT JOIN pharmacy_prices pp ON pp.medicine_id = m.id AND pp.source != 'nhs_drug_tariff'
         LEFT JOIN ingredients i ON i.medicine_id = m.id AND LOWER(i.ingredient_name) = $1
         WHERE LOWER(m.active_ingredient) = $1 OR i.medicine_id IS NOT NULL
         GROUP BY m.id, m.name
         ORDER BY min_price ASC NULLS LAST
         LIMIT 10`,
        [ing.toLowerCase()]
      );
      console.log(`\n── All DB medicines with ingredient "${ing}":`);
      for (const a of alts) console.log(`  [${a.id}] ${a.name} | from £${a.min_price || 'no price'} | ${a.pharmacies} pharmacies`);
    }
  }
}

// Also show what scraped products contain "ibuprofen" in their name
const { rows: scraped } = await pool.query(
  `SELECT pharmacy_name, m.name, pp.price_gbp
   FROM pharmacy_prices pp
   JOIN medicines m ON m.id = pp.medicine_id
   WHERE LOWER(m.name) LIKE '%ibuprofen%' AND LOWER(m.name) LIKE '%children%'
   ORDER BY pp.price_gbp ASC
   LIMIT 15`
);
console.log(`\n── All scraped "children ibuprofen" products:`);
for (const r of scraped) console.log(`  ${r.pharmacy_name.padEnd(25)} £${r.price_gbp}  ${r.name}`);

await pool.end();
