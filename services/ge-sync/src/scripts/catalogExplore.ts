import 'dotenv/config';
import { chromium, Page } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getLocationConfig } from '../db/supabase.js';

const GE_DMS_BASE = 'https://dms-erp-aws-prd.geappliances.com';
const DEFAULT_LOCATION_ID = '00000000-0000-0000-0000-000000000001';

type CaptureResult = {
  url: string;
  title: string;
  timestamp: string;
  screenshot: string;
  htmlFile: string;
  textFile: string;
  exportButtons: string[];
};


const loadCatalogUrls = async (catalogPath: string) => {
  const content = await fs.readFile(catalogPath, 'utf8');
  const urls = new Set<string>();
  const regex = /\*\*URL\*\*:\s*`([^`]+)`/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content))) {
    const raw = match[1].trim();
    if (!raw || raw.toLowerCase().includes('unknown')) continue;
    urls.add(raw);
  }

  return Array.from(urls);
};

const slugify = (input: string) => {
  return input
    .toLowerCase()
    .replace(/https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
};

const detectExportButtons = async (page: Page) => {
  return page.$$eval(
    'input[value*="SpreadSheet"], input[value*="Spreadsheet"], input[value*="Excel"], input[value*="Download"], button:has-text("Export"), button:has-text("Download")',
    (els) =>
      els.map((el) => (el as HTMLInputElement).value || el.textContent?.trim() || '').filter(Boolean)
  );
};

const capturePage = async (page: Page, archiveDir: string, index: number) => {
  const url = page.url();
  const title = await page.title();
  const timestamp = new Date().toISOString();
  const slug = slugify(url || title || `page-${index}`) || `page-${index}`;

  const screenshot = path.join(archiveDir, `${index.toString().padStart(2, '0')}-${slug}.png`);
  const htmlFile = path.join(archiveDir, `${index.toString().padStart(2, '0')}-${slug}.html`);
  const textFile = path.join(archiveDir, `${index.toString().padStart(2, '0')}-${slug}.txt`);

  const [html, text, exportButtons] = await Promise.all([
    page.content(),
    page.evaluate(() => document.body?.innerText ?? ''),
    detectExportButtons(page),
  ]);

  await Promise.all([
    page.screenshot({ path: screenshot, fullPage: true }),
    fs.writeFile(htmlFile, html),
    fs.writeFile(textFile, text),
  ]);

  const result: CaptureResult = {
    url,
    title,
    timestamp,
    screenshot,
    htmlFile,
    textFile,
    exportButtons,
  };

  return result;
};

const authenticate = async (locationId: string) => {
  const config = await getLocationConfig(locationId);

  if (!config.ssoUsername || !config.ssoPassword) {
    throw new Error('SSO credentials not configured for this location');
  }

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    viewport: { width: 1400, height: 900 },
  });

  const page = await context.newPage();
  await page.goto(`${GE_DMS_BASE}/dms/newasis`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  if (page.url().includes('sso.geappliances.com')) {
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.fill('input[name="username"]', config.ssoUsername);
    await page.fill('input[name="password"]', config.ssoPassword);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL('**/dms/**', { timeout: 60000 });
    } catch {
      await page.waitForTimeout(5000);
      await page.goto(`${GE_DMS_BASE}/dms/newasis`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForURL('**/dms/**', { timeout: 60000 });
    }
  }

  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  return { browser, page };
};

const resolveUrl = (raw: string) => {
  if (raw.startsWith('http')) return raw;
  if (raw.startsWith('/')) return `${GE_DMS_BASE}${raw}`;
  return `${GE_DMS_BASE}/${raw}`;
};

const run = async () => {
  const locationId = process.argv[2] || process.env.DEFAULT_LOCATION_ID || DEFAULT_LOCATION_ID;
  const archiveDir = process.argv[3]
    || process.env.GE_DMS_ARCHIVE_DIR
    || path.resolve(process.cwd(), '..', '..', '.ge-dms-archive');

  await fs.mkdir(archiveDir, { recursive: true });
  const indexFile = path.join(archiveDir, 'index.jsonl');

  const catalogPath = path.resolve(process.cwd(), 'docs', 'GE_DMS_PAGES.md');
  const urls = await loadCatalogUrls(catalogPath);

  console.log(`\n📚 Loaded ${urls.length} GE DMS pages from catalog.`);
  console.log(`📁 Archive: ${archiveDir}\n`);

  const { browser, page } = await authenticate(locationId);

  try {
    for (let i = 0; i < urls.length; i += 1) {
      const raw = urls[i];
      const target = resolveUrl(raw);

      console.log(`\n[${i + 1}/${urls.length}] Navigate to: ${target}`);
      await page.goto(target, { waitUntil: 'networkidle', timeout: 30000 });
      console.log('✅ Page loaded. Capturing...');

      const capture = await capturePage(page, archiveDir, i + 1);
      await fs.appendFile(indexFile, `${JSON.stringify(capture)}\n`);
      console.log(`📸 Captured: ${capture.title || capture.url}`);
      if (capture.exportButtons.length) {
        console.log(`📤 Export buttons: ${capture.exportButtons.join(', ')}`);
      }
    }
  } finally {
    await browser.close();
  }
};

run().catch((error) => {
  console.error('❌ Explorer failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
