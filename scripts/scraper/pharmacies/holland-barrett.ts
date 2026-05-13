import type { Page } from "playwright";
import type { ScrapeResult } from "../types";
import { dismissConsent, delay, extractPriceFromText, detectOffer } from "../browser";
import { matchScore } from "../matcher";

const PHARMACY = "Holland & Barrett";
const BASE      = "https://www.hollandandbarrett.com";

export async function scrapeHollandBarrett(query: string, page: Page): Promise<ScrapeResult[]> {
  try {
    await page.goto(
      `${BASE}/shop/search/?q=${encodeURIComponent(query)}&ctype=product`,
      { waitUntil: "domcontentloaded", timeout: 20000 },
    );
    await dismissConsent(page);
    await delay(800, 1800);

    await page.waitForSelector('a[data-testid="midi-product-card"]', { timeout: 8000 }).catch(() => {});

    const results = await page.evaluate(() => {
      const allCards = Array.from(document.querySelectorAll('a[data-testid="midi-product-card"]'));

      // Exclude carousel top-sellers — they're not search results
      const carouselEl  = document.querySelector('[data-testid="midi_carousel_top_sellers"], [class*="MidiCarousel"]');
      const carouselUrls = carouselEl
        ? new Set(Array.from(carouselEl.querySelectorAll('a[data-testid="midi-product-card"]')).map(c => (c as HTMLAnchorElement).href))
        : new Set<string>();

      const searchCards = allCards.filter(c => !carouselUrls.has((c as HTMLAnchorElement).href));

      return searchCards.slice(0, 10).map(card => {
        const imgEl   = card.querySelector("img") as HTMLImageElement | null;
        const offerEl = card.querySelector('[class*="offer"], [class*="badge"], [class*="promo"], [class*="saving"], [class*="deal"]');
        const text    = card.textContent ?? "";
        const name    = card.getAttribute("title") ?? imgEl?.getAttribute("alt") ?? "";
        const url     = (card as HTMLAnchorElement).href ?? "";
        const price   = text.match(/£\s*\d+\.\d{2}/)?.[0] ?? "";
        const extra   = (offerEl?.textContent ?? "") + " " + text.slice(0, 300);
        const imageUrl = imgEl?.src || imgEl?.dataset?.src || "";
        return { name, price, url, extra, imageUrl };
      });
    });

    return results
      .map((r) => {
        const price = extractPriceFromText(r.price) ?? extractPriceFromText(r.extra);
        if (!price) return null;
        const score = matchScore(query, r.name);
        if (score < 0.3) return null;
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
    console.warn(`[H&B] scrape failed for "${query}":`, (err as Error).message);
    return [];
  }
}
