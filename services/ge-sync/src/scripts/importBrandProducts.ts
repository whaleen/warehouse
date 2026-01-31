import 'dotenv/config';
import { chromium, type Browser } from 'playwright';

import { getSupabase } from '../db/supabase.js';

type ProductPayload = {
  model: string;
  product_type: string;
  brand: string;
  description?: string | null;
  image_url?: string | null;
  product_url?: string | null;
  product_category?: string | null;
  is_part?: boolean;
};

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
const VIEWPORT = { width: 1280, height: 720 };
const PAGE_TIMEOUT_MS = 45000;
const WAIT_AFTER_NAV_MS = 5000;

const BRAND_SOURCES = [
  {
    name: 'Cafe',
    match: (model: string) => model.startsWith('C'),
    baseUrl: 'https://www.cafeappliances.com',
    searchUrl: (model: string) =>
      `https://www.cafeappliances.com/shop/?search_query=${encodeURIComponent(model)}`,
    pickProductLink: (links: Array<{ href: string; text: string }>, model: string) =>
      pickBigCommerceLink(links, model, 'https://www.cafeappliances.com'),
    scrapeProduct: scrapeBigCommerceProduct,
    brand: 'Cafe',
  },
  {
    name: 'Monogram',
    match: (model: string) => model.startsWith('Z'),
    baseUrl: 'https://www.monogram.com',
    searchUrl: (model: string) =>
      `https://www.monogram.com/global-search/s?q=${encodeURIComponent(model)}`,
    pickProductLink: (links: Array<{ href: string; text: string }>, model: string) =>
      pickMonogramLink(links, model),
    scrapeProduct: scrapeMonogramProduct,
    brand: 'Monogram',
  },
  {
    name: 'Hotpoint',
    match: (model: string) => model.startsWith('H') || model.startsWith('R') || model.startsWith('Q'),
    baseUrl: 'https://products.geappliances.com',
    searchUrl: (model: string) =>
      `https://products.geappliances.com/appliance/hotpoint-product-search?Ntt=${encodeURIComponent(model)}`,
    pickProductLink: (links: Array<{ href: string; text: string }>, model: string) =>
      pickHotpointLink(links, model),
    scrapeProduct: scrapeHotpointProduct,
    brand: 'Hotpoint',
  },
  {
    name: 'GE',
    match: () => true,
    baseUrl: 'https://www.geappliances.com',
    searchUrl: (model: string) =>
      `https://www.geappliances.com/shop/?search_query=${encodeURIComponent(model)}`,
    pickProductLink: (links: Array<{ href: string; text: string }>, model: string) =>
      pickBigCommerceLink(links, model, 'https://www.geappliances.com'),
    scrapeProduct: scrapeBigCommerceProduct,
    brand: 'GE',
  },
];

async function main() {
  const args = process.argv.slice(2);
  const modelArgs = args.filter((arg) => !arg.startsWith('--'));
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : null;

  const db = getSupabase();

  const models = modelArgs.length > 0
    ? modelArgs.map(normalizeModel)
    : await fetchMissingModels(db);

  const modelsToProcess = limit ? models.slice(0, limit) : models;

  if (modelsToProcess.length === 0) {
    console.log('No missing models found.');
    return;
  }

  console.log(`Processing ${modelsToProcess.length} model(s).`);

  const browser = await chromium.launch({ headless: true });
  let processed = 0;
  let added = 0;
  let skipped = 0;

  try {
    for (const model of modelsToProcess) {
      processed += 1;
      const result = await fetchProductForModel(browser, model);
      if (!result) {
        console.log(`[miss] ${model}`);
        skipped += 1;
        continue;
      }

      const payload: ProductPayload = {
        model,
        product_type: result.productType,
        brand: result.brand,
        description: result.title ?? null,
        image_url: result.imageUrl ?? null,
        product_url: result.productUrl ?? null,
        product_category: 'appliance',
        is_part: false,
      };

      const { error } = await db
        .from('products')
        .upsert(payload, { onConflict: 'model' });

      if (error) {
        console.error(`[error] ${model} -> ${error.message}`);
        skipped += 1;
        continue;
      }

      console.log(`[ok] ${model} -> ${result.brand}`);
      added += 1;

      await delay(1000);
    }
  } finally {
    await browser.close();
  }

  console.log(`Done. Added ${added}, skipped ${skipped}, total ${processed}.`);
}

