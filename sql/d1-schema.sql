-- GeneriQ Cloudflare D1 (SQLite) schema
-- Apply with: wrangler d1 execute generiq --remote --file=sql/d1-schema.sql
-- Note: PRAGMA journal_mode and foreign_keys are managed by D1 internally

CREATE TABLE IF NOT EXISTS medicines (
  id                INTEGER PRIMARY KEY,
  name              TEXT    NOT NULL,
  generic_name      TEXT    NOT NULL DEFAULT '',
  category          TEXT    NOT NULL DEFAULT '',
  description       TEXT    NOT NULL DEFAULT '',
  active_ingredient TEXT    NOT NULL DEFAULT '',
  dosage_form       TEXT    NOT NULL DEFAULT '',
  mhra_approved     INTEGER NOT NULL DEFAULT 0,
  brand_names       TEXT,
  bnf_code          TEXT,
  atc_code          TEXT,
  source            TEXT    NOT NULL DEFAULT 'seed',
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  gender            TEXT,
  subcategory       TEXT,
  barcode           TEXT
);

CREATE TABLE IF NOT EXISTS pharmacy_prices (
  id            INTEGER PRIMARY KEY,
  medicine_id   INTEGER NOT NULL,
  pharmacy_name TEXT    NOT NULL,
  pharmacy_url  TEXT,
  price_gbp     REAL    NOT NULL,
  in_stock      INTEGER NOT NULL DEFAULT 1,
  delivery_info TEXT,
  pack_size     TEXT,
  strength      TEXT,
  last_updated  TEXT    NOT NULL DEFAULT (datetime('now')),
  source        TEXT,
  offer_text    TEXT,
  image_url     TEXT
);

CREATE TABLE IF NOT EXISTS ingredients (
  id              INTEGER PRIMARY KEY,
  medicine_id     INTEGER NOT NULL,
  ingredient_name TEXT    NOT NULL,
  quantity        TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS pharmacy_clicks (
  id            INTEGER PRIMARY KEY,
  price_id      INTEGER,
  medicine_id   INTEGER,
  pharmacy_name TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS watchlist (
  id                INTEGER PRIMARY KEY,
  email             TEXT    NOT NULL,
  medicine_id       INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  current_price_gbp REAL,
  confirmed         INTEGER NOT NULL DEFAULT 0,
  token             TEXT    UNIQUE NOT NULL,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_medicines_name       ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_category   ON medicines(category);
CREATE INDEX IF NOT EXISTS idx_pharmacy_prices_med  ON pharmacy_prices(medicine_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_prices_name ON pharmacy_prices(pharmacy_name);
CREATE INDEX IF NOT EXISTS idx_ingredients_med      ON ingredients(medicine_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_name     ON ingredients(ingredient_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlist_email_med ON watchlist(email, medicine_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_token      ON watchlist(token);

CREATE UNIQUE INDEX IF NOT EXISTS pharmacy_prices_upsert_idx
  ON pharmacy_prices(medicine_id, pharmacy_name, COALESCE(pack_size, ''), COALESCE(strength, ''));
