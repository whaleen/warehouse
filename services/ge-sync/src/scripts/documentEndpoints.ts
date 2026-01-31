#!/usr/bin/env tsx
/**
 * GE DMS Endpoint Documentation Script
 *
 * Systematically clicks each spreadsheet export button,
 * downloads the files, and documents all available fields.
 */

import 'dotenv/config';
import { chromium, Browser, Page, Download } from 'playwright';
import * as XLSX from 'xlsx';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getLocationConfig } from '../db/supabase.js';

const GE_DMS_BASE = 'https://dms-erp-aws-prd.geappliances.com';
const OUTPUT_DIR = '/tmp/ge-endpoint-docs';
let activeBrowser: Browser | null = null;

interface EndpointDoc {
  name: string;
  description: string;
  url: string;
  method: 'click' | 'navigate';
  selector?: string;
  fields: FieldDoc[];
  sampleData: Record<string, unknown>[];
  timestamp: string;
}

interface FieldDoc {
  name: string;
  type: 'string' | 'number' | 'date' | 'unknown';
  sampleValues: string[];
  nullCount: number;
  uniqueCount: number;
  notes?: string;
}

async function authenticate(locationId: string): Promise<{ browser: Browser; page: Page }> {
  const config = await getLocationConfig(locationId);

  if (!config.ssoUsername || !config.ssoPassword) {
    throw new Error('SSO credentials not configured');
  }

  console.log('🔐 Authenticating to GE DMS...\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    viewport: { width: 1400, height: 900 },
    acceptDownloads: true,
  });

  const page = await context.newPage();

  // Navigate and authenticate
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

  return { browser, page };
}

async function analyzeFile(filePath: string): Promise<{ fields: FieldDoc[]; sampleData: Record<string, unknown>[] }> {
  const ext = path.extname(filePath).toLowerCase();
  let data: Record<string, unknown>[] = [];

  if (ext === '.xls' || ext === '.xlsx') {
    const buffer = await fs.readFile(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    data = XLSX.utils.sheet_to_json(firstSheet);
  } else if (ext === '.csv') {
    const text = await fs.readFile(filePath, 'utf-8');
    const lines = text.trim().split('\n');
    if (lines.length < 2) return { fields: [], sampleData: [] };

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    data = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, unknown> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });
      return row;
    });
  }

  if (data.length === 0) {
    return { fields: [], sampleData: [] };
  }

  // Analyze fields
  const fields: FieldDoc[] = [];
  const headers = Object.keys(data[0] || {});

  for (const header of headers) {
    const values = data.map(row => row[header]);
    const nonNullValues = values.filter(v => v != null && v !== '');
    const uniqueValues = new Set(nonNullValues.map(v => String(v)));

    // Determine type
    let type: 'string' | 'number' | 'date' | 'unknown' = 'string';
    const numericCount = nonNullValues.filter(v => !isNaN(Number(v))).length;
    const datePattern = /^\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4}/;
    const dateCount = nonNullValues.filter(v => datePattern.test(String(v))).length;

    if (dateCount > nonNullValues.length * 0.8) {
      type = 'date';
    } else if (numericCount > nonNullValues.length * 0.8) {
      type = 'number';
    }

    // Get sample values (max 5 unique)
    const sampleValues = Array.from(uniqueValues)
      .slice(0, 5)
      .map(v => String(v));

    fields.push({
      name: header,
      type,
      sampleValues,
      nullCount: values.length - nonNullValues.length,
      uniqueCount: uniqueValues.size,
    });
  }

  return {
    fields,
    sampleData: data.slice(0, 3), // First 3 rows as sample
  };
}

