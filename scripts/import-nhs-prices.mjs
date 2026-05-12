/**
 * Import NHS Prescription Cost Analysis (PCA) prices into pharmacy_prices.
 * Source: NHS BSA Open Data Portal, dataset 358e443c-b299-4370-aed4-eca63ce3ba68
 * Price = NIC / ITEMS (average net ingredient cost per dispensed item, in GBP)
 */

import pg from 'pg';
import { createInterface } from 'readline';
import { Readable } from 'stream';

const { Pool } = pg;

const DB_URL = process.env.DATABASE_URL ||
  'postgresql://postgres:JcrAbKzOYkTCRjkQRDWbZBaOYTXmJsBY@viaduct.proxy.rlwy.net:53590/railway';

// Latest PCA monthly data (Feb 2026)
const PCA_CSV_URL =
  'https://opendata.nhsbsa.net/dataset/358e443c-b299-4370-aed4-eca63ce3ba68/resource/f481c3e6-9ffd-4e36-8183-f025157205cf/download/pca_202602.csv';

const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

/** Parse a single CSV line handling double-quoted fields */
function parseCsvLine(line) {
  const fields = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === '"' && line[j + 1] === '"') { j += 2; continue; }
        if (line[j] === '"') break;
        j++;
      }
      fields.push(line.slice(i + 1, j).replace(/""/g, '"'));
      i = j + 2; // skip closing quote + comma
    } else {
      let j = line.indexOf(',', i);
      if (j === -1) j = line.length;
      fields.push(line.slice(i, j));
      i = j + 1;
    }
  }
  return fields;
}

function normalise(str) {
  return (str || '').toLowerCase().trim();
}

