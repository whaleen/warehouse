import { chromium, Page } from 'playwright';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const SSO_USERNAME = process.env.VITE_SSO_USERNAME!;
const SSO_PASSWORD = process.env.VITE_SSO_PASSWORD!;
const DMS_URL = 'https://dms-erp-aws-prd.geappliances.com';
const OUTPUT_DIR = './ge-dms-docs';
const CAPTURES_DIR = './ge-dms-captures';

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

  // Page structure analysis
  forms: FormInfo[];
  tables: TableInfo[];
  buttons: ButtonInfo[];
  links: LinkInfo[];
  inputs: InputInfo[];
  selects: SelectInfo[];

  // Summary
  purpose: string;
  dataAvailable: string[];
  capabilities: string[];
}

interface FormInfo {
  action: string;
  method: string;
  fields: string[];
}

interface TableInfo {
  headers: string[];
  rowCount: number;
  hasData: boolean;
}

interface ButtonInfo {
  text: string;
  type: string;
  onClick?: string;
}

interface InputInfo {
  name: string;
  type: string;
  label?: string;
}

interface SelectInfo {
  name: string;
  label?: string;
  options: string[];
}

interface LinkInfo {
  text: string;
  href: string;
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

async function analyzePage(page: Page): Promise<Partial<PageAnalysis>> {
  const analysis: Partial<PageAnalysis> = {
    forms: [],
    tables: [],
    buttons: [],
    links: [],
    inputs: [],
    selects: [],
    dataAvailable: [],
    capabilities: []
  };

  // Analyze forms
  const forms = await page.$$('form');
  for (const form of forms) {
    const action = await form.getAttribute('action') || '';
    const method = await form.getAttribute('method') || '';
    const fields: string[] = [];

    const inputs = await form.$$('input, select, textarea');
    for (const input of inputs) {
      const name = await input.getAttribute('name') || '';
      const type = await input.getAttribute('type') || '';
      if (name) fields.push(`${name} (${type})`);
    }

    analysis.forms!.push({ action, method, fields });
  }

  // Analyze tables
  const tables = await page.$$('table');
  for (const table of tables) {
    const headers: string[] = [];
    const headerCells = await table.$$('thead th, thead td');
    for (const cell of headerCells) {
      const text = await cell.innerText();
      if (text.trim()) headers.push(text.trim());
    }

    const rows = await table.$$('tbody tr');
    const rowCount = rows.length;
    const hasData = rowCount > 0;

    if (headers.length > 0) {
      analysis.tables!.push({ headers, rowCount, hasData });
    }
  }

  // Analyze buttons (skip submit/save/update/delete types)
  const buttons = await page.$$('button, input[type="button"], a.button');
  for (const button of buttons) {
    try {
      const text = await button.innerText();
      const type = await button.getAttribute('type') || 'button';
      const onClick = await button.getAttribute('onclick') || undefined;

      // Skip dangerous buttons
      if (text && !/(submit|save|update|delete|remove|cancel|approve)/i.test(text)) {
        analysis.buttons!.push({ text: text.trim(), type, onClick });
      }
    } catch (e) {
      // Skip stale elements
    }
  }

  // Analyze input fields
  const inputs = await page.$$('input[type="text"], input[type="date"], input[type="number"], textarea');
  for (const input of inputs) {
    try {
      const name = await input.getAttribute('name') || '';
      const type = await input.getAttribute('type') || 'text';
      const id = await input.getAttribute('id') || '';

      // Try to find label
      let label = '';
      if (id) {
        const labelEl = await page.$(`label[for="${id}"]`);
        if (labelEl) {
          label = await labelEl.innerText();
        }
      }

      if (name) {
        analysis.inputs!.push({ name, type, label: label.trim() || undefined });
      }
    } catch (e) {
      // Skip
    }
  }

  // Analyze select dropdowns
  const selects = await page.$$('select');
  for (const select of selects) {
    try {
      const name = await select.getAttribute('name') || '';
      const id = await select.getAttribute('id') || '';

      let label = '';
      if (id) {
        const labelEl = await page.$(`label[for="${id}"]`);
        if (labelEl) {
          label = await labelEl.innerText();
        }
      }

      const options: string[] = [];
      const optionEls = await select.$$('option');
      for (const opt of optionEls) {
        const text = await opt.innerText();
        if (text.trim()) options.push(text.trim());
      }

      if (name) {
        analysis.selects!.push({ name, label: label.trim() || undefined, options });
      }
    } catch (e) {
      // Skip
    }
  }

  // Analyze links (non-navigation)
  const links = await page.$$('a');
  const linkTexts = new Set<string>();
  for (const link of links) {
    try {
      const text = await link.innerText();
      const href = await link.getAttribute('href') || '';

      // Skip navigation and empty links
      if (text && !text.includes('Home') && !href.startsWith('#') && href && !linkTexts.has(text)) {
        linkTexts.add(text);
        if (analysis.links!.length < 20) { // Limit to first 20
          analysis.links!.push({ text: text.trim(), href });
        }
      }
    } catch (e) {
      // Skip
    }
  }

  return analysis;
}

async function generatePurpose(linkInfo: LinkInfo, analysis: Partial<PageAnalysis>): Promise<string> {
  let purpose = linkInfo.tooltip || linkInfo.name;

  // Enhance based on analysis
  if (analysis.tables && analysis.tables.length > 0) {
    purpose += ' Shows data in table format.';
  }

  if (analysis.forms && analysis.forms.length > 0) {
    purpose += ' Has forms for data entry/filtering.';
  }

  return purpose;
}

async function capturePage(page: Page, linkInfo: LinkInfo, index: number): Promise<PageAnalysis | null> {
  try {
    const timestamp = new Date().toISOString();
    const safeCategory = linkInfo.category.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const safeName = linkInfo.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const filename = `${String(index).padStart(3, '0')}-${safeCategory}-${safeName}`;

    // Save screenshot
    const screenshotPath = path.join(CAPTURES_DIR, `${filename}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Save HTML
    const html = await page.content();
    const htmlPath = path.join(CAPTURES_DIR, `${filename}.html`);
    fs.writeFileSync(htmlPath, html);

    // Analyze the page
    const analysis = await analyzePage(page);
    const purpose = await generatePurpose(linkInfo, analysis);

    const fullAnalysis: PageAnalysis = {
      index,
      category: linkInfo.category,
      name: linkInfo.name,
      url: linkInfo.url,
      actualUrl: page.url(),
      tooltip: linkInfo.tooltip,
      timestamp,
      purpose,
      ...analysis
    } as PageAnalysis;

    // Save analysis
    const analysisPath = path.join(CAPTURES_DIR, `${filename}.json`);
    fs.writeFileSync(analysisPath, JSON.stringify(fullAnalysis, null, 2));

    return fullAnalysis;
  } catch (error) {
    console.error(`Error capturing page: ${error}`);
    return null;
  }
}

async function generateDocumentation(analyses: PageAnalysis[]) {
  let markdown = '# GE DMS System Documentation\n\n';
  markdown += `Generated: ${new Date().toISOString()}\n\n`;
  markdown += '## Overview\n\n';
  markdown += `This documentation covers ${analyses.length} pages across the GE DMS system.\n\n`;

  // Group by category
  const categories = [...new Set(analyses.map(a => a.category))];

  for (const category of categories) {
    markdown += `\n## ${category}\n\n`;

    const categoryPages = analyses.filter(a => a.category === category);

    for (const page of categoryPages) {
      markdown += `### ${page.name}\n\n`;
      markdown += `**URL:** \`${page.url}\`\n\n`;
      markdown += `**Purpose:** ${page.purpose}\n\n`;

      if (page.tables && page.tables.length > 0) {
        markdown += '**Data Tables:**\n\n';
        page.tables.forEach((table, idx) => {
          markdown += `- Table ${idx + 1}: ${table.rowCount} rows\n`;
          if (table.headers.length > 0) {
            markdown += `  - Columns: ${table.headers.join(', ')}\n`;
          }
        });
        markdown += '\n';
      }

      if (page.forms && page.forms.length > 0) {
        markdown += '**Forms:**\n\n';
        page.forms.forEach((form, idx) => {
          markdown += `- Form ${idx + 1}: ${form.method.toUpperCase()} ${form.action}\n`;
          if (form.fields.length > 0) {
            markdown += `  - Fields: ${form.fields.join(', ')}\n`;
          }
        });
        markdown += '\n';
      }

      if (page.selects && page.selects.length > 0) {
        markdown += '**Filter/Search Options:**\n\n';
        page.selects.forEach(select => {
          markdown += `- ${select.label || select.name}: ${select.options.slice(0, 5).join(', ')}${select.options.length > 5 ? '...' : ''}\n`;
        });
        markdown += '\n';
      }

      markdown += '---\n\n';
    }
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'GE-DMS-Documentation.md'), markdown);
  console.log('📝 Documentation generated: GE-DMS-Documentation.md');
}

async function crawlAndDocument() {
  // Create output directories
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  if (!fs.existsSync(CAPTURES_DIR)) {
    fs.mkdirSync(CAPTURES_DIR, { recursive: true });
  }

  // Load the pages list
  const pages: LinkInfo[] = JSON.parse(fs.readFileSync('./ge-dms-pages.json', 'utf-8'));

  console.log('🕷️  Starting comprehensive crawl and documentation...\n');
  console.log(`📋 Total pages to analyze: ${pages.length}\n`);
  console.log('⚠️  READ ONLY MODE - No data will be modified\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 200
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

      // Navigate to the page
      let fullUrl = linkInfo.url;
      if (!fullUrl.startsWith('http')) {
        fullUrl = `https://dms-erp-aws-prd.geappliances.com${fullUrl}`;
      }

      try {
        await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000); // Let page settle

        const analysis = await capturePage(page, linkInfo, i + 1);
        if (analysis) {
          analyses.push(analysis);
          console.log(`   ✅ Analyzed - ${analysis.tables?.length || 0} tables, ${analysis.forms?.length || 0} forms`);
        }

      } catch (error) {
        console.log(`   ⚠️  Error: ${error}`);
      }
    }

    console.log('\n\n📊 Generating documentation...');
    await generateDocumentation(analyses);

    console.log('\n✅ Crawl and documentation complete!');
    console.log(`📁 Captures saved to: ${CAPTURES_DIR}`);
    console.log(`📝 Documentation saved to: ${OUTPUT_DIR}/GE-DMS-Documentation.md`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

crawlAndDocument();
