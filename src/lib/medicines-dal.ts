import { randomBytes } from 'crypto';
import { getDB } from './db';
import { slugify } from './format-utils';
export { formatGBP, parseBrandNames } from './format-utils';

// ─── Row types ───────────────────────────────────────────────────────────────
// price_gbp is REAL in D1 (number) but kept as string|number for pg compat.

export interface MedicineRow {
  id: number;
  name: string;
  generic_name: string;
  category: string;
  description: string;
  active_ingredient: string;
  dosage_form: string;
  mhra_approved: boolean | number;
  brand_names: string | null;
  bnf_code: string | null;
  atc_code: string | null;
  source: string;
  created_at: string;
  gender: string | null;
  subcategory: string | null;
}

export interface PriceRow {
  id: number;
  medicine_id: number;
  pharmacy_name: string;
  pharmacy_url: string | null;
  price_gbp: string;            // stored as REAL in D1; JS coercion keeps all existing parseFloat() calls working
  in_stock: boolean | number;
  delivery_info: string | null;
  pack_size: string | null;
  strength: string | null;
  last_updated: string;
  source: string | null;
  offer_text: string | null;
  image_url: string | null;
}

export interface IngredientRow {
  id: number;
  medicine_id: number;
  ingredient_name: string;
  quantity: string | null;
  is_active: boolean | number;
}

