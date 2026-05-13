/**
 * Show medicines that OTC pharmacies / H&B are likely to carry.
 */
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  // Look for common OTC-style medicines in the DB
  const otc = await pool.query(`
    SELECT m.id, m.name, m.generic_name, m.category
    FROM medicines m
    WHERE LOWER(m.name) SIMILAR TO '%ibuprofen%|%paracetamol%|%aspirin%|%omega%|%vitamin%|%fish oil%|%cod liver%|%zinc%|%iron%|%calcium%|%magnesium%|%folic%|%nicotine%|%antihistamine%|%cetirizine%|%loratadine%|%omeprazole%|%lansoprazole%'
    ORDER BY m.name
    LIMIT 30
  `);

  console.log(`\n=== OTC-style medicines in DB (${otc.rows.length} found) ===\n`);
  otc.rows.forEach((r: any) => {
    console.log(`  [${r.id}] ${r.name}  (category: ${r.category ?? "—"})`);
  });

  // Total medicines count
  const total = await pool.query(`SELECT COUNT(*) FROM medicines`);
  console.log(`\nTotal medicines in DB: ${total.rows[0].count}`);

  await pool.end();
})();
