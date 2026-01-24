import { chromium, Page, Request } from 'playwright';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const SSO_USERNAME = process.env.VITE_SSO_USERNAME!;
const SSO_PASSWORD = process.env.VITE_SSO_PASSWORD!;
const DMS_URL = 'https://dms-erp-aws-prd.geappliances.com';
const ORG = '9SU';

interface ExportEndpoint {
  pageName: string;
  pageUrl: string;
  method: string;
  url: string;
  postData?: string;
  headers: Record<string, string>;
  triggerDescription: string;
}

const discoveredEndpoints: ExportEndpoint[] = [];
const visitedUrls = new Set<string>();

async function login(page: Page) {
  console.log('🔐 Logging into DMS...');
  await page.goto(DMS_URL, { waitUntil: 'networkidle', timeout: 60000 });

  if (page.url().includes('sso.geappliances.com')) {
    console.log('🔑 Filling SSO credentials...');
    await page.waitForTimeout(2000);

    const usernameField = await page.$('input[type="text"], input[type="email"], input[name*="user"]');
    const passwordField = await page.$('input[type="password"]');
    const submitButton = await page.$('button[type="submit"], input[type="submit"]');

    if (usernameField && passwordField && submitButton) {
      await usernameField.fill(SSO_USERNAME);
      await passwordField.fill(SSO_PASSWORD);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
        submitButton.click()
      ]);
      await page.waitForTimeout(3000);
      console.log('✅ Login successful!\n');
    }
  }
}

function setupNetworkListener(page: Page, pageName: string, pageUrl: string) {
  const listener = (request: Request) => {
    const url = request.url();
    const method = request.method();

    // Capture download/export requests
    const exportKeywords = ['download', 'csv', 'xls', 'xlsx', 'export', 'spreadsheet', 'xml', 'report'];
    if (exportKeywords.some(kw => url.toLowerCase().includes(kw)) || method === 'POST') {
      const endpoint: ExportEndpoint = {
        pageName: pageName,
        pageUrl: pageUrl,
        method: method,
        url: url,
        postData: request.postData() || undefined,
        headers: request.headers(),
        triggerDescription: 'Network request captured'
      };

      // Check if we already have this endpoint
      const exists = discoveredEndpoints.some(e =>
        e.url === url && e.method === method && e.postData === request.postData()
      );

      if (!exists) {
        discoveredEndpoints.push(endpoint);
        console.log(`   🌐 ${method} ${url}`);
        if (request.postData()) {
          console.log(`      POST: ${request.postData()}`);
        }
      }
    }
  };

  page.on('request', listener);
  return () => page.off('request', listener);
}

async function clickAllTabs(page: Page, pageName: string) {
  console.log(`   🔖 Looking for tabs...`);

  // Common tab selectors
  const tabSelectors = [
    'ul.nav-tabs li a',
    '.tabs a',
    '[role="tab"]',
    'a[data-toggle="tab"]',
    '.tab-link',
    'button[role="tab"]'
  ];

  for (const selector of tabSelectors) {
    try {
      const tabs = await page.$$(selector);
      if (tabs.length > 0) {
        console.log(`   Found ${tabs.length} tabs`);

        for (let i = 0; i < tabs.length; i++) {
          try {
            const tab = tabs[i];
            const tabText = await tab.innerText();
            console.log(`      Clicking tab: ${tabText}`);
            await tab.click();
            await page.waitForTimeout(1500);

            // Scan for exports on this tab
            await scanForExports(page, `${pageName} - ${tabText}`, page.url());
          } catch (e) {
            // Tab might be stale, continue
          }
        }
        break; // Found tabs, no need to try other selectors
      }
    } catch (e) {
      // Selector didn't match, try next
    }
  }
}

