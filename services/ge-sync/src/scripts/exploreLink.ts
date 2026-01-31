#!/usr/bin/env tsx
import 'dotenv/config';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { getLocationConfig } from '../db/supabase.js';
import * as fs from 'fs/promises';

const GE_DMS_BASE = 'https://dms-erp-aws-prd.geappliances.com';

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

async function authenticate() {
  const locationId = '00000000-0000-0000-0000-000000000001'; // Sacramento
  const config = await getLocationConfig(locationId);

  if (!config.ssoUsername || !config.ssoPassword) {
    throw new Error('SSO credentials not configured');
  }

  console.log('🔐 Authenticating...\n');

  browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    viewport: { width: 1400, height: 900 },
  });

  // Handle new tabs
  context.on('page', async (newPage) => {
    console.log(`\n🆕 New tab opened: ${newPage.url()}`);
    page = newPage; // Switch to new tab
  });

  page = await context.newPage();

  // Authenticate
  await page.goto(`${GE_DMS_BASE}/dms/newasis`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  if (page.url().includes('sso.geappliances.com')) {
    await page.waitForSelector('input[name="username"]');
    await page.fill('input[name="username"]', config.ssoUsername);
    await page.fill('input[name="password"]', config.ssoPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dms/**', { timeout: 30000 });
  }

  await page.reload({ waitUntil: 'networkidle' });
  console.log('✅ Authenticated\n');
}

async function documentPage() {
  if (!page) throw new Error('No page available');

  const currentUrl = page.url();
  const title = await page.title();
  const timestamp = Date.now();

  console.log('📍 Current Location:');
  console.log(`   URL: ${currentUrl}`);
  console.log(`   Title: ${title}\n`);

  // Take screenshot
  const screenshot = `/tmp/ge-${timestamp}.png`;
  await page.screenshot({ path: screenshot, fullPage: true });
  console.log(`📸 Screenshot: ${screenshot}\n`);

  // Get page content
  const bodyText = await page.evaluate(() => document.body?.innerText || '');
  const contentFile = `/tmp/ge-content-${timestamp}.txt`;
  await fs.writeFile(contentFile, bodyText);
  console.log(`📄 Page content saved: ${contentFile}\n`);

  // Look for export/download buttons
  const exportButtons = await page.$$eval(
    'input[value*="SpreadSheet"], input[value*="Spreadsheet"], input[value*="Excel"], input[value*="Download"], button:has-text("Export"), button:has-text("Download")',
    els => els.map(el => (el as HTMLInputElement).value || el.textContent?.trim() || '')
  );

  if (exportButtons.length > 0) {
    console.log('📥 Export buttons found:');
    exportButtons.forEach(btn => console.log(`   - ${btn}`));
    console.log('');
  }

  return { url: currentUrl, title, screenshot, contentFile };
}

async function main() {
  const linkText = process.argv[2];

  if (!linkText) {
    console.error('❌ Usage: tsx exploreLink.ts "Link Text"');
    console.error('Example: tsx exploreLink.ts "Cancellations"');
    process.exit(1);
  }

  await authenticate();

  // Go to dashboard
  console.log(`📍 Navigating to dashboard...\n`);
  await page!.goto(`${GE_DMS_BASE}/dms/`, { waitUntil: 'networkidle' });
  await page!.waitForTimeout(2000);

  // Click the specified link
  console.log(`🔗 Looking for link: "${linkText}"...\n`);

  try {
    await page!.click(`a:has-text("${linkText}")`, { timeout: 5000 });
    await page!.waitForTimeout(3000);
    console.log(`✅ Clicked "${linkText}"\n`);
  } catch {
    console.log(`⚠️  Could not find link: "${linkText}"\n`);
    console.log('📄 Current page documented below:\n');
  }

  // Document the resulting page
  await documentPage();

  console.log('🎉 Browser staying open. Press Ctrl+C to exit.\n');

  // Keep browser open
  await new Promise(() => {});
}

process.on('SIGINT', async () => {
  console.log('\n👋 Closing browser...');
  if (browser) await browser.close();
  process.exit(0);
});

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
