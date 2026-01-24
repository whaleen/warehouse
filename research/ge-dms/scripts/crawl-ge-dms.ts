import { chromium, Page } from 'playwright';
import * as dotenv from 'dotenv';

dotenv.config();

const SSO_USERNAME = process.env.VITE_SSO_USERNAME!;
const SSO_PASSWORD = process.env.VITE_SSO_PASSWORD!;
const DMS_URL = 'https://dms-erp-aws-prd.geappliances.com';

interface ExportOption {
  page: string;
  pageUrl: string;
  elementType: 'button' | 'link' | 'form';
  text: string;
  href?: string;
  onclick?: string;
  selector?: string;
}

const exportOptions: ExportOption[] = [];
const visitedUrls = new Set<string>();

async function login(page: Page) {
  console.log('🔐 Logging into DMS...');
  await page.goto(DMS_URL, { waitUntil: 'networkidle', timeout: 60000 });

  if (page.url().includes('sso.geappliances.com')) {
    console.log('🔑 Filling SSO credentials...');
    await page.waitForTimeout(2000);

    try {
      const usernameField = await page.$('input[type="text"], input[type="email"], input[name*="user"]');
      const passwordField = await page.$('input[type="password"]');
      const submitButton = await page.$('button[type="submit"], input[type="submit"]');

      if (usernameField && passwordField && submitButton) {
        await usernameField.fill(SSO_USERNAME);
        await passwordField.fill(SSO_PASSWORD);

        // Click and wait for navigation away from SSO
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
          submitButton.click()
        ]);

        // Wait for final redirect to DMS
        await page.waitForTimeout(3000);

        if (page.url().includes('dms-erp-aws-prd.geappliances.com')) {
          console.log('✅ Login successful!');
        } else {
          console.log('⚠️  Still on:', page.url());
        }
      }
    } catch (e) {
      console.log('⚠️  Auto-login failed:', e);
    }
  }

  console.log(`📍 Current URL: ${page.url()}\n`);
}

async function findExportElements(page: Page, pageName: string, pageUrl: string) {
  console.log(`🔍 Scanning page: ${pageName}`);

  // Find all buttons, links, and elements that might be export-related
  const keywords = ['download', 'export', 'csv', 'spreadsheet', 'report', 'excel', 'xls', 'xlsx', 'xml', 'json', 'data'];

  // Check buttons
  const buttons = await page.$$('button, input[type="button"], input[type="submit"]');
  for (const button of buttons) {
    try {
      const text = await button.innerText();
      const onclick = await button.getAttribute('onclick');

      if (text && keywords.some(kw => text.toLowerCase().includes(kw))) {
        exportOptions.push({
          page: pageName,
          pageUrl: pageUrl,
          elementType: 'button',
          text: text.trim(),
          onclick: onclick || undefined
        });
        console.log(`   📥 Found button: "${text.trim()}"`);
      }
    } catch (e) {
      // Element might be stale, skip
    }
  }

  // Check links
  const links = await page.$$('a');
  for (const link of links) {
    try {
      const text = await link.innerText();
      const href = await link.getAttribute('href');

      if (text && href && keywords.some(kw => text.toLowerCase().includes(kw) || href.toLowerCase().includes(kw))) {
        exportOptions.push({
          page: pageName,
          pageUrl: pageUrl,
          elementType: 'link',
          text: text.trim(),
          href: href
        });
        console.log(`   🔗 Found link: "${text.trim()}" -> ${href}`);
      }
    } catch (e) {
      // Element might be stale, skip
    }
  }

  // Check for forms with CSV/download in action
  const forms = await page.$$('form');
  for (const form of forms) {
    try {
      const action = await form.getAttribute('action');
      if (action && keywords.some(kw => action.toLowerCase().includes(kw))) {
        exportOptions.push({
          page: pageName,
          pageUrl: pageUrl,
          elementType: 'form',
          text: `Form: ${action}`,
          href: action
        });
        console.log(`   📋 Found form: ${action}`);
      }
    } catch (e) {
      // Element might be stale, skip
    }
  }
}

async function getNavigationLinks(page: Page): Promise<Array<{text: string, url: string}>> {
  const navLinks: Array<{text: string, url: string}> = [];

  // Find navigation elements - try common patterns
  const selectors = [
    'nav a',
    'header a',
    '.menu a',
    '.nav a',
    '.navigation a',
    '[role="navigation"] a',
    '.sidebar a'
  ];

  for (const selector of selectors) {
    try {
      const links = await page.$$(selector);
      for (const link of links) {
        try {
          const text = await link.innerText();
          const href = await link.getAttribute('href');

          if (text && href && !href.startsWith('#')) {
            const fullUrl = href.startsWith('http') ? href : `${DMS_URL}${href}`;
            if (!visitedUrls.has(fullUrl)) {
              navLinks.push({ text: text.trim(), url: fullUrl });
            }
          }
        } catch (e) {
          // Skip stale elements
        }
      }
    } catch (e) {
      // Selector didn't match, continue
    }
  }

  return navLinks;
}

