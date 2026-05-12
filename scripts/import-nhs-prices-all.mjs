/**
 * Comprehensive NHS price import — all 62 PCA monthly CSVs (Jan 2021 – Feb 2026).
 * Improvements over import-nhs-prices.mjs:
 *  - Processes every available month (not just Feb 2026)
 *  - Prefix matching: "Aclidinium" matches "Aclidinium bromide" in BNF
 *  - 4 files streamed in parallel for speed
 *  - Prices averaged across all months (more stable than single month)
 */

import pg from 'pg';
import { createInterface } from 'readline';
import { Readable } from 'stream';

const { Pool } = pg;
const DB_URL = process.env.DATABASE_URL ||
  'postgresql://postgres:JcrAbKzOYkTCRjkQRDWbZBaOYTXmJsBY@viaduct.proxy.rlwy.net:53590/railway';
const CKAN_PACKAGE = '358e443c-b299-4370-aed4-eca63ce3ba68';
const CONCURRENCY = 4;

const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

function norm(s) { return (s || '').toLowerCase().trim(); }

/** Parse one CSV line, handling double-quoted fields */
function parseLine(line) {
  const f = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === '"' && line[j + 1] === '"') { j += 2; continue; }
        if (line[j] === '"') break;
        j++;
      }
      f.push(line.slice(i + 1, j).replace(/""/g, '"'));
      i = j + 2;
    } else {
      let j = line.indexOf(',', i);
      if (j === -1) j = line.length;
      f.push(line.slice(i, j));
      i = j + 1;
    }
  }
  return f;
}

/**
 * Build a match function that tries:
 *   1. Exact match on normalised BNF_CHEMICAL_SUBSTANCE
 *   2. Prefix match: our key is a prefix of the BNF substance (e.g. "aclidinium" → "aclidinium bromide")
 *   3. Prefix match: BNF substance is a prefix of our key
 * Results cached so prefix scan runs once per unique BNF substance.
 */
function buildMatcher(medicines) {
  const exact = new Map();
  const prefixKeys = []; // [{key, id}] sorted longest first

  for (const m of medicines) {
    const keys = [norm(m.active_ingredient), norm(m.generic_name), norm(m.name)];
    for (const k of keys) {
      if (!k) continue;
      if (!exact.has(k)) {
        exact.set(k, m.id);
        prefixKeys.push({ k, id: m.id });
      }
    }
  }
  prefixKeys.sort((a, b) => b.k.length - a.k.length); // longest first

  const cache = new Map();

  return function match(bnfSub) {
    const n = norm(bnfSub);
    if (!n) return null;
    if (exact.has(n)) return exact.get(n);
    if (cache.has(n)) return cache.get(n);

    let found = null;
    for (const { k, id } of prefixKeys) {
      if (!k) continue;
      // our key is a word-boundary prefix of BNF sub: "aclidinium" → "aclidinium bromide"
      if (n.startsWith(k + ' ') || n.startsWith(k + ',')) { found = id; break; }
      // BNF sub is a word-boundary prefix of our key: "metformin" → "metformin hydrochloride"
      if (k.startsWith(n + ' ') || k.startsWith(n + ',')) { found = id; break; }
    }

    cache.set(n, found);
    return found;
  };
}

/** Stream one PCA CSV URL and aggregate into the provided agg map */
async function streamFile(url, match, agg) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);

  const stream = Readable.fromWeb(res.body);
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let headerParsed = false;
  let colPres, colChem, colItems, colNIC;
  let rows = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!headerParsed) {
      const h = parseLine(line);
      colPres  = h.indexOf('BNF_PRESENTATION_NAME');
      colChem  = h.indexOf('BNF_CHEMICAL_SUBSTANCE');
      colItems = h.indexOf('ITEMS');
      colNIC   = h.indexOf('NIC');
      headerParsed = true;
      continue;
    }
    rows++;
    const f = parseLine(line);
    const items = parseFloat(f[colItems]);
    const nic   = parseFloat(f[colNIC]);
    if (isNaN(items) || isNaN(nic) || items <= 0) continue;

    const id = match(f[colChem]);
    if (!id) continue;

    const entry = agg.get(id);
    if (entry) {
      entry.totalNIC   += nic;
      entry.totalItems += items;
    } else {
      agg.set(id, { totalNIC: nic, totalItems: items, chemSub: f[colChem], pres: new Map() });
    }

    // Track top presentations
    const presName = (f[colPres] || '').slice(0, 200);
    if (presName) {
      const pe = agg.get(id).pres.get(presName);
      if (pe) { pe.nic += nic; pe.items += items; }
      else agg.get(id).pres.set(presName, { nic, items });
    }
  }
  return rows;
}

