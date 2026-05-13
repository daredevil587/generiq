import { chromium } from "playwright";
import { resolve } from "path";

const url  = process.argv[2] ?? "http://localhost:3001/medicine/28988";
const out  = resolve(process.cwd(), "scripts/scraper/check-ui.png");
const out2 = resolve(process.cwd(), "scripts/scraper/check-ui-expanded.png");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
  await page.screenshot({ path: out, fullPage: false });
  console.log("Screenshot 1 (normal):", out);

  // Click the H&B row to expand it
  const row = page.locator('[role="button"]').first();
  if (await row.count() > 0) {
    await row.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: out2, fullPage: false });
    console.log("Screenshot 2 (expanded):", out2);
  }

  await browser.close();
})();
