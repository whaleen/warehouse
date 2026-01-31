import { chromium, Browser, BrowserContext, Cookie } from 'playwright';
import { getLocationConfig, getSupabase } from '../db/supabase.js';
import type { AuthStatus } from '../types/index.js';

const GE_DMS_BASE = 'https://dms-erp-aws-prd.geappliances.com';
const GE_ASIS_URL = `${GE_DMS_BASE}/dms/newasis`;

// In-memory cookie storage keyed by location (persisted to DB as backup)
const cachedCookiesByLocation = new Map<string, Cookie[]>();
const lastAuthAtByLocation = new Map<string, Date>();

const getCachedCookies = (locationId: string) => cachedCookiesByLocation.get(locationId) ?? null;
const setCachedCookies = (locationId: string, cookies: Cookie[]) => {
  cachedCookiesByLocation.set(locationId, cookies);
  lastAuthAtByLocation.set(locationId, new Date());
};
const getLastAuthAt = (locationId: string) => lastAuthAtByLocation.get(locationId);

/**
 * Check if current cookies are valid by making a test request
 */
export async function getAuthStatus(locationId: string): Promise<AuthStatus> {
  let cookies = getCachedCookies(locationId);
  if (!cookies) {
    cookies = await loadCookiesFromDb(locationId);
    if (cookies) {
      cachedCookiesByLocation.set(locationId, cookies);
    }
  }

  if (!cookies || cookies.length === 0) {
    return {
      authenticated: false,
      cookiesValid: false,
    };
  }

  // Try a simple fetch to check if cookies work
  try {
    const cookieHeader = cookies
      .map(c => `${c.name}=${c.value}`)
      .join('; ');

    const response = await fetch(GE_ASIS_URL, {
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      redirect: 'manual', // Don't follow redirects - a redirect means auth failed
    });

    // If we get a redirect to login page, cookies are invalid
    const isValid = response.status === 200;

    return {
      authenticated: isValid,
      cookiesValid: isValid,
      lastAuthAt: getLastAuthAt(locationId)?.toISOString(),
    };
  } catch {
    return {
      authenticated: false,
      cookiesValid: false,
      lastAuthAt: getLastAuthAt(locationId)?.toISOString(),
    };
  }
}

/**
 * Perform browser-based SSO login to get fresh cookies
 */
export async function refreshAuth(locationId: string): Promise<AuthStatus> {
  const config = await getLocationConfig(locationId);

  if (!config.ssoUsername || !config.ssoPassword) {
    throw new Error('SSO credentials not configured for this location');
  }

  console.log(`Starting Playwright auth for location: ${config.name}`);

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
    console.log(`Launching browser in ${headless ? 'headless' : 'headed'} mode`);

    browser = await chromium.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });

    const page = await context.newPage();

    // Navigate to GE DMS - will redirect to SSO
    console.log('Navigating to GE DMS...');
    await page.goto(GE_ASIS_URL, { waitUntil: 'networkidle' });

    // Wait for SSO login page
    // GE uses a corporate SSO - the exact selectors may need adjustment
    console.log('Waiting for SSO login form...');

    // Check if we're on the SSO page
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // Wait a moment for SSO page to fully render
    await page.waitForTimeout(2000);

    if (currentUrl.includes('login') || currentUrl.includes('sso') || currentUrl.includes('auth')) {
      // Fill in credentials
      // GE SSO uses simple text/password fields with a "LOG IN" button
      try {
        // Take screenshot of SSO page before login attempt
        await page.screenshot({ path: '/tmp/sso-page-before-login.png', fullPage: true });
        console.log('Screenshot saved: /tmp/sso-page-before-login.png');

        // GE SSO selectors - based on actual page structure
        const usernameSelector = 'input[type="text"], input[type="email"], input[name*="user"]';
        const passwordSelector = 'input[type="password"]';
        const submitSelector = 'button[type="submit"], input[type="submit"], button:has-text("LOG IN")';

        // Find and fill username
        const usernameField = await page.$(usernameSelector);
        if (!usernameField) {
          throw new Error(`Could not find username field with selector: ${usernameSelector}`);
        }
        await usernameField.fill(config.ssoUsername);
        console.log('Filled username field');

        // Find and fill password
        const passwordField = await page.$(passwordSelector);
        if (!passwordField) {
          throw new Error(`Could not find password field with selector: ${passwordSelector}`);
        }
        await passwordField.fill(config.ssoPassword);
        console.log('Filled password field');

        // Find and click submit button
        const submitButton = await page.$(submitSelector);
        if (!submitButton) {
          throw new Error(`Could not find submit button with selector: ${submitSelector}`);
        }
        console.log('Submitting login form...');
        await submitButton.click();

        // Wait for page to settle after login (like the working browse script)
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Take screenshot to see what happened
        await page.screenshot({ path: '/tmp/after-submit.png', fullPage: true });
        console.log(`After submit URL: ${page.url()}`);
        console.log('Screenshot saved: /tmp/after-submit.png');

        // Check if we're still on login page - might need to click continue or handle 2FA
        if (page.url().includes('sso.') || page.url().includes('login')) {
          console.log('Still on login/SSO page, checking for additional prompts...');

          // Look for common "Continue" or "Consent" buttons
          const continueButton = page.locator('button:has-text("Continue"), button:has-text("Accept"), button:has-text("Allow"), input[type="submit"]');
          if (await continueButton.count() > 0) {
            console.log('Found continue/consent button, clicking...');
            await continueButton.first().click();
            await page.waitForTimeout(2000);
          }
        }

        // Wait for navigation to complete - try multiple times
        try {
          await page.waitForURL(/dms/, { timeout: 30000 });
        } catch {
          // Take another screenshot if we timeout
          await page.screenshot({ path: '/tmp/timeout-waiting-dms.png', fullPage: true });
          console.log(`Timeout waiting for DMS redirect. Current URL: ${page.url()}`);
          throw new Error(`Login may have failed - stuck at ${page.url()}`);
        }

        // Wait a bit more for all cookies to be set
        await page.waitForLoadState('networkidle');

        console.log('Login successful, waiting for page to fully load...');
        console.log(`Final URL: ${page.url()}`);
      } catch (loginError) {
        console.error('Login form interaction failed:', loginError);
        // Take a screenshot for debugging
        await page.screenshot({ path: '/tmp/login-error.png' });
        throw new Error('Failed to complete SSO login - check credentials and selectors');
      }
    }

    // Extract cookies from all domains
    const cookies = await context.cookies();

    // Debug: log cookie details
    console.log('Extracted cookies:');
    for (const cookie of cookies) {
      console.log(`  ${cookie.domain}: ${cookie.name} = ${cookie.value.substring(0, 20)}...`);
    }

    // Filter to only include cookies for the GE DMS domain
    const dmsCookies = cookies.filter(c =>
      c.domain.includes('geappliances.com') || c.domain.includes('dms')
    );
    console.log(`Filtered to ${dmsCookies.length} GE-related cookies`);

    setCachedCookies(locationId, dmsCookies);

    // Store cookies in database for persistence across restarts
    await storeCookiesInDb(locationId, dmsCookies);

    console.log(`Stored ${dmsCookies.length} cookies`);

    return {
      authenticated: true,
      cookiesValid: true,
      lastAuthAt: getLastAuthAt(locationId)?.toISOString(),
    };
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

