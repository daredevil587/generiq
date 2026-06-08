/**
 * scraper-utils.mjs
 * Shared utilities: DB connection, product matching, price upsert, proxy support.
 *
 * Optional env vars:
 *   SCRAPER_API_KEY  — ScraperAPI.com key; enables proxy for blocked sites.
 *                      Free tier: 1000 requests/month. Get one at scraperapi.com
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium as playwrightChromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

const __dirname = dirname(fileURLToPath(import.meta.url));

for (const line of readFileSync(join(__dirname, '..', '..', '.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (t && !t.startsWith('#') && t.includes('=')) {
    const [k, ...vs] = t.split('=');
    process.env[k.trim()] = vs.join('=').trim();
  }
}

const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });

// ── Name normalisation ────────────────────────────────────────────────────────

export function normaliseName(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/[''`´]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(tablets?|capsules?|softgels?|gummies?|liquid|spray|gel|cream|serum|lotion|oil|ml|mg|g\b|x\d+|\d+\s*pack)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordSet(s) {
  return new Set(normaliseName(s).split(' ').filter(w => w.length > 2));
}

export function matchScore(dbName, scrapedName) {
  const dbWords  = wordSet(dbName);
  const scrWords = wordSet(scrapedName);
  if (dbWords.size === 0 || scrWords.size === 0) return 0;
  let overlap = 0;
  for (const w of dbWords) if (scrWords.has(w)) overlap++;
  const union = new Set([...dbWords, ...scrWords]).size;
  return overlap / union;
}

export async function loadDbProducts(categories) {
  const placeholders = categories.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await pool.query(
    `SELECT id, name, category FROM medicines WHERE category IN (${placeholders})`,
    categories,
  );
  return rows.map(r => ({ ...r, norm: normaliseName(r.name) }));
}

export function findBestMatch(scrapedName, dbProducts, minScore = 0.35) {
  let best = null;
  let bestScore = 0;
  for (const p of dbProducts) {
    const score = matchScore(p.name, scrapedName);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return bestScore >= minScore ? { product: best, score: bestScore } : null;
}

export async function upsertPrice({ medicineId, pharmacyName, pharmacyUrl, priceGbp, packSize, source, imageUrl }) {
  await pool.query(`
    INSERT INTO pharmacy_prices
      (medicine_id, pharmacy_name, pharmacy_url, price_gbp, in_stock, pack_size, image_url, source, last_updated)
    VALUES ($1, $2, $3, $4, true, $5, $6, $7, NOW())
    ON CONFLICT (medicine_id, pharmacy_name)
    DO UPDATE SET
      price_gbp    = EXCLUDED.price_gbp,
      pharmacy_url = EXCLUDED.pharmacy_url,
      pack_size    = EXCLUDED.pack_size,
      image_url    = COALESCE(EXCLUDED.image_url, pharmacy_prices.image_url),
      source       = EXCLUDED.source,
      last_updated = NOW()
  `, [medicineId, pharmacyName, pharmacyUrl, priceGbp, packSize ?? null, imageUrl ?? null, source]);
}

export async function upsertMedicine({ name, category, source }) {
  const existing = await pool.query(
    'SELECT id FROM medicines WHERE name = $1 AND category = $2 LIMIT 1',
    [name, category],
  );
  if (existing.rows.length > 0) return existing.rows[0].id;
  const { rows } = await pool.query(`
    INSERT INTO medicines (name, generic_name, category, description, active_ingredient, dosage_form, mhra_approved, source, created_at)
    VALUES ($1, $1, $2, '', '', '', false, $3, NOW())
    RETURNING id
  `, [name, category, source]);
  return rows[0]?.id ?? null;
}

export async function removeEstimatedPrices(categories) {
  const placeholders = categories.map((_, i) => `$${i + 1}`).join(',');
  const { rowCount } = await pool.query(`
    DELETE FROM pharmacy_prices pp
    USING medicines m
    WHERE pp.medicine_id = m.id
      AND m.category IN (${placeholders})
      AND pp.source = 'estimated'
      AND EXISTS (
        SELECT 1 FROM pharmacy_prices pp2
        WHERE pp2.medicine_id = pp.medicine_id
          AND pp2.source != 'estimated'
      )
  `, categories);
  return rowCount;
}

// ── Timing helpers ────────────────────────────────────────────────────────────

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export function randDelay(minMs = 800, maxMs = 2000) {
  return sleep(minMs + Math.random() * (maxMs - minMs));
}

// ── Rotating User-Agents ──────────────────────────────────────────────────────

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
];

export function randomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export const PAGE_HEADERS = {
  'User-Agent': USER_AGENTS[0],
  'Accept-Language': 'en-GB,en;q=0.9',
};

// ── Full stealth HTTP headers (mimics real Chrome) ────────────────────────────

export function buildHeaders(ua) {
  const agent = ua || randomUserAgent();
  return {
    'User-Agent': agent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };
}

// ── ScraperAPI proxy fetch ────────────────────────────────────────────────────
// Set SCRAPER_API_KEY env var to route blocked sites through ScraperAPI.
// Free: 1000 credits/month at scraperapi.com. render=true costs 5 credits.

export async function fetchWithProxy(url, { render = false, retries = 2, timeout = 30000 } = {}) {
  const key = process.env.SCRAPER_API_KEY;
  if (key) {
    const apiUrl = `https://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(url)}&country_code=gb${render ? '&render=true' : ''}`;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(apiUrl, { signal: AbortSignal.timeout(timeout) });
        if (res.status === 429) { await sleep(5000 + attempt * 5000); continue; }
        if (!res.ok) throw new Error(`ScraperAPI HTTP ${res.status}`);
        return res.text();
      } catch (err) {
        if (attempt < retries) { await sleep(3000); continue; }
        throw err;
      }
    }
  }

  // Direct fetch fallback
  const ua = randomUserAgent();
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: buildHeaders(ua),
        signal: AbortSignal.timeout(timeout),
        redirect: 'follow',
      });
      if (res.status === 429 || res.status === 503) {
        console.warn(`  ⚠ HTTP ${res.status} — backing off (attempt ${attempt + 1})`);
        await sleep(5000 + attempt * 5000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res.text();
    } catch (err) {
      if (attempt < retries) { await sleep(3000); continue; }
      throw err;
    }
  }
  return null;
}

// ── Browser helpers ───────────────────────────────────────────────────────────

export const BROWSER_ARGS = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-web-security',
    '--disable-gpu',
    '--window-size=1920,1080',
  ],
};

export async function launchStealthBrowser() {
  playwrightChromium.use(StealthPlugin());
  return playwrightChromium.launch(BROWSER_ARGS);
}

// ── Generic product extractor (works on any website) ─────────────────────────
// Falls back through 3 strategies to find product cards with prices.

export async function genericProductExtract(page, baseUrl = '') {
  return page.evaluate((base) => {
    const results = [];
    const seenUrls = new Set();
    const seenNames = new Set();

    function parsePrice(text) {
      const m = (text || '').match(/£\s*([\d,]+\.?\d*)/);
      if (!m) return null;
      const p = parseFloat(m[1].replace(',', ''));
      return (p >= 0.3 && p <= 1000) ? p : null;
    }

    function getLink(el) {
      return el.querySelector('a[href]') || el.closest('a[href]');
    }

    function buildUrl(href) {
      if (!href) return null;
      if (href.startsWith('http')) return href;
      if (href.startsWith('//')) return 'https:' + href;
      try { return new URL(href, base || location.href).href; } catch { return null; }
    }

    function extractFromContainer(container) {
      if (!container || container.children.length > 20) return;

      const containerText = container.textContent || '';
      const price = parsePrice(containerText);
      if (!price) return;

      const link = getLink(container);
      if (!link) return;

      const href = buildUrl(link.getAttribute('href'));
      if (!href || href === '#' || seenUrls.has(href)) return;

      // Skip non-product links
      if (href.includes('javascript:') || href.includes('mailto:') || href.includes('tel:')) return;

      seenUrls.add(href);

      // Find product name
      const nameEl = (
        container.querySelector('h1, h2, h3, h4, h5') ||
        container.querySelector('[class*="name" i], [class*="title" i], [data-testid*="name" i], [data-testid*="title" i]') ||
        link
      );

      let name = (nameEl?.textContent || '').trim().replace(/\s+/g, ' ');
      if (name.length > 200) name = name.slice(0, 200);
      if (!name || name.length < 3) return;

      // Deduplicate by normalised name
      const normName = name.toLowerCase().replace(/\s+/g, ' ').slice(0, 60);
      if (seenNames.has(normName)) return;
      seenNames.add(normName);

      const img = container.querySelector('img');
      const imageUrl = img?.src || img?.getAttribute('data-src') || null;

      results.push({ name, price, href, imageUrl });
    }

    // Strategy 1: semantic / data-attribute product containers
    const SELECTORS = [
      '[data-testid*="product"]', '[data-test*="product"]',
      '[data-component*="product" i]', '[data-cy*="product"]',
      '[class*="product-card" i]', '[class*="productcard" i]',
      '[class*="product-item" i]', '[class*="productitem" i]',
      '[class*="product-tile" i]', '[class*="producttile" i]',
      '[class*="plp-item" i]', '[class*="plpitem" i]',
      '[class*="item-card" i]', '[class*="catalogue-item" i]',
      'article.product', 'li.product',
    ];

    for (const sel of SELECTORS) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        for (const el of els) extractFromContainer(el);
        if (results.length >= 3) break;
      }
    }

    // Strategy 2: walk all anchors and look for prices in parent containers
    if (results.length === 0) {
      const links = document.querySelectorAll('a[href]');
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        if (!href || href === '#' || href.includes('javascript:')) continue;

        // Walk up 4 levels to find price
        let el = link.parentElement;
        for (let depth = 0; depth < 4; depth++) {
          if (!el) break;
          const txt = el.textContent || '';
          const price = parsePrice(txt);
          if (price) {
            // Only if this container has limited children (avoid page-level containers)
            const childCount = el.querySelectorAll('a[href]').length;
            if (childCount <= 5) {
              extractFromContainer(el);
            }
            break;
          }
          el = el.parentElement;
        }
      }
    }

    // Strategy 3: find any element containing £ that has exactly one link
    if (results.length === 0) {
      const allEls = document.querySelectorAll('div, li, article, section');
      for (const el of allEls) {
        const directLinks = Array.from(el.querySelectorAll('a[href]'));
        if (directLinks.length !== 1) continue;
        if ((el.textContent || '').length > 500) continue;
        extractFromContainer(el);
      }
    }

    return results;
  }, baseUrl);
}
