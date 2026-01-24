import { chromium, Page } from 'playwright';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const SSO_USERNAME = process.env.VITE_SSO_USERNAME!;
const SSO_PASSWORD = process.env.VITE_SSO_PASSWORD!;
const DMS_URL = 'https://dms-erp-aws-prd.geappliances.com';
const OUTPUT_DIR = './ge-dms-filtered-docs';
const CAPTURES_DIR = './ge-dms-filtered-captures';

interface LinkInfo {
  category: string;
  name: string;
  url: string;
  tooltip: string;
}

interface PageAnalysis {
  index: number;
  category: string;
  name: string;
  url: string;
  actualUrl: string;
  tooltip: string;
  timestamp: string;

  // Captures with different filters
  captures: CaptureInfo[];
}

interface CaptureInfo {
  label: string;
  filtersApplied: Record<string, string>;
  screenshot: string;
  html: string;
  tableData: TableData[];
}

interface TableData {
  headers: string[];
  sampleRows: string[][];
  totalRows: number;
}

async function login(page: Page) {
  console.log('🔐 Logging in...');
  await page.goto(DMS_URL, { waitUntil: 'networkidle' });

  if (page.url().includes('sso.geappliances.com')) {
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

  console.log('✅ Logged in\n');
}

async function extractTableData(page: Page): Promise<TableData[]> {
  const tables: TableData[] = [];

  const tableElements = await page.$$('table');

  for (const table of tableElements) {
    try {
      // Get headers
      const headers: string[] = [];
      const headerCells = await table.$$('thead th, thead td');
      for (const cell of headerCells) {
        const text = await cell.innerText();
        if (text.trim() && !text.includes('Daily Operations')) { // Skip nav tables
          headers.push(text.trim().replace(/\s+/g, ' '));
        }
      }

      if (headers.length === 0) continue;

      // Get data rows (sample first 10)
      const sampleRows: string[][] = [];
      const rows = await table.$$('tbody tr');
      const totalRows = rows.length;

      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i];
        const cells = await row.$$('td');
        const rowData: string[] = [];

        for (const cell of cells) {
          const text = await cell.innerText();
          rowData.push(text.trim().replace(/\s+/g, ' ').substring(0, 100)); // Limit cell text
        }

        if (rowData.length > 0) {
          sampleRows.push(rowData);
        }
      }

      if (headers.length > 0 && totalRows > 0) {
        tables.push({ headers, sampleRows, totalRows });
      }
    } catch (e) {
      // Skip problematic tables
    }
  }

  return tables;
}

