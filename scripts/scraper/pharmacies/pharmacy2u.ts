import type { Page } from "playwright";
import type { ScrapeResult } from "../types";
import { dismissConsent, delay, extractPriceFromText, detectOffer } from "../browser";
import { matchScore } from "../matcher";

const PHARMACY = "Pharmacy2U";
const BASE      = "https://www.pharmacy2u.co.uk";

export async function scrapePharmacy2U(query: string, page: Page): Promise<ScrapeResult[]> {
  try {
    await page.goto(
      `${BASE}/search?q=${encodeURIComponent(query)}`,
      { waitUntil: "domcontentloaded", timeout: 20000 },
    );
    await dismissConsent(page);
    await delay(800, 1800);

    await page.waitForSelector(
      '[class*="product"], .search-results, [class*="Product"]',
      { timeout: 8000 },
    ).catch(() => {});

    const results = await page.evaluate(() => {
      const items: Array<{ name: string; price: string; url: string; packSize: string; extra: string; imageUrl: string }> = [];

      const cardSelectors = [
        '[class*="product-item"]',
        '[class*="ProductItem"]',
        '.product-list-item',
        '[data-component="product-card"]',
        '[class*="search-result"] > li',
        '[class*="productCard"]',
      ];

      let cards: NodeListOf<Element> | null = null;
      for (const sel of cardSelectors) {
        const found = document.querySelectorAll(sel);
        if (found.length > 0) { cards = found; break; }
      }
      if (!cards || cards.length === 0) return items;

      cards.forEach((card) => {
        const nameEl  = card.querySelector('h3, h2, h4, [class*="name"], [class*="title"]');
        const priceEl = card.querySelector('[class*="price"], [class*="Price"]');
        const linkEl  = card.querySelector("a[href]");
        const offerEl = card.querySelector('[class*="offer"], [class*="badge"], [class*="promo"]');
        const imgEl   = card.querySelector("img");

        const name     = nameEl?.textContent?.trim() ?? "";
        const price    = priceEl?.textContent?.trim() ?? "";
        const url      = linkEl instanceof HTMLAnchorElement ? linkEl.href : "";
        const extra    = (offerEl?.textContent ?? "") + " " + (card.textContent?.slice(0, 200) ?? "");
        const imageUrl = imgEl instanceof HTMLImageElement
          ? (imgEl.src || imgEl.dataset.src || imgEl.getAttribute("data-lazy-src") || "")
          : "";

        if (name && price && url) items.push({ name, price, url, packSize: "", extra, imageUrl });
      });

      return items.slice(0, 8);
    });

    return results
      .map((r) => {
        const price = extractPriceFromText(r.price) ?? extractPriceFromText(r.extra);
        if (!price) return null;
        const score = matchScore(query, r.name);
        if (score < 0.35) return null;
        return {
          pharmacyName: PHARMACY,
          priceGbp:    price,
          url:         r.url.startsWith("http") ? r.url : `${BASE}${r.url}`,
          inStock:     !r.extra.toLowerCase().includes("out of stock"),
          offerText:   detectOffer(r.extra),
          imageUrl:    r.imageUrl || undefined,
          matchScore:  score,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.matchScore - a.matchScore) as ScrapeResult[];
  } catch (err) {
    console.warn(`[Pharmacy2U] scrape failed for "${query}":`, (err as Error).message);
    return [];
  }
}
