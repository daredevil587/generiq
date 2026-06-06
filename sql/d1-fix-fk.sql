-- Drop and recreate ingredients + pharmacy_prices without FK REFERENCES.
-- D1 enforces foreign keys by default and INSERT OR IGNORE does not bypass them.
-- Referential integrity is maintained by application logic instead.

DROP TABLE IF EXISTS ingredients;
DROP TABLE IF EXISTS pharmacy_prices;

CREATE TABLE pharmacy_prices (
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

CREATE TABLE ingredients (
  id              INTEGER PRIMARY KEY,
  medicine_id     INTEGER NOT NULL,
  ingredient_name TEXT    NOT NULL,
  quantity        TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_prices_med  ON pharmacy_prices(medicine_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_prices_name ON pharmacy_prices(pharmacy_name);
CREATE INDEX IF NOT EXISTS idx_ingredients_med      ON ingredients(medicine_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_name     ON ingredients(ingredient_name);

CREATE UNIQUE INDEX IF NOT EXISTS pharmacy_prices_upsert_idx
  ON pharmacy_prices(medicine_id, pharmacy_name, COALESCE(pack_size, ''), COALESCE(strength, ''));
