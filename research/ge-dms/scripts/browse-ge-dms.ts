import { chromium, Page } from 'playwright';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const SSO_USERNAME = process.env.VITE_SSO_USERNAME!;
const SSO_PASSWORD = process.env.VITE_SSO_PASSWORD!;
const DMS_URL = 'https://dms-erp-aws-prd.geappliances.com';

const OUTPUT_DIR = './browse-session';

async function login(page: Page) {
  console.log('🔐 Navigating to DMS application...');
  await page.goto(DMS_URL, { waitUntil: 'networkidle' });

  if (page.url().includes('sso.geappliances.com')) {
    console.log('🔑 Detected SSO login page - attempting to fill credentials...');
    await page.waitForTimeout(2000);

    const usernameField = await page.$('input[type="text"], input[type="email"], input[name*="user"]');
    const passwordField = await page.$('input[type="password"]');
    const submitButton = await page.$('button[type="submit"], input[type="submit"]');

    if (usernameField && passwordField && submitButton) {
      await usernameField.fill(SSO_USERNAME);
      await passwordField.fill(SSO_PASSWORD);
      await submitButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }
  }

  console.log(`✅ Ready at: ${page.url()}\n`);
}

async function capturePageState(page: Page, label: string) {
  const timestamp = Date.now();
  const safeLabel = label.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const filename = `${timestamp}-${safeLabel}`;

  // Save screenshot
  const screenshotPath = path.join(OUTPUT_DIR, `${filename}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  // Save HTML
  const html = await page.content();
  const htmlPath = path.join(OUTPUT_DIR, `${filename}.html`);
  fs.writeFileSync(htmlPath, html);

  // Save page info
  const info = {
    timestamp: new Date().toISOString(),
    url: page.url(),
    title: await page.title(),
    label,
    screenshot: screenshotPath,
    html: htmlPath
  };

  const infoPath = path.join(OUTPUT_DIR, `${filename}.json`);
  fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));

  console.log(`📸 Captured: ${label}`);
  console.log(`   URL: ${page.url()}`);
  console.log(`   Files: ${filename}.*\n`);
}

async function browseSession() {
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('🎭 Starting browse session...\n');
  console.log('📁 Saving captures to:', OUTPUT_DIR, '\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  let navigationCount = 0;

  // Monitor all new pages/tabs
  context.on('page', async (newPage) => {
    console.log(`🆕 New tab/page detected: ${newPage.url()}`);

    newPage.on('load', async () => {
      await newPage.waitForTimeout(2000); // Wait for page to settle
      navigationCount++;
      await capturePageState(newPage, `page-${navigationCount}`);
    });
  });

  // Auto-capture on navigation in main page
  page.on('framenavigated', async (frame) => {
    if (frame === page.mainFrame()) {
      navigationCount++;
      await page.waitForTimeout(2000); // Wait for page to settle
      await capturePageState(page, `nav-${navigationCount}`);
    }
  });

  // Capture network requests
  page.on('request', request => {
    const url = request.url();
    console.log(`🌐 ${request.method()} ${url}`);
  });

  page.on('response', async response => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    if (contentType.includes('csv') || contentType.includes('spreadsheet') || contentType.includes('excel')) {
      console.log(`📥 Download detected: ${url}`);
    }
  });

  try {
    await login(page);
    await capturePageState(page, 'initial');

    console.log('✅ Browser ready!');
    console.log('📋 Browse the site normally - I will auto-capture each page you visit');
    console.log('⏸️  Press Ctrl+C when done\n');

    // Keep running
    await new Promise(() => {});
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  console.log('\n\n✅ Session complete. Check the browse-session folder for captures.');
  process.exit(0);
});

browseSession();
