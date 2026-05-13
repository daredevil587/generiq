import { chromium as baseChromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, Page } from "playwright";

baseChromium.use(StealthPlugin());

export async function launchBrowser(): Promise<Browser> {
  return baseChromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
    ],
  }) as unknown as Browser;
}

export async function newStealthPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "en-GB",
    extraHTTPHeaders: {
      "Accept-Language": "en-GB,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    },
  });
  const page = await ctx.newPage();
  // Mask webdriver flag
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  return page;
}

/** Random delay 1.5–4s to avoid bot detection */
export function delay(min = 1500, max = 4000): Promise<void> {
  return new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
}

/** Dismiss common cookie/consent banners */
export async function dismissConsent(page: Page): Promise<void> {
  const selectors = [
    'button[id*="accept"]',
    'button[class*="accept"]',
    'button[aria-label*="accept"]',
    'button[id*="cookie"]',
    '#onetrust-accept-btn-handler',
    '.cc-accept',
    '[data-testid="accept-all-cookies"]',
    'button:has-text("Accept all")',
    'button:has-text("Accept All")',
    'button:has-text("Accept cookies")',
    'button:has-text("I accept")',
    'button:has-text("Allow all")',
  ];
  for (const sel of selectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click();
        await delay(500, 1000);
        return;
      }
    } catch {}
  }
}

/** Extract all £X.XX prices from visible text on a page */
export function extractPriceFromText(text: string): string | null {
  const m = text.match(/£\s*(\d+\.\d{2})/);
  return m ? m[1] : null;
}

/** Detect offer text from a block of product text */
export function detectOffer(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/\bbuy\s+\d+\s+get\s+\d+\s+free\b/.test(t)) return text.match(/buy\s+\d+\s+get\s+\d+\s+free/i)?.[0];
  if (/\b3\s+for\s+2\b/.test(t))  return "3 for 2";
  if (/\b2\s+for\s+1\b/.test(t))  return "2 for 1";
  if (/bogof/i.test(t))            return "Buy 1 Get 1 Free";
  if (/\bhalf\s+price\b/i.test(t)) return "Half price";
  const pctMatch = text.match(/(\d+)%\s*off/i);
  if (pctMatch) return `${pctMatch[1]}% off`;
  const wasNow = text.match(/was\s+£[\d.]+/i);
  if (wasNow) return wasNow[0].replace(/\s+/g, " ").trim();
  return undefined;
}
