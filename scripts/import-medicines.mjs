/**
 * Medicine data import script
 * Sources: EMA medicines Excel + OpenFDA drug label API
 * Run: node scripts/import-medicines.mjs
 * Output: src/lib/medicines-imported.ts
 */

import { createRequire } from 'module';
import { existsSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const EMA_EXCEL_PATH = process.env.EMA_EXCEL || join(PROJECT_ROOT, 'data', 'ema-medicines.xlsx');
const OUTPUT_PATH = join(PROJECT_ROOT, 'src', 'lib', 'medicines-imported.ts');

function assertEmaSource() {
  if (existsSync(EMA_EXCEL_PATH)) return;

  throw new Error(
    `EMA spreadsheet not found at "${EMA_EXCEL_PATH}". ` +
    'Set EMA_EXCEL to the source .xlsx path or place the file at data/ema-medicines.xlsx.',
  );
}

// ─── EMA column indices (0-based, row 8 is header) ──────────────────────────
const COL = {
  category: 0,       // Human / Veterinary
  name: 1,           // Brand / product name
  productNum: 2,     // EMEA/H/C/...
  status: 3,         // Authorised / Withdrawn / Refused
  inn: 6,            // INN / common name (active ingredient)
  substance: 7,      // Active substance (may differ slightly from INN)
  meshArea: 8,       // Therapeutic area (MeSH)
  atcCode: 11,       // ATC code (human)
  pharmGroup: 13,    // Pharmacotherapeutic group (human)
  indication: 15,    // Therapeutic indication (long text)
  isGeneric: 22,     // "Yes" / "No"
  url: 38,           // EMA product URL
};

// ─── ATC→category mapping ────────────────────────────────────────────────────
const ATC_CATEGORY = {
  'A': 'Alimentary & Metabolism',
  'B': 'Blood & Blood-forming Organs',
  'C': 'Cardiovascular',
  'D': 'Dermatology',
  'G': 'Genito-urinary & Sex Hormones',
  'H': 'Systemic Hormonal Preparations',
  'J': 'Anti-infectives (Systemic)',
  'L': 'Antineoplastic & Immunomodulating',
  'M': 'Musculoskeletal',
  'N': 'Nervous System',
  'P': 'Antiparasitic',
  'R': 'Respiratory',
  'S': 'Sensory Organs',
  'V': 'Various',
};

function atcToCategory(atcCode, pharmGroup) {
  if (atcCode) {
    const letter = atcCode.charAt(0).toUpperCase();
    if (ATC_CATEGORY[letter]) return ATC_CATEGORY[letter];
  }
  if (pharmGroup) {
    const pg = pharmGroup.toString().trim();
    // Capitalise first letter, truncate at 50 chars
    return pg.charAt(0).toUpperCase() + pg.slice(1, 50);
  }
  return 'Other';
}

function toId(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(/[\s,;]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .trim();
}

function truncate(str, max = 300) {
  if (!str) return '';
  const s = str.toString().replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.lastIndexOf(' ', max);
  return s.slice(0, cut > 0 ? cut : max) + '…';
}

// ─── Parse EMA Excel ─────────────────────────────────────────────────────────
function parseEMA() {
  console.log('Parsing EMA Excel…');
  const wb = XLSX.readFile(EMA_EXCEL_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Data starts at row 9 (index 9)
  const dataRows = rows.slice(9);

  // Map: normalised active substance → { name, brandNames, category, atcCode, description, emaProductNumbers }
  const bySubstance = new Map();

  let skipped = 0;
  for (const row of dataRows) {
    if (!row || row.length < 10) continue;

    // Only human, authorised medicines
    const category = (row[COL.category] || '').toString().trim();
    const status = (row[COL.status] || '').toString().trim();
    if (category !== 'Human') { skipped++; continue; }
    if (!status.toLowerCase().includes('authorised')) { skipped++; continue; }

    const brandName = (row[COL.name] || '').toString().trim();
    const inn = (row[COL.inn] || row[COL.substance] || '').toString().trim();
    if (!inn || inn.length < 2) continue;

    const atcCode = (row[COL.atcCode] || '').toString().trim();
    const pharmGroup = (row[COL.pharmGroup] || '').toString().trim();
    const indication = row[COL.indication] ? truncate(row[COL.indication].toString(), 280) : '';
    const productNum = (row[COL.productNum] || '').toString().trim();

    // Split combined INNs (e.g. "fluticasone furoate;umeclidinium;vilanterol")
    // Use all of them as a combined key but also index the first as primary
    const innParts = inn.split(';').map(s => s.trim()).filter(Boolean);
    const primaryInn = innParts[0];
    const normKey = primaryInn.toLowerCase();

    const medicineCategory = atcToCategory(atcCode, pharmGroup);

    if (bySubstance.has(normKey)) {
      const existing = bySubstance.get(normKey);
      if (brandName && !existing.brandNames.includes(brandName)) {
        existing.brandNames.push(brandName);
      }
      if (productNum && !existing.emaProductNumbers.includes(productNum)) {
        existing.emaProductNumbers.push(productNum);
      }
      // Use longer description if available
      if (indication && indication.length > (existing.description || '').length) {
        existing.description = indication;
      }
    } else {
      bySubstance.set(normKey, {
        id: toId(primaryInn),
        name: toTitleCase(primaryInn),
        brandNames: brandName ? [brandName] : [],
        category: medicineCategory,
        atcCode: atcCode || undefined,
        description: indication,
        emaProductNumbers: productNum ? [productNum] : [],
        source: 'ema',
      });
    }
  }

  console.log(`EMA: ${bySubstance.size} unique active substances (skipped ${skipped} non-human/non-authorised)`);
  return bySubstance;
}

// ─── Fetch OpenFDA ────────────────────────────────────────────────────────────
async function fetchFDA() {
  console.log('Fetching OpenFDA drug labels…');
  const results = new Map();

  // Fetch multiple pages of oral prescription medicines with structured openfda data
  const queries = [
    'openfda.route:ORAL+AND+openfda.pharm_class_epc:"Nonsteroidal+Anti-inflammatory+Drug+[EPC]"',
    'openfda.route:ORAL+AND+openfda.pharm_class_epc:"HMG-CoA+Reductase+Inhibitor+[EPC]"',
    'openfda.route:ORAL+AND+openfda.pharm_class_epc:"Proton+Pump+Inhibitor+[EPC]"',
    'openfda.route:ORAL+AND+openfda.pharm_class_epc:"Selective+Serotonin+Reuptake+Inhibitor+[EPC]"',
    'openfda.route:ORAL+AND+openfda.pharm_class_epc:"Angiotensin-Converting+Enzyme+Inhibitor+[EPC]"',
    'openfda.route:ORAL+AND+openfda.pharm_class_epc:"Calcium+Channel+Blocker+[EPC]"',
    'openfda.route:ORAL+AND+openfda.pharm_class_epc:"Beta-Adrenergic+Blocker+[EPC]"',
    'openfda.route:ORAL+AND+openfda.pharm_class_epc:"Biguanide+[EPC]"',
    'openfda.route:ORAL+AND+openfda.pharm_class_epc:"Penicillin-class+Antibacterial+[EPC]"',
    'openfda.route:ORAL+AND+openfda.pharm_class_epc:"Tetracycline+Antibacterial+[EPC]"',
    'openfda.route:ORAL+AND+openfda.pharm_class_epc:"Angiotensin+2+Receptor+Blocker+[EPC]"',
    'openfda.route:ORAL+AND+openfda.pharm_class_epc:"Thiazide+Diuretic+[EPC]"',
    'openfda.route:ORAL+AND+openfda.pharm_class_epc:"Tricyclic+Antidepressant+[EPC]"',
    'openfda.route:ORAL+AND+openfda.pharm_class_epc:"Anticonvulsant+[EPC]"',
    'openfda.route:ORAL+AND+openfda.pharm_class_epc:"Antiviral+[EPC]"',
    'openfda.route:ORAL+AND+openfda.pharm_class_epc:"Corticosteroid+[EPC]"',
    'openfda.route:ORAL+AND+openfda.pharm_class_epc:"Antifungal+[EPC]"',
    'openfda.route:ORAL+AND+openfda.pharm_class_epc:"Antihistamine+[EPC]"',
    'openfda.route:ORAL+AND+openfda.pharm_class_epc:"Opioid+Agonist+[EPC]"',
    'openfda.route:ORAL+AND+openfda.pharm_class_epc:"Benzodiazepine+[EPC]"',
  ];

  for (const query of queries) {
    try {
      const url = `https://api.fda.gov/drug/label.json?limit=50&search=${query}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.log(`  FDA query failed (${res.status}): ${query.slice(0, 60)}`);
        continue;
      }
      const data = await res.json();
      const items = data.results || [];

      for (const item of items) {
        const openfda = item.openfda || {};
        const genericNames = openfda.generic_name || [];
        const brandNames = openfda.brand_name || [];
        const substances = openfda.substance_name || [];
        const routes = openfda.route || [];
        const pharmClasses = openfda.pharm_class_epc || [];

        const primaryGeneric = genericNames[0] || substances[0];
        if (!primaryGeneric) continue;

        const normKey = primaryGeneric.toLowerCase();
        if (results.has(normKey)) {
          const existing = results.get(normKey);
          for (const b of brandNames) {
            if (!existing.brandNames.includes(b)) existing.brandNames.push(b);
          }
          continue;
        }

        // Build description from indications or description field
        const descSource = item.indications_and_usage?.[0] || item.description?.[0] || '';
        const description = truncate(descSource.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), 280);

        // Category from pharmacological class
        const pharmClass = pharmClasses[0] || '';
        const category = pharmClass
          ? pharmClass.replace(/\s*\[EPC\]/, '').trim()
          : (routes[0] ? `${routes[0]} medicines` : 'Other');

        results.set(normKey, {
          id: toId(primaryGeneric),
          name: toTitleCase(primaryGeneric),
          brandNames: [...new Set([...brandNames])].slice(0, 5),
          category,
          atcCode: undefined,
          description,
          source: 'fda',
        });
      }
      console.log(`  Fetched ${items.length} labels for: ${query.slice(query.indexOf('"') + 1, query.lastIndexOf('"'))}`);
      await new Promise(r => setTimeout(r, 350)); // FDA rate limit
    } catch (err) {
      console.log(`  FDA fetch error: ${err.message}`);
    }
  }

  console.log(`OpenFDA: ${results.size} unique medicines`);
  return results;
}

// ─── Merge & deduplicate ──────────────────────────────────────────────────────
function merge(emaMap, fdaMap) {
  // Start with EMA as authoritative source
  const merged = new Map(emaMap);

  let fdaAdded = 0;
  let fdaMerged = 0;
  for (const [key, fdaMed] of fdaMap) {
    if (merged.has(key)) {
      // Merge brand names
      const existing = merged.get(key);
      for (const b of fdaMed.brandNames) {
        if (!existing.brandNames.includes(b)) existing.brandNames.push(b);
      }
      fdaMerged++;
    } else {
      merged.set(key, fdaMed);
      fdaAdded++;
    }
  }

  console.log(`Merge: ${fdaAdded} new from FDA, ${fdaMerged} merged into EMA entries`);
  console.log(`Total unique medicines: ${merged.size}`);
  return merged;
}

// ─── IDs must be unique ───────────────────────────────────────────────────────
function deduplicateIds(map) {
  const idCount = new Map();
  for (const med of map.values()) {
    const id = med.id;
    idCount.set(id, (idCount.get(id) || 0) + 1);
  }
  const idSeen = new Map();
  for (const med of map.values()) {
    const baseId = med.id;
    if (idCount.get(baseId) > 1) {
      const n = (idSeen.get(baseId) || 0) + 1;
      idSeen.set(baseId, n);
      med.id = n === 1 ? baseId : `${baseId}-${n}`;
    }
  }
}

// ─── Generate TypeScript output ───────────────────────────────────────────────
function generateTS(map) {
  const medicines = [...map.values()]
    // Filter: must have a name and description
    .filter(m => m.name && m.name.length > 1)
    // Sort: EMA first, then FDA, alphabetically within each
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === 'ema' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const lines = [
    '// AUTO-GENERATED by scripts/import-medicines.mjs — do not edit manually',
    `// Generated: ${new Date().toISOString()}`,
    `// Sources: EMA medicines-output-medicines-report_en.xlsx + OpenFDA drug/label API`,
    `// Total: ${medicines.length} unique medicines`,
    '',
    "import type { BaseMedicine } from './medicines-db';",
    '',
    'export const IMPORTED_MEDICINES: BaseMedicine[] = [',
  ];

  for (const m of medicines) {
    const brandNamesJson = JSON.stringify(m.brandNames.slice(0, 6));
    const desc = (m.description || '').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    const emaNumbers = m.emaProductNumbers ? JSON.stringify(m.emaProductNumbers.slice(0, 3)) : '[]';
    lines.push(`  {`);
    lines.push(`    id: ${JSON.stringify(m.id)},`);
    lines.push(`    name: ${JSON.stringify(m.name)},`);
    lines.push(`    brandNames: ${brandNamesJson},`);
    lines.push(`    category: ${JSON.stringify(m.category)},`);
    lines.push(`    description: ${JSON.stringify(m.description || '')},`);
    if (m.atcCode) lines.push(`    atcCode: ${JSON.stringify(m.atcCode)},`);
    if (m.emaProductNumbers?.length) lines.push(`    emaProductNumbers: ${emaNumbers},`);
    lines.push(`    source: ${JSON.stringify(m.source)},`);
    lines.push(`  },`);
  }

  lines.push('];');
  lines.push('');

  return lines.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== GeneriQ Medicine Import ===\n');
  assertEmaSource();

  const emaMap = parseEMA();
  const fdaMap = await fetchFDA();
  const merged = merge(emaMap, fdaMap);
  deduplicateIds(merged);

  const ts = generateTS(merged);
  writeFileSync(OUTPUT_PATH, ts, 'utf8');

  const count = [...merged.values()].filter(m => m.name?.length > 1).length;
  console.log(`\nWrote ${count} medicines to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
