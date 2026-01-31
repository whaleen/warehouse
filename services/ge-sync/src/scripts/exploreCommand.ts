import 'dotenv/config';
import { chromium } from 'playwright';
import { getSupabase } from '../db/supabase.js';
import { Cookie } from 'playwright';
import * as fs from 'fs/promises';

const GE_DMS_BASE = 'https://dms-erp-aws-prd.geappliances.com';

async function loadCookiesFromDb(locationId: string): Promise<Cookie[] | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('ge_sync_cookies')
    .select('cookies')
    .eq('location_id', locationId)
    .single();

  return data?.cookies ? JSON.parse(data.cookies) : null;
}

async function executeCommand(locationId: string, command: string) {
  const cookies = await loadCookiesFromDb(locationId);

  if (!cookies) {
    console.log('❌ No cookies found. Please authenticate first.');
    return;
  }

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    viewport: { width: 1400, height: 900 },
  });

  await context.addCookies(cookies);
  const page = await context.newPage();

  const [action, ...args] = command.trim().split(/\s+/);

  try {
    switch (action) {
      case 'goto': {
        const url = args[0] || `${GE_DMS_BASE}/dms/newasis`;
        const fullUrl = url.startsWith('http') ? url : `${GE_DMS_BASE}${url}`;
        console.log(`🔄 Navigating to: ${fullUrl}`);
        await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
        break;
      }

      case 'click': {
        const selector = args.join(' ');
        console.log(`👆 Clicking: ${selector}`);
        await page.click(selector);
        await page.waitForTimeout(2000);
        break;
      }

      case 'reload': {
        console.log('🔄 Reloading page...');
        await page.reload({ waitUntil: 'networkidle' });
        break;
      }

      case 'wait': {
        const ms = parseInt(args[0]) || 2000;
        console.log(`⏳ Waiting ${ms}ms...`);
        await page.waitForTimeout(ms);
        break;
      }

      default: {
        // Default: just navigate to ASIS page
        await page.goto(`${GE_DMS_BASE}/dms/newasis`, { waitUntil: 'networkidle', timeout: 30000 });
      }
    }

    // Get page info
    const url = page.url();
    const title = await page.title();
    console.log('\n📍 Current Page:');
    console.log(`   URL: ${url}`);
    console.log(`   Title: ${title}`);

    // Take screenshot
    const screenshotPath = `/tmp/ge-explore-${action}-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`📸 Screenshot: ${screenshotPath}\n`);

    // Save HTML for analysis
    const html = await page.content();
    const htmlPath = `/tmp/ge-page-${action}-${Date.now()}.html`;
    await fs.writeFile(htmlPath, html);
    console.log(`💾 HTML saved: ${htmlPath}\n`);

    // Keep browser open indefinitely
    console.log('✅ Browser is ready! Press Ctrl+C to close when done.');
    console.log('   You can now navigate manually in the browser window.\n');

    // Wait forever (until killed)
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error);
    await browser.close();
  }
}

const locationId = process.argv[2];
const command = process.argv.slice(3).join(' ') || 'goto';

if (!locationId) {
  console.error('Usage: tsx exploreCommand.ts <location-id> [command]');
  process.exit(1);
}

executeCommand(locationId, command);
