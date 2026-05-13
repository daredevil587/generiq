/**
 * Audit what medicines have retail prices vs not.
 */
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  // Overall counts
  const total      = await pool.query(`SELECT COUNT(*) FROM medicines`);
  const hasNhs     = await pool.query(`SELECT COUNT(DISTINCT medicine_id) FROM pharmacy_prices WHERE source = 'nhs_drug_tariff'`);
  const hasRetail  = await pool.query(`SELECT COUNT(DISTINCT medicine_id) FROM pharmacy_prices WHERE source = 'scraper'`);
  const hasAny     = await pool.query(`SELECT COUNT(DISTINCT medicine_id) FROM pharmacy_prices`);
  const noPrice    = await pool.query(`
    SELECT COUNT(*) FROM medicines m
    WHERE NOT EXISTS (SELECT 1 FROM pharmacy_prices pp WHERE pp.medicine_id = m.id)
  `);

  console.log("\n=== Price Coverage Audit ===\n");
  console.log(`Total medicines in DB          : ${total.rows[0].count}`);
  console.log(`Have NHS Drug Tariff price     : ${hasNhs.rows[0].count}`);
  console.log(`Have scraped retail price      : ${hasRetail.rows[0].count}`);
  console.log(`Have any price at all          : ${hasAny.rows[0].count}`);
  console.log(`Have NO price at all           : ${noPrice.rows[0].count}`);

  // Medicines with NHS price but NO retail price yet (prime scrape targets)
  const nhsNoRetail = await pool.query(`
    SELECT COUNT(DISTINCT m.id) FROM medicines m
    WHERE EXISTS (
      SELECT 1 FROM pharmacy_prices pp WHERE pp.medicine_id = m.id AND pp.source = 'nhs_drug_tariff'
    )
    AND NOT EXISTS (
      SELECT 1 FROM pharmacy_prices pp WHERE pp.medicine_id = m.id AND pp.source = 'scraper'
    )
  `);
  console.log(`NHS price but no retail yet    : ${nhsNoRetail.rows[0].count}  ← best scrape targets`);

  // Pharmacies already scraped
  const byPharmacy = await pool.query(`
    SELECT pharmacy_name, COUNT(*) as count
    FROM pharmacy_prices
    WHERE source = 'scraper'
    GROUP BY pharmacy_name
    ORDER BY count DESC
  `);
  console.log("\n=== Scraped prices by pharmacy ===\n");
  if (byPharmacy.rows.length === 0) {
    console.log("  None yet (only H&B omega 3 demo)");
  } else {
    byPharmacy.rows.forEach((r: any) => console.log(`  ${r.pharmacy_name}: ${r.count}`));
  }

  // Sample of NHS medicines with no retail price (so user can see examples)
  const samples = await pool.query(`
    SELECT m.id, m.name, m.category
    FROM medicines m
    WHERE EXISTS (
      SELECT 1 FROM pharmacy_prices pp WHERE pp.medicine_id = m.id AND pp.source = 'nhs_drug_tariff'
    )
    AND NOT EXISTS (
      SELECT 1 FROM pharmacy_prices pp WHERE pp.medicine_id = m.id AND pp.source = 'scraper'
    )
    ORDER BY m.name
    LIMIT 20
  `);
  console.log("\n=== Sample NHS medicines with no retail price yet ===\n");
  samples.rows.forEach((r: any) => console.log(`  [${r.id}] ${r.name}  (${r.category ?? "—"})`));

  await pool.end();
})();
