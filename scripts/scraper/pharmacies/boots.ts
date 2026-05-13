import type { Page } from "playwright";
import type { ScrapeResult } from "../types";
import { dismissConsent, delay, extractPriceFromText, detectOffer } from "../browser";
import { matchScore } from "../matcher";

const PHARMACY = "Boots";
const BASE      = "https://www.boots.com";

export async function scrapeBoots(query: string, page: Page): Promise<ScrapeResult[]> {
  try {
    await page.goto(`${BASE}/search?q=${encodeURIComponent(query)}`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await dismissConsent(page);
    await delay(1000, 2000);

    await page.waitForSelector('[class*="product"], [data-test*="product"], .plp-grid', {
      timeout: 8000,
    }).catch(() => {});

    const results = await page.evaluate(() => {
      const items: Array<{ name: string; price: string; url: string; packSize: string; extra: string; imageUrl: string }> = [];

      const cardSelectors = [
        '[data-test="product-tile"]',
        '.product_description',
        '[class*="ProductCard"]',
        '[class*="product-card"]',
        'li[class*="plp"]',
        '.plp-grid__item',
      ];

      let cards: NodeListOf<Element> | null = null;
      for (const sel of cardSelectors) {
        const found = document.querySelectorAll(sel);
        if (found.length > 0) { cards = found; break; }
      }
      if (!cards || cards.length === 0) return items;

      cards.forEach((card) => {
        const nameEl  = card.querySelector('h3, h2, [data-test*="name"], [class*="product-name"], [class*="ProductName"], [class*="title"]');
        const priceEl = card.querySelector('[data-test*="price"], [class*="price"], [class*="Price"], .product_price');
        const linkEl  = card.querySelector("a[href]");
        const packEl  = card.querySelector('[class*="pack"], [class*="size"], [class*="Pack"]');
        const offerEl = card.querySelector('[class*="offer"], [class*="badge"], [class*="promo"], [class*="deal"]');
        const imgEl   = card.querySelector("img");

        const name     = nameEl?.textContent?.trim() ?? "";
        const price    = priceEl?.textContent?.trim() ?? "";
        const url      = linkEl instanceof HTMLAnchorElement ? linkEl.href : "";
        const pack     = packEl?.textContent?.trim() ?? "";
        const extra    = offerEl?.textContent?.trim() ?? card.textContent?.slice(0, 200) ?? "";
        const imageUrl = imgEl instanceof HTMLImageElement
          ? (imgEl.src || imgEl.dataset.src || imgEl.getAttribute("data-lazy-src") || "")
          : "";

        if (name && price && url) items.push({ name, price, url, packSize: pack, extra, imageUrl });
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
          packSize:    r.packSize || undefined,
          inStock:     !r.extra.toLowerCase().includes("out of stock"),
          offerText:   detectOffer(r.extra),
          imageUrl:    r.imageUrl || undefined,
          matchScore:  score,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.matchScore - a.matchScore) as ScrapeResult[];
  } catch (err) {
    console.warn(`[Boots] scrape failed for "${query}":`, (err as Error).message);
    return [];
  }
}
