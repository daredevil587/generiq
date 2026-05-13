/**
 * Quick test: scrape one medicine from Holland & Barrett and print results.
 * Usage: npx tsx scripts/scraper/test-one.ts "omega 3"
 */
import { launchBrowser, newStealthPage } from "./browser";
import { scrapeHollandBarrett } from "./pharmacies/holland-barrett";

const query = process.argv[2] ?? "omega 3";

(async () => {
  console.log(`\nSearching Holland & Barrett for: "${query}"\n`);
  const browser = await launchBrowser();
  const page    = await newStealthPage(browser);

  try {
    const results = await scrapeHollandBarrett(query, page);

    if (results.length === 0) {
      console.log("No matching results (below match threshold or page blocked).");
    } else {
      results.forEach((r, i) => {
        console.log(`--- Result ${i + 1} ---`);
        console.log(`  Match score : ${(r.matchScore * 100).toFixed(0)}%`);
        console.log(`  Price       : £${r.priceGbp}`);
        console.log(`  In stock    : ${r.inStock ? "Yes" : "No"}`);
        console.log(`  Offer       : ${r.offerText ?? "none"}`);
        console.log(`  Image URL   : ${r.imageUrl ?? "none"}`);
        console.log(`  Product URL : ${r.url}`);
        console.log();
      });
    }
  } finally {
    await browser.close();
  }
})();
