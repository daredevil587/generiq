/**
 * Adds offer_text and image_url columns to pharmacy_prices (safe to re-run).
 */
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  await pool.query(`ALTER TABLE pharmacy_prices ADD COLUMN IF NOT EXISTS offer_text TEXT`);
  console.log("✓ offer_text column ready");

  await pool.query(`ALTER TABLE pharmacy_prices ADD COLUMN IF NOT EXISTS image_url TEXT`);
  console.log("✓ image_url column ready");

  // Upsert index (safe if already exists)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS pharmacy_prices_upsert_idx
    ON pharmacy_prices (medicine_id, pharmacy_name, COALESCE(pack_size, ''), COALESCE(strength, ''))
  `).catch(e => console.log("  upsert index:", e.message));

  console.log("\nMigration complete.");
  await pool.end();
})();
