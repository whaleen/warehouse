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
  const outputDir = process.argv[3]
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

  await page.goto(`${GE_DMS_BASE}/dms/backhaul`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);

  const notCompleteSelector = '#notComplete';
  const isChecked = await page.isChecked(notCompleteSelector).catch(() => false);
  if (isChecked) {
    await page.uncheck(notCompleteSelector);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
  }

  const captureDir = path.resolve(process.cwd(), '..', '..', '.ge-dms-archive');
  const timestamp = Date.now();
  await fs.mkdir(captureDir, { recursive: true });
  const captureBase = path.join(captureDir, `backhaul-${timestamp}`);

  await page.waitForLoadState('domcontentloaded');
  const pageHtml = await page.content();
  const pageText = await page.evaluate(() => document.body?.innerText ?? '');
  await fs.writeFile(`${captureBase}.html`, pageHtml);
  await fs.writeFile(`${captureBase}.txt`, pageText);
  await page.screenshot({ path: `${captureBase}.png`, fullPage: true });
  console.log(`📸 Backhaul list captured: ${captureBase}.{png,html,txt}`);

  const rowData = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#table_list tbody tr'));
    return rows.map((row) => {
      const cells = Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() || '');
      const isoLink = row.querySelector('td:nth-child(2) a') as HTMLAnchorElement | null;
      const link = isoLink || (row.querySelector('a') as HTMLAnchorElement | null);
      return {
        cells,
        href: link?.getAttribute('href') || null,
        onclick: link?.getAttribute('onclick') || null,
        iso: isoLink?.textContent?.trim() || null,
      };
    });
  });

  await fs.writeFile(`${captureBase}-rows.json`, JSON.stringify(rowData, null, 2));
  console.log(`🧾 Backhaul rows captured: ${captureBase}-rows.json`);

  if (rowData.length) {
    const firstRow = rowData[0];
    console.log(`➡️ First backhaul row ISO: ${firstRow.iso ?? 'Unknown'}`);

    const popupPromise = page.waitForEvent('popup', { timeout: 8000 }).catch(() => null);
    const navPromise = page.waitForNavigation({ timeout: 8000 }).catch(() => null);

    try {
      await page.click('#table_list tbody tr td:nth-child(2) a');
    } catch {
      // ignore click failure
    }

    const popup = await popupPromise;
    if (popup) {
      await popup.waitForLoadState('domcontentloaded');
      const detailBase = path.join(captureDir, `backhaul-detail-${timestamp}`);
      const detailHtml = await popup.content();
      const detailText = await popup.evaluate(() => document.body?.innerText ?? '');
      await fs.writeFile(`${detailBase}.html`, detailHtml);
      await fs.writeFile(`${detailBase}.txt`, detailText);
      await popup.screenshot({ path: `${detailBase}.png`, fullPage: true });
      console.log(`📸 Backhaul detail captured (popup): ${detailBase}.{png,html,txt}`);
    } else {
      await navPromise;
      const detailBase = path.join(captureDir, `backhaul-detail-${timestamp}`);
      const detailHtml = await page.content();
      const detailText = await page.evaluate(() => document.body?.innerText ?? '');
      await fs.writeFile(`${detailBase}.html`, detailHtml);
      await fs.writeFile(`${detailBase}.txt`, detailText);
      await page.screenshot({ path: `${detailBase}.png`, fullPage: true });
      console.log(`📸 Backhaul detail captured: ${detailBase}.{png,html,txt}`);
    }
  } else {
    console.log('⚠️ No backhaul rows found on page.');
  }

  const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
  await page.click('input[value*="Spreadsheet"], input[value*="SpreadSheet"], input[value*="Excel"], input[value*="Download"], button:has-text("Export"), button:has-text("Download")');
  const download = await downloadPromise;
  const suggested = download.suggestedFilename();
  const downloadPath = path.join(outputDir, suggested);
  await download.saveAs(downloadPath);
  console.log(`✅ Backhaul export downloaded: ${downloadPath}`);

  await browser.close();
  console.log('✅ Browser closed after capture.');
};

process.on('SIGINT', async () => {
  if (browser) await browser.close();
  process.exit(0);
});

run().catch(async (error) => {
  console.error('❌ Backhaul export failed:', error instanceof Error ? error.message : error);
  if (browser) await browser.close();
  process.exit(1);
});
