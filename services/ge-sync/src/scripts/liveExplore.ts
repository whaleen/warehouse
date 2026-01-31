#!/usr/bin/env tsx
/**
 * Live GE DMS Explorer
 * Opens an authenticated browser session and keeps it open for manual exploration
 */

import 'dotenv/config';
import { chromium, Browser, Page } from 'playwright';
import { getLocationConfig } from '../db/supabase.js';

const GE_DMS_BASE = 'https://dms-erp-aws-prd.geappliances.com';
const GE_ASIS_URL = `${GE_DMS_BASE}/dms/newasis`;

let browser: Browser | null = null;
let page: Page | null = null;

async function authenticate(locationId: string) {
  const config = await getLocationConfig(locationId);

  if (!config.ssoUsername || !config.ssoPassword) {
    throw new Error('SSO credentials not configured');
  }

  console.log('\n🚀 Starting Live GE DMS Explorer\n');
  console.log(`📍 Location: ${config.name}`);
  console.log('🔐 Authenticating...\n');

  browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1400,900',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    viewport: { width: 1400, height: 900 },
  });

  page = await context.newPage();

  // Navigate to GE DMS
  await page.goto(GE_ASIS_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait a bit for redirect
  await page.waitForTimeout(2000);

  // Check if we're at login page
  const currentUrl = page.url();
  if (currentUrl.includes('sso.geappliances.com')) {
    console.log('🔑 SSO login detected, filling credentials...');

    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.fill('input[name="username"]', config.ssoUsername);
    await page.fill('input[name="password"]', config.ssoPassword);

    console.log('📤 Submitting login...');
    await page.click('button[type="submit"]');

    // Wait for navigation to DMS
    await page.waitForURL('**/dms/**', { timeout: 30000 });
  }

  // Now reload to get fresh content
  console.log('🔄 Reloading page for fresh content...');
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });

  const finalUrl = page.url();
  const title = await page.title();

  console.log('\n✅ Authentication successful!\n');
  console.log('📍 Current Page:');
  console.log(`   URL: ${finalUrl}`);
  console.log(`   Title: ${title}\n`);

  // Take initial screenshot
  const screenshotPath = `/tmp/ge-live-initial-${Date.now()}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`📸 Screenshot saved: ${screenshotPath}\n`);

  console.log('🎉 Browser is ready for exploration!');
  console.log('   Navigate manually or press Ctrl+C to exit.\n');

  return page;
}

async function keepAlive() {
  // Keep the process running
  await new Promise(() => {});
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n👋 Closing browser...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

// Main execution
const locationId = process.argv[2] || process.env.DEFAULT_LOCATION_ID;

if (!locationId) {
  console.error('❌ Usage: tsx liveExplore.ts <location-id>');
  console.error('   or set DEFAULT_LOCATION_ID environment variable');
  process.exit(1);
}

authenticate(locationId)
  .then(() => keepAlive())
  .catch(error => {
    console.error('❌ Error:', error);
    if (browser) {
      browser.close();
    }
    process.exit(1);
  });
