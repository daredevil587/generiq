-- Run once against your Railway PostgreSQL database

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
