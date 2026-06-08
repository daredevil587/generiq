import * as cheerio from 'cheerio';

const html = await fetch('https://www.chemist-4-u.com/vitamins', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
}).then(r => r.text());

const $ = cheerio.load(html);

// Check product-item structure
const items = $('li.product-item, .product-item');
console.log(`Found ${items.length} product items\n`);

items.slice(0, 3).each((i, el) => {
  const $el = $(el);
  console.log(`=== Product ${i + 1} ===`);
  
  // Try various name selectors
  const nameSelectors = [
    'a.product-item-link',
    '.product-name a',
    '.product-item-name a',
    'h3 a', 'h2 a',
    '.product-item-name',
    'a[title]',
    'a.stretched-link',
  ];
  for (const s of nameSelectors) {
    const text = $el.find(s).first().text().trim();
    if (text) console.log(`  name [${s}]: ${text.slice(0, 80)}`);
  }
  
  // Try various price selectors
  const priceSelectors = [
    '.price', '.regular-price', '.special-price',
    '[data-price-amount]', '.price-wrapper',
    'span.price', '[x-html*="price"]',
  ];
  for (const s of priceSelectors) {
    const text = $el.find(s).first().text().trim();
    const dataPrice = $el.find(s).first().attr('data-price-amount');
    if (text || dataPrice) console.log(`  price [${s}]: text="${text}" data="${dataPrice}"`);
  }
  
  // Try finding href
  const href = $el.find('a[href]').first().attr('href');
  console.log(`  href: ${href}`);
  
  // Dump inner text
  const text = $el.text().replace(/\s+/g, ' ').trim().slice(0, 200);
  console.log(`  text: ${text}\n`);
});