async function documentEndpoint(
  page: Page,
  endpoint: {
    name: string;
    description: string;
    method: 'click' | 'navigate';
    selector?: string;
    url?: string;
  }
): Promise<EndpointDoc | null> {
  console.log(`\n📊 Documenting: ${endpoint.name}`);
  console.log(`   ${endpoint.description}`);

  try {
    let download: Download | null = null;

    if (endpoint.method === 'click' && endpoint.selector) {
      // Wait for the download
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

      // Click the button
      await page.click(endpoint.selector);

      // Wait for download to start
      download = await downloadPromise;
    } else if (endpoint.method === 'navigate' && endpoint.url) {
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
      await page.goto(endpoint.url);
      download = await downloadPromise;
    }

    if (!download) {
      console.log('   ⚠️  No download triggered');
      return null;
    }

    // Save the file
    const suggestedFilename = download.suggestedFilename();
    const downloadPath = path.join(OUTPUT_DIR, suggestedFilename);
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await download.saveAs(downloadPath);

    console.log(`   ✅ Downloaded: ${suggestedFilename}`);

    // Analyze the file
    const { fields, sampleData } = await analyzeFile(downloadPath);
    console.log(`   📋 Found ${fields.length} fields`);

    return {
      name: endpoint.name,
      description: endpoint.description,
      url: endpoint.url || page.url(),
      method: endpoint.method,
      selector: endpoint.selector,
      fields,
      sampleData,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.log(`   ❌ Failed: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

async function main() {
  const locationId = process.argv[2] || process.env.DEFAULT_LOCATION_ID;

  if (!locationId) {
    console.error('❌ Usage: tsx documentEndpoints.ts <location-id>');
    process.exit(1);
  }

  console.log('🚀 GE DMS Endpoint Documentation Tool\n');

  const { browser, page } = await authenticate(locationId);
  activeBrowser = browser;

  const endpoints = [
    {
      name: 'ASIS Load SpreadSheet',
      description: 'Main load list with notes and basic status',
      method: 'click' as const,
      selector: 'input[value="ASIS Load SpreadSheet"]',
    },
    {
      name: 'Model Details SpreadSheet',
      description: 'Product model details',
      method: 'click' as const,
      selector: 'input[value="Model Details SpreadSheet"]',
    },
  ];

  const docs: EndpointDoc[] = [];

  // Navigate to ASIS page first
  await page.goto(`${GE_DMS_BASE}/dms/newasis`, { waitUntil: 'networkidle' });

  for (const endpoint of endpoints) {
    const doc = await documentEndpoint(page, endpoint);
    if (doc) {
      docs.push(doc);
    }
    await page.waitForTimeout(2000); // Wait between downloads
  }

  // Navigate to Report History page
  console.log('\n📊 Navigating to Report History...');
  await page.goto(`${GE_DMS_BASE}/dms/newasis/asreporthistory`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Now document report history export
  const reportHistoryDoc = await documentEndpoint(page, {
    name: 'ASIS Report History',
    description: 'Detailed load history with CSO status, pricing, submitted dates',
    method: 'click',
    selector: 'input[value="SpreadSheet"]',
  });

  if (reportHistoryDoc) {
    docs.push(reportHistoryDoc);
  }

  // Generate markdown documentation
  console.log('\n\n📝 Generating documentation...\n');

  let markdown = '# GE DMS Endpoint Field Documentation\n\n';
  markdown += `**Generated:** ${new Date().toISOString()}\n\n`;
  markdown += '**Purpose:** Document all available fields from GE DMS spreadsheet exports to ensure complete data coverage.\n\n';
  markdown += '---\n\n';

  for (const doc of docs) {
    markdown += `## ${doc.name}\n\n`;
    markdown += `**Description:** ${doc.description}\n\n`;
    markdown += `**Method:** ${doc.method}\n`;
    if (doc.selector) markdown += `**Selector:** \`${doc.selector}\`\n`;
    markdown += `**URL:** ${doc.url}\n`;
    markdown += `**Timestamp:** ${doc.timestamp}\n\n`;

    markdown += `### Fields (${doc.fields.length} total)\n\n`;
    markdown += '| Field Name | Type | Unique Values | Null Count | Sample Values |\n';
    markdown += '|------------|------|---------------|------------|---------------|\n';

    for (const field of doc.fields) {
      const samples = field.sampleValues.slice(0, 3).join(', ');
      markdown += `| ${field.name} | ${field.type} | ${field.uniqueCount} | ${field.nullCount} | ${samples} |\n`;
    }

    markdown += '\n### Sample Data (First 3 Rows)\n\n';
    markdown += '```json\n';
    markdown += JSON.stringify(doc.sampleData, null, 2);
    markdown += '\n```\n\n';
    markdown += '---\n\n';
  }

  // Save documentation
  const docPath = path.join(OUTPUT_DIR, 'GE_ENDPOINT_FIELDS.md');
  await fs.writeFile(docPath, markdown);

  console.log(`✅ Documentation saved to: ${docPath}\n`);
  console.log('📊 Summary:');
  for (const doc of docs) {
    console.log(`   • ${doc.name}: ${doc.fields.length} fields`);
  }

  console.log('\n👋 Press Ctrl+C to close browser and exit');

  // Keep browser open for review
  await new Promise(() => {});
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Exiting...');
  if (activeBrowser) {
    void activeBrowser.close();
  }
  process.exit(0);
});

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
