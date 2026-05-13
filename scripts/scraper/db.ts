import { Pool } from "pg";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load .env.local when running locally; in CI DATABASE_URL comes from env secrets
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

export interface MedicineRecord {
  id: number;
  name: string;
  generic_name: string;
  active_ingredient: string;
  category: string;
}

/** Medicines with no retail price yet — OTC/supplements/skincare first, NHS specialist drugs last */
export async function getMedicinesNeedingPrices(limit: number, category?: string): Promise<MedicineRecord[]> {
  const params: unknown[] = [limit];
  const categoryFilter = category ? `AND m.category = $2` : "";
  if (category) params.push(category);

  const res = await pool.query<MedicineRecord>(
    `SELECT m.id, m.name, m.generic_name, m.active_ingredient, m.category
     FROM   medicines m
     WHERE  NOT EXISTS (
       SELECT 1 FROM pharmacy_prices pp
       WHERE  pp.medicine_id = m.id AND pp.source = 'scraper'
     )
     ${categoryFilter}
     ORDER  BY
       EXISTS (
         SELECT 1 FROM pharmacy_prices pp
         WHERE  pp.medicine_id = m.id AND pp.source = 'nhs_drug_tariff'
       ) ASC,
       m.name
     LIMIT  $1`,
    params,
  );
  return res.rows;
}

/** Upsert a scraped price into pharmacy_prices */
export async function upsertPrice(
  medicineId: number,
  pharmacyName: string,
  priceGbp: string,
  url: string,
  packSize: string | undefined,
  strength: string | undefined,
  inStock: boolean,
  offerText: string | undefined,
  imageUrl: string | undefined,
): Promise<void> {
  await pool.query(
    `INSERT INTO pharmacy_prices
       (medicine_id, pharmacy_name, pharmacy_url, price_gbp, in_stock, pack_size, strength, offer_text, image_url, source, last_updated)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'scraper', NOW())
     ON CONFLICT (medicine_id, pharmacy_name, COALESCE(pack_size, ''), COALESCE(strength, ''))
     DO UPDATE SET
       price_gbp    = EXCLUDED.price_gbp,
       pharmacy_url = EXCLUDED.pharmacy_url,
       in_stock     = EXCLUDED.in_stock,
       offer_text   = EXCLUDED.offer_text,
       image_url    = EXCLUDED.image_url,
       last_updated = NOW()`,
    [medicineId, pharmacyName, url, priceGbp, inStock, packSize ?? null, strength ?? null, offerText ?? null, imageUrl ?? null],
  );
}

export async function close(): Promise<void> {
  await pool.end();
}
