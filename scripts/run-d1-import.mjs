#!/usr/bin/env node
/**
 * Import all D1 SQL files into Cloudflare D1 in order.
 * Usage: node scripts/run-d1-import.mjs
 *
 * Runs every d1-data-*.sql file sequentially, logs errors and continues.
 */

import { spawnSync } from 'child_process';
import { readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root   = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlDir = path.join(root, 'sql');

// Sort: medicines-1..27 numerically first, then prices, ingredients (alphabetically after)
const allFiles = readdirSync(sqlDir)
  .filter(f => f.startsWith('d1-data-') && f.endsWith('.sql'))
  .sort((a, b) => {
    const prefix = (f) => f.startsWith('d1-data-medicines-') ? 0 : 1;
    const pA = prefix(a), pB = prefix(b);
    if (pA !== pB) return pA - pB;
    // Both medicines: sort by numeric suffix
    const nA = parseInt(a.match(/-(\d+)\.sql$/)?.[1] ?? '0', 10);
    const nB = parseInt(b.match(/-(\d+)\.sql$/)?.[1] ?? '0', 10);
    return nA - nB || a.localeCompare(b);
  });

if (allFiles.length === 0) {
  console.error('No d1-data-*.sql files found in sql/. Run export-to-d1.mjs first.');
  process.exit(1);
}

console.log(`Found ${allFiles.length} files to import:\n`);
allFiles.forEach((f, i) => console.log(`  ${String(i + 1).padStart(2)}. ${f}`));
console.log();

let ok = 0;
let failed = 0;

for (const file of allFiles) {
  const filePath = path.join(sqlDir, file);
  process.stdout.write(`[${ok + failed + 1}/${allFiles.length}] ${file} ... `);

  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'generiq', '--remote', `--file="${filePath}"`],
    { cwd: root, encoding: 'utf8', timeout: 120_000, shell: true }
  );

  if (result.status === 0) {
    const match = result.stdout.match(/"Rows written":\s*(\d+)/);
    const rows  = match ? match[1] : '?';
    console.log(`OK  (${rows} rows written)`);
    ok++;
  } else {
    const errMsg = (result.stderr || result.stdout || '').trim();
    const detail = errMsg
      ? errMsg.split('\n').find(l => l.includes('ERROR') || l.includes('error')) || errMsg.slice(0, 120)
      : `exit ${result.status ?? 'timeout'}`;
    console.log(`FAILED — ${detail}`);
    failed++;
    // Always continue — never prompt
  }
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Done: ${ok} succeeded, ${failed} failed out of ${allFiles.length} files.`);

if (failed > 0) {
  console.log('\nRe-run any failed files individually with:');
  console.log('  npx wrangler d1 execute generiq --remote --file=sql/<filename>');
}

console.log('\nVerify counts:');
console.log('  npx wrangler d1 execute generiq --remote --command="SELECT COUNT(*) FROM medicines"');
console.log('  npx wrangler d1 execute generiq --remote --command="SELECT COUNT(*) FROM pharmacy_prices"');
console.log('  npx wrangler d1 execute generiq --remote --command="SELECT COUNT(*) FROM ingredients"');
