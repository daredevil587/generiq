/**
 * Demo: scrape H&B for one medicine, save to DB, print the medicine URL to view in browser.
 * Usage: npx tsx scripts/scraper/demo-save.ts "omega 3"
 */
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { resolve } from "path";
import { launchBrowser, newStealthPage } from "./browser";
import { scrapeHollandBarrett } from "./pharmacies/holland-barrett";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const query = process.argv[2] ?? "omega 3";

(async () => {
  // 1. Find matching medicine in DB
  const medRes = await pool.query(
    `SELECT id, name FROM medicines
     WHERE LOWER(name) LIKE $1
     ORDER BY name LIMIT 5`,
    [`%${query.toLowerCase()}%`],
  );

  if (medRes.rows.length === 0) {
    console.log(`No medicine found in DB matching "${query}"`);
    await pool.end(); return;
  }

  const medicine = medRes.rows[0];
  console.log(`\nFound medicine: [${medicine.id}] ${medicine.name}`);

  // 2. Scrape H&B
  console.log(`Scraping Holland & Barrett for "${query}"...`);
  const browser = await launchBrowser();
  const page    = await newStealthPage(browser);
  const results = await scrapeHollandBarrett(query, page);
  await browser.close();

  if (results.length === 0) {
    console.log("No scraped results — nothing saved.");
    await pool.end(); return;
  }

  // 3. Save best result to DB
  const best = results[0];
  console.log(`\nBest match (${(best.matchScore * 100).toFixed(0)}% score):`);
  console.log(`  Price     : £${best.priceGbp}`);
  console.log(`  Offer     : ${best.offerText ?? "none"}`);
  console.log(`  Image URL : ${best.imageUrl ?? "none"}`);
  console.log(`  Product   : ${best.url}`);

  await pool.query(
    `INSERT INTO pharmacy_prices
       (medicine_id, pharmacy_name, pharmacy_url, price_gbp, in_stock, offer_text, image_url, source, last_updated)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'scraper', NOW())
     ON CONFLICT (medicine_id, pharmacy_name, COALESCE(pack_size, ''), COALESCE(strength, ''))
     DO UPDATE SET
       price_gbp    = EXCLUDED.price_gbp,
       pharmacy_url = EXCLUDED.pharmacy_url,
       in_stock     = EXCLUDED.in_stock,
       offer_text   = EXCLUDED.offer_text,
       image_url    = EXCLUDED.image_url,
       last_updated = NOW()`,
    [medicine.id, best.pharmacyName, best.url, best.priceGbp, best.inStock, best.offerText ?? null, best.imageUrl ?? null],
  );

  console.log(`\n✓ Saved to DB!`);
  console.log(`\nView it at: http://localhost:3000/medicine/${medicine.id}`);
  await pool.end();
})();
