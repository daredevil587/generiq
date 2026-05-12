import pool from './db';
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
): Promise<{ rows: MedicineWithPrice[]; total: number }> {
  const { where, params } = buildWhere(query, tab, gender, subcategory);

  const countRes = await pool.query<{ total: string }>(
    `SELECT COUNT(DISTINCT m.id) AS total FROM medicines m ${where}`,
    [...params],
  );
  const total = parseInt(countRes.rows[0].total, 10);

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
    ORDER  BY
      (MIN(pp.price_gbp) IS NOT NULL) DESC,
      (m.source = 'seed') DESC,
      m.name ASC
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
