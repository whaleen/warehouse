import 'dotenv/config';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { getLocationConfig } from '../db/supabase.js';
import * as readline from 'readline';
import * as fs from 'fs/promises';

const GE_DMS_BASE = 'https://dms-erp-aws-prd.geappliances.com';
const GE_ASIS_URL = `${GE_DMS_BASE}/dms/newasis`;

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

async function authenticate(locationId: string) {
  const config = await getLocationConfig(locationId);

  if (!config.ssoUsername || !config.ssoPassword) {
    throw new Error('SSO credentials not configured for this location');
  }

  console.log(`\n🔐 Authenticating to GE DMS for location: ${config.name}\n`);

  browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    viewport: { width: 1400, height: 900 },
  });

  page = await context.newPage();

  // Navigate to GE DMS - will redirect to SSO
  console.log('📍 Navigating to GE DMS...');
  await page.goto(GE_ASIS_URL, { waitUntil: 'networkidle' });

  // Check if we're at login page
  const currentUrl = page.url();
  if (currentUrl.includes('sso.geappliances.com')) {
    console.log('🔑 SSO login required, filling credentials...');

    // Fill login form
    await page.fill('input[name="username"]', config.ssoUsername);
    await page.fill('input[name="password"]', config.ssoPassword);

    // Submit
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dms/**', { timeout: 30000 });

    console.log('✅ Authentication successful!\n');
  } else {
    console.log('✅ Already authenticated!\n');
  }

  return page;
}

async function takeScreenshot(name: string = 'screenshot') {
  if (!page) return;
  const filename = `/tmp/ge-explore-${name}-${Date.now()}.png`;
  await page.screenshot({ path: filename, fullPage: false });
  console.log(`📸 Screenshot saved: ${filename}`);
  return filename;
}

async function getCurrentInfo() {
  if (!page) return;

  const url = page.url();
  const title = await page.title();

  console.log('\n📍 Current Page Info:');
  console.log(`   URL: ${url}`);
  console.log(`   Title: ${title}`);

  return { url, title };
}

async function runCommand(cmd: string) {
  if (!page) {
    console.log('❌ No active page. Authenticate first.');
    return;
  }

  const [action, ...args] = cmd.trim().split(/\s+/);

  try {
    switch (action) {
      case 'goto':
      case 'navigate': {
        const url = args[0];
        if (!url) {
          console.log('❌ Usage: goto <url>');
          return;
        }
        console.log(`🔄 Navigating to: ${url}`);
        await page.goto(url.startsWith('http') ? url : `${GE_DMS_BASE}${url}`, {
          waitUntil: 'networkidle',
          timeout: 30000
        });
        await getCurrentInfo();
        await takeScreenshot('navigate');
        break;
      }

      case 'click': {
        const selector = args.join(' ');
        if (!selector) {
          console.log('❌ Usage: click <selector>');
          return;
        }
        console.log(`👆 Clicking: ${selector}`);
        await page.click(selector);
        await page.waitForTimeout(1000);
        await getCurrentInfo();
        await takeScreenshot('click');
        break;
      }

      case 'screenshot':
      case 'snap': {
        const name = args[0] || 'manual';
        await takeScreenshot(name);
        break;
      }

      case 'info':
      case 'where': {
        await getCurrentInfo();
        break;
      }

      case 'text': {
        const selector = args[0];
        if (!selector) {
          console.log('❌ Usage: text <selector>');
          return;
        }
        const text = await page.textContent(selector);
        console.log(`📝 Text content: ${text}`);
        break;
      }

      case 'html': {
        const html = await page.content();
        const filename = `/tmp/ge-page-${Date.now()}.html`;
        await fs.writeFile(filename, html);
        console.log(`💾 HTML saved: ${filename}`);
        break;
      }

      case 'eval':
      case 'js': {
        const code = args.join(' ');
        if (!code) {
          console.log('❌ Usage: eval <javascript code>');
          return;
        }
        const result = await page.evaluate(code);
        console.log(`🔧 Result:`, result);
        break;
      }

      case 'back': {
        await page.goBack();
        await getCurrentInfo();
        await takeScreenshot('back');
        break;
      }

      case 'forward': {
        await page.goForward();
        await getCurrentInfo();
        await takeScreenshot('forward');
        break;
      }

      case 'reload':
      case 'refresh': {
        await page.reload();
        await getCurrentInfo();
        await takeScreenshot('reload');
        break;
      }

      case 'wait': {
        const ms = parseInt(args[0]) || 1000;
        console.log(`⏳ Waiting ${ms}ms...`);
        await page.waitForTimeout(ms);
        break;
      }

      case 'help': {
        console.log('\n📚 Available Commands:');
        console.log('   goto <url>        - Navigate to URL');
        console.log('   click <selector>  - Click element');
        console.log('   screenshot [name] - Take screenshot');
        console.log('   info              - Show current page info');
        console.log('   text <selector>   - Get text content');
        console.log('   html              - Save page HTML');
        console.log('   eval <js>         - Execute JavaScript');
        console.log('   back              - Go back');
        console.log('   forward           - Go forward');
        console.log('   reload            - Reload page');
        console.log('   wait <ms>         - Wait for milliseconds');
        console.log('   help              - Show this help');
        console.log('   quit              - Exit\n');
        break;
      }

      default: {
        console.log(`❌ Unknown command: ${action}`);
        console.log('💡 Type "help" for available commands');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
  }
}

async function interactiveSession(locationId: string) {
  console.log('\n🚀 Starting Interactive GE DMS Explorer\n');
  console.log('Type "help" for available commands, "quit" to exit\n');

  // Authenticate first
  await authenticate(locationId);
  await getCurrentInfo();
  await takeScreenshot('initial');

  // Set up readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'ge-dms> '
  });

  rl.prompt();

  rl.on('line', async (input) => {
    const line = input.trim();

    if (!line) {
      rl.prompt();
      return;
    }

    if (line === 'quit' || line === 'exit') {
      console.log('\n👋 Closing browser and exiting...\n');
      rl.close();
      return;
    }

    await runCommand(line);
    rl.prompt();
  });

  rl.on('close', async () => {
    if (browser) {
      await browser.close();
    }
    process.exit(0);
  });
}

// Get location ID from command line
const locationId = process.argv[2] || process.env.DEFAULT_LOCATION_ID;

if (!locationId) {
  console.error('❌ Usage: tsx interactiveExplore.ts <location-id>');
  process.exit(1);
}

interactiveSession(locationId).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
