import pool from './db';
import { randomBytes } from 'crypto';
export { formatGBP, parseBrandNames } from './format-utils';

// ─── Row types (match DB schema) ─────────────────────────────────────────────

export interface MedicineRow {
  id: number;
  name: string;
  generic_name: string;
  category: string;
  description: string;
  active_ingredient: string;
  dosage_form: string;
  mhra_approved: boolean;
  brand_names: string | null;   // comma-separated
  bnf_code: string | null;
  atc_code: string | null;
  source: string;
  created_at: Date;
  gender: string | null;
  subcategory: string | null;
}

export interface PriceRow {
  id: number;
  medicine_id: number;
  pharmacy_name: string;
  pharmacy_url: string | null;
  price_gbp: string;            // pg returns DECIMAL as string
  in_stock: boolean;
  delivery_info: string | null;
  pack_size: string | null;
  strength: string | null;
  last_updated: Date;
  source: string | null;
  offer_text: string | null;
  image_url: string | null;
}

export interface IngredientRow {
  id: number;
  medicine_id: number;
  ingredient_name: string;
  quantity: string | null;
  is_active: boolean;
}

export type MedicineWithPrice = MedicineRow & { min_price: string | null };

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getFeaturedMedicines(limit = 6): Promise<MedicineWithPrice[]> {
  const res = await pool.query<MedicineWithPrice>(`
    SELECT m.*, MIN(pp.price_gbp) AS min_price
    FROM   medicines m
    LEFT   JOIN pharmacy_prices pp ON pp.medicine_id = m.id
    GROUP  BY m.id
    ORDER  BY (m.source = 'seed') DESC, m.name
    LIMIT  $1
  `, [limit]);
  return res.rows;
}