async function crawlSite() {
  console.log('🕷️  Starting DMS crawler...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  // Capture network requests for file downloads
  page.on('request', request => {
    const url = request.url();
    const exportFormats = ['csv', 'xls', 'xlsx', 'xml', 'json', 'download', 'spreadsheet', 'export'];
    if (exportFormats.some(format => url.toLowerCase().includes(format))) {
      console.log(`   🌐 Network request: ${request.method()} ${url}`);
    }
  });

  try {
    await login(page);

    // Start crawling from main page
    await page.goto(`${DMS_URL}/dms/`, { waitUntil: 'networkidle' });
    visitedUrls.add(`${DMS_URL}/dms/`);

    // Scan main page
    await findExportElements(page, 'Main Dashboard', page.url());

    // Get all the export-related links we just found and visit them
    const linksToVisit = exportOptions
      .filter(opt => opt.elementType === 'link' && opt.href && !opt.href.startsWith('javascript:'))
      .map(opt => ({
        text: opt.text,
        url: opt.href!.startsWith('http') ? opt.href! : `${DMS_URL}${opt.href}`
      }));

    console.log(`\n📋 Found ${linksToVisit.length} links to explore\n`);

    // Visit each page
    for (const link of linksToVisit) {
      if (visitedUrls.has(link.url)) continue;

      try {
        console.log(`\n🔄 Navigating to: ${link.text} (${link.url})`);
        await page.goto(link.url, { waitUntil: 'networkidle', timeout: 30000 });
        visitedUrls.add(link.url);

        await page.waitForTimeout(1500);
        await findExportElements(page, link.text, link.url);
      } catch (e) {
        console.log(`   ⚠️  Could not load page`);
      }
    }

    // Also specifically check ASIS pages since we know they have exports
    console.log(`\n🔄 Checking ASIS section specifically...`);
    try {
      await page.goto(`${DMS_URL}/dms/newasis`, { waitUntil: 'networkidle', timeout: 30000 });
      await findExportElements(page, 'ASIS Main', page.url());

      // Check Report History
      console.log(`\n🔄 Checking ASIS Report History...`);
      await page.goto(`${DMS_URL}/dms/newasis/getreporthistory`, { waitUntil: 'networkidle', timeout: 30000 });
      await findExportElements(page, 'ASIS Report History', page.url());
    } catch (e) {
      console.log(`   ⚠️  Could not load ASIS page`);
    }

    // Try clicking some of the javascript export links to see what network requests they make
    console.log(`\n\n🖱️  Attempting to trigger javascript export functions...`);

    // Try the Reporting page EXPORT TO SPREADSHEET button
    try {
      console.log(`\n🔄 Trying Reporting > EXPORT TO SPREADSHEET...`);
      await page.goto(`${DMS_URL}/dms/reportsummary`, { waitUntil: 'networkidle', timeout: 30000 });
      const exportLink = await page.$('a:has-text("EXPORT TO SPREADSHEET")');
      if (exportLink) {
        console.log('   Found export link, clicking...');
        await exportLink.click();
        await page.waitForTimeout(3000); // Wait for any download to trigger
      }
    } catch (e) {
      console.log('   ⚠️  Could not trigger export');
    }

    // Try Inventory Report downloads
    try {
      console.log(`\n🔄 Trying Inventory Report downloads...`);
      await page.goto(`https://prd.digideck.appliancedms.com/inventory/report?invOrg=9SU`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Try clicking the download links
      const downloadLinks = await page.$$('a[href^="javascript:download"]');
      for (let i = 0; i < Math.min(downloadLinks.length, 2); i++) {
        try {
          console.log(`   Clicking download link ${i + 1}...`);
          await downloadLinks[i].click();
          await page.waitForTimeout(2000);
        } catch (e) {
          // Continue
        }
      }
    } catch (e) {
      console.log('   ⚠️  Could not trigger inventory downloads');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n\n📊 ===== SUMMARY OF EXPORT OPTIONS =====\n');

    // Group by page
    const byPage = exportOptions.reduce((acc, opt) => {
      if (!acc[opt.page]) acc[opt.page] = [];
      acc[opt.page].push(opt);
      return acc;
    }, {} as Record<string, ExportOption[]>);

    for (const [pageName, options] of Object.entries(byPage)) {
      console.log(`\n📄 ${pageName}`);
      console.log(`   URL: ${options[0].pageUrl}`);
      options.forEach(opt => {
        console.log(`   - [${opt.elementType}] ${opt.text}`);
        if (opt.href) console.log(`     URL: ${opt.href}`);
        if (opt.onclick) console.log(`     Action: ${opt.onclick}`);
      });
    }

    console.log(`\n\n✅ Found ${exportOptions.length} export options across ${Object.keys(byPage).length} pages`);

    await browser.close();
  }
}

crawlSite();
