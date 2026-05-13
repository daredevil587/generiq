import { chromium } from "playwright";
import { resolve } from "path";

(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ colorScheme: "dark" });
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto("http://localhost:3000/medicine/28988", { waitUntil: "domcontentloaded", timeout: 15000 });
  await p.evaluate(() => document.documentElement.classList.add("dark"));
  await p.waitForTimeout(600);

  await p.screenshot({ path: resolve(process.cwd(), "scripts/scraper/dark-normal.png") });
  console.log("Shot 1 done");

  const row = await p.$('[role="button"]');
  if (row) {
    await row.click();
    await p.waitForTimeout(500);
    await p.screenshot({ path: resolve(process.cwd(), "scripts/scraper/dark-expanded.png") });
    console.log("Shot 2 done");
  }

  await b.close();
})();
