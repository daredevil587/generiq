-- Run once against your Railway PostgreSQL database
-- Safe to re-run (all statements use IF NOT EXISTS / IF EXISTS guards)

-- Scraper: track which pharmacy product was clicked


CREATE TABLE IF NOT EXISTS pharmacy_clicks (
  id           SERIAL PRIMARY KEY,
  price_id     INTEGER,
  medicine_id  INTEGER,
  pharmacy_name TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watchlist (
  id                   SERIAL PRIMARY KEY,
  email                TEXT NOT NULL,
  medicine_id          INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  current_price_gbp    DECIMAL(10, 2),
  confirmed            BOOLEAN DEFAULT FALSE,
  token                TEXT UNIQUE NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS watchlist_email_med_idx ON watchlist(email, medicine_id);
CREATE        INDEX IF NOT EXISTS watchlist_token_idx     ON watchlist(token);

-- Scraper: offer text on price rows
ALTER TABLE pharmacy_prices ADD COLUMN IF NOT EXISTS offer_text TEXT;

-- Scraper: image url on price rows
ALTER TABLE pharmacy_prices ADD COLUMN IF NOT EXISTS image_url TEXT;


-- Scraper: conflict-free upsert key
CREATE UNIQUE INDEX IF NOT EXISTS pharmacy_prices_upsert_idx
  ON pharmacy_prices (medicine_id, pharmacy_name, COALESCE(pack_size, ''), COALESCE(strength, ''));