export type MedicineWithPrice = MedicineRow & { min_price: string | null };

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Builds a WHERE clause using D1's ?N named-positional params.
// Tab values are validated against a fixed set — safe to inline.
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
      `(LOWER(m.name) LIKE ?${n} OR LOWER(m.generic_name) LIKE ?${n}` +
      ` OR LOWER(m.active_ingredient) LIKE ?${n} OR LOWER(m.category) LIKE ?${n}` +
      ` OR LOWER(m.brand_names) LIKE ?${n}` +
      ` OR EXISTS (SELECT 1 FROM ingredients i WHERE i.medicine_id = m.id AND LOWER(i.ingredient_name) LIKE ?${n}))`,
    );
  }

  const NEW_CATS = `'baby','pet','haircare','dental','sports'`;
  if      (tab === 'supplements') conditions.push(`m.category = 'supplement'`);
  else if (tab === 'skincare')    conditions.push(`m.category = 'skincare'`);
  else if (tab === 'baby')        conditions.push(`m.category = 'baby'`);
  else if (tab === 'pet')         conditions.push(`m.category = 'pet'`);
  else if (tab === 'haircare')    conditions.push(`m.category = 'haircare'`);
  else if (tab === 'dental')      conditions.push(`m.category = 'dental'`);
  else if (tab === 'sports')      conditions.push(`m.category = 'sports'`);
  else if (tab === 'medicines')   conditions.push(`m.category NOT IN ('supplement','skincare',${NEW_CATS})`);

  if (gender === 'men' || gender === 'women' || gender === 'unisex') {
    params.push(gender);
    conditions.push(`m.gender = ?${params.length}`);
  }

  if (subcategory?.trim()) {
    params.push(subcategory.trim());
    conditions.push(`m.subcategory = ?${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getFeaturedMedicines(limit = 6): Promise<MedicineWithPrice[]> {
  const db = await getDB();
  const { results } = await db.prepare(`
    SELECT m.*, MIN(pp.price_gbp) AS min_price
    FROM   medicines m
    LEFT   JOIN pharmacy_prices pp ON pp.medicine_id = m.id
    GROUP  BY m.id
    ORDER  BY (m.source = 'seed') DESC, m.name
    LIMIT  ?1
  `).bind(limit).all<MedicineWithPrice>();
  return results;
}

export async function getSkincareMeta(): Promise<{
  genders: Array<{ gender: string; count: number }>;
  subcategories: Array<{ subcategory: string; count: number }>;
}> {
  const db = await getDB();
  const [gRes, sRes] = await Promise.all([
    db.prepare(
      `SELECT gender, COUNT(*) AS count FROM medicines WHERE category='skincare' AND gender IS NOT NULL GROUP BY gender ORDER BY gender`,
    ).all<{ gender: string; count: number }>(),
    db.prepare(
      `SELECT subcategory, COUNT(*) AS count FROM medicines WHERE category='skincare' AND subcategory IS NOT NULL GROUP BY subcategory ORDER BY count DESC`,
    ).all<{ subcategory: string; count: number }>(),
  ]);
  return {
    genders:       gRes.results.map(r => ({ gender: r.gender, count: Number(r.count) })),
    subcategories: sRes.results.map(r => ({ subcategory: r.subcategory, count: Number(r.count) })),
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
  const db = await getDB();
  const { where, params } = buildWhere(query, tab, gender, subcategory);

  const having = pricedOnly
    ? `HAVING MIN(CASE WHEN pp.source != 'nhs_drug_tariff' THEN pp.price_gbp END) IS NOT NULL`
    : '';

  // Count using the same ?N params (no limit/offset added yet)
  const countRow = await db.prepare(
    `SELECT COUNT(*) AS total FROM (
       SELECT m.id FROM medicines m
       LEFT JOIN pharmacy_prices pp ON pp.medicine_id = m.id
       ${where}
       GROUP BY m.id
       ${having}
     ) sub`,
  ).bind(...params).first<{ total: number }>();
  const total = Number(countRow?.total ?? 0);

  const orderBy =
    sort === 'price_asc'  ? `MIN(CASE WHEN pp.source != 'nhs_drug_tariff' THEN pp.price_gbp END) ASC NULLS LAST, m.name ASC`
  : sort === 'price_desc' ? `MIN(CASE WHEN pp.source != 'nhs_drug_tariff' THEN pp.price_gbp END) DESC NULLS LAST, m.name ASC`
  : sort === 'name_asc'   ? `m.name ASC`
  : `(MIN(pp.price_gbp) IS NOT NULL) DESC, (m.source = 'seed') DESC, m.name ASC`;

  // Append limit and offset as the next positional params
  const dataParams = [...params, limit, offset];
  const limitIdx  = params.length + 1;
  const offsetIdx = params.length + 2;

  const { results } = await db.prepare(`
    SELECT m.*, MIN(pp.price_gbp) AS min_price
    FROM   medicines m
    LEFT   JOIN pharmacy_prices pp ON pp.medicine_id = m.id
    ${where}
    GROUP  BY m.id
    ${having}
    ORDER  BY ${orderBy}
    LIMIT  ?${limitIdx} OFFSET ?${offsetIdx}
  `).bind(...dataParams).all<MedicineWithPrice>();

  return { rows: results, total };
}

export async function getFeaturedByCategory(
  category: string,
  limit = 4,
): Promise<MedicineWithPrice[]> {
  const db = await getDB();
  const { results } = await db.prepare(`
    SELECT m.*, MIN(pp.price_gbp) AS min_price
    FROM   medicines m
    LEFT   JOIN pharmacy_prices pp ON pp.medicine_id = m.id
    WHERE  m.category = ?1
    GROUP  BY m.id
    ORDER  BY MIN(pp.price_gbp) ASC NULLS LAST, m.name
    LIMIT  ?2
  `).bind(category, limit).all<MedicineWithPrice>();
  return results;
}

export async function getMedicineById(id: number): Promise<MedicineRow | null> {
  const db = await getDB();
  return db.prepare('SELECT * FROM medicines WHERE id = ?1').bind(id).first<MedicineRow>();
}

export async function getPricesByMedicineId(medicineId: number): Promise<PriceRow[]> {
  const db = await getDB();
  const { results } = await db.prepare(`
    SELECT * FROM pharmacy_prices
    WHERE  medicine_id = ?1
    ORDER  BY price_gbp ASC
  `).bind(medicineId).all<PriceRow>();
  return results;
}

export async function getIngredientsByMedicineId(medicineId: number): Promise<IngredientRow[]> {
  const db = await getDB();
  const { results } = await db.prepare(`
    SELECT * FROM ingredients
    WHERE  medicine_id = ?1
    ORDER  BY is_active DESC, ingredient_name
  `).bind(medicineId).all<IngredientRow>();
  return results;
}

export type AutocompleteSuggestion =
  | { type: 'medicine';   label: string; href: string }
  | { type: 'ingredient'; label: string; href: string };

export async function getAutocompleteSuggestions(
  query: string,
  limit = 7,
): Promise<AutocompleteSuggestion[]> {
  const db = await getDB();
  const q = `${query.toLowerCase()}%`;
  const medLimit = Math.max(4, limit - 2);

  const [medRes, ingRes] = await Promise.all([
    db.prepare(`
      SELECT DISTINCT name
      FROM   medicines
      WHERE  LOWER(name) LIKE ?1 OR LOWER(generic_name) LIKE ?1
      ORDER  BY name
      LIMIT  ?2
    `).bind(q, medLimit).all<{ name: string }>(),
    db.prepare(`
      SELECT DISTINCT ingredient_name
      FROM   ingredients
      WHERE  LOWER(ingredient_name) LIKE ?1
      ORDER  BY ingredient_name
      LIMIT  ?2
    `).bind(q, 3).all<{ ingredient_name: string }>(),
  ]);

  const medicines: AutocompleteSuggestion[] = medRes.results.map(r => ({
    type: 'medicine',
    label: r.name,
    href: `/search?q=${encodeURIComponent(r.name)}`,
  }));

  const seen = new Set(medicines.map(m => m.label.toLowerCase()));
  const ingredients: AutocompleteSuggestion[] = ingRes.results
    .filter(r => !seen.has(r.ingredient_name.toLowerCase()))
    .map(r => ({
      type: 'ingredient',
      label: r.ingredient_name,
      href: `/ingredient/${slugify(r.ingredient_name)}`,
    }));

  return [...medicines, ...ingredients].slice(0, limit);
}

export async function getSearchTabCounts(query: string): Promise<{
  all: number; medicines: number; supplements: number; skincare: number;
  baby: number; pet: number; haircare: number; dental: number; sports: number;
}> {
  const db = await getDB();
  const q = query.trim() ? `%${query.toLowerCase()}%` : null;
  const whereSearch = q
    ? `(LOWER(m.name) LIKE ?1 OR LOWER(m.generic_name) LIKE ?1 OR LOWER(m.active_ingredient) LIKE ?1 OR LOWER(m.brand_names) LIKE ?1)`
    : `1=1`;

  // SQLite doesn't support COUNT(*) FILTER — use SUM(CASE WHEN ...) instead
  const row = await db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN m.category NOT IN ('supplement','skincare','baby','pet','haircare','dental','sports') THEN 1 ELSE 0 END) AS medicines,
      SUM(CASE WHEN m.category = 'supplement' THEN 1 ELSE 0 END) AS supplements,
      SUM(CASE WHEN m.category = 'skincare'   THEN 1 ELSE 0 END) AS skincare,
      SUM(CASE WHEN m.category = 'baby'       THEN 1 ELSE 0 END) AS baby,
      SUM(CASE WHEN m.category = 'pet'        THEN 1 ELSE 0 END) AS pet,
      SUM(CASE WHEN m.category = 'haircare'   THEN 1 ELSE 0 END) AS haircare,
      SUM(CASE WHEN m.category = 'dental'     THEN 1 ELSE 0 END) AS dental,
      SUM(CASE WHEN m.category = 'sports'     THEN 1 ELSE 0 END) AS sports
    FROM medicines m
    WHERE ${whereSearch}
  `).bind(...(q ? [q] : [])).first<{ total: number; medicines: number; supplements: number; skincare: number; baby: number; pet: number; haircare: number; dental: number; sports: number }>();

  return {
    all:         Number(row?.total ?? 0),
    medicines:   Number(row?.medicines ?? 0),
    supplements: Number(row?.supplements ?? 0),
    skincare:    Number(row?.skincare ?? 0),
    baby:        Number(row?.baby ?? 0),
    pet:         Number(row?.pet ?? 0),
    haircare:    Number(row?.haircare ?? 0),
    dental:      Number(row?.dental ?? 0),
    sports:      Number(row?.sports ?? 0),
  };
}

