import { Pool } from "pg";
import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  const r = await pool.query(`
    SELECT m.name, pp.pharmacy_name, pp.price_gbp, pp.image_url, pp.offer_text
    FROM pharmacy_prices pp
    JOIN medicines m ON m.id = pp.medicine_id
    WHERE pp.source = 'scraper'
    ORDER BY pp.last_updated DESC
  `);
  console.log(`\nScraped prices in DB: ${r.rows.length}\n`);
  r.rows.forEach((row: any) => {
    console.log(`  ${row.name}`);
    console.log(`    Pharmacy : ${row.pharmacy_name}`);
    console.log(`    Price    : £${row.price_gbp}`);
    console.log(`    Offer    : ${row.offer_text ?? "none"}`);
    console.log(`    Image    : ${row.image_url ? "✓ YES — " + row.image_url.slice(0, 60) : "✗ no"}`);
    console.log();
  });
  await pool.end();
})();