async function capturePageState(page: Page, linkInfo: LinkInfo, index: number, captureLabel: string, filtersApplied: Record<string, string>): Promise<CaptureInfo> {
  const safeCategory = linkInfo.category.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const safeName = linkInfo.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const safeLabel = captureLabel.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const filename = `${String(index).padStart(3, '0')}-${safeCategory}-${safeName}-${safeLabel}`;

  // Save screenshot
  const screenshotPath = path.join(CAPTURES_DIR, `${filename}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  // Save HTML
  const html = await page.content();
  const htmlPath = path.join(CAPTURES_DIR, `${filename}.html`);
  fs.writeFileSync(htmlPath, html);

  // Extract table data
  const tableData = await extractTableData(page);

  return {
    label: captureLabel,
    filtersApplied,
    screenshot: screenshotPath,
    html: htmlPath,
    tableData
  };
}

async function tryFiltersAndCapture(page: Page, linkInfo: LinkInfo, index: number): Promise<PageAnalysis> {
  const captures: CaptureInfo[] = [];

  console.log(`   📸 Capturing default state...`);

  // Capture default state
  const defaultCapture = await capturePageState(page, linkInfo, index, 'default', {});
  captures.push(defaultCapture);
  console.log(`      Found ${defaultCapture.tableData.length} tables with data`);

  // Try to find and use filters
  const selects = await page.$$('select');
  const searchButtons = await page.$$('button:has-text("Search"), input[type="button"][value*="Search"], a:has-text("Search")');

  if (selects.length > 0) {
    console.log(`   🔍 Found ${selects.length} filters, trying different options...`);

    // Try first select with second option (usually first is blank)
    for (let i = 0; i < Math.min(2, selects.length); i++) {
      try {
        const select = selects[i];
        const options = await select.$$('option');
        const selectName = await select.getAttribute('name') || `select-${i}`;

        if (options.length > 1) {
          // Try second option
          const optionValue = await options[1].getAttribute('value');
          const optionText = await options[1].innerText();

          if (optionValue) {
            await select.selectOption(optionValue);
            console.log(`      Selected: ${selectName} = ${optionText}`);

            // Click search if available
            if (searchButtons.length > 0) {
              const searchBtn = searchButtons[0];
              const btnText = await searchBtn.innerText();

              // Make sure it's not a dangerous button
              if (!/(submit|save|update|delete|approve)/i.test(btnText)) {
                await searchBtn.click();
                await page.waitForTimeout(2000);

                const filteredCapture = await capturePageState(
                  page,
                  linkInfo,
                  index,
                  `filtered-${selectName}-${optionValue}`,
                  { [selectName]: optionText }
                );
                captures.push(filteredCapture);
                console.log(`      Captured filtered view - ${filteredCapture.tableData.length} tables`);
              }
            }
          }
        }
      } catch (e) {
        console.log(`      ⚠️  Filter error: ${e}`);
      }
    }
  }

  return {
    index,
    category: linkInfo.category,
    name: linkInfo.name,
    url: linkInfo.url,
    actualUrl: page.url(),
    tooltip: linkInfo.tooltip,
    timestamp: new Date().toISOString(),
    captures
  };
}

async function generateDocumentation(analyses: PageAnalysis[]) {
  let markdown = '# GE DMS System Documentation (with Filtered Data)\n\n';
  markdown += `Generated: ${new Date().toISOString()}\n\n`;
  markdown += '## Overview\n\n';
  markdown += `This documentation covers ${analyses.length} pages with actual data displayed using filters.\n\n`;

  const categories = [...new Set(analyses.map(a => a.category))];

  for (const category of categories) {
    markdown += `\n## ${category}\n\n`;

    const categoryPages = analyses.filter(a => a.category === category);

    for (const page of categoryPages) {
      markdown += `### ${page.name}\n\n`;
      markdown += `**URL:** \`${page.url}\`\n\n`;
      markdown += `**Purpose:** ${page.tooltip}\n\n`;

      // Show each captured state
      for (const capture of page.captures) {
        markdown += `#### ${capture.label}\n\n`;

        if (Object.keys(capture.filtersApplied).length > 0) {
          markdown += '**Filters Applied:**\n';
          for (const [key, value] of Object.entries(capture.filtersApplied)) {
            markdown += `- ${key}: ${value}\n`;
          }
          markdown += '\n';
        }

        if (capture.tableData.length > 0) {
          markdown += '**Data Available:**\n\n';

          capture.tableData.forEach((table, idx) => {
            markdown += `**Table ${idx + 1}** (${table.totalRows} total rows):\n\n`;
            markdown += `Columns: ${table.headers.join(' | ')}\n\n`;

            if (table.sampleRows.length > 0) {
              markdown += 'Sample Data:\n';
              table.sampleRows.slice(0, 3).forEach(row => {
                markdown += `- ${row.join(' | ')}\n`;
              });
              markdown += '\n';
            }
          });
        } else {
          markdown += '*No data tables found*\n\n';
        }

        markdown += '---\n\n';
      }
    }
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'GE-DMS-Documentation-Filtered.md'), markdown);
  console.log('📝 Documentation generated: GE-DMS-Documentation-Filtered.md');

  // Also generate JSON for programmatic use
  fs.writeFileSync(path.join(OUTPUT_DIR, 'ge-dms-data-analysis.json'), JSON.stringify(analyses, null, 2));
  console.log('📝 JSON data saved: ge-dms-data-analysis.json');
}

async function crawlWithFilters() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  if (!fs.existsSync(CAPTURES_DIR)) {
    fs.mkdirSync(CAPTURES_DIR, { recursive: true });
  }

  const pages: LinkInfo[] = JSON.parse(fs.readFileSync('./ge-dms-pages.json', 'utf-8'));

  console.log('🕷️  Starting comprehensive crawl WITH FILTERS...\n');
  console.log(`📋 Total pages to analyze: ${pages.length}\n`);
  console.log('⚠️  READ ONLY MODE - No data modifications\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 300
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();
  const analyses: PageAnalysis[] = [];

  try {
    await login(page);

    for (let i = 0; i < pages.length; i++) {
      const linkInfo = pages[i];

      console.log(`\n[${i + 1}/${pages.length}] 📄 ${linkInfo.category} > ${linkInfo.name}`);

      let fullUrl = linkInfo.url;
      if (!fullUrl.startsWith('http')) {
        fullUrl = `https://dms-erp-aws-prd.geappliances.com${fullUrl}`;
      }

      try {
        await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);

        const analysis = await tryFiltersAndCapture(page, linkInfo, i + 1);
        analyses.push(analysis);

        console.log(`   ✅ Captured ${analysis.captures.length} states`);

      } catch (error) {
        console.log(`   ⚠️  Error: ${error}`);
      }
    }

    console.log('\n\n📊 Generating documentation...');
    await generateDocumentation(analyses);

    console.log('\n✅ Filtered crawl complete!');
    console.log(`📁 Captures: ${CAPTURES_DIR}`);
    console.log(`📝 Documentation: ${OUTPUT_DIR}/GE-DMS-Documentation-Filtered.md`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

crawlWithFilters();