async function fillCommonFilters(page: Page) {
  console.log(`   📝 Filling common filter fields...`);

  // Try to fill in org field
  try {
    const orgInputs = await page.$$('input[name*="org"], input[id*="org"], select[name*="org"]');
    for (const input of orgInputs) {
      try {
        const tagName = await input.evaluate(el => el.tagName.toLowerCase());
        if (tagName === 'select') {
          // Try to select option with 9SU
          await input.selectOption({ label: ORG }).catch(() => {});
        } else {
          await input.fill(ORG);
        }
        console.log(`      Filled org field with ${ORG}`);
      } catch (e) {}
    }
  } catch (e) {}

  // Fill date fields with recent dates (don't submit, just fill)
  try {
    const dateInputs = await page.$$('input[type="date"], input[name*="date"], input[id*="date"]');
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < dateInputs.length; i++) {
      try {
        const input = dateInputs[i];
        const name = await input.getAttribute('name') || '';

        // Start date
        if (name.toLowerCase().includes('start') || name.toLowerCase().includes('from') || i === 0) {
          await input.fill(thirtyDaysAgo.toISOString().split('T')[0]);
        }
        // End date
        else if (name.toLowerCase().includes('end') || name.toLowerCase().includes('to') || i === 1) {
          await input.fill(today.toISOString().split('T')[0]);
        }
      } catch (e) {}
    }
  } catch (e) {}
}

async function scanForExports(page: Page, pageName: string, pageUrl: string) {
  // Look for export/download buttons
  const exportSelectors = [
    'button:has-text("export")',
    'button:has-text("download")',
    'a:has-text("export")',
    'a:has-text("download")',
    'input[value*="export" i]',
    'input[value*="download" i]',
    'button:has-text("CSV")',
    'button:has-text("Excel")',
    'a:has-text("CSV")',
    'a:has-text("Excel")'
  ];

  for (const selector of exportSelectors) {
    try {
      const buttons = await page.$$(selector);
      for (const button of buttons) {
        try {
          const text = await button.innerText();
          const isVisible = await button.isVisible();

          if (isVisible && text) {
            console.log(`      🔘 Found export button: "${text}"`);

            // Click and capture network request
            await button.click();
            await page.waitForTimeout(2000); // Wait for any download to trigger
          }
        } catch (e) {
          // Button might be stale or not clickable
        }
      }
    } catch (e) {
      // Selector didn't match
    }
  }
}

async function deepExplorePage(page: Page, pageName: string, pageUrl: string) {
  if (visitedUrls.has(pageUrl)) {
    return;
  }

  console.log(`\n🔍 Deep exploring: ${pageName}`);
  console.log(`   URL: ${pageUrl}`);

  visitedUrls.add(pageUrl);

  try {
    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const removeListener = setupNetworkListener(page, pageName, pageUrl);

    // Fill common filters (don't submit, just fill)
    await fillCommonFilters(page);

    // Click through all tabs
    await clickAllTabs(page, pageName);

    // Scan for export buttons on main view
    await scanForExports(page, pageName, pageUrl);

    // Look for forms with submit buttons that might load data
    console.log(`   🔎 Looking for search/filter forms...`);
    const forms = await page.$$('form');
    for (let i = 0; i < Math.min(forms.length, 3); i++) {
      try {
        const form = forms[i];

        // Fill in the form
        await fillCommonFilters(page);

        // Look for submit/search buttons in this form
        const submitButtons = await form.$$('button[type="submit"], input[type="submit"], button:has-text("search"), button:has-text("submit"), button:has-text("go")');

        if (submitButtons.length > 0) {
          const button = submitButtons[0];
          const buttonText = await button.innerText().catch(() => 'Submit');
          console.log(`      📤 Submitting form: ${buttonText}`);

          await button.click();
          await page.waitForTimeout(3000);

          // Scan for exports after form submission
          await scanForExports(page, `${pageName} (filtered)`, pageUrl);
        }
      } catch (e) {
        // Form submission failed, continue
      }
    }

    removeListener();

  } catch (e) {
    console.log(`   ⚠️  Error exploring page: ${e}`);
  }
}

async function getAllMainLinks(page: Page): Promise<Array<{text: string, url: string}>> {
  const links: Array<{text: string, url: string}> = [];

  // Get all links from the page
  const allLinks = await page.$$('a');

  for (const link of allLinks) {
    try {
      const href = await link.getAttribute('href');
      const text = await link.innerText();

      if (href && text && !href.startsWith('#') && !href.startsWith('javascript:')) {
        const fullUrl = href.startsWith('http') ? href : `${DMS_URL}${href}`;

        // Only include DMS-related URLs
        if (fullUrl.includes('dms-erp-aws-prd.geappliances.com') || fullUrl.includes('digideck.appliancedms.com')) {
          links.push({ text: text.trim(), url: fullUrl });
        }
      }
    } catch (e) {
      // Skip stale elements
    }
  }

  return links;
}

