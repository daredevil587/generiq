/**
 * GeneriQ database setup + migration
 * Creates tables and populates them from:
 *   1. Hardcoded seed medicines (17 medicines with full price data)
 *   2. EMA Excel (930+ unique active substances)
 * Run: node scripts/setup-db.mjs
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const require = createRequire(import.meta.url);
const { Pool } = require('pg');
const XLSX = require('xlsx');

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const EMA_EXCEL = join(
  'C:\\Users\\yadav\\.claude\\projects\\F--geniric-iq\\0c290095-c67a-442d-8af2-0e5fa561bcca\\tool-results',
  'webfetch-1778449897201-bj4iaz.xlsx',
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ─── Schema ───────────────────────────────────────────────────────────────────

async function createTables(client) {
  console.log('Creating tables…');
  await client.query(`
    CREATE TABLE IF NOT EXISTS medicines (
      id               serial PRIMARY KEY,
      name             varchar(255) NOT NULL,
      generic_name     varchar(255),
      category         varchar(255),
      description      text,
      active_ingredient varchar(255),
      dosage_form      varchar(100),
      mhra_approved    boolean DEFAULT false,
      brand_names      text,
      bnf_code         varchar(20),
      atc_code         varchar(20),
      source           varchar(20) DEFAULT 'seed',
      created_at       timestamp DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS pharmacy_prices (
      id            serial PRIMARY KEY,
      medicine_id   integer REFERENCES medicines(id) ON DELETE CASCADE,
      pharmacy_name varchar(100),
      pharmacy_url  varchar(500),
      price_gbp     decimal(10,2),
      in_stock      boolean DEFAULT true,
      delivery_info varchar(200),
      pack_size     varchar(80),
      strength      varchar(80),
      last_updated  timestamp DEFAULT now(),
      source        varchar(20) DEFAULT 'seed'
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id              serial PRIMARY KEY,
      medicine_id     integer REFERENCES medicines(id) ON DELETE CASCADE,
      ingredient_name varchar(255),
      quantity        varchar(100),
      is_active       boolean DEFAULT true
    );
  `);

  // Indexes for fast search
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_medicines_name        ON medicines USING gin(to_tsvector('english', name));
    CREATE INDEX IF NOT EXISTS idx_medicines_generic     ON medicines (LOWER(generic_name));
    CREATE INDEX IF NOT EXISTS idx_medicines_category    ON medicines (category);
    CREATE INDEX IF NOT EXISTS idx_prices_medicine       ON pharmacy_prices (medicine_id);
    CREATE INDEX IF NOT EXISTS idx_ingredients_medicine  ON ingredients (medicine_id);
  `);

  console.log('Tables and indexes ready.');
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED = [
  {
    name: 'Ibuprofen', generic_name: 'Ibuprofen', category: 'Analgesics & NSAIDs',
    description: 'Non-steroidal anti-inflammatory drug (NSAID) used to relieve pain, fever and inflammation.',
    active_ingredient: 'Ibuprofen', dosage_form: 'Tablet', mhra_approved: true,
    brand_names: 'Nurofen, Calprofen, Brufen, Ibugel', bnf_code: '0407010H0',
    prices: [
      { pharmacy_name: 'Pharmacy2U', price_gbp: 0.89, in_stock: true, delivery_info: 'Next day delivery', pack_size: '16 tablets', strength: '200mg' },
      { pharmacy_name: 'Boots', price_gbp: 1.29, in_stock: true, delivery_info: 'In-store', pack_size: '16 tablets', strength: '200mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 1.19, in_stock: true, delivery_info: 'In-store', pack_size: '16 tablets', strength: '200mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 1.09, in_stock: true, delivery_info: '2-day delivery', pack_size: '16 tablets', strength: '200mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 1.15, in_stock: true, delivery_info: 'In-store', pack_size: '16 tablets', strength: '200mg' },
      { pharmacy_name: 'Pharmacy2U', price_gbp: 3.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '84 tablets', strength: '200mg' },
      { pharmacy_name: 'Boots', price_gbp: 5.49, in_stock: true, delivery_info: 'In-store', pack_size: '84 tablets', strength: '200mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 4.99, in_stock: true, delivery_info: 'In-store', pack_size: '84 tablets', strength: '200mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 4.59, in_stock: true, delivery_info: '2-day delivery', pack_size: '84 tablets', strength: '200mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 4.79, in_stock: true, delivery_info: 'In-store', pack_size: '84 tablets', strength: '200mg' },
      { pharmacy_name: 'Pharmacy2U', price_gbp: 5.89, in_stock: true, delivery_info: 'Next day delivery', pack_size: '84 tablets', strength: '400mg' },
      { pharmacy_name: 'Boots', price_gbp: 7.99, in_stock: true, delivery_info: 'In-store', pack_size: '84 tablets', strength: '400mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 7.49, in_stock: true, delivery_info: 'In-store', pack_size: '84 tablets', strength: '400mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 6.99, in_stock: true, delivery_info: '2-day delivery', pack_size: '84 tablets', strength: '400mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 7.29, in_stock: true, delivery_info: 'In-store', pack_size: '84 tablets', strength: '400mg' },
    ],
    ingredients: [{ ingredient_name: 'Ibuprofen', quantity: '200–400mg', is_active: true }],
  },
  {
    name: 'Paracetamol', generic_name: 'Paracetamol', category: 'Analgesics & NSAIDs',
    description: 'Widely used analgesic and antipyretic for mild to moderate pain and fever.',
    active_ingredient: 'Paracetamol', dosage_form: 'Tablet', mhra_approved: true,
    brand_names: 'Panadol, Calpol, Hedex', bnf_code: '0407010AC',
    prices: [
      { pharmacy_name: 'Pharmacy2U', price_gbp: 0.65, in_stock: true, delivery_info: 'Next day delivery', pack_size: '16 tablets', strength: '500mg' },
      { pharmacy_name: 'Boots', price_gbp: 0.75, in_stock: true, delivery_info: 'In-store', pack_size: '16 tablets', strength: '500mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 0.72, in_stock: true, delivery_info: 'In-store', pack_size: '16 tablets', strength: '500mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 0.69, in_stock: true, delivery_info: '2-day delivery', pack_size: '16 tablets', strength: '500mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 0.71, in_stock: true, delivery_info: 'In-store', pack_size: '16 tablets', strength: '500mg' },
      { pharmacy_name: 'Pharmacy2U', price_gbp: 3.45, in_stock: true, delivery_info: 'Next day delivery', pack_size: '100 tablets', strength: '500mg' },
      { pharmacy_name: 'Boots', price_gbp: 4.49, in_stock: true, delivery_info: 'In-store', pack_size: '100 tablets', strength: '500mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 3.99, in_stock: true, delivery_info: 'In-store', pack_size: '100 tablets', strength: '500mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 3.69, in_stock: true, delivery_info: '2-day delivery', pack_size: '100 tablets', strength: '500mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 3.89, in_stock: true, delivery_info: 'In-store', pack_size: '100 tablets', strength: '500mg' },
    ],
    ingredients: [{ ingredient_name: 'Paracetamol', quantity: '500mg', is_active: true }],
  },
  {
    name: 'Amoxicillin', generic_name: 'Amoxicillin', category: 'Antibacterials',
    description: 'Broad-spectrum penicillin antibiotic used for bacterial infections.',
    active_ingredient: 'Amoxicillin', dosage_form: 'Capsule', mhra_approved: true,
    brand_names: 'Amoxil', bnf_code: '0501013B0',
    prices: [
      { pharmacy_name: 'Pharmacy2U', price_gbp: 7.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '21 capsules', strength: '250mg' },
      { pharmacy_name: 'Boots', price_gbp: 9.99, in_stock: true, delivery_info: 'In-store', pack_size: '21 capsules', strength: '250mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 9.49, in_stock: true, delivery_info: 'In-store', pack_size: '21 capsules', strength: '250mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 8.99, in_stock: true, delivery_info: '2-day delivery', pack_size: '21 capsules', strength: '250mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 9.29, in_stock: true, delivery_info: 'In-store', pack_size: '21 capsules', strength: '250mg' },
      { pharmacy_name: 'Pharmacy2U', price_gbp: 10.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '21 capsules', strength: '500mg' },
      { pharmacy_name: 'Boots', price_gbp: 13.99, in_stock: true, delivery_info: 'In-store', pack_size: '21 capsules', strength: '500mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 12.99, in_stock: true, delivery_info: 'In-store', pack_size: '21 capsules', strength: '500mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 11.99, in_stock: true, delivery_info: '2-day delivery', pack_size: '21 capsules', strength: '500mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 12.49, in_stock: true, delivery_info: 'In-store', pack_size: '21 capsules', strength: '500mg' },
    ],
    ingredients: [{ ingredient_name: 'Amoxicillin trihydrate', quantity: '250–500mg', is_active: true }],
  },
  {
    name: 'Atorvastatin', generic_name: 'Atorvastatin', category: 'Cardiovascular — Lipid Regulating',
    description: 'HMG-CoA reductase inhibitor (statin) for lowering cholesterol and reducing cardiovascular risk.',
    active_ingredient: 'Atorvastatin calcium', dosage_form: 'Tablet', mhra_approved: true,
    brand_names: 'Lipitor', bnf_code: '0212000B0',
    prices: [
      { pharmacy_name: 'Pharmacy2U', price_gbp: 9.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 tablets', strength: '10mg' },
      { pharmacy_name: 'Boots', price_gbp: 12.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '10mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 11.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '10mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 10.99, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 tablets', strength: '10mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 11.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '10mg' },
      { pharmacy_name: 'Pharmacy2U', price_gbp: 10.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 tablets', strength: '20mg' },
      { pharmacy_name: 'Boots', price_gbp: 14.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '20mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 13.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '20mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 11.99, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 tablets', strength: '20mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 12.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '20mg' },
      { pharmacy_name: 'Pharmacy2U', price_gbp: 11.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 tablets', strength: '40mg' },
      { pharmacy_name: 'Boots', price_gbp: 15.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '40mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 14.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '40mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 12.99, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 tablets', strength: '40mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 13.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '40mg' },
    ],
    ingredients: [{ ingredient_name: 'Atorvastatin calcium', quantity: '10–40mg', is_active: true }],
  },
  {
    name: 'Lisinopril', generic_name: 'Lisinopril', category: 'Cardiovascular — ACE Inhibitors',
    description: 'ACE inhibitor for hypertension, heart failure, and diabetic nephropathy.',
    active_ingredient: 'Lisinopril', dosage_form: 'Tablet', mhra_approved: true,
    brand_names: 'Zestril, Carace', bnf_code: '0205051P0',
    prices: [
      { pharmacy_name: 'Pharmacy2U', price_gbp: 8.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 tablets', strength: '5mg' },
      { pharmacy_name: 'Boots', price_gbp: 11.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '5mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 10.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '5mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 9.99, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 tablets', strength: '5mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 10.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '5mg' },
      { pharmacy_name: 'Pharmacy2U', price_gbp: 9.49, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 tablets', strength: '10mg' },
      { pharmacy_name: 'Boots', price_gbp: 12.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '10mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 11.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '10mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 10.49, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 tablets', strength: '10mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 10.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '10mg' },
    ],
    ingredients: [{ ingredient_name: 'Lisinopril dihydrate', quantity: '5–10mg', is_active: true }],
  },
  {
    name: 'Amlodipine', generic_name: 'Amlodipine', category: 'Cardiovascular — Calcium Channel Blockers',
    description: 'Calcium channel blocker for hypertension and angina.',
    active_ingredient: 'Amlodipine besilate', dosage_form: 'Tablet', mhra_approved: true,
    brand_names: 'Istin', bnf_code: '0206020A0',
    prices: [
      { pharmacy_name: 'Pharmacy2U', price_gbp: 8.49, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 tablets', strength: '5mg' },
      { pharmacy_name: 'Boots', price_gbp: 11.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '5mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 10.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '5mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 9.49, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 tablets', strength: '5mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 9.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '5mg' },
      { pharmacy_name: 'Pharmacy2U', price_gbp: 8.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 tablets', strength: '10mg' },
      { pharmacy_name: 'Boots', price_gbp: 11.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '10mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 10.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '10mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 9.99, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 tablets', strength: '10mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 10.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '10mg' },
    ],
    ingredients: [{ ingredient_name: 'Amlodipine besilate', quantity: '5–10mg', is_active: true }],
  },
  {
    name: 'Metformin', generic_name: 'Metformin', category: 'Diabetes — Biguanides',
    description: 'First-line oral antidiabetic for type 2 diabetes mellitus.',
    active_ingredient: 'Metformin hydrochloride', dosage_form: 'Tablet', mhra_approved: true,
    brand_names: 'Glucophage', bnf_code: '0601022B0',
    prices: [
      { pharmacy_name: 'Pharmacy2U', price_gbp: 10.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '84 tablets', strength: '500mg' },
      { pharmacy_name: 'Boots', price_gbp: 14.99, in_stock: true, delivery_info: 'In-store', pack_size: '84 tablets', strength: '500mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 13.49, in_stock: true, delivery_info: 'In-store', pack_size: '84 tablets', strength: '500mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 11.99, in_stock: true, delivery_info: '2-day delivery', pack_size: '84 tablets', strength: '500mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 12.49, in_stock: true, delivery_info: 'In-store', pack_size: '84 tablets', strength: '500mg' },
      { pharmacy_name: 'Pharmacy2U', price_gbp: 11.49, in_stock: true, delivery_info: 'Next day delivery', pack_size: '56 tablets', strength: '850mg' },
      { pharmacy_name: 'Boots', price_gbp: 15.49, in_stock: true, delivery_info: 'In-store', pack_size: '56 tablets', strength: '850mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 13.99, in_stock: true, delivery_info: 'In-store', pack_size: '56 tablets', strength: '850mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 12.49, in_stock: true, delivery_info: '2-day delivery', pack_size: '56 tablets', strength: '850mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 12.99, in_stock: true, delivery_info: 'In-store', pack_size: '56 tablets', strength: '850mg' },
    ],
    ingredients: [{ ingredient_name: 'Metformin hydrochloride', quantity: '500–850mg', is_active: true }],
  },
  {
    name: 'Omeprazole', generic_name: 'Omeprazole', category: 'Gastro-intestinal — Proton Pump Inhibitors',
    description: 'Proton pump inhibitor (PPI) for gastric acid-related conditions including GORD and peptic ulcers.',
    active_ingredient: 'Omeprazole', dosage_form: 'Gastro-resistant Capsule', mhra_approved: true,
    brand_names: 'Losec, Mepradec', bnf_code: '0103050E0',
    prices: [
      { pharmacy_name: 'Pharmacy2U', price_gbp: 12.49, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 capsules', strength: '20mg' },
      { pharmacy_name: 'Boots', price_gbp: 16.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 capsules', strength: '20mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 14.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 capsules', strength: '20mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 13.49, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 capsules', strength: '20mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 13.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 capsules', strength: '20mg' },
      { pharmacy_name: 'Pharmacy2U', price_gbp: 14.49, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 capsules', strength: '40mg' },
      { pharmacy_name: 'Boots', price_gbp: 18.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 capsules', strength: '40mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 16.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 capsules', strength: '40mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 15.49, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 capsules', strength: '40mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 15.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 capsules', strength: '40mg' },
    ],
    ingredients: [{ ingredient_name: 'Omeprazole', quantity: '20–40mg', is_active: true }],
  },
  {
    name: 'Sertraline', generic_name: 'Sertraline', category: 'Antidepressants — SSRIs',
    description: 'Selective serotonin reuptake inhibitor (SSRI) for depression, OCD, panic disorder and PTSD.',
    active_ingredient: 'Sertraline hydrochloride', dosage_form: 'Tablet', mhra_approved: true,
    brand_names: 'Lustral', bnf_code: '0403030AC',
    prices: [
      { pharmacy_name: 'Pharmacy2U', price_gbp: 17.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 tablets', strength: '50mg' },
      { pharmacy_name: 'Boots', price_gbp: 22.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '50mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 20.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '50mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 18.99, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 tablets', strength: '50mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 19.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '50mg' },
      { pharmacy_name: 'Pharmacy2U', price_gbp: 24.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 tablets', strength: '100mg' },
      { pharmacy_name: 'Boots', price_gbp: 31.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '100mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 28.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '100mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 26.49, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 tablets', strength: '100mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 27.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '100mg' },
    ],
    ingredients: [{ ingredient_name: 'Sertraline hydrochloride', quantity: '50–100mg', is_active: true }],
  },
  {
    name: 'Salbutamol', generic_name: 'Salbutamol', category: 'Respiratory — Bronchodilators',
    description: 'Short-acting beta-2 agonist (SABA) for acute relief of bronchospasm in asthma and COPD.',
    active_ingredient: 'Salbutamol', dosage_form: 'CFC-free Inhaler', mhra_approved: true,
    brand_names: 'Ventolin, Salamol, Airomir', bnf_code: '0301011R0',
    prices: [
      { pharmacy_name: 'Pharmacy2U', price_gbp: 19.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '200 dose inhaler', strength: '100mcg/actuation' },
      { pharmacy_name: 'Boots', price_gbp: 25.99, in_stock: true, delivery_info: 'In-store', pack_size: '200 dose inhaler', strength: '100mcg/actuation' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 23.99, in_stock: true, delivery_info: 'In-store', pack_size: '200 dose inhaler', strength: '100mcg/actuation' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 21.99, in_stock: true, delivery_info: '2-day delivery', pack_size: '200 dose inhaler', strength: '100mcg/actuation' },
      { pharmacy_name: 'Day Lewis', price_gbp: 22.99, in_stock: true, delivery_info: 'In-store', pack_size: '200 dose inhaler', strength: '100mcg/actuation' },
    ],
    ingredients: [{ ingredient_name: 'Salbutamol (as sulphate)', quantity: '100mcg/actuation', is_active: true }],
  },
  {
    name: 'Ramipril', generic_name: 'Ramipril', category: 'Cardiovascular — ACE Inhibitors',
    description: 'ACE inhibitor for hypertension, heart failure, post-MI, and diabetic nephropathy.',
    active_ingredient: 'Ramipril', dosage_form: 'Capsule', mhra_approved: true,
    brand_names: 'Tritace', bnf_code: '0205051R0',
    prices: [
      { pharmacy_name: 'Pharmacy2U', price_gbp: 8.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 capsules', strength: '2.5mg' },
      { pharmacy_name: 'Boots', price_gbp: 11.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 capsules', strength: '2.5mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 10.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 capsules', strength: '2.5mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 9.99, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 capsules', strength: '2.5mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 10.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 capsules', strength: '2.5mg' },
      { pharmacy_name: 'Pharmacy2U', price_gbp: 9.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 capsules', strength: '5mg' },
      { pharmacy_name: 'Boots', price_gbp: 12.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 capsules', strength: '5mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 11.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 capsules', strength: '5mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 10.99, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 capsules', strength: '5mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 11.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 capsules', strength: '5mg' },
    ],
    ingredients: [{ ingredient_name: 'Ramipril', quantity: '2.5–5mg', is_active: true }],
  },
  {
    name: 'Bisoprolol', generic_name: 'Bisoprolol', category: 'Cardiovascular — Beta Blockers',
    description: 'Selective beta-1 blocker for hypertension, angina, and heart failure.',
    active_ingredient: 'Bisoprolol fumarate', dosage_form: 'Tablet', mhra_approved: true,
    brand_names: 'Cardicor, Emcor', bnf_code: '0206020B0',
    prices: [
      { pharmacy_name: 'Pharmacy2U', price_gbp: 8.49, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 tablets', strength: '2.5mg' },
      { pharmacy_name: 'Boots', price_gbp: 11.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '2.5mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 10.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '2.5mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 9.49, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 tablets', strength: '2.5mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 9.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '2.5mg' },
      { pharmacy_name: 'Pharmacy2U', price_gbp: 8.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 tablets', strength: '5mg' },
      { pharmacy_name: 'Boots', price_gbp: 11.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '5mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 10.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '5mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 9.99, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 tablets', strength: '5mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 10.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '5mg' },
    ],
    ingredients: [{ ingredient_name: 'Bisoprolol fumarate', quantity: '2.5–5mg', is_active: true }],
  },
  {
    name: 'Naproxen', generic_name: 'Naproxen', category: 'Analgesics & NSAIDs',
    description: 'NSAID used for pain, inflammation, and musculoskeletal disorders.',
    active_ingredient: 'Naproxen', dosage_form: 'Tablet', mhra_approved: true,
    brand_names: 'Naprosyn, Feminax Ultra', bnf_code: '1001010M0',
    prices: [
      { pharmacy_name: 'Pharmacy2U', price_gbp: 15.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 tablets', strength: '250mg' },
      { pharmacy_name: 'Boots', price_gbp: 20.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '250mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 18.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '250mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 16.99, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 tablets', strength: '250mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 17.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '250mg' },
      { pharmacy_name: 'Pharmacy2U', price_gbp: 20.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 tablets', strength: '500mg' },
      { pharmacy_name: 'Boots', price_gbp: 26.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '500mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 24.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '500mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 22.99, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 tablets', strength: '500mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 23.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '500mg' },
    ],
    ingredients: [{ ingredient_name: 'Naproxen', quantity: '250–500mg', is_active: true }],
  },
  {
    name: 'Fluoxetine', generic_name: 'Fluoxetine', category: 'Antidepressants — SSRIs',
    description: 'SSRI for depression, OCD, bulimia nervosa and panic disorder.',
    active_ingredient: 'Fluoxetine hydrochloride', dosage_form: 'Capsule', mhra_approved: true,
    brand_names: 'Prozac, Oxactin', bnf_code: '0403030E0',
    prices: [
      { pharmacy_name: 'Pharmacy2U', price_gbp: 13.49, in_stock: true, delivery_info: 'Next day delivery', pack_size: '30 capsules', strength: '20mg' },
      { pharmacy_name: 'Boots', price_gbp: 17.49, in_stock: true, delivery_info: 'In-store', pack_size: '30 capsules', strength: '20mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 15.99, in_stock: true, delivery_info: 'In-store', pack_size: '30 capsules', strength: '20mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 14.49, in_stock: true, delivery_info: '2-day delivery', pack_size: '30 capsules', strength: '20mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 14.99, in_stock: true, delivery_info: 'In-store', pack_size: '30 capsules', strength: '20mg' },
    ],
    ingredients: [{ ingredient_name: 'Fluoxetine hydrochloride', quantity: '20mg', is_active: true }],
  },
  {
    name: 'Lansoprazole', generic_name: 'Lansoprazole', category: 'Gastro-intestinal — Proton Pump Inhibitors',
    description: 'Proton pump inhibitor for GORD, peptic ulcers, and H. pylori eradication.',
    active_ingredient: 'Lansoprazole', dosage_form: 'Gastro-resistant Capsule', mhra_approved: true,
    brand_names: 'Zoton FasTab', bnf_code: '0103050C0',
    prices: [
      { pharmacy_name: 'Pharmacy2U', price_gbp: 10.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 capsules', strength: '15mg' },
      { pharmacy_name: 'Boots', price_gbp: 14.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 capsules', strength: '15mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 12.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 capsules', strength: '15mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 11.49, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 capsules', strength: '15mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 11.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 capsules', strength: '15mg' },
      { pharmacy_name: 'Pharmacy2U', price_gbp: 12.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 capsules', strength: '30mg' },
      { pharmacy_name: 'Boots', price_gbp: 16.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 capsules', strength: '30mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 15.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 capsules', strength: '30mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 13.99, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 capsules', strength: '30mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 14.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 capsules', strength: '30mg' },
    ],
    ingredients: [{ ingredient_name: 'Lansoprazole', quantity: '15–30mg', is_active: true }],
  },
  {
    name: 'Doxycycline', generic_name: 'Doxycycline', category: 'Antibacterials — Tetracyclines',
    description: 'Tetracycline antibiotic for respiratory, urogenital and skin infections, and malaria prophylaxis.',
    active_ingredient: 'Doxycycline hyclate', dosage_form: 'Capsule', mhra_approved: true,
    brand_names: 'Vibramycin-D, Efracea', bnf_code: '0501030P0',
    prices: [
      { pharmacy_name: 'Pharmacy2U', price_gbp: 21.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '8 capsules', strength: '100mg' },
      { pharmacy_name: 'Boots', price_gbp: 27.99, in_stock: true, delivery_info: 'In-store', pack_size: '8 capsules', strength: '100mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 25.99, in_stock: true, delivery_info: 'In-store', pack_size: '8 capsules', strength: '100mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 23.99, in_stock: true, delivery_info: '2-day delivery', pack_size: '8 capsules', strength: '100mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 24.99, in_stock: true, delivery_info: 'In-store', pack_size: '8 capsules', strength: '100mg' },
    ],
    ingredients: [{ ingredient_name: 'Doxycycline hyclate', quantity: '100mg', is_active: true }],
  },
  {
    name: 'Simvastatin', generic_name: 'Simvastatin', category: 'Cardiovascular — Lipid Regulating',
    description: 'HMG-CoA reductase inhibitor (statin) for lowering cholesterol.',
    active_ingredient: 'Simvastatin', dosage_form: 'Tablet', mhra_approved: true,
    brand_names: 'Zocor', bnf_code: '0212000Y0',
    prices: [
      { pharmacy_name: 'Pharmacy2U', price_gbp: 8.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 tablets', strength: '10mg' },
      { pharmacy_name: 'Boots', price_gbp: 11.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '10mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 10.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '10mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 9.99, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 tablets', strength: '10mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 10.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '10mg' },
      { pharmacy_name: 'Pharmacy2U', price_gbp: 9.99, in_stock: true, delivery_info: 'Next day delivery', pack_size: '28 tablets', strength: '40mg' },
      { pharmacy_name: 'Boots', price_gbp: 12.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '40mg' },
      { pharmacy_name: 'Lloyds Pharmacy', price_gbp: 11.99, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '40mg' },
      { pharmacy_name: 'Well Pharmacy', price_gbp: 10.99, in_stock: true, delivery_info: '2-day delivery', pack_size: '28 tablets', strength: '40mg' },
      { pharmacy_name: 'Day Lewis', price_gbp: 11.49, in_stock: true, delivery_info: 'In-store', pack_size: '28 tablets', strength: '40mg' },
    ],
    ingredients: [{ ingredient_name: 'Simvastatin', quantity: '10–40mg', is_active: true }],
  },
];

// ─── EMA parsing (reuse from import-medicines.mjs) ────────────────────────────

const COL = { category:0, name:1, productNum:2, status:3, inn:6, substance:7, meshArea:8, atcCode:11, pharmGroup:13, indication:15 };
const ATC_CATEGORY = { A:'Alimentary & Metabolism', B:'Blood & Blood-forming Organs', C:'Cardiovascular', D:'Dermatology', G:'Genito-urinary & Sex Hormones', H:'Systemic Hormonal Preparations', J:'Anti-infectives (Systemic)', L:'Antineoplastic & Immunomodulating', M:'Musculoskeletal', N:'Nervous System', P:'Antiparasitic', R:'Respiratory', S:'Sensory Organs', V:'Various' };

function atcToCategory(atcCode, pharmGroup) {
  if (atcCode) { const l = atcCode.charAt(0).toUpperCase(); if (ATC_CATEGORY[l]) return ATC_CATEGORY[l]; }
  if (pharmGroup) { const pg = pharmGroup.toString().trim(); return pg.charAt(0).toUpperCase() + pg.slice(1, 50); }
  return 'Other';
}

function toTitleCase(str) {
  return str.toLowerCase().split(/[\s,;]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').trim();
}

function truncate(str, max = 280) {
  if (!str) return '';
  const s = str.toString().replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.lastIndexOf(' ', max);
  return s.slice(0, cut > 0 ? cut : max) + '…';
}

function parseEMA() {
  console.log('Parsing EMA Excel…');
  const wb = XLSX.readFile(EMA_EXCEL);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const bySubstance = new Map();
  for (const row of rows.slice(9)) {
    if (!row || row.length < 10) continue;
    if ((row[COL.category] || '').toString().trim() !== 'Human') continue;
    if (!(row[COL.status] || '').toString().toLowerCase().includes('authorised')) continue;
    const brandName = (row[COL.name] || '').toString().trim();
    const inn = (row[COL.inn] || row[COL.substance] || '').toString().trim();
    if (!inn || inn.length < 2) continue;
    const primaryInn = inn.split(';')[0].trim();
    const normKey = primaryInn.toLowerCase();
    const atcCode = (row[COL.atcCode] || '').toString().trim();
    const pharmGroup = (row[COL.pharmGroup] || '').toString().trim();
    const indication = row[COL.indication] ? truncate(row[COL.indication].toString()) : '';
    const productNum = (row[COL.productNum] || '').toString().trim();
    if (bySubstance.has(normKey)) {
      const ex = bySubstance.get(normKey);
      if (brandName && !ex.brandNames.includes(brandName)) ex.brandNames.push(brandName);
      if (productNum && !ex.emaProductNums.includes(productNum)) ex.emaProductNums.push(productNum);
      if (indication.length > (ex.description || '').length) ex.description = indication;
    } else {
      bySubstance.set(normKey, {
        name: toTitleCase(primaryInn),
        generic_name: toTitleCase(primaryInn),
        active_ingredient: toTitleCase(primaryInn),
        category: atcToCategory(atcCode, pharmGroup),
        description: indication,
        dosage_form: null,
        mhra_approved: true,
        brand_names: brandName || null,
        atc_code: atcCode || null,
        source: 'ema',
        brandNames: brandName ? [brandName] : [],
        emaProductNums: productNum ? [productNum] : [],
      });
    }
  }
  // Finalise brand_names field
  for (const med of bySubstance.values()) {
    med.brand_names = med.brandNames.slice(0, 6).join(', ') || null;
  }
  console.log(`EMA: ${bySubstance.size} unique active substances`);
  return [...bySubstance.values()];
}

// ─── Insert helpers ───────────────────────────────────────────────────────────

async function insertMedicine(client, m) {
  const res = await client.query(`
    INSERT INTO medicines (name, generic_name, category, description, active_ingredient, dosage_form, mhra_approved, brand_names, bnf_code, atc_code, source)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING id
  `, [m.name, m.generic_name, m.category, m.description, m.active_ingredient, m.dosage_form, m.mhra_approved, m.brand_names, m.bnf_code || null, m.atc_code || null, m.source || 'seed']);
  return res.rows[0].id;
}

async function insertPrices(client, medicineId, prices) {
  for (const p of prices) {
    await client.query(`
      INSERT INTO pharmacy_prices (medicine_id, pharmacy_name, pharmacy_url, price_gbp, in_stock, delivery_info, pack_size, strength, source)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [medicineId, p.pharmacy_name, p.pharmacy_url || null, p.price_gbp, p.in_stock, p.delivery_info, p.pack_size, p.strength, p.source || 'seed']);
  }
}

async function insertIngredients(client, medicineId, ingredients) {
  for (const ing of ingredients) {
    await client.query(`
      INSERT INTO ingredients (medicine_id, ingredient_name, quantity, is_active)
      VALUES ($1,$2,$3,$4)
    `, [medicineId, ing.ingredient_name, ing.quantity, ing.is_active]);
  }
}

async function batchInsertEMA(client, emaMeds, seedNames) {
  console.log(`Inserting ${emaMeds.length} EMA medicines (skipping ${seedNames.size} already seeded)…`);
  let inserted = 0;
  for (const m of emaMeds) {
    if (seedNames.has(m.name.toLowerCase())) continue;
    const id = await insertMedicine(client, m);
    await client.query(
      'INSERT INTO ingredients (medicine_id, ingredient_name, is_active) VALUES ($1,$2,true)',
      [id, m.active_ingredient]
    );
    inserted++;
  }
  console.log(`EMA: inserted ${inserted} medicines`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect();
  try {
    console.log('=== GeneriQ DB Setup ===\n');

    await createTables(client);

    // Clear existing data for idempotent re-runs
    console.log('Clearing existing data…');
    await client.query('TRUNCATE medicines RESTART IDENTITY CASCADE');

    // 1. Seed medicines
    console.log(`\nInserting ${SEED.length} seed medicines with prices…`);
    const seedNames = new Set();
    for (const m of SEED) {
      const id = await insertMedicine(client, m);
      await insertPrices(client, id, m.prices);
      await insertIngredients(client, id, m.ingredients);
      seedNames.add(m.name.toLowerCase());
    }
    console.log(`Seed: inserted ${SEED.length} medicines with ${SEED.reduce((n,m)=>n+m.prices.length,0)} prices`);

    // 2. EMA medicines
    const emaMeds = parseEMA();
    await batchInsertEMA(client, emaMeds, seedNames);

    // Final count
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM medicines)       AS medicines,
        (SELECT COUNT(*) FROM pharmacy_prices) AS prices,
        (SELECT COUNT(*) FROM ingredients)     AS ingredients
    `);
    console.log('\n=== Done ===');
    console.log(`Medicines:       ${counts.rows[0].medicines}`);
    console.log(`Pharmacy prices: ${counts.rows[0].prices}`);
    console.log(`Ingredients:     ${counts.rows[0].ingredients}`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
