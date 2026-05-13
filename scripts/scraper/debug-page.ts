/**
 * Debug: find H&B search results section (not the carousel).
 */
import { launchBrowser, newStealthPage, dismissConsent, delay } from "./browser";

const query = process.argv[2] ?? "omega 3";

(async () => {
  const browser = await launchBrowser();
  const page    = await newStealthPage(browser);

  try {
    await page.goto(
      `https://www.hollandandbarrett.com/shop/search/?q=${encodeURIComponent(query)}&ctype=product`,
      { waitUntil: "networkidle", timeout: 30000 },
    );
    await dismissConsent(page);
    await delay(2000, 3000);

    const data = await page.evaluate(() => {
      // Find ALL midi-product-cards, but exclude ones inside a carousel
      const allCards = Array.from(document.querySelectorAll('a[data-testid="midi-product-card"]'));

      // Cards outside carousel
      const carouselEl = document.querySelector('[data-testid="midi_carousel_top_sellers"], [class*="MidiCarousel"]');
      const carouselCards = carouselEl ? Array.from(carouselEl.querySelectorAll('a[data-testid="midi-product-card"]')) : [];
      const carouselUrls  = new Set(carouselCards.map(c => (c as HTMLAnchorElement).href));

      const searchCards = allCards.filter(c => !carouselUrls.has((c as HTMLAnchorElement).href));

      // Also check for product-card (non-midi)
      const altCards = document.querySelectorAll('[data-testid="product-card"], [class*="ProductCard-module_product"]');

      return {
        total:   allCards.length,
        carousel: carouselCards.length,
        searchResults: searchCards.length,
        altCards: altCards.length,
        firstSearch: searchCards.slice(0, 3).map(card => {
          const imgEl = card.querySelector("img") as HTMLImageElement | null;
          const text  = card.textContent ?? "";
          return {
            name:  card.getAttribute("title") ?? imgEl?.getAttribute("alt") ?? "",
            price: text.match(/£\s*\d+\.\d{2}/)?.[0] ?? "",
            image: imgEl?.src ?? "",
            url:   (card as HTMLAnchorElement).href ?? "",
          };
        }),
      };
    });

    console.log(`\nTotal midi-product-cards: ${data.total}`);
    console.log(`In carousel:              ${data.carousel}`);
    console.log(`In search results:        ${data.searchResults}`);
    console.log(`Alt card type:            ${data.altCards}`);
    console.log("\nFirst 3 search result cards:");
    (data.firstSearch as any[]).forEach((r, i) => {
      console.log(`\n  ${i + 1}. ${r.name}`);
      console.log(`     Price: ${r.price}`);
      console.log(`     Image: ${r.image}`);
      console.log(`     URL:   ${r.url}`);
    });

  } finally {
    await browser.close();
  }
})();