async function deepCrawl() {
  console.log('🕷️  Starting DEEP crawl of GE DMS...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 50
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    await login(page);

    // Start from main dashboard
    await page.goto(`${DMS_URL}/dms/`, { waitUntil: 'networkidle' });

    // Get all navigation links
    console.log('📋 Discovering all pages in the application...\n');
    const mainLinks = await getAllMainLinks(page);
    console.log(`Found ${mainLinks.length} unique pages to explore\n`);

    // Deep explore main dashboard first
    await deepExplorePage(page, 'Main Dashboard', `${DMS_URL}/dms/`);

    // Deep explore each discovered page
    for (const link of mainLinks) {
      if (!visitedUrls.has(link.url)) {
        await deepExplorePage(page, link.text, link.url);
      }
    }

    // Specifically hit known important pages
    const importantPages = [
      { name: 'ASIS Main', url: `${DMS_URL}/dms/newasis` },
      { name: 'ASIS Report History', url: `${DMS_URL}/dms/newasis/getreporthistory` },
      { name: 'Downloads', url: `${DMS_URL}/dms/downloads` },
      { name: 'Order Download', url: `${DMS_URL}/dms/orderdata` },
      { name: 'Reporting', url: `${DMS_URL}/dms/reportsummary` },
      { name: 'Inventory Report', url: `https://prd.digideck.appliancedms.com/inventory/report?invOrg=${ORG}` }
    ];

    for (const importantPage of importantPages) {
      if (!visitedUrls.has(importantPage.url)) {
        await deepExplorePage(page, importantPage.name, importantPage.url);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Generate report
    console.log('\n\n📊 ===== CRAWL COMPLETE =====\n');
    console.log(`✅ Visited ${visitedUrls.size} unique pages`);
    console.log(`✅ Discovered ${discoveredEndpoints.length} export endpoints\n`);

    // Save detailed report
    const report = {
      summary: {
        pagesVisited: visitedUrls.size,
        endpointsDiscovered: discoveredEndpoints.length,
        crawlDate: new Date().toISOString(),
        organization: ORG
      },
      visitedPages: Array.from(visitedUrls),
      discoveredEndpoints: discoveredEndpoints
    };

    fs.writeFileSync('deep-crawl-report.json', JSON.stringify(report, null, 2));

    // Generate markdown report
    let markdown = '# GE DMS Deep Crawl Report\n\n';
    markdown += `**Organization:** ${ORG}\n`;
    markdown += `**Date:** ${new Date().toISOString()}\n\n`;
    markdown += `## Summary\n\n`;
    markdown += `- Pages Explored: ${visitedUrls.size}\n`;
    markdown += `- Export Endpoints Found: ${discoveredEndpoints.length}\n\n`;
    markdown += `---\n\n`;

    markdown += `## All Visited Pages\n\n`;
    Array.from(visitedUrls).forEach((url, idx) => {
      markdown += `${idx + 1}. ${url}\n`;
    });
    markdown += `\n---\n\n`;

    markdown += `## Discovered Export Endpoints\n\n`;

    // Group by page
    const byPage = discoveredEndpoints.reduce((acc, ep) => {
      if (!acc[ep.pageName]) acc[ep.pageName] = [];
      acc[ep.pageName].push(ep);
      return acc;
    }, {} as Record<string, ExportEndpoint[]>);

    for (const [pageName, endpoints] of Object.entries(byPage)) {
      markdown += `### ${pageName}\n\n`;
      markdown += `**Page URL:** ${endpoints[0].pageUrl}\n\n`;

      endpoints.forEach((ep, idx) => {
        markdown += `#### Endpoint ${idx + 1}\n\n`;
        markdown += '```\n';
        markdown += `Method: ${ep.method}\n`;
        markdown += `URL: ${ep.url}\n`;
        if (ep.postData) {
          markdown += `POST Data: ${ep.postData}\n`;
        }
        markdown += `\nKey Headers:\n`;
        if (ep.headers.referer) markdown += `  Referer: ${ep.headers.referer}\n`;
        if (ep.headers['content-type']) markdown += `  Content-Type: ${ep.headers['content-type']}\n`;
        markdown += '```\n\n';
      });
    }

    fs.writeFileSync('DEEP-CRAWL-REPORT.md', markdown);

    console.log('📄 Reports saved:');
    console.log('   - deep-crawl-report.json');
    console.log('   - DEEP-CRAWL-REPORT.md\n');

    await browser.close();
  }
}

deepCrawl();