export async function getAllCategories(): Promise<string[]> {
  const db = await getDB();
  const { results } = await db.prepare(
    `SELECT DISTINCT category FROM medicines WHERE category IS NOT NULL ORDER BY category`,
  ).all<{ category: string }>();
  return results.map(r => r.category);
}

export async function getTopDeals(limit = 6): Promise<MedicineWithPrice[]> {
  const db = await getDB();
  const { results } = await db.prepare(`
    SELECT m.*, MIN(pp.price_gbp) AS min_price
    FROM   medicines m
    JOIN   pharmacy_prices pp ON pp.medicine_id = m.id
                              AND pp.source != 'nhs_drug_tariff'
    GROUP  BY m.id
    ORDER  BY (m.source = 'seed') DESC, m.name ASC
    LIMIT  ?1
  `).bind(limit).all<MedicineWithPrice>();
  return results;
}

// Words that are never the active ingredient — brand prefixes, dose forms, modifiers.
const PHARMA_STOP = new Set([
  'almus','accord','actavis','teva','mylan','zentiva','ratiopharm','sandoz','wockhardt',
  'boots','superdrug','lloyds','tesco','asda','sainsburys','day','lewis',
  'nurofen','calpol','calprofen','panadol','imodium','rennie','gaviscon',
  'strepsils','benylin','covonia','sudafed','piriton','clarityn',
  'children','childrens','adults','adult','baby','infant','junior',
  'max','maximum','extra','ultra','plus','double','high','strength',
  'oral','suspension','solution','tablet','tablets','capsule','capsules',
  'caplet','caplets','gel','cream','drops','spray','syrup','liquid','elixir',
  'patch','suppositories','effervescent','soluble','prolonged','modified',
  'slow','sustained','immediate','release','flavour','flavored','flavoured',
  'pain','fever','relief','cold','flu','allergy','hayfever','runny',
  'heartburn','indigestion','diarrhoea','diarrhea','nausea',
  'sore','throat','cough','nasal','eye','ear',
  'and','with','for','the','of','in','to','or','by','from','at',
]);