async function main() {
  // ── 1. Load all medicines from DB ──────────────────────────────────────────
  console.log('Loading medicines from database...');
  const { rows: medicines } = await pool.query(
    'SELECT id, name, generic_name, active_ingredient FROM medicines'
  );
  console.log(`  ${medicines.length} medicines loaded`);

  // Build lookup maps: normalised string → medicine id
  // Priority: active_ingredient > generic_name > name
  const lookup = new Map(); // normalised → id
  for (const m of medicines) {
    // Store all tokens for matching
    const candidates = [
      normalise(m.active_ingredient),
      normalise(m.generic_name),
      normalise(m.name),
    ];
    for (const c of candidates) {
      if (c && !lookup.has(c)) lookup.set(c, m.id);
    }
  }
  console.log(`  ${lookup.size} lookup keys built`);

  // ── 2. Stream PCA CSV and aggregate NIC/ITEMS per matched medicine ─────────
  console.log(`\nFetching PCA CSV from NHS BSA...`);
  const response = await fetch(PCA_CSV_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.url}`);

  // Aggregation: medicineId → { chemSub, presentationName, totalNIC, totalItems }
  const agg = new Map();
  // Track multiple presentations per medicine
  const presentations = new Map(); // medicineId → Map<presentationName, {nic, items}>

  let lineCount = 0;
  let matchCount = 0;
  let header = null;
  // Column indices (set after parsing header)
  let colPresName, colChemSub, colItems, colNIC;

  const nodeStream = Readable.fromWeb(response.body);
  const rl = createInterface({ input: nodeStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    lineCount++;

    if (lineCount === 1) {
      header = parseCsvLine(line);
      colPresName = header.indexOf('BNF_PRESENTATION_NAME');
      colChemSub  = header.indexOf('BNF_CHEMICAL_SUBSTANCE');
      colItems    = header.indexOf('ITEMS');
      colNIC      = header.indexOf('NIC');
      console.log(`  Header parsed. Columns: BNF_PRESENTATION_NAME=${colPresName}, BNF_CHEMICAL_SUBSTANCE=${colChemSub}, ITEMS=${colItems}, NIC=${colNIC}`);
      continue;
    }

    const fields = parseCsvLine(line);
    const chemSub = normalise(fields[colChemSub]);
    const items = parseFloat(fields[colItems]);
    const nic = parseFloat(fields[colNIC]);

    if (!chemSub || isNaN(items) || isNaN(nic) || items <= 0) continue;

    const medicineId = lookup.get(chemSub);
    if (!medicineId) continue;

    matchCount++;
    const presName = fields[colPresName] || '';

    // Aggregate at medicine level
    const existing = agg.get(medicineId);
    if (existing) {
      existing.totalNIC += nic;
      existing.totalItems += items;
    } else {
      agg.set(medicineId, { chemSub: fields[colChemSub], totalNIC: nic, totalItems: items });
    }

    // Also aggregate per presentation for pack_size detail
    if (!presentations.has(medicineId)) presentations.set(medicineId, new Map());
    const presMap = presentations.get(medicineId);
    const presEntry = presMap.get(presName);
    if (presEntry) {
      presEntry.nic += nic;
      presEntry.items += items;
    } else {
      presMap.set(presName, { nic, items });
    }

    if (lineCount % 100000 === 0) {
      process.stdout.write(`  Processed ${lineCount.toLocaleString()} rows, ${matchCount.toLocaleString()} matches so far...\r`);
    }
  }

  console.log(`\n  Done. ${lineCount.toLocaleString()} rows processed, ${matchCount.toLocaleString()} matching rows, ${agg.size} unique medicines matched`);

  if (agg.size === 0) {
    console.error('No medicines matched — aborting.');
    await pool.end();
    return;
  }

  // ── 3. Clear existing NHS Drug Tariff prices ───────────────────────────────
  console.log('\nClearing existing NHS Drug Tariff prices...');
  const del = await pool.query("DELETE FROM pharmacy_prices WHERE source = 'nhs_drug_tariff'");
  console.log(`  Deleted ${del.rowCount} old rows`);

  // ── 4. Insert new price rows ───────────────────────────────────────────────
  console.log('Inserting new prices...');
  let inserted = 0;

  for (const [medicineId, data] of agg) {
    const avgPrice = (data.totalNIC / data.totalItems).toFixed(2);

    // Insert one row per medicine with average price
    await pool.query(`
      INSERT INTO pharmacy_prices
        (medicine_id, pharmacy_name, pharmacy_url, price_gbp, in_stock,
         delivery_info, pack_size, strength, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      medicineId,
      'NHS Drug Tariff',
      null,
      avgPrice,
      true,
      'Via NHS prescription',
      null,
      null,
      'nhs_drug_tariff',
    ]);
    inserted++;

    // Also insert top-3 presentations as separate rows for pack size detail
    const presMap = presentations.get(medicineId);
    if (presMap) {
      const sorted = [...presMap.entries()]
        .sort((a, b) => b[1].items - a[1].items)
        .slice(0, 3);

      for (const [presName, presData] of sorted) {
        if (!presName) continue;
        const presAvg = (presData.nic / presData.items).toFixed(2);
        // Only insert if it differs meaningfully from the overall avg
        if (Math.abs(parseFloat(presAvg) - parseFloat(avgPrice)) < 0.01) continue;
        await pool.query(`
          INSERT INTO pharmacy_prices
            (medicine_id, pharmacy_name, pharmacy_url, price_gbp, in_stock,
             delivery_info, pack_size, strength, source)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          medicineId,
          'NHS Drug Tariff',
          null,
          presAvg,
          true,
          'Via NHS prescription',
          presName.slice(0, 200),
          null,
          'nhs_drug_tariff',
        ]);
        inserted++;
      }
    }
  }

  console.log(`  Inserted ${inserted} price rows for ${agg.size} medicines`);

  // ── 5. Summary ─────────────────────────────────────────────────────────────
  const { rows: summary } = await pool.query(`
    SELECT COUNT(DISTINCT medicine_id) AS medicines, COUNT(*) AS price_rows
    FROM pharmacy_prices WHERE source = 'nhs_drug_tariff'
  `);
  console.log(`\nDone! NHS Drug Tariff prices: ${summary[0].medicines} medicines, ${summary[0].price_rows} price rows`);

  // Show a few examples
  const { rows: examples } = await pool.query(`
    SELECT m.name, pp.price_gbp, pp.pack_size
    FROM pharmacy_prices pp
    JOIN medicines m ON m.id = pp.medicine_id
    WHERE pp.source = 'nhs_drug_tariff'
    ORDER BY pp.price_gbp ASC
    LIMIT 10
  `);
  console.log('\nSample prices:');
  examples.forEach(r => console.log(`  ${r.name}: £${r.price_gbp} — ${r.pack_size || '(avg)'}`));

  await pool.end();
}

main().catch(async err => {
  console.error('Error:', err);
  await pool.end();
  process.exit(1);
});
