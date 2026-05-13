/**
 * GeneriQ price scraper
 * Usage:  npx tsx scripts/scraper/run.ts [--limit 200] [--pharmacy boots,superdrug]
 *
 * Fetches medicines without retail prices, searches each pharmacy,
 * and writes results back to pharmacy_prices.
 */

import { launchBrowser, newStealthPage, delay } from "./browser";
import { getMedicinesNeedingPrices, upsertPrice, close } from "./db";
import { scrapeBoots }          from "./pharmacies/boots";
import { scrapeSuperdrug }      from "./pharmacies/superdrug";
import { scrapeHollandBarrett } from "./pharmacies/holland-barrett";
import { scrapePharmacy2U }     from "./pharmacies/pharmacy2u";
import type { Page } from "playwright";
import type { ScrapeResult } from "./types";

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg >= 0 ? parseInt(args[limitArg + 1], 10) : 200;

const pharmArg   = args.indexOf("--pharmacy");
const PHARMACIES_ARG = pharmArg >= 0 ? args[pharmArg + 1].split(",") : null;

const catArg  = args.indexOf("--category");
const CATEGORY = catArg >= 0 ? args[catArg + 1] : undefined;

// ─── Scraper registry ─────────────────────────────────────────────────────────

const ALL_SCRAPERS: Array<{
  name: string;
  fn: (q: string, page: Page) => Promise<ScrapeResult[]>;
}> = [
  { name: "Boots",            fn: scrapeBoots },
  { name: "Superdrug",        fn: scrapeSuperdrug },
  { name: "Holland & Barrett", fn: scrapeHollandBarrett },
  { name: "Pharmacy2U",       fn: scrapePharmacy2U },
];

const SCRAPERS = PHARMACIES_ARG
  ? ALL_SCRAPERS.filter((s) =>
      PHARMACIES_ARG.some((p) => s.name.toLowerCase().includes(p.toLowerCase())),
    )
  : ALL_SCRAPERS;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍 GeneriQ Scraper — ${new Date().toISOString()}`);
  console.log(`   Limit: ${LIMIT} medicines | Pharmacies: ${SCRAPERS.map((s) => s.name).join(", ")}${CATEGORY ? ` | Category: ${CATEGORY}` : ""}\n`);

  const medicines = await getMedicinesNeedingPrices(LIMIT, CATEGORY);
  console.log(`   Found ${medicines.length} medicines without retail prices\n`);

  if (medicines.length === 0) {
    console.log("   Nothing to scrape. Exiting.");
    await close();
    return;
  }

  const browser = await launchBrowser();
  let priced = 0;
  let withImage = 0;
  let failed = 0;

  for (const [mIdx, medicine] of medicines.entries()) {
    const searchQuery = medicine.name.length > 60
      ? medicine.name.slice(0, 60)
      : medicine.name;

    process.stdout.write(
      `[${mIdx + 1}/${medicines.length}] ${medicine.name.slice(0, 50).padEnd(50)} `,
    );

    let foundAny = false;
    let gotImage = false;

    for (const scraper of SCRAPERS) {
      const page = await newStealthPage(browser);

      try {
        const results = await scraper.fn(searchQuery, page);
        const best    = results[0];

        if (best) {
          await upsertPrice(
            medicine.id,
            best.pharmacyName,
            best.priceGbp,
            best.url,
            best.packSize,
            best.strength,
            best.inStock,
            best.offerText,
            best.imageUrl,
          );
          process.stdout.write(`  ${scraper.name}: £${best.priceGbp}`);
          if (best.imageUrl) { process.stdout.write(" [img]"); gotImage = true; }
          if (best.offerText) process.stdout.write(` [${best.offerText}]`);
          foundAny = true;
        }
      } catch (err) {
        process.stdout.write(`  ${scraper.name}: ERR`);
        failed++;
      } finally {
        await page.context().close().catch(() => {});
      }

      // Rate limit between pharmacies for the same medicine
      await delay(2000, 3500);
    }

    process.stdout.write("\n");
    if (foundAny) priced++;
    if (gotImage) {
      withImage++;
      if (withImage % 10 === 0) {
        console.log(`\n--- CHECKPOINT: ${withImage} products saved with price + image (${priced} total priced) ---\n`);
      }
    }

    // Slightly longer pause between medicines
    if (mIdx < medicines.length - 1) await delay(1500, 3000);
  }

  await browser.close();
  await close();

  console.log(`\n✅ Done — ${priced}/${medicines.length} medicines priced, ${withImage} with images, ${failed} errors`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