function extractDrugKeyword(name: string, activeIngredient: string | null): string {
  if (activeIngredient?.trim()) {
    return activeIngredient.split(/[\s,/+]+/)[0].trim().toLowerCase();
  }
  const words = name.split(/[\s\-/,()]+/);
  for (const w of words) {
    const clean = w.replace(/[^a-zA-Z]/g, '').toLowerCase();
    if (clean.length >= 4 && !PHARMA_STOP.has(clean) && !/^\d/.test(w)) {
      return clean;
    }
  }
  return '';
}

export async function getGenericAlternatives(
  medicineId: number,
  genericName: string | null,
  activeIngredient: string | null,
  limit = 5,
): Promise<MedicineWithPrice[]> {
  const keyword = extractDrugKeyword(
    (activeIngredient || genericName) ?? '',
    activeIngredient,
  );
  if (!keyword || keyword.length < 3) return [];

  const db = await getDB();
  const { results } = await db.prepare(`
    SELECT m.*, MIN(pp.price_gbp) AS min_price
    FROM   medicines m
    JOIN   pharmacy_prices pp ON pp.medicine_id = m.id
                              AND pp.source != 'nhs_drug_tariff'
    WHERE  m.id != ?1
      AND  m.category NOT IN ('supplement', 'skincare')
      AND  (
        LOWER(m.name)                 LIKE ?2
        OR LOWER(m.generic_name)      LIKE ?2
        OR LOWER(m.active_ingredient) LIKE ?2
        OR EXISTS (
          SELECT 1 FROM ingredients i
          WHERE i.medicine_id = m.id AND LOWER(i.ingredient_name) LIKE ?2
        )
      )
    GROUP  BY m.id
    ORDER  BY MIN(pp.price_gbp) ASC NULLS LAST
    LIMIT  ?3
  `).bind(medicineId, `%${keyword}%`, limit).all<MedicineWithPrice>();
  return results;
}

// ─── Ingredient landing pages ────────────────────────────────────────────────

export async function getMedicinesByIngredient(
  slug: string,
  limit = 40,
  offset = 0,
): Promise<{ rows: MedicineWithPrice[]; total: number; ingredientName: string | null }> {
  const db = await getDB();

  // D1/SQLite has no REGEXP_REPLACE — match slug in JS using the same slugify logic
  const allNames = await db.prepare(
    `SELECT DISTINCT ingredient_name FROM ingredients`,
  ).all<{ ingredient_name: string }>();
  const ingredientName = allNames.results.find(
    (r) => slugify(r.ingredient_name) === slug,
  )?.ingredient_name ?? null;
  if (!ingredientName) return { rows: [], total: 0, ingredientName: null };

  const nameLower = ingredientName.toLowerCase();
  const [countRow, dataRes] = await Promise.all([
    db.prepare(`
      SELECT COUNT(DISTINCT m.id) AS total
      FROM   medicines m
      JOIN   ingredients i ON i.medicine_id = m.id AND LOWER(i.ingredient_name) = ?1
    `).bind(nameLower).first<{ total: number }>(),
    db.prepare(`
      SELECT m.*,
             MIN(CASE WHEN pp.source != 'nhs_drug_tariff' THEN pp.price_gbp END) AS min_price
      FROM   medicines m
      JOIN   ingredients i ON i.medicine_id = m.id AND LOWER(i.ingredient_name) = ?1
      LEFT   JOIN pharmacy_prices pp ON pp.medicine_id = m.id
      GROUP  BY m.id
      ORDER  BY MIN(CASE WHEN pp.source != 'nhs_drug_tariff' THEN pp.price_gbp END) ASC NULLS LAST, m.name
      LIMIT  ?2 OFFSET ?3
    `).bind(nameLower, limit, offset).all<MedicineWithPrice>(),
  ]);
  return { rows: dataRes.results, total: Number(countRow?.total ?? 0), ingredientName };
}

