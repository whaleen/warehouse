#!/usr/bin/env tsx
import 'dotenv/config';
import { chromium, Browser, Page } from 'playwright';
import { getLocationConfig } from '../db/supabase.js';

const GE_DMS_BASE = 'https://dms-erp-aws-prd.geappliances.com';

let browser: Browser | null = null;
let page: Page | null = null;

async function main() {
  const locationId = '00000000-0000-0000-0000-000000000001'; // Sacramento
  const config = await getLocationConfig(locationId);

  if (!config.ssoUsername || !config.ssoPassword) {
    throw new Error('SSO credentials not configured');
  }

  console.log('🚀 Navigating to: ERP On Hand Qty\n');
  console.log('🔐 Authenticating...\n');

  browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    viewport: { width: 1400, height: 900 },
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

  // Navigate to dashboard
  console.log('📍 Navigating to dashboard...\n');
  await page.goto(`${GE_DMS_BASE}/dms/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Try to find and click "ERP On Hand Qty" link
  console.log('🔍 Looking for "ERP On Hand Qty" link...\n');

  try {
    // Try different possible selectors
    const selectors = [
      'a:has-text("ERP On Hand Qty")',
      'input[value*="ERP On Hand"]',
      'button:has-text("ERP On Hand Qty")',
      'a[href*="erp"]',
      ':text("ERP On Hand Qty")',
    ];

    let clicked = false;
    for (const selector of selectors) {
      try {
        await page.click(selector, { timeout: 2000 });
        console.log(`✅ Clicked with selector: ${selector}\n`);
        clicked = true;
        await page.waitForTimeout(3000);
        break;
      } catch {
        // Try next selector
      }
    }

    if (!clicked) {
      console.log('⚠️  Could not find "ERP On Hand Qty" link\n');
      console.log('📸 Taking screenshot of dashboard...\n');
    }

    // Now navigate to ASIS
    console.log('📍 Navigating to ASIS sub-inventory...\n');

    const asisSelectors = [
      'a:has-text("ASIS")',
      'button:has-text("ASIS")',
      ':text("ASIS")',
      'a[href*="ASIS"]',
    ];

    let asisClicked = false;
    for (const selector of asisSelectors) {
      try {
        await page.click(selector, { timeout: 2000 });
        console.log(`✅ Clicked ASIS with selector: ${selector}\n`);
        asisClicked = true;
        await page.waitForTimeout(3000);
        break;
      } catch {
        // Try next selector
      }
    }

    if (!asisClicked) {
      console.log('⚠️  Could not find ASIS link\n');
    }

    const url = page.url();
    const title = await page.title();

    console.log('📍 Current Page:');
    console.log(`   URL: ${url}`);
    console.log(`   Title: ${title}\n`);

    const screenshot = `/tmp/ge-asis-${Date.now()}.png`;
    await page.screenshot({ path: screenshot, fullPage: true });
    console.log(`📸 Screenshot: ${screenshot}\n`);

    console.log('🎉 Browser staying open. Press Ctrl+C to exit.\n');

    // Keep browser open
    await new Promise(() => {});
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

process.on('SIGINT', async () => {
  console.log('\n👋 Closing browser...');
  if (browser) await browser.close();
  process.exit(0);
});

main();