async function fetchMissingModels(db: ReturnType<typeof getSupabase>) {
  const { data: inventoryRows, error: inventoryError } = await db
    .from('inventory_items')
    .select('model');
  if (inventoryError) {
    throw new Error(`Failed to load inventory models: ${inventoryError.message}`);
  }

  const { data: productRows, error: productError } = await db
    .from('products')
    .select('model');
  if (productError) {
    throw new Error(`Failed to load product models: ${productError.message}`);
  }

  const productSet = new Set(
    (productRows ?? [])
      .map((row) => normalizeModel(row.model))
      .filter(Boolean)
  );

  const inventorySet = new Set(
    (inventoryRows ?? [])
      .map((row) => normalizeModel(row.model))
      .filter(Boolean)
  );

  return Array.from(inventorySet).filter((model) => !productSet.has(model));
}

function normalizeModel(model?: string | null) {
  return (model ?? '').trim().toUpperCase();
}

async function fetchProductForModel(browser: Browser, model: string) {
  const sources = BRAND_SOURCES.filter((source) => source.match(model));

  for (const source of sources) {
    try {
      const searchPage = await createPage(browser);
      const searchUrl = source.searchUrl(model);
      await searchPage.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
      await searchPage.waitForTimeout(WAIT_AFTER_NAV_MS);

      const links = await extractLinks(searchPage);
      const productLink = source.pickProductLink(links, model);
      await searchPage.close();

      if (!productLink) {
        continue;
      }

      const product = await source.scrapeProduct(browser, productLink, model, source.brand);
      if (product) {
        return product;
      }
    } catch (error) {
      console.warn(`[warn] ${source.name} search failed for ${model}: ${(error as Error).message}`);
    }
  }

  return null;
}

async function createPage(browser: Browser) {
  const page = await browser.newPage({ userAgent: USER_AGENT, viewport: VIEWPORT, locale: 'en-US' });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  return page;
}

async function extractLinks(page: Awaited<ReturnType<typeof createPage>>) {
  return page.$$eval('a[href]', (anchors) =>
    anchors
      .map((anchor) => ({
        href: anchor.getAttribute('href') ?? '',
        text: (anchor.textContent ?? '').trim(),
      }))
      .filter((entry) => entry.href)
  );
}

function pickBigCommerceLink(
  links: Array<{ href: string; text: string }>,
  model: string,
  baseUrl: string
) {
  const normalizedModel = model.toUpperCase();
  const candidates = links
    .map((link) => ({
      href: link.href.startsWith('http') ? link.href : `${baseUrl}${link.href}`,
      text: link.text,
    }))
    .filter((link) => link.href.includes('/appliance/'));

  return (
    candidates.find((link) => link.href.toUpperCase().includes(normalizedModel))?.href ??
    candidates.find((link) => link.text.toUpperCase().includes(normalizedModel))?.href ??
    candidates[0]?.href ??
    null
  );
}

function pickMonogramLink(links: Array<{ href: string; text: string }>, model: string) {
  const normalizedModel = model.toUpperCase();
  const candidates = links
    .map((link) => ({
      href: link.href.startsWith('http') ? link.href : `https://www.monogram.com${link.href}`,
      text: link.text,
    }))
    .filter((link) => link.href.includes('/product/'));

  return (
    candidates.find((link) => link.text.toUpperCase().includes(normalizedModel))?.href ??
    candidates.find((link) => link.href.toUpperCase().includes(normalizedModel))?.href ??
    candidates[0]?.href ??
    null
  );
}

function pickHotpointLink(links: Array<{ href: string; text: string }>, model: string) {
  const normalizedModel = model.toUpperCase();
  const candidates = links
    .map((link) => ({
      href: link.href.startsWith('http')
        ? link.href
        : `https://products.geappliances.com${link.href}`,
      text: link.text,
    }))
    .filter((link) => link.href.includes('hotpoint-specs'));

  return (
    candidates.find((link) => link.href.toUpperCase().includes(normalizedModel))?.href ??
    candidates[0]?.href ??
    null
  );
}