// Builds a WHERE clause + params array from search filters.
// All user-supplied values go through parameterised placeholders — no interpolation.
function buildWhere(
  query: string,
  tab: string,
  gender?: string,
  subcategory?: string,
): { where: string; params: unknown[] } {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (query.trim()) {
    params.push(`%${query.toLowerCase()}%`);
    const n = params.length;
    conditions.push(
      `(LOWER(m.name) LIKE $${n} OR LOWER(m.generic_name) LIKE $${n}` +
      ` OR LOWER(m.active_ingredient) LIKE $${n} OR LOWER(m.category) LIKE $${n}` +
      ` OR LOWER(m.brand_names) LIKE $${n})`,
    );
  }

  // Tab values are validated against a fixed set — safe to inline
  if (tab === 'supplements') conditions.push(`m.category = 'supplement'`);
  else if (tab === 'skincare')  conditions.push(`m.category = 'skincare'`);
  else if (tab === 'medicines') conditions.push(`m.category NOT IN ('supplement','skincare')`);

  if (gender === 'men' || gender === 'women' || gender === 'unisex') {
    params.push(gender);
    conditions.push(`m.gender = $${params.length}`);
  }

  if (subcategory?.trim()) {
    params.push(subcategory.trim());
    conditions.push(`m.subcategory = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

export async function getSkincareMeta(): Promise<{
  genders: Array<{ gender: string; count: number }>;
  subcategories: Array<{ subcategory: string; count: number }>;
}> {
  const [gRes, sRes] = await Promise.all([
    pool.query<{ gender: string; count: string }>(
      `SELECT gender, COUNT(*) AS count FROM medicines WHERE category='skincare' AND gender IS NOT NULL GROUP BY gender ORDER BY gender`,
    ),
    pool.query<{ subcategory: string; count: string }>(
      `SELECT subcategory, COUNT(*) AS count FROM medicines WHERE category='skincare' AND subcategory IS NOT NULL GROUP BY subcategory ORDER BY count DESC`,
    ),
  ]);
  return {
    genders:       gRes.rows.map(r => ({ gender: r.gender, count: Number(r.count) })),
    subcategories: sRes.rows.map(r => ({ subcategory: r.subcategory, count: Number(r.count) })),
  };
}

export async function searchMedicines(
  query: string,
  limit = 60,
  offset = 0,
  tab = 'all',
  gender?: string,
  subcategory?: string,
  sort = 'relevance',
  pricedOnly = false,
): Promise<{ rows: MedicineWithPrice[]; total: number }> {
  const { where, params } = buildWhere(query, tab, gender, subcategory);

  const having = pricedOnly
    ? `HAVING MIN(CASE WHEN pp.source != 'nhs_drug_tariff' THEN pp.price_gbp END) IS NOT NULL`
    : '';

  const countRes = await pool.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM (
       SELECT m.id FROM medicines m
       LEFT JOIN pharmacy_prices pp ON pp.medicine_id = m.id
       ${where}
       GROUP BY m.id
       ${having}
     ) sub`,
    [...params],
  );
  const total = parseInt(countRes.rows[0].total, 10);

  const orderBy = sort === 'price_asc'  ? 'MIN(CASE WHEN pp.source != \'nhs_drug_tariff\' THEN pp.price_gbp END) ASC NULLS LAST, m.name ASC'
                : sort === 'price_desc' ? 'MIN(CASE WHEN pp.source != \'nhs_drug_tariff\' THEN pp.price_gbp END) DESC NULLS LAST, m.name ASC'
                : sort === 'name_asc'   ? 'm.name ASC'
                : '(MIN(pp.price_gbp) IS NOT NULL) DESC, (m.source = \'seed\') DESC, m.name ASC';

  const dataParams = [...params];
  dataParams.push(limit);
  const limitIdx = dataParams.length;
  dataParams.push(offset);
  const offsetIdx = dataParams.length;

  const res = await pool.query<MedicineWithPrice>(`
    SELECT m.*, MIN(pp.price_gbp) AS min_price
    FROM   medicines m
    LEFT   JOIN pharmacy_prices pp ON pp.medicine_id = m.id
    ${where}
    GROUP  BY m.id
    ${having}
    ORDER  BY ${orderBy}
    LIMIT  $${limitIdx} OFFSET $${offsetIdx}
  `, dataParams);

  return { rows: res.rows, total };
}

export async function getFeaturedByCategory(
  category: string,
  limit = 4,
): Promise<MedicineWithPrice[]> {
  const res = await pool.query<MedicineWithPrice>(`
    SELECT m.*, MIN(pp.price_gbp) AS min_price
    FROM   medicines m
    LEFT   JOIN pharmacy_prices pp ON pp.medicine_id = m.id
    WHERE  m.category = $1
    GROUP  BY m.id
    ORDER  BY MIN(pp.price_gbp) ASC NULLS LAST, m.name
    LIMIT  $2
  `, [category, limit]);
  return res.rows;
}

export async function getMedicineById(id: number): Promise<MedicineRow | null> {
  const res = await pool.query<MedicineRow>(
    'SELECT * FROM medicines WHERE id = $1',
    [id],
  );
  return res.rows[0] ?? null;
}

export async function getPricesByMedicineId(medicineId: number): Promise<PriceRow[]> {
  const res = await pool.query<PriceRow>(
    `SELECT * FROM pharmacy_prices
     WHERE  medicine_id = $1
     ORDER  BY price_gbp ASC`,
    [medicineId],
  );
  return res.rows;
}

export async function getIngredientsByMedicineId(medicineId: number): Promise<IngredientRow[]> {
  const res = await pool.query<IngredientRow>(
    `SELECT * FROM ingredients
     WHERE  medicine_id = $1
     ORDER  BY is_active DESC, ingredient_name`,
    [medicineId],
  );
  return res.rows;
}

export async function getAutocompleteSuggestions(query: string, limit = 7): Promise<string[]> {
  const q = `${query.toLowerCase()}%`;
  const res = await pool.query<{ name: string }>(`
    SELECT DISTINCT name
    FROM   medicines
    WHERE  LOWER(name) LIKE $1
        OR LOWER(generic_name) LIKE $1
    ORDER  BY name
    LIMIT  $2
  `, [q, limit]);
  return res.rows.map((r) => r.name);
}

export async function getSearchTabCounts(query: string): Promise<{
  all: number; medicines: number; supplements: number; skincare: number;
}> {
  const q = query.trim() ? `%${query.toLowerCase()}%` : null;
  const whereSearch = q
    ? `(LOWER(m.name) LIKE $1 OR LOWER(m.generic_name) LIKE $1 OR LOWER(m.active_ingredient) LIKE $1 OR LOWER(m.brand_names) LIKE $1)`
    : `1=1`;

  const res = await pool.query<{ all: string; medicines: string; supplements: string; skincare: string }>(
    `SELECT
       COUNT(*) AS all,
       COUNT(*) FILTER (WHERE m.category NOT IN ('supplement','skincare')) AS medicines,
       COUNT(*) FILTER (WHERE m.category = 'supplement') AS supplements,
       COUNT(*) FILTER (WHERE m.category = 'skincare')    AS skincare
     FROM medicines m
     WHERE ${whereSearch}`,
    q ? [q] : [],
  );
  const r = res.rows[0];
  return {
    all:         parseInt(r.all, 10),
    medicines:   parseInt(r.medicines, 10),
    supplements: parseInt(r.supplements, 10),
    skincare:    parseInt(r.skincare, 10),
  };
}

export async function getAllCategories(): Promise<string[]> {
  const res = await pool.query<{ category: string }>(
    `SELECT DISTINCT category FROM medicines
     WHERE  category IS NOT NULL
     ORDER  BY category`,
  );
  return res.rows.map((r) => r.category);
}

// Products that actually have retail prices — used for the homepage "live deals" row.
export async function getTopDeals(limit = 6): Promise<MedicineWithPrice[]> {
  const res = await pool.query<MedicineWithPrice>(`
    SELECT m.*, MIN(pp.price_gbp) AS min_price
    FROM   medicines m
    JOIN   pharmacy_prices pp ON pp.medicine_id = m.id
                              AND pp.source != 'nhs_drug_tariff'
    GROUP  BY m.id
    ORDER  BY (m.source = 'seed') DESC, m.name ASC
    LIMIT  $1
  `, [limit]);
  return res.rows;
}

// Medicines sharing the same active ingredient / generic name — shown as
// cheaper alternatives on branded product pages.
export async function getGenericAlternatives(
  medicineId: number,
  genericName: string | null,
  activeIngredient: string | null,
  limit = 5,
): Promise<MedicineWithPrice[]> {
  // Use the first word of active_ingredient or generic_name as the keyword
  const keyword = ((activeIngredient || genericName) ?? '')
    .split(/\s+/)[0].trim().toLowerCase();
  if (!keyword || keyword.length < 3) return [];

  const res = await pool.query<MedicineWithPrice>(`
    SELECT m.*, MIN(pp.price_gbp) AS min_price
    FROM   medicines m
    JOIN   pharmacy_prices pp ON pp.medicine_id = m.id
                              AND pp.source != 'nhs_drug_tariff'
    WHERE  m.id != $1
      AND  m.category NOT IN ('supplement', 'skincare')
      AND  (
        LOWER(m.name)              LIKE $2
        OR LOWER(m.generic_name)   LIKE $2
        OR LOWER(m.active_ingredient) LIKE $2
      )
    GROUP  BY m.id
    ORDER  BY MIN(pp.price_gbp) ASC NULLS LAST
    LIMIT  $3
  `, [medicineId, `%${keyword}%`, limit]);

  return res.rows;
}

// ─── Ingredient landing pages ─────────────────────────────────────────────────

export async function getMedicinesByIngredient(
  slug: string,
  limit = 40,
  offset = 0,
): Promise<{ rows: MedicineWithPrice[]; total: number; ingredientName: string | null }> {
  const nameRes = await pool.query<{ ingredient_name: string }>(
    `SELECT DISTINCT ingredient_name
     FROM   ingredients
     WHERE  REGEXP_REPLACE(LOWER(ingredient_name), '[^a-z0-9]+', '-', 'g') = $1
     LIMIT  1`,
    [slug],
  );
  const ingredientName = nameRes.rows[0]?.ingredient_name ?? null;
  if (!ingredientName) return { rows: [], total: 0, ingredientName: null };

  const nameLower = ingredientName.toLowerCase();
  const [countRes, dataRes] = await Promise.all([
    pool.query<{ total: string }>(
      `SELECT COUNT(DISTINCT m.id) AS total
       FROM   medicines m
       JOIN   ingredients i ON i.medicine_id = m.id AND LOWER(i.ingredient_name) = $1`,
      [nameLower],
    ),
    pool.query<MedicineWithPrice>(
      `SELECT m.*,
              MIN(CASE WHEN pp.source != 'nhs_drug_tariff' THEN pp.price_gbp END) AS min_price
       FROM   medicines m
       JOIN   ingredients i ON i.medicine_id = m.id AND LOWER(i.ingredient_name) = $1
       LEFT   JOIN pharmacy_prices pp ON pp.medicine_id = m.id
       GROUP  BY m.id
       ORDER  BY MIN(CASE WHEN pp.source != 'nhs_drug_tariff' THEN pp.price_gbp END) ASC NULLS LAST, m.name
       LIMIT  $2 OFFSET $3`,
      [nameLower, limit, offset],
    ),
  ]);
  return { rows: dataRes.rows, total: parseInt(countRes.rows[0].total, 10), ingredientName };
}

// ─── Pharmacy landing pages ───────────────────────────────────────────────────

export async function getPharmacyList(): Promise<Array<{ pharmacy_name: string; slug: string; count: number }>> {
  const res = await pool.query<{ pharmacy_name: string; count: string }>(
    `SELECT pharmacy_name, COUNT(DISTINCT medicine_id) AS count
     FROM   pharmacy_prices
     WHERE  source != 'nhs_drug_tariff'
     GROUP  BY pharmacy_name
     ORDER  BY count DESC`,
  );
  return res.rows.map(r => ({
    pharmacy_name: r.pharmacy_name,
    slug: r.pharmacy_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    count: Number(r.count),
  }));
}

export async function getMedicinesByPharmacy(
  slug: string,
  limit = 40,
  offset = 0,
): Promise<{ rows: MedicineWithPrice[]; total: number; pharmacyName: string | null }> {
  const nameRes = await pool.query<{ pharmacy_name: string }>(
    `SELECT DISTINCT pharmacy_name
     FROM   pharmacy_prices
     WHERE  REGEXP_REPLACE(LOWER(pharmacy_name), '[^a-z0-9]+', '-', 'g') = $1
       AND  source != 'nhs_drug_tariff'
     LIMIT  1`,
    [slug],
  );
  const pharmacyName = nameRes.rows[0]?.pharmacy_name ?? null;
  if (!pharmacyName) return { rows: [], total: 0, pharmacyName: null };

  const nameLower = pharmacyName.toLowerCase();
  const [countRes, dataRes] = await Promise.all([
    pool.query<{ total: string }>(
      `SELECT COUNT(DISTINCT medicine_id) AS total
       FROM   pharmacy_prices
       WHERE  LOWER(pharmacy_name) = $1 AND source != 'nhs_drug_tariff'`,
      [nameLower],
    ),
    pool.query<MedicineWithPrice>(
      `SELECT m.*, MIN(pp.price_gbp) AS min_price
       FROM   medicines m
       JOIN   pharmacy_prices pp ON pp.medicine_id = m.id
                                 AND LOWER(pp.pharmacy_name) = $1
                                 AND pp.source != 'nhs_drug_tariff'
       GROUP  BY m.id
       ORDER  BY MIN(pp.price_gbp) ASC, m.name
       LIMIT  $2 OFFSET $3`,
      [nameLower, limit, offset],
    ),
  ]);
  return { rows: dataRes.rows, total: parseInt(countRes.rows[0].total, 10), pharmacyName };
}

// ─── Click tracking ───────────────────────────────────────────────────────────

export async function getPharmacyUrl(priceId: number): Promise<{ url: string; pharmacy_name: string; medicine_id: number } | null> {
  const res = await pool.query<{ pharmacy_url: string; pharmacy_name: string; medicine_id: number }>(
    'SELECT pharmacy_url, pharmacy_name, medicine_id FROM pharmacy_prices WHERE id = $1',
    [priceId],
  );
  const row = res.rows[0];
  if (!row?.pharmacy_url) return null;
  return { url: row.pharmacy_url, pharmacy_name: row.pharmacy_name, medicine_id: row.medicine_id };
}

export async function logPharmacyClick(priceId: number, pharmacyName: string, medicineId: number): Promise<void> {
  await pool.query(
    `INSERT INTO pharmacy_clicks (price_id, medicine_id, pharmacy_name) VALUES ($1, $2, $3)`,
    [priceId, medicineId, pharmacyName],
  ).catch(() => {});
}

// ─── Price alerts / watchlist ─────────────────────────────────────────────────

export interface WatchlistRow {
  id: number;
  email: string;
  medicine_id: number;
  medicine_name: string;
  current_price_gbp: string | null;
  new_price_gbp: string | null;
  token: string;
}

export async function createWatchlistEntry(
  email: string,
  medicineId: number,
  currentPriceGbp: string | null,
): Promise<{ token: string; alreadyExists: boolean }> {
  const existing = await pool.query<{ token: string }>(
    'SELECT token FROM watchlist WHERE email = $1 AND medicine_id = $2',
    [email, medicineId],
  );
  if (existing.rows[0]) return { token: existing.rows[0].token, alreadyExists: true };

  const token = randomBytes(32).toString('hex');
  const price = currentPriceGbp ? parseFloat(currentPriceGbp) : null;
  await pool.query(
    `INSERT INTO watchlist (email, medicine_id, current_price_gbp, token) VALUES ($1, $2, $3, $4)`,
    [email, medicineId, price, token],
  );
  return { token, alreadyExists: false };
}

export async function confirmWatchlistEntry(token: string): Promise<boolean> {
  const res = await pool.query(
    'UPDATE watchlist SET confirmed = TRUE WHERE token = $1',
    [token],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function deleteWatchlistByToken(token: string): Promise<boolean> {
  const res = await pool.query('DELETE FROM watchlist WHERE token = $1', [token]);
  return (res.rowCount ?? 0) > 0;
}

export async function getWatchlistForPriceCheck(): Promise<WatchlistRow[]> {
  const res = await pool.query<WatchlistRow>(`
    SELECT w.id, w.email, w.medicine_id, m.name AS medicine_name,
           w.current_price_gbp::text,
           MIN(pp.price_gbp)::text AS new_price_gbp,
           w.token
    FROM   watchlist w
    JOIN   medicines m ON m.id = w.medicine_id
    LEFT   JOIN pharmacy_prices pp ON pp.medicine_id = w.medicine_id
                                   AND pp.source != 'nhs_drug_tariff'
    WHERE  w.confirmed = TRUE
    GROUP  BY w.id, w.email, w.medicine_id, m.name, w.current_price_gbp, w.token
    HAVING MIN(pp.price_gbp) < w.current_price_gbp OR w.current_price_gbp IS NULL
  `);
  return res.rows;
}

export async function updateWatchlistPrice(id: number, priceGbp: string): Promise<void> {
  await pool.query(
    'UPDATE watchlist SET current_price_gbp = $1 WHERE id = $2',
    [parseFloat(priceGbp), id],
  );
}