/**
 * Get cookies, refreshing if necessary
 */
export async function getValidCookies(locationId: string): Promise<Cookie[]> {
  // Check if cookies are valid
  const status = await getAuthStatus(locationId);

  if (!status.cookiesValid) {
    console.log('Cookies invalid or expired, refreshing...');
    await refreshAuth(locationId);
  }

  const cookies = getCachedCookies(locationId);
  if (!cookies) {
    throw new Error('Failed to obtain valid cookies');
  }

  return cookies;
}

/**
 * Get cookie header string for fetch requests
 */
export async function getCookieHeader(locationId: string): Promise<string> {
  const cookies = await getValidCookies(locationId);
  const header = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  console.log(`Cookie header (${cookies.length} cookies, ${header.length} chars) for ${locationId}: ${header.substring(0, 100)}...`);
  return header;
}

/**
 * Store cookies in Supabase for persistence
 */
async function storeCookiesInDb(locationId: string, cookies: Cookie[]): Promise<void> {
  const db = getSupabase();

  const { error } = await db
    .from('settings')
    .update({
      ge_cookies: cookies,
      ge_cookies_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('location_id', locationId);

  if (error) {
    console.warn('Failed to persist cookies to DB:', error.message);
  } else {
    console.log(`Stored ${cookies.length} cookies for location ${locationId}`);
  }
}

/**
 * Load cookies from Supabase
 */
async function loadCookiesFromDb(locationId: string): Promise<Cookie[] | null> {
  const db = getSupabase();

  const { data, error } = await db
    .from('settings')
    .select('ge_cookies, ge_cookies_updated_at')
    .eq('location_id', locationId)
    .single();

  if (error || !data?.ge_cookies) {
    console.log(`No stored cookies found for location ${locationId}`);
    return null;
  }

  // Check if cookies are too old (e.g., older than 24 hours)
  if (data.ge_cookies_updated_at) {
    const updatedAt = new Date(data.ge_cookies_updated_at);
    const hoursSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceUpdate > 24) {
      console.log(`Stored cookies are ${hoursSinceUpdate.toFixed(1)} hours old, will refresh`);
      return null;
    }
  }

  console.log(`Loaded ${data.ge_cookies.length} cookies from DB for location ${locationId}`);
  if (data.ge_cookies_updated_at) {
    lastAuthAtByLocation.set(locationId, new Date(data.ge_cookies_updated_at));
  }
  return data.ge_cookies as Cookie[];
}
