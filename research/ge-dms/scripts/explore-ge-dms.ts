import { chromium, Page } from 'playwright';
import * as dotenv from 'dotenv';

dotenv.config();

const SSO_USERNAME = process.env.VITE_SSO_USERNAME!;
const SSO_PASSWORD = process.env.VITE_SSO_PASSWORD!;
const DMS_URL = 'https://dms-erp-aws-prd.geappliances.com';

interface EndpointInfo {
  name: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  postData?: string;
}

const discoveredEndpoints: EndpointInfo[] = [];

async function login(page: Page) {
  console.log('🔐 Navigating to DMS application...');
  await page.goto(DMS_URL, { waitUntil: 'networkidle' });

  console.log(`📍 Current URL after navigation: ${page.url()}`);

  // If we're on SSO page, try to login
  if (page.url().includes('sso.geappliances.com')) {
    console.log('🔑 Detected SSO login page - attempting to fill credentials...');

    await page.screenshot({ path: 'sso-page.png', fullPage: true });
    console.log('📸 Screenshot saved to sso-page.png');

    await page.waitForTimeout(2000);

    // Look for username field (trying various selectors)
    try {
      await page.waitForSelector('input[type="text"], input[type="email"], input[name*="user"], input[name*="email"]', { timeout: 5000 });
      const usernameField = await page.$('input[type="text"], input[type="email"], input[name*="user"], input[name*="email"]');
      if (usernameField) {
        await usernameField.fill(SSO_USERNAME);
        console.log('✅ Filled username');
      }
    } catch (e) {
      console.log('❌ Could not find username field');
    }

    try {
      const passwordField = await page.$('input[type="password"]');
      if (passwordField) {
        await passwordField.fill(SSO_PASSWORD);
        console.log('✅ Filled password');
      }
    } catch (e) {
      console.log('❌ Could not find password field');
    }

    try {
      const submitButton = await page.$('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Sign in")');
      if (submitButton) {
        await submitButton.click();
        console.log('🚀 Clicked submit button');
        await page.waitForLoadState('networkidle');
      }
    } catch (e) {
      console.log('❌ Could not find/click submit button');
    }
  }

  console.log(`📍 Final URL: ${page.url()}`);
  await page.screenshot({ path: 'after-login.png', fullPage: true });
  console.log('📸 Screenshot saved to after-login.png');

  console.log('\n⏸️  Browser left open for manual navigation and exploration');
  console.log('   I will watch for CSV downloads as you explore\n');
}

async function captureNetworkRequests(page: Page) {
  // Capture all CSV downloads and relevant API calls
  page.on('request', request => {
    const url = request.url();
    if (url.includes('csv') || url.includes('download') || url.includes('spreadsheet')) {
      const endpoint: EndpointInfo = {
        name: 'CSV Download',
        url: url,
        method: request.method(),
        headers: request.headers(),
        postData: request.postData() || undefined
      };

      discoveredEndpoints.push(endpoint);

      console.log('🌐 CSV Request captured:');
      console.log(`   Method: ${request.method()}`);
      console.log(`   URL: ${url}`);
      if (request.postData()) {
        console.log(`   POST data: ${request.postData()}`);
      }
      console.log('');
    }
  });
}

async function exploreApp() {
  console.log('🎭 Starting Playwright exploration...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500 // Slow down actions so you can see what's happening
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  // Set up network request capture
  captureNetworkRequests(page);

  try {
    // Login
    await login(page);

    console.log('🔍 Browser is ready for exploration!');
    console.log('📋 Instructions:');
    console.log('   - Navigate to pages that have CSV exports');
    console.log('   - Click download/export buttons');
    console.log('   - I will capture all the network requests');
    console.log('   - Press Ctrl+C when done to see summary\n');
    console.log('⏸️  Keeping browser open for exploration...\n');

    // Keep the script running so you can explore
    await page.waitForTimeout(300000); // Wait 5 minutes or until you Ctrl+C

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n📊 Summary of discovered endpoints:');
    discoveredEndpoints.forEach((ep, idx) => {
      console.log(`\n${idx + 1}. ${ep.name}`);
      console.log(`   URL: ${ep.url}`);
      console.log(`   Method: ${ep.method}`);
      if (ep.postData) {
        console.log(`   POST data: ${ep.postData}`);
      }
    });

    await browser.close();
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  console.log('\n\n📊 Summary of discovered endpoints:');
  discoveredEndpoints.forEach((ep, idx) => {
    console.log(`\n${idx + 1}. ${ep.name}`);
    console.log(`   URL: ${ep.url}`);
    console.log(`   Method: ${ep.method}`);
    if (ep.postData) {
      console.log(`   POST data: ${ep.postData}`);
    }
  });
  process.exit(0);
});

exploreApp();