// ─── Pharmacy landing pages ──────────────────────────────────────────────────

export async function getPharmacyList(): Promise<Array<{ pharmacy_name: string; slug: string; count: number }>> {
  const db = await getDB();
  const { results } = await db.prepare(`
    SELECT pharmacy_name, COUNT(DISTINCT medicine_id) AS count
    FROM   pharmacy_prices
    WHERE  source != 'nhs_drug_tariff'
    GROUP  BY pharmacy_name
    ORDER  BY count DESC
  `).all<{ pharmacy_name: string; count: number }>();
  return results.map(r => ({
    pharmacy_name: r.pharmacy_name,
    slug: slugify(r.pharmacy_name),
    count: Number(r.count),
  }));
}

export async function getRetailerCoverage(): Promise<Array<{
  pharmacy_name: string;
  slug: string;
  product_count: number;
  live_price_count: number;
  in_stock_count: number;
  last_checked: string | null;
  sources: string;
}>> {
  const db = await getDB();
  const { results } = await db.prepare(`
    SELECT
      pharmacy_name,
      COUNT(DISTINCT medicine_id) AS product_count,
      COUNT(*) AS live_price_count,
      SUM(CASE WHEN in_stock THEN 1 ELSE 0 END) AS in_stock_count,
      MAX(last_updated) AS last_checked,
      GROUP_CONCAT(DISTINCT COALESCE(source, 'retailer')) AS sources
    FROM pharmacy_prices
    WHERE source != 'nhs_drug_tariff'
    GROUP BY pharmacy_name
    ORDER BY product_count DESC, pharmacy_name ASC
  `).all<{
    pharmacy_name: string;
    product_count: number;
    live_price_count: number;
    in_stock_count: number;
    last_checked: string | null;
    sources: string;
  }>();

  return results.map(r => ({
    ...r,
    slug: slugify(r.pharmacy_name),
    product_count: Number(r.product_count ?? 0),
    live_price_count: Number(r.live_price_count ?? 0),
    in_stock_count: Number(r.in_stock_count ?? 0),
  }));
}

export async function getMedicinesByPharmacy(
  slug: string,
  limit = 40,
  offset = 0,
): Promise<{ rows: MedicineWithPrice[]; total: number; pharmacyName: string | null }> {
  const db = await getDB();

  // D1/SQLite has no REGEXP_REPLACE — match slug in JS
  const allPharmacies = await db.prepare(
    `SELECT DISTINCT pharmacy_name FROM pharmacy_prices WHERE source != 'nhs_drug_tariff'`,
  ).all<{ pharmacy_name: string }>();
  const pharmacyName = allPharmacies.results.find(
    (r) => slugify(r.pharmacy_name) === slug,
  )?.pharmacy_name ?? null;
  if (!pharmacyName) return { rows: [], total: 0, pharmacyName: null };

  const nameLower = pharmacyName.toLowerCase();
  const [countRow, dataRes] = await Promise.all([
    db.prepare(`
      SELECT COUNT(DISTINCT medicine_id) AS total
      FROM   pharmacy_prices
      WHERE  LOWER(pharmacy_name) = ?1 AND source != 'nhs_drug_tariff'
    `).bind(nameLower).first<{ total: number }>(),
    db.prepare(`
      SELECT m.*, MIN(pp.price_gbp) AS min_price
      FROM   medicines m
      JOIN   pharmacy_prices pp ON pp.medicine_id = m.id
                                AND LOWER(pp.pharmacy_name) = ?1
                                AND pp.source != 'nhs_drug_tariff'
      GROUP  BY m.id
      ORDER  BY MIN(pp.price_gbp) ASC, m.name
      LIMIT  ?2 OFFSET ?3
    `).bind(nameLower, limit, offset).all<MedicineWithPrice>(),
  ]);
  return { rows: dataRes.results, total: Number(countRow?.total ?? 0), pharmacyName };
}

// ─── Click tracking ──────────────────────────────────────────────────────────

