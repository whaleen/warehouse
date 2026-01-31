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

async function navigateTo(url: string) {
  if (!page) throw new Error('No page available');

  console.log(`\n📍 Navigating to: ${url}\n`);

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // If there's an "open all" link, click it to expand content
  try {
    const openAllLink = await page.$('a:has-text("open all")');
    if (openAllLink) {
      console.log('🔓 Clicking "open all" to expand content...\n');
      await openAllLink.click();
      await page.waitForTimeout(1000);
    }
  } catch {
    // No "open all" link, continue
  }

  const currentUrl = page.url();
  const title = await page.title();

  console.log('✅ Current Location:');
  console.log(`   URL: ${currentUrl}`);
  console.log(`   Title: ${title}\n`);

  // Take screenshot
  const timestamp = Date.now();
  const screenshot = `/tmp/ge-${timestamp}.png`;
  await page.screenshot({ path: screenshot, fullPage: true });
  console.log(`📸 Screenshot: ${screenshot}\n`);

  // Show page structure
  const headings = await page.$$eval('h1, h2, h3', els =>
    els.map(el => ({ tag: el.tagName, text: el.textContent?.trim() }))
  );

  if (headings.length > 0) {
    console.log('📄 Page headings:');
    headings.slice(0, 5).forEach(h => {
      console.log(`   ${h.tag}: ${h.text}`);
    });
    console.log('');
  }

  // Show available links/buttons
  const links = await page.$$eval('a[href], button, input[type="submit"]', els =>
    els.slice(0, 10).map(el => {
      const text = el.textContent?.trim() || (el as HTMLInputElement).value || '';
      return text;
    }).filter(t => t.length > 0 && t.length < 50)
  );

  if (links.length > 0) {
    console.log('🔗 Available links/buttons (first 10):');
    links.forEach(link => {
      console.log(`   - ${link}`);
    });
    console.log('');
  }

  // Get page text content
  const bodyText = await page.evaluate(() => {
    const body = document.body;
    return body ? body.innerText : '';
  });

  // Save page content to file
  const contentFile = `/tmp/ge-content-${timestamp}.txt`;
  await fs.writeFile(contentFile, bodyText);
  console.log(`📄 Page content saved: ${contentFile}\n`);
}

async function main() {
  const targetUrl = process.argv[2] || `${GE_DMS_BASE}/dms/`;

  await authenticate();
  await navigateTo(targetUrl);

  console.log('🎉 Browser staying open. Press Ctrl+C to exit.\n');
  console.log('All tabs are being tracked. Current active tab shown above.\n');

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
