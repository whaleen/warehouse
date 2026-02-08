import 'dotenv/config';
import { chromium, Browser, Page } from 'playwright';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { getLocationConfig } from '../db/supabase.js';

const GE_DMS_BASE = 'https://dms-erp-aws-prd.geappliances.com';
const DEFAULT_LOCATION_ID = '00000000-0000-0000-0000-000000000001';

let browser: Browser | null = null;

const authenticate = async (page: Page, locationId: string) => {
  const config = await getLocationConfig(locationId);

  if (!config.ssoUsername || !config.ssoPassword) {
    throw new Error('SSO credentials not configured for this location');
  }

  await page.goto(`${GE_DMS_BASE}/dms/newasis`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  if (page.url().includes('sso.geappliances.com')) {
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.fill('input[name="username"]', config.ssoUsername);
    await page.fill('input[name="password"]', config.ssoPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dms/**', { timeout: 60000 });
  }

  await page.reload({ waitUntil: 'networkidle', timeout: 60000 });
};

const run = async () => {
  const locationId = process.argv[2] || process.env.DEFAULT_LOCATION_ID || DEFAULT_LOCATION_ID;
  const backhaulUrl = process.argv[3] || 'https://dms-erp-aws-prd.geappliances.com/dms/backhaul/iso?id=96780268';
  const outputDir = process.argv[4]
    || process.env.GE_DMS_ARCHIVE_DIR
    || path.resolve(process.cwd(), '..', '..', '.ge-dms-archive', 'downloads');

  await fs.mkdir(outputDir, { recursive: true });

  browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
  });

  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    viewport: { width: 1400, height: 900 },
  });

  const page = await context.newPage();
  await authenticate(page, locationId);

  await page.goto(backhaulUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
  await page.click('input[value*="Pick"], button:has-text("Pick"), a:has-text("Pick")');
  const download = await downloadPromise;
  const suggested = download.suggestedFilename();
  const downloadPath = path.join(outputDir, suggested);
  await download.saveAs(downloadPath);

  console.log(`✅ Backhaul pick list downloaded: ${downloadPath}`);
  await browser.close();
};

process.on('SIGINT', async () => {
  if (browser) await browser.close();
  process.exit(0);
});

run().catch(async (error) => {
  console.error('❌ Backhaul pick list failed:', error instanceof Error ? error.message : error);
  if (browser) await browser.close();
  process.exit(1);
});
