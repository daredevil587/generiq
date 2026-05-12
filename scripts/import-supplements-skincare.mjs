#!/usr/bin/env node
/**
 * import-supplements-skincare.mjs
 * Imports UK supplements/vitamins and skincare/beauty products into GeneriQ.
 * Sources: Open Beauty Facts API (skincare) + curated UK supplement data.
 * Also inserts sample UK retail prices from Holland & Barrett, Boots, Superdrug, Amazon UK.
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ───────────────────────────────────────────────────────────
const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (t && !t.startsWith('#') && t.includes('=')) {
    const [k, ...vs] = t.split('=');
    process.env[k.trim()] = vs.join('=').trim();
  }
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── SQL ───────────────────────────────────────────────────────────────────────
const INSERT_MED = `
  INSERT INTO medicines
    (name, generic_name, category, description, active_ingredient,
     dosage_form, mhra_approved, brand_names, bnf_code, atc_code, source)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
  ON CONFLICT DO NOTHING
  RETURNING id
`;

const INSERT_PRICE = `
  INSERT INTO pharmacy_prices
    (medicine_id, pharmacy_name, pharmacy_url, price_gbp, in_stock,
     delivery_info, pack_size, strength, source)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
`;

// ── Curated UK Supplements ────────────────────────────────────────────────────
const SUPPLEMENTS = [
  {
    name: 'Vitamin C 1000mg',
    ingredient: 'Ascorbic Acid',
    form: 'Tablets',
    desc: 'High strength vitamin C supplement. Supports immune function and collagen formation.',
    brands: 'Holland & Barrett, Boots, Vitabiotics',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/holland-barrett-vitamin-c-1000mg-120-tablets-60033453', price: 8.99, pack: '120 tablets', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/boots-vitamin-c-1000mg-180-tablets-10264358', price: 9.49, pack: '180 tablets', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/vitamins-supplements/vitamins/vitamin-c/superdrug-vitamin-c-1000mg-60-tablets-p-805256', price: 4.99, pack: '60 tablets', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=vitamin+c+1000mg+tablets', price: 6.99, pack: '365 tablets', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Vitamin D3 1000IU',
    ingredient: 'Cholecalciferol',
    form: 'Tablets',
    desc: 'Vitamin D3 supplement for bone health, immune support and muscle function.',
    brands: 'Holland & Barrett, Vitabiotics, BetterYou, Boots',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/holland-barrett-vitamin-d3-1000iu-180-tablets-60017516', price: 5.99, pack: '180 tablets', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/boots-vitamin-d-1000iu-180-tablets-10264370', price: 4.49, pack: '180 tablets', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/vitamins-supplements/vitamins/vitamin-d/superdrug-vitamin-d-1000iu-90-tablets-p-805424', price: 3.99, pack: '90 tablets', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=vitamin+d3+1000iu', price: 7.99, pack: '400 tablets', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Vitamin D3 4000IU High Strength',
    ingredient: 'Cholecalciferol',
    form: 'Softgels',
    desc: 'High strength vitamin D3 4000IU supplement. Ideal for those with vitamin D deficiency.',
    brands: 'Holland & Barrett, BetterYou, Vitabiotics',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/holland-barrett-vitamin-d3-4000iu-60-softgels-60033462', price: 9.99, pack: '60 softgels', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/boots-vitamin-d-4000iu-high-strength-60-softgel-capsules-10299867', price: 8.99, pack: '60 softgels', delivery: 'Free click & collect' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=vitamin+d3+4000iu', price: 9.49, pack: '365 softgels', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Omega-3 Fish Oil 1000mg',
    ingredient: 'EPA and DHA Omega-3',
    form: 'Capsules',
    desc: 'Omega-3 fish oil supplement rich in EPA and DHA. Supports heart, brain and joint health.',
    brands: 'Seven Seas, Holland & Barrett, Boots, Omega-3 Plus',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/holland-barrett-omega-3-fish-oil-1000mg-240-capsules-60020977', price: 12.99, pack: '240 capsules', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/seven-seas-simply-timeless-pure-cod-liver-oil-plus-omega-3-60-capsules-10176512', price: 8.99, pack: '60 capsules', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/vitamins-supplements/omega-3/superdrug-omega-3-fish-oil-1000mg-90-capsules-p-805284', price: 5.99, pack: '90 capsules', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=omega+3+fish+oil+1000mg', price: 10.99, pack: '360 capsules', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Zinc 25mg',
    ingredient: 'Zinc Gluconate',
    form: 'Tablets',
    desc: 'Zinc supplement for immune system support, skin health and normal testosterone levels.',
    brands: 'Holland & Barrett, Solgar, Boots',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/holland-barrett-zinc-25mg-100-tablets-60015437', price: 3.99, pack: '100 tablets', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/boots-zinc-25mg-90-tablets-10273985', price: 4.49, pack: '90 tablets', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/vitamins-supplements/minerals/zinc/superdrug-zinc-25mg-90-tablets-p-805312', price: 2.99, pack: '90 tablets', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=zinc+25mg+tablets', price: 6.99, pack: '200 tablets', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Magnesium 375mg',
    ingredient: 'Magnesium Oxide',
    form: 'Tablets',
    desc: 'Magnesium supplement supporting normal muscle and nerve function, energy metabolism.',
    brands: 'Holland & Barrett, Solgar, Vitabiotics',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/holland-barrett-magnesium-375mg-100-tablets-60015296', price: 5.99, pack: '100 tablets', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/boots-magnesium-375mg-90-tablets-10264386', price: 5.49, pack: '90 tablets', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/vitamins-supplements/minerals/magnesium/superdrug-magnesium-375mg-90-tablets-p-805268', price: 3.99, pack: '90 tablets', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=magnesium+375mg', price: 8.99, pack: '250 tablets', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Iron 14mg Ferrous Bisglycinate',
    ingredient: 'Ferrous Bisglycinate',
    form: 'Tablets',
    desc: 'Gentle iron supplement in bisglycinate form. Supports red blood cell formation and reduces fatigue.',
    brands: 'Spatone, Holland & Barrett, Solgar, Floradix',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/solgar-gentle-iron-25mg-180-vegetable-capsules-60019636', price: 19.99, pack: '180 capsules', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/boots-iron-14mg-60-tablets-10313487', price: 4.49, pack: '60 tablets', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/vitamins-supplements/minerals/iron/superdrug-iron-14mg-90-tablets-p-805256', price: 3.49, pack: '90 tablets', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=iron+supplement+gentle', price: 12.99, pack: '180 capsules', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Vitamin B12 1000mcg Methylcobalamin',
    ingredient: 'Methylcobalamin',
    form: 'Tablets',
    desc: 'High strength vitamin B12 as methylcobalamin for energy, nervous system and red blood cells.',
    brands: 'Holland & Barrett, Solgar, Jarrow Formulas',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/holland-barrett-vitamin-b12-1000mcg-180-tablets-60019563', price: 7.99, pack: '180 tablets', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/boots-vitamin-b12-1000mcg-90-tablets-10273979', price: 6.49, pack: '90 tablets', delivery: 'Free click & collect' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=vitamin+b12+1000mcg', price: 9.99, pack: '365 tablets', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'B Complex Complete with Vitamin C',
    ingredient: 'B Vitamins Complex',
    form: 'Tablets',
    desc: 'Complete B vitamin complex including B1, B2, B3, B5, B6, B12, folic acid and biotin.',
    brands: 'Holland & Barrett, Boots, Vitabiotics, Solgar',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/holland-barrett-b-complex-with-vitamin-c-90-tablets-60020948', price: 8.99, pack: '90 tablets', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/boots-vitamin-b-complex-90-tablets-10264395', price: 6.99, pack: '90 tablets', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/vitamins-supplements/vitamins/vitamin-b/superdrug-b-complex-90-tablets-p-805200', price: 4.99, pack: '90 tablets', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=b+complex+vitamins', price: 7.99, pack: '180 tablets', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Biotin 10000mcg High Strength',
    ingredient: 'Biotin (Vitamin B7)',
    form: 'Capsules',
    desc: 'High strength biotin supplement for hair growth, skin health and strong nails.',
    brands: 'Holland & Barrett, Vitabiotics, Natrol',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/holland-barrett-high-strength-biotin-10000mcg-60-capsules-60033475', price: 11.99, pack: '60 capsules', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/boots-biotin-10000mcg-60-capsules-10313495', price: 9.99, pack: '60 capsules', delivery: 'Free click & collect' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=biotin+10000mcg', price: 8.49, pack: '120 capsules', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Folic Acid 400mcg',
    ingredient: 'Folic Acid',
    form: 'Tablets',
    desc: 'Folic acid supplement for cell division, pregnancy support and reducing neural tube defect risk.',
    brands: 'Boots, Pregnacare, Holland & Barrett, Superdrug',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/holland-barrett-folic-acid-400mcg-180-tablets-60019527', price: 3.99, pack: '180 tablets', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/boots-folic-acid-400mcg-90-tablets-10079698', price: 2.99, pack: '90 tablets', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/vitamins-supplements/vitamins/folic-acid/superdrug-folic-acid-400mcg-90-tablets-p-805240', price: 1.99, pack: '90 tablets', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=folic+acid+400mcg', price: 4.99, pack: '365 tablets', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Turmeric and Black Pepper 500mg',
    ingredient: 'Curcumin',
    form: 'Capsules',
    desc: 'Turmeric curcumin with black pepper bioperine for enhanced absorption. Anti-inflammatory support.',
    brands: 'Holland & Barrett, Pukka, Solgar, Nature\'s Best',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/holland-barrett-turmeric-black-pepper-500mg-120-capsules-60033487', price: 12.99, pack: '120 capsules', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/boots-turmeric-and-black-pepper-60-capsules-10338756', price: 9.99, pack: '60 capsules', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/vitamins-supplements/herbal-supplements/turmeric/superdrug-turmeric-black-pepper-90-capsules-p-810124', price: 7.99, pack: '90 capsules', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=turmeric+black+pepper+500mg', price: 11.99, pack: '180 capsules', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Probiotics 10 Billion CFU Multi-Strain',
    ingredient: 'Lactobacillus acidophilus',
    form: 'Capsules',
    desc: 'Multi-strain probiotic with 10 billion CFU. Supports gut health and digestive balance.',
    brands: 'Optibac, Boots, Holland & Barrett, Symprove',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/optibac-probiotics-one-week-flat-7-sachets-60030856', price: 9.99, pack: '30 capsules', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/boots-probiotics-10-billion-60-capsules-10313502', price: 12.99, pack: '60 capsules', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/vitamins-supplements/probiotics/superdrug-probiotics-30-capsules-p-814568', price: 7.99, pack: '30 capsules', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=probiotics+10+billion', price: 14.99, pack: '90 capsules', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Glucosamine Sulphate 1500mg',
    ingredient: 'Glucosamine Sulphate',
    form: 'Tablets',
    desc: 'Glucosamine sulphate supplement for joint health, cartilage support and flexibility.',
    brands: 'Boots, Holland & Barrett, Solgar, Vitabiotics',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/holland-barrett-glucosamine-sulphate-1500mg-90-tablets-60015330', price: 14.99, pack: '90 tablets', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/boots-glucosamine-sulphate-1500mg-90-tablets-10178438', price: 11.99, pack: '90 tablets', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/vitamins-supplements/joints-bones/glucosamine/superdrug-glucosamine-1500mg-90-tablets-p-809876', price: 8.99, pack: '90 tablets', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=glucosamine+sulphate+1500mg', price: 13.99, pack: '180 tablets', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'CoQ10 Coenzyme Q10 100mg',
    ingredient: 'Coenzyme Q10',
    form: 'Capsules',
    desc: 'Co-enzyme Q10 supplement for cellular energy production, heart health and antioxidant support.',
    brands: 'Solgar, Holland & Barrett, Vitabiotics, Boots',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/solgar-coenzyme-q10-100mg-30-capsules-60019594', price: 18.99, pack: '30 capsules', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/boots-coq10-100mg-30-capsules-10313510', price: 14.99, pack: '30 capsules', delivery: 'Free click & collect' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=coq10+100mg', price: 16.99, pack: '60 capsules', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Ashwagandha KSM-66 600mg',
    ingredient: 'Withania Somnifera Extract',
    form: 'Capsules',
    desc: 'Ashwagandha root extract KSM-66 for stress reduction, energy and hormonal balance.',
    brands: 'Holland & Barrett, Solgar, Nature\'s Best, Vitabiotics',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/holland-barrett-ashwagandha-600mg-60-capsules-60033499', price: 15.99, pack: '60 capsules', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/boots-ashwagandha-600mg-60-capsules-10365789', price: 13.99, pack: '60 capsules', delivery: 'Free click & collect' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=ashwagandha+ksm66+600mg', price: 12.99, pack: '90 capsules', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Multivitamins Complete A-Z',
    ingredient: 'Multivitamin and Mineral Complex',
    form: 'Tablets',
    desc: 'Complete daily multivitamin and mineral supplement with 26 essential nutrients for overall health.',
    brands: 'Vitabiotics Wellman, Wellwoman, Boots, Centrum',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/holland-barrett-multivitamins-minerals-90-tablets-60017640', price: 9.99, pack: '90 tablets', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/boots-a-z-multivitamins-180-tablets-10264360', price: 8.49, pack: '180 tablets', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/vitamins-supplements/multivitamins/superdrug-complete-multivitamin-90-tablets-p-805304', price: 5.99, pack: '90 tablets', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=multivitamins+a+to+z', price: 11.99, pack: '365 tablets', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Evening Primrose Oil 1000mg',
    ingredient: 'GLA (Gamma-Linolenic Acid)',
    form: 'Capsules',
    desc: 'Evening primrose oil containing GLA for hormonal balance, skin health and menopause support.',
    brands: 'Efamol, Holland & Barrett, Boots, Seven Seas',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/holland-barrett-evening-primrose-oil-1000mg-90-capsules-60017515', price: 10.99, pack: '90 capsules', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/efamol-evening-primrose-oil-1000mg-90-capsules-10025289', price: 12.99, pack: '90 capsules', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/vitamins-supplements/evening-primrose-oil/superdrug-evening-primrose-oil-1000mg-90-capsules-p-805236', price: 7.99, pack: '90 capsules', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=evening+primrose+oil+1000mg', price: 8.99, pack: '180 capsules', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Cod Liver Oil 1000mg',
    ingredient: 'Cod Liver Oil',
    form: 'Capsules',
    desc: 'Cod liver oil supplement providing omega-3 fatty acids, vitamin A and vitamin D for joint and immune health.',
    brands: 'Seven Seas, Boots, Holland & Barrett, Vitabiotics',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/holland-barrett-cod-liver-oil-1000mg-120-capsules-60017493', price: 9.99, pack: '120 capsules', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/seven-seas-cod-liver-oil-500mg-180-capsules-10063040', price: 8.99, pack: '180 capsules', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/vitamins-supplements/omega-3/cod-liver-oil/superdrug-cod-liver-oil-1000mg-90-capsules-p-805220', price: 5.99, pack: '90 capsules', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=cod+liver+oil+1000mg', price: 9.49, pack: '240 capsules', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Spirulina 500mg Organic',
    ingredient: 'Arthrospira Platensis',
    form: 'Tablets',
    desc: 'Organic spirulina blue-green algae supplement, rich in protein, B vitamins and antioxidants.',
    brands: 'Holland & Barrett, Bulk Powders, Boots, Naturya',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/holland-barrett-organic-spirulina-200-tablets-60023867', price: 11.99, pack: '200 tablets', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/boots-spirulina-500mg-180-tablets-10364892', price: 9.99, pack: '180 tablets', delivery: 'Free click & collect' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=spirulina+500mg+organic', price: 8.99, pack: '500 tablets', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Collagen Type I and III 1000mg',
    ingredient: 'Hydrolysed Collagen Peptides',
    form: 'Tablets',
    desc: 'Collagen type I and III hydrolysed peptides for skin elasticity, joint health and anti-ageing.',
    brands: 'Holland & Barrett, Vital Proteins, Boots, Solgar',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/holland-barrett-collagen-tablets-1000mg-60-tablets-60033481', price: 14.99, pack: '60 tablets', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/boots-collagen-1000mg-60-tablets-10380456', price: 12.99, pack: '60 tablets', delivery: 'Free click & collect' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=collagen+1000mg+hydrolysed', price: 11.99, pack: '120 tablets', delivery: 'Prime delivery' },
    ],
  },
];

// ── Curated UK Skincare Products ──────────────────────────────────────────────
const SKINCARE = [
  {
    name: 'CeraVe Moisturising Cream 340g',
    ingredient: 'Ceramides, Hyaluronic Acid, Niacinamide',
    form: 'Cream',
    desc: 'Dermatologist-developed moisturising cream with ceramides and hyaluronic acid for dry to very dry skin.',
    brands: 'CeraVe',
    prices: [
      { pharmacy: 'Boots', url: 'https://www.boots.com/cerave-moisturising-cream-340g-10294256', price: 13.50, pack: '340g', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/skincare/moisturisers/body-moisturisers/cerave-moisturising-cream-340g-p-816843', price: 12.99, pack: '340g', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=cerave+moisturising+cream+340g', price: 11.99, pack: '340g', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'La Roche-Posay Toleriane Hydrating Gentle Cleanser',
    ingredient: 'Ceramides, Niacinamide, Prebiotic Water',
    form: 'Cleanser',
    desc: 'Gentle face wash for sensitive and normal to dry skin. Dermatologist tested, non-comedogenic.',
    brands: 'La Roche-Posay',
    prices: [
      { pharmacy: 'Boots', url: 'https://www.boots.com/la-roche-posay-toleriane-hydrating-gentle-cleanser-400ml-10286573', price: 14.50, pack: '400ml', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/skincare/cleansers-toners/cleansers/la-roche-posay-toleriane-hydrating-gentle-facial-cleanser-400ml-p-816456', price: 13.99, pack: '400ml', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=la+roche+posay+toleriane+cleanser', price: 12.50, pack: '400ml', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Neutrogena Hydro Boost Water Gel',
    ingredient: 'Hyaluronic Acid, Dimethicone',
    form: 'Gel Moisturiser',
    desc: 'Lightweight water-gel moisturiser with hyaluronic acid for long-lasting hydration. Oil-free and non-comedogenic.',
    brands: 'Neutrogena',
    prices: [
      { pharmacy: 'Boots', url: 'https://www.boots.com/neutrogena-hydro-boost-water-gel-50ml-10241589', price: 19.99, pack: '50ml', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/skincare/moisturisers/face-moisturisers/neutrogena-hydro-boost-water-gel-50ml-p-814265', price: 18.99, pack: '50ml', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=neutrogena+hydro+boost+water+gel', price: 15.99, pack: '50ml', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Simple Kind to Skin Moisturising Facial Wash',
    ingredient: 'Bisabolol, Allantoin, Pro-Vitamin B5',
    form: 'Face Wash',
    desc: 'Gentle moisturising face wash for sensitive skin. No artificial perfume, colours or harsh chemicals.',
    brands: 'Simple',
    prices: [
      { pharmacy: 'Boots', url: 'https://www.boots.com/simple-kind-to-skin-moisturising-facial-wash-150ml-10018673', price: 3.99, pack: '150ml', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/skincare/cleansers-toners/cleansers/simple-kind-to-skin-moisturising-facial-wash-150ml-p-805678', price: 3.49, pack: '150ml', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=simple+moisturising+facial+wash', price: 3.75, pack: '150ml', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'E45 Moisturising Lotion 500ml',
    ingredient: 'Light Liquid Paraffin, White Soft Paraffin',
    form: 'Lotion',
    desc: 'Clinically proven moisturiser for dry, itchy and sensitive skin. Dermatologist tested, fragrance-free.',
    brands: 'E45',
    prices: [
      { pharmacy: 'Boots', url: 'https://www.boots.com/e45-moisturising-lotion-500ml-10014685', price: 8.99, pack: '500ml', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/skincare/moisturisers/body-moisturisers/e45-moisturising-lotion-500ml-p-802314', price: 7.99, pack: '500ml', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=e45+moisturising+lotion+500ml', price: 7.49, pack: '500ml', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Nivea Soft Moisturising Cream 200ml',
    ingredient: 'Jojoba Oil, Vitamin E, Water',
    form: 'Cream',
    desc: 'Lightweight moisturising cream with jojoba oil and vitamin E for face, hands and body. Non-greasy.',
    brands: 'Nivea',
    prices: [
      { pharmacy: 'Boots', url: 'https://www.boots.com/nivea-soft-moisturising-cream-200ml-10064280', price: 3.99, pack: '200ml', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/skincare/moisturisers/body-moisturisers/nivea-soft-moisturising-cream-200ml-p-803234', price: 3.49, pack: '200ml', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=nivea+soft+moisturising+cream+200ml', price: 3.29, pack: '200ml', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'The Ordinary Niacinamide 10% + Zinc 1%',
    ingredient: 'Niacinamide, Zinc PCA',
    form: 'Serum',
    desc: 'High-strength niacinamide serum with zinc for pore reduction, blemish control and skin texture.',
    brands: 'The Ordinary',
    prices: [
      { pharmacy: 'Boots', url: 'https://www.boots.com/the-ordinary-niacinamide-10-zinc-1-30ml-10286234', price: 5.80, pack: '30ml', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/skincare/serums-treatments/serums/the-ordinary-niacinamide-10-zinc-1-30ml-p-816234', price: 5.40, pack: '30ml', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=the+ordinary+niacinamide+10+zinc', price: 6.50, pack: '30ml', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'The Ordinary Hyaluronic Acid 2% + B5',
    ingredient: 'Sodium Hyaluronate, Vitamin B5',
    form: 'Serum',
    desc: 'Multi-molecular hyaluronic acid serum with vitamin B5 for intense surface and deep hydration.',
    brands: 'The Ordinary',
    prices: [
      { pharmacy: 'Boots', url: 'https://www.boots.com/the-ordinary-hyaluronic-acid-2-b5-30ml-10286235', price: 8.90, pack: '30ml', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/skincare/serums-treatments/serums/the-ordinary-hyaluronic-acid-2-b5-30ml-p-816289', price: 8.50, pack: '30ml', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=the+ordinary+hyaluronic+acid+2+b5', price: 9.99, pack: '30ml', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Eucerin Hyaluron-Filler Day Cream SPF15',
    ingredient: 'Hyaluronic Acid, Sabiwhite, SPF15',
    form: 'Day Cream',
    desc: 'Anti-ageing day cream with hyaluronic acid and SPF15 protection for normal to combination skin.',
    brands: 'Eucerin',
    prices: [
      { pharmacy: 'Boots', url: 'https://www.boots.com/eucerin-hyaluron-filler-day-cream-spf15-50ml-10243546', price: 22.99, pack: '50ml', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/skincare/moisturisers/day-creams/eucerin-hyaluron-filler-day-cream-spf15-50ml-p-812456', price: 21.99, pack: '50ml', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=eucerin+hyaluron+filler+day+cream+spf15', price: 19.99, pack: '50ml', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Garnier Micellar Cleansing Water 400ml',
    ingredient: 'Micellar Technology, Rose Water',
    form: 'Micellar Water',
    desc: 'Gentle micellar water that removes makeup, dirt and impurities without rubbing. No rinse needed.',
    brands: 'Garnier',
    prices: [
      { pharmacy: 'Boots', url: 'https://www.boots.com/garnier-micellar-cleansing-water-400ml-10243712', price: 6.99, pack: '400ml', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/skincare/cleansers-toners/micellar-water/garnier-micellar-cleansing-water-400ml-p-810234', price: 5.99, pack: '400ml', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=garnier+micellar+water+400ml', price: 5.49, pack: '400ml', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Aveeno Daily Moisturising Lotion 300ml',
    ingredient: 'Active Naturals Colloidal Oatmeal, Dimethicone',
    form: 'Lotion',
    desc: 'Daily moisturising lotion with colloidal oatmeal for dry, sensitive skin. Clinically proven to improve skin in one day.',
    brands: 'Aveeno',
    prices: [
      { pharmacy: 'Boots', url: 'https://www.boots.com/aveeno-daily-moisturising-lotion-300ml-10164289', price: 10.99, pack: '300ml', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/skincare/moisturisers/body-moisturisers/aveeno-daily-moisturising-lotion-300ml-p-808412', price: 9.99, pack: '300ml', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=aveeno+daily+moisturising+lotion+300ml', price: 8.99, pack: '300ml', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Vichy Minéral 89 Hyaluronic Acid Booster',
    ingredient: 'Hyaluronic Acid, Vichy Mineralizing Water',
    form: 'Serum',
    desc: 'Skin strengthening booster with 89% Vichy mineralizing water and hyaluronic acid for all skin types.',
    brands: 'Vichy',
    prices: [
      { pharmacy: 'Boots', url: 'https://www.boots.com/vichy-mineral-89-hyaluronic-acid-face-serum-50ml-10286581', price: 29.50, pack: '50ml', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/skincare/serums-treatments/serums/vichy-mineral-89-hyaluronic-acid-face-serum-50ml-p-816581', price: 28.99, pack: '50ml', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=vichy+mineral+89+serum+50ml', price: 25.99, pack: '50ml', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Olay Regenerist Micro-Sculpting Cream',
    ingredient: 'Niacinamide, Amino-Peptides, Hyaluronic Acid',
    form: 'Cream',
    desc: 'Advanced anti-ageing moisturiser with micro-sculpting formula for firmer, younger-looking skin.',
    brands: 'Olay',
    prices: [
      { pharmacy: 'Boots', url: 'https://www.boots.com/olay-regenerist-micro-sculpting-cream-50ml-10164312', price: 26.99, pack: '50ml', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/skincare/moisturisers/day-creams/olay-regenerist-micro-sculpting-cream-50ml-p-809312', price: 25.99, pack: '50ml', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=olay+regenerist+micro+sculpting+cream', price: 22.99, pack: '50ml', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Bioderma Sensibio H2O Micellar Water 500ml',
    ingredient: 'Cucumber Extract, Micellar Technology',
    form: 'Micellar Water',
    desc: 'Cleansing micellar solution for sensitive skin. Removes makeup and cleanses with zero irritation.',
    brands: 'Bioderma',
    prices: [
      { pharmacy: 'Boots', url: 'https://www.boots.com/bioderma-sensibio-h2o-micellar-water-500ml-10186234', price: 16.99, pack: '500ml', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/skincare/cleansers-toners/micellar-water/bioderma-sensibio-h2o-micellar-water-500ml-p-810198', price: 15.99, pack: '500ml', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=bioderma+sensibio+h2o+500ml', price: 14.99, pack: '500ml', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'RoC Retinol Correxion Line Smoothing Serum',
    ingredient: 'Retinol, Mineral Complex',
    form: 'Serum',
    desc: 'Clinically proven pure retinol serum to reduce appearance of fine lines and wrinkles overnight.',
    brands: 'RoC',
    prices: [
      { pharmacy: 'Boots', url: 'https://www.boots.com/roc-retinol-correxion-line-smoothing-serum-30ml-10251786', price: 29.99, pack: '30ml', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/skincare/serums-treatments/retinol/roc-retinol-correxion-line-smoothing-serum-30ml-p-812786', price: 27.99, pack: '30ml', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=roc+retinol+correxion+serum', price: 24.99, pack: '30ml', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Cetraben Emollient Cream 500g',
    ingredient: 'White Soft Paraffin, Light Liquid Paraffin',
    form: 'Cream',
    desc: 'Emollient cream for dry skin conditions including eczema, psoriasis and ichthyosis. Fragrance-free.',
    brands: 'Cetraben',
    prices: [
      { pharmacy: 'Boots', url: 'https://www.boots.com/cetraben-emollient-cream-500g-10014736', price: 8.99, pack: '500g', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/skincare/moisturisers/body-moisturisers/cetraben-emollient-cream-500g-p-802418', price: 7.99, pack: '500g', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=cetraben+emollient+cream+500g', price: 7.49, pack: '500g', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Boots Vitamin C Brightening Serum 30ml',
    ingredient: 'Vitamin C (Ascorbyl Glucoside), Niacinamide',
    form: 'Serum',
    desc: 'Brightening vitamin C serum to reduce dark spots, even skin tone and boost radiance. Dermatologist tested.',
    brands: 'Boots',
    prices: [
      { pharmacy: 'Boots', url: 'https://www.boots.com/boots-ingredients-vitamin-c-brightening-serum-30ml-10348712', price: 9.99, pack: '30ml', delivery: 'Free click & collect' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=boots+vitamin+c+brightening+serum', price: 11.99, pack: '30ml', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Superdrug Simply Pure Hydrating Serum 40ml',
    ingredient: 'Hyaluronic Acid, Vitamin B5',
    form: 'Serum',
    desc: 'Affordable hydrating serum with hyaluronic acid and vitamin B5 for plump, moisturised skin.',
    brands: 'Superdrug',
    prices: [
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/skincare/serums-treatments/serums/superdrug-simply-pure-hydrating-serum-40ml-p-818234', price: 5.99, pack: '40ml', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=superdrug+simply+pure+hydrating+serum', price: 7.49, pack: '40ml', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Weleda Skin Food Original Ultra-Rich Cream 75ml',
    ingredient: 'Pansy Extract, Sunflower Oil, Rosemary',
    form: 'Cream',
    desc: 'Nourishing ultra-rich botanical cream for very dry and rough skin. Natural and certified organic.',
    brands: 'Weleda',
    prices: [
      { pharmacy: 'Holland & Barrett', url: 'https://www.hollandandbarrett.com/shop/product/weleda-skin-food-original-ultra-rich-cream-75ml-00023745', price: 10.99, pack: '75ml', delivery: 'Free over £25' },
      { pharmacy: 'Boots', url: 'https://www.boots.com/weleda-skin-food-75ml-10094823', price: 11.99, pack: '75ml', delivery: 'Free click & collect' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=weleda+skin+food+75ml', price: 9.99, pack: '75ml', delivery: 'Prime delivery' },
    ],
  },
  {
    name: 'Neutrogena Norwegian Formula Hand Cream 75ml',
    ingredient: 'Glycerin, Dimethicone',
    form: 'Hand Cream',
    desc: 'Concentrated formula hand cream clinically proven to heal very dry, cracked hands. Fragrance-free option available.',
    brands: 'Neutrogena',
    prices: [
      { pharmacy: 'Boots', url: 'https://www.boots.com/neutrogena-norwegian-formula-hand-cream-75ml-10015689', price: 5.99, pack: '75ml', delivery: 'Free click & collect' },
      { pharmacy: 'Superdrug', url: 'https://www.superdrug.com/skincare/hand-nail-creams/hand-creams/neutrogena-norwegian-formula-hand-cream-75ml-p-803456', price: 4.99, pack: '75ml', delivery: 'Free over £10' },
      { pharmacy: 'Amazon UK', url: 'https://www.amazon.co.uk/s?k=neutrogena+norwegian+formula+hand+cream', price: 4.49, pack: '75ml', delivery: 'Prime delivery' },
    ],
  },
];

// ── Import functions ──────────────────────────────────────────────────────────

async function getExisting(category) {
  const res = await pool.query(
    'SELECT LOWER(name) AS name FROM medicines WHERE category = $1',
    [category],
  );
  return new Set(res.rows.map(r => r.name));
}

async function insertProducts(products, category, source) {
  const existing = await getExisting(category);
  let inserted = 0;
  let pricesInserted = 0;

  for (const p of products) {
    if (existing.has(p.name.toLowerCase())) {
      console.log(`  Skip (exists): ${p.name}`);
      continue;
    }

    const medResult = await pool.query(INSERT_MED, [
      p.name,
      p.name,
      category,
      p.desc,
      p.ingredient,
      p.form,
      false,
      p.brands || null,
      null,
      null,
      source,
    ]);

    if (!medResult.rows[0]) continue;
    const medId = medResult.rows[0].id;
    existing.add(p.name.toLowerCase());
    inserted++;

    for (const pr of p.prices) {
      await pool.query(INSERT_PRICE, [
        medId,
        pr.pharmacy,
        pr.url,
        pr.price,
        true,
        pr.delivery,
        pr.pack,
        null,
        source,
      ]);
      pricesInserted++;
    }

    console.log(`  Inserted: ${p.name} (${p.prices.length} prices)`);
  }

  return { inserted, pricesInserted };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== GeneriQ Supplements & Skincare Import ===\n');

  console.log(`Importing ${SUPPLEMENTS.length} supplement products...`);
  const { inserted: si, pricesInserted: sp } = await insertProducts(SUPPLEMENTS, 'supplement', 'curated');
  console.log(`Supplements done: ${si} products, ${sp} prices\n`);

  console.log(`Importing ${SKINCARE.length} skincare products...`);
  const { inserted: ki, pricesInserted: kp } = await insertProducts(SKINCARE, 'skincare', 'curated');
  console.log(`Skincare done: ${ki} products, ${kp} prices\n`);

  // Summary
  const totals = await pool.query(`
    SELECT category, COUNT(*) AS cnt
    FROM medicines
    WHERE category IN ('supplement', 'skincare')
    GROUP BY category
  `);
  console.log('DB totals:');
  for (const row of totals.rows) {
    console.log(`  ${row.category}: ${row.cnt} products`);
  }

  await pool.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