export async function getPharmacyUrl(priceId: number): Promise<{ url: string; pharmacy_name: string; medicine_id: number } | null> {
  const db = await getDB();
  const row = await db.prepare(
    'SELECT pharmacy_url, pharmacy_name, medicine_id FROM pharmacy_prices WHERE id = ?1',
  ).bind(priceId).first<{ pharmacy_url: string; pharmacy_name: string; medicine_id: number }>();
  if (!row?.pharmacy_url) return null;
  return { url: row.pharmacy_url, pharmacy_name: row.pharmacy_name, medicine_id: row.medicine_id };
}

export async function logPharmacyClick(priceId: number, pharmacyName: string, medicineId: number): Promise<void> {
  try {
    const db = await getDB();
    await db.prepare(
      `INSERT INTO pharmacy_clicks (price_id, medicine_id, pharmacy_name) VALUES (?1, ?2, ?3)`,
    ).bind(priceId, medicineId, pharmacyName).run();
  } catch { /* non-critical — never block a redirect */ }
}

// ─── Price alerts / watchlist ────────────────────────────────────────────────

export interface WatchlistRow {
  id: number;
  email: string;
  medicine_id: number;
  medicine_name: string;
  current_price_gbp: string | null;   // D1 returns REAL; JS coercion keeps formatGBP() working
  new_price_gbp: string | null;
  token: string;
}

export async function createWatchlistEntry(
  email: string,
  medicineId: number,
  currentPriceGbp: string | null,
): Promise<{ token: string; alreadyExists: boolean }> {
  const db = await getDB();
  const existing = await db.prepare(
    'SELECT token FROM watchlist WHERE email = ?1 AND medicine_id = ?2',
  ).bind(email, medicineId).first<{ token: string }>();
  if (existing) return { token: existing.token, alreadyExists: true };

  const token = randomBytes(32).toString('hex');
  const price = currentPriceGbp ? parseFloat(currentPriceGbp) : null;
  await db.prepare(
    `INSERT INTO watchlist (email, medicine_id, current_price_gbp, token) VALUES (?1, ?2, ?3, ?4)`,
  ).bind(email, medicineId, price, token).run();
  return { token, alreadyExists: false };
}

export async function confirmWatchlistEntry(token: string): Promise<boolean> {
  const db = await getDB();
  const result = await db.prepare(
    'UPDATE watchlist SET confirmed = 1 WHERE token = ?1',
  ).bind(token).run();
  return result.meta.changes > 0;
}

export async function deleteWatchlistByToken(token: string): Promise<boolean> {
  const db = await getDB();
  const result = await db.prepare('DELETE FROM watchlist WHERE token = ?1').bind(token).run();
  return result.meta.changes > 0;
}

export async function getWatchlistForPriceCheck(): Promise<WatchlistRow[]> {
  const db = await getDB();
  const { results } = await db.prepare(`
    SELECT w.id, w.email, w.medicine_id, m.name AS medicine_name,
           w.current_price_gbp,
           MIN(pp.price_gbp) AS new_price_gbp,
           w.token
    FROM   watchlist w
    JOIN   medicines m ON m.id = w.medicine_id
    LEFT   JOIN pharmacy_prices pp ON pp.medicine_id = w.medicine_id
                                   AND pp.source != 'nhs_drug_tariff'
    WHERE  w.confirmed = 1
    GROUP  BY w.id, w.email, w.medicine_id, m.name, w.current_price_gbp, w.token
    HAVING MIN(pp.price_gbp) < w.current_price_gbp OR w.current_price_gbp IS NULL
  `).all<WatchlistRow>();
  return results;
}

export async function updateWatchlistPrice(id: number, priceGbp: string | number): Promise<void> {
  const db = await getDB();
  await db.prepare(
    'UPDATE watchlist SET current_price_gbp = ?1 WHERE id = ?2',
  ).bind(parseFloat(String(priceGbp)), id).run();
}

// Atomically claims a watchlist entry for notification by updating current_price_gbp
// only if it still matches the price we read — returns false if another invocation
// already claimed it (current_price_gbp changed), preventing duplicate emails.
export async function claimWatchlistForNotification(
  id: number,
  newPriceGbp: string | number,
): Promise<boolean> {
  const db = await getDB();
  const newPrice = parseFloat(String(newPriceGbp));
  const result = await db.prepare(
    `UPDATE watchlist SET current_price_gbp = ?1
     WHERE id = ?2
       AND (current_price_gbp IS NULL OR current_price_gbp > ?1)`,
  ).bind(newPrice, id).run();
  return result.meta.changes > 0;
}