async function main() {
  // ── 1. Get all resource URLs ──────────────────────────────────────────────
  console.log('Fetching PCA dataset resource list from NHS BSA CKAN...');
  const ckanRes = await fetch(`https://opendata.nhsbsa.net/api/3/action/package_show?id=${CKAN_PACKAGE}`);
  const ckanData = await ckanRes.json();
  const resources = (ckanData.result?.resources || []).map(r => ({ name: r.name, url: r.url }));
  console.log(`  Found ${resources.length} monthly CSV files (${resources[0].name} → ${resources[resources.length - 1].name})`);

  // ── 2. Load medicines ─────────────────────────────────────────────────────
  console.log('\nLoading medicines from database...');
  const { rows: medicines } = await pool.query(
    'SELECT id, name, generic_name, active_ingredient FROM medicines'
  );
  const match = buildMatcher(medicines);
  console.log(`  ${medicines.length} medicines, matcher ready`);

  // ── 3. Stream all files (CONCURRENCY at a time) ───────────────────────────
  const agg = new Map(); // medicine_id → {totalNIC, totalItems, chemSub, pres}
  let totalRows = 0;
  let filesProcessed = 0;

  for (let i = 0; i < resources.length; i += CONCURRENCY) {
    const batch = resources.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(r => streamFile(r.url, match, agg))
    );
    for (let j = 0; j < results.length; j++) {
      if (results[j].status === 'fulfilled') {
        totalRows += results[j].value;
        filesProcessed++;
      } else {
        console.warn(`  WARNING: ${batch[j].name} failed: ${results[j].reason?.message}`);
      }
    }
    const pct = Math.round((filesProcessed / resources.length) * 100);
    process.stdout.write(`  [${pct}%] ${filesProcessed}/${resources.length} files, ${(totalRows / 1e6).toFixed(1)}M rows, ${agg.size} medicines matched\r`);
  }
  console.log(`\n  Done. ${totalRows.toLocaleString()} rows, ${agg.size} unique medicines with NHS prices`);

  // ── 4. Insert prices ───────────────────────────────────────────────────────
  console.log('\nClearing old NHS Drug Tariff prices...');
  await pool.query("DELETE FROM pharmacy_prices WHERE source = 'nhs_drug_tariff'");

  console.log('Inserting new prices...');
  let inserted = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [medicineId, data] of agg) {
      const avgPrice = (data.totalNIC / data.totalItems).toFixed(2);

      // Average (overall) row
      await client.query(`
        INSERT INTO pharmacy_prices
          (medicine_id, pharmacy_name, pharmacy_url, price_gbp, in_stock,
           delivery_info, pack_size, strength, source)
        VALUES ($1,'NHS Drug Tariff',NULL,$2,true,'Via NHS prescription',NULL,NULL,'nhs_drug_tariff')
      `, [medicineId, avgPrice]);
      inserted++;

      // Top 3 presentations that differ meaningfully from the average
      const topPres = [...data.pres.entries()]
        .sort((a, b) => b[1].items - a[1].items)
        .slice(0, 3);

      for (const [presName, pd] of topPres) {
        const presPrice = (pd.nic / pd.items).toFixed(2);
        if (Math.abs(parseFloat(presPrice) - parseFloat(avgPrice)) < 0.01) continue;
        await client.query(`
          INSERT INTO pharmacy_prices
            (medicine_id, pharmacy_name, pharmacy_url, price_gbp, in_stock,
             delivery_info, pack_size, strength, source)
          VALUES ($1,'NHS Drug Tariff',NULL,$2,true,'Via NHS prescription',$3,NULL,'nhs_drug_tariff')
        `, [medicineId, presPrice, presName]);
        inserted++;
      }
    }
    await client.query('COMMIT');
  } finally {
    client.release();
  }
  console.log(`  Inserted ${inserted} rows for ${agg.size} medicines`);

  // ── 5. Summary ─────────────────────────────────────────────────────────────
  const { rows: [stats] } = await pool.query(`
    SELECT COUNT(DISTINCT medicine_id) AS medicines, COUNT(*) AS rows
    FROM pharmacy_prices WHERE source = 'nhs_drug_tariff'
  `);
  console.log(`\nNHS Drug Tariff prices now cover ${stats.medicines} medicines (${stats.rows} price rows)`);

  // Key medicines check
  const { rows: check } = await pool.query(`
    SELECT m.name, MIN(pp.price_gbp)::numeric AS min_price
    FROM pharmacy_prices pp JOIN medicines m ON m.id = pp.medicine_id
    WHERE pp.source = 'nhs_drug_tariff'
      AND LOWER(m.name) IN ('paracetamol','ibuprofen','amoxicillin','atorvastatin','omeprazole','fluoxetine','metformin','ramipril')
    GROUP BY m.name ORDER BY m.name
  `);
  console.log('\nKey medicines:');
  check.forEach(r => console.log(`  ${r.name}: from £${parseFloat(r.min_price).toFixed(2)}`));

  await pool.end();
}

main().catch(async err => {
  console.error('\nError:', err);
  await pool.end();
  process.exit(1);
});
