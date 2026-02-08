/**
 * Inspect STA Spreadsheet Columns
 *
 * Downloads the STA inventory spreadsheet from GE and shows all available columns
 */

import * as XLSX from 'xlsx';
import { getCookieHeader } from '../auth/playwright.js';
import { ENDPOINTS, HEADERS, REFERERS } from '../sync/endpoints.js';

async function inspectStaColumns() {
  console.log('🔍 Inspecting STA Spreadsheet Columns...\n');

  // Use hardcoded location
  const locationId = '0192850e-5f93-7016-ae97-5dc87dd5bce2'; // Sacramento
  const invOrg = '9SU';
  console.log(`📍 Location: ${invOrg}\n`);

  // Get auth cookie
  console.log('📝 Getting authentication cookie...');
  const cookieHeader = await getCookieHeader(locationId);
  console.log('✅ Cookie obtained\n');

  // Fetch STA spreadsheet
  console.log('⬇️  Downloading STA spreadsheet...');
  const body = new URLSearchParams({
    dmsLoc: invOrg,
    subInvLoc: 'STA',
    invorg: invOrg,
    erpDataList: '[]',
  }).toString();

  const response = await fetch(ENDPOINTS.ERP_INVENTORY_SPREADSHEET, {
    method: 'POST',
    headers: {
      ...HEADERS,
      Referer: REFERERS.ERP_INVENTORY,
      Cookie: cookieHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch STA spreadsheet: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(firstSheet);

  console.log(`✅ Downloaded ${data.length} rows\n`);

  if (data.length === 0) {
    console.log('⚠️  No data found in spreadsheet');
    return;
  }

  // Get all column names from first row
  const firstRow = data[0] as Record<string, unknown>;
  const columns = Object.keys(firstRow);

  console.log('📊 Available Columns:\n');
  console.log('═'.repeat(80));
  columns.forEach((col, index) => {
    const sampleValue = firstRow[col];
    const valueStr = sampleValue !== null && sampleValue !== undefined
      ? String(sampleValue).substring(0, 50)
      : '(empty)';
    console.log(`${(index + 1).toString().padStart(2)}. ${col.padEnd(30)} → ${valueStr}`);
  });
  console.log('═'.repeat(80));
  console.log(`\nTotal columns: ${columns.length}`);

  // Show a few sample rows
  console.log('\n📋 Sample Data (first 3 rows):\n');
  data.slice(0, 3).forEach((row, idx) => {
    console.log(`Row ${idx + 1}:`);
    console.log(JSON.stringify(row, null, 2));
    console.log('');
  });

  // Look for potential CSO/Order columns
  console.log('\n🔎 Potential Order/CSO Columns:\n');
  const orderKeywords = ['cso', 'order', 'customer', 'route', 'stop', 'delivery', 'ship'];
  const potentialColumns = columns.filter(col =>
    orderKeywords.some(keyword => col.toLowerCase().includes(keyword))
  );

  if (potentialColumns.length > 0) {
    potentialColumns.forEach(col => {
      const sampleValue = firstRow[col];
      console.log(`  ✓ ${col}: ${sampleValue}`);
    });
  } else {
    console.log('  ⚠️  No obvious order/CSO columns found');
    console.log('  💡 Check column names carefully - CSO might be abbreviated differently');
  }
}

inspectStaColumns()
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