async function scrapeBigCommerceProduct(
  browser: Browser,
  productUrl: string,
  model: string,
  brand: string
) {
  const page = await createPage(browser);
  try {
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
    await page.waitForTimeout(WAIT_AFTER_NAV_MS);

    const title =
      (await page.$eval('.productView-title', (el) => el.textContent?.trim()).catch(() => null)) ??
      (await page.$eval('h1', (el) => el.textContent?.trim()).catch(() => null));

    const ogImage = await page
      .$eval('meta[property="og:image"]', (el) => el.getAttribute('content'))
      .catch(() => null);

    const images = await page.$$eval('img', (imgs) =>
      imgs
        .map((img) => img.getAttribute('src') || img.getAttribute('data-src'))
        .filter(Boolean)
    );
    const imageUrl =
      ogImage ??
      images.find((src) => src.includes('bigcommerce') && src.includes('/products/')) ??
      null;

    const modelFromPage = await page.evaluate(() => {
      const text = document?.body?.textContent ?? '';
      const match = text.match(/Model\s*#:\s*([A-Z0-9-]+)/i);
      return match?.[1] || null;
    });

    const breadcrumbs = await page.$$eval(
      'nav.breadcrumb, .breadcrumbs, [aria-label="breadcrumb"], nav[aria-label="Breadcrumb"]',
      (nodes) => {
        const items: string[] = [];
        nodes.forEach((node) => {
          const texts = Array.from(node.querySelectorAll('a, span, li'))
            .map((el) => el.textContent?.trim())
            .filter((text): text is string => Boolean(text));
          items.push(...texts);
        });
        return Array.from(new Set(items));
      }
    );

    return {
      model: modelFromPage ?? model,
      title: title ?? null,
      imageUrl,
      productUrl,
      productType: inferProductType(title ?? '', breadcrumbs),
      brand,
    };
  } finally {
    await page.close();
  }
}

async function scrapeMonogramProduct(
  browser: Browser,
  productUrl: string,
  model: string,
  brand: string
) {
  const page = await createPage(browser);
  try {
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
    await page.waitForTimeout(WAIT_AFTER_NAV_MS + 2000);

    const title = await page.$eval('h1', (el) => el.textContent?.trim()).catch(() => null);
    const images = await page.$$eval('img', (imgs) =>
      imgs
        .map((img) => img.getAttribute('src') || img.getAttribute('data-src'))
        .filter(Boolean)
    );
    const imageUrl =
      images.find((src) => src.includes('products-salsify')) ??
      images.find((src) => src.includes('salsify')) ??
      images[0] ??
      null;

    return {
      model,
      title: title ?? null,
      imageUrl,
      productUrl,
      productType: inferProductType(title ?? '', []),
      brand,
    };
  } finally {
    await page.close();
  }
}

async function scrapeHotpointProduct(
  browser: Browser,
  productUrl: string,
  model: string,
  brand: string
) {
  const page = await createPage(browser);
  try {
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
    await page.waitForTimeout(WAIT_AFTER_NAV_MS);

    const title = await page.$eval('h1', (el) => el.textContent?.trim()).catch(() => null);
    const images = await page.$$eval('img', (imgs) =>
      imgs
        .map((img) => img.getAttribute('src') || img.getAttribute('data-src'))
        .filter(Boolean)
    );
    const imageUrl =
      images.find((src) => src.includes('products-salsify')) ??
      images.find((src) => src.includes('salsify')) ??
      null;

    return {
      model,
      title: title ?? null,
      imageUrl,
      productUrl,
      productType: inferProductType(title ?? '', []),
      brand,
    };
  } finally {
    await page.close();
  }
}

function inferProductType(title: string, breadcrumbs: string[]) {
  const haystack = `${title} ${breadcrumbs.join(' ')}`.toUpperCase();
  const rules: Array<[string, string[]]> = [
    ['REFRIGERATOR', ['REFRIGERATOR', 'FRIDGE']],
    ['RANGE', ['RANGE']],
    ['MICROWAVE', ['MICROWAVE']],
    ['DISHWASHER', ['DISHWASHER']],
    ['COOKTOP', ['COOKTOP']],
    ['OVEN', ['OVEN']],
    ['WASHER', ['WASHER']],
    ['DRYER', ['DRYER']],
    ['HOOD', ['HOOD', 'VENT']],
    ['FREEZER', ['FREEZER']],
  ];

  for (const [type, keywords] of rules) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return type;
    }
  }

  return 'APPLIANCE';
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
