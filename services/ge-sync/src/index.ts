import 'dotenv/config';
import express from 'express';
import { getAuthStatus, refreshAuth } from './auth/playwright.js';
import { syncASIS } from './sync/asis.js';
import { syncSimpleInventory } from './sync/inventory.js';
import { syncInboundReceipts } from './sync/inbound.js';
import { syncBackhaul } from './sync/backhaul.js';
import { logSyncActivity } from './db/activityLog.js';
import { getLocationConfig } from './db/supabase.js';
import type { SyncResult, AuthStatus } from './types/index.js';
import { handleAgentChat } from './agent/agentChat.js';

const app = express();

// Basic CORS for local UI -> service requests.
const rawCorsOrigins = process.env.CORS_ORIGIN || '*';
const normalizeOrigin = (value: string) => value.trim().replace(/\/+$/, '').toLowerCase();
const corsOrigins = rawCorsOrigins
  .split(',')
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const normalizedRequestOrigin = requestOrigin ? normalizeOrigin(requestOrigin) : '';
  const allowAll = corsOrigins.includes('*');

  if (allowAll) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (requestOrigin && corsOrigins.includes(normalizedRequestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});

app.options('*', (_req, res) => {
  res.sendStatus(204);
});

app.use(express.json());

const PORT = Number(process.env.PORT) || 3001;
const API_KEY = process.env.API_KEY;

// Simple API key auth middleware
function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.method === 'OPTIONS') {
    return next();
  }
  if (req.path === '/health') {
    return next();
  }
  const key = req.headers['x-api-key'];

  if (!API_KEY) {
    // If no API key is configured, allow all requests (dev mode)
    console.warn('No API_KEY configured - running in open mode');
    return next();
  }

  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

app.use(authenticate);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Agent chat
app.post('/agent/chat', handleAgentChat);

// Check auth status
app.get('/auth/status', async (_req, res) => {
  try {
    const locationId =
      (typeof _req.query.locationId === 'string' && _req.query.locationId) ||
      (typeof _req.headers['x-location-id'] === 'string' && _req.headers['x-location-id']);

    if (!locationId) {
      return res.status(400).json({ error: 'locationId is required' });
    }

    const status: AuthStatus = await getAuthStatus(locationId);
    res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// Force re-authentication
app.post('/auth/refresh', async (req, res) => {
  try {
    const { locationId } = req.body;

    if (!locationId) {
      return res.status(400).json({ error: 'locationId is required' });
    }

    const result = await refreshAuth(locationId);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// Sync ASIS data
app.post('/sync/asis', async (req, res) => {
  const startTime = Date.now();

  try {
    const { locationId } = req.body;

    if (!locationId) {
      return res.status(400).json({ error: 'locationId is required' });
    }

    console.log(`Starting ASIS sync for location: ${locationId}`);

    // Get location config for activity logging
    const config = await getLocationConfig(locationId);

    const result: SyncResult = await syncASIS(locationId);

    console.log(`ASIS sync completed in ${result.duration}ms`, result.stats);

    // Log successful sync to activity_log
    await logSyncActivity({
      locationId: config.locationId,
      companyId: config.companyId,
      action: 'asis_sync',
      success: true,
      details: {
        duration_ms: result.duration,
        ...result.stats,
      },
    });

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('ASIS sync failed:', message);

    const result: SyncResult = {
      success: false,
      error: message,
      duration: Date.now() - startTime,
      stats: {
        totalGEItems: 0,
        itemsInLoads: 0,
        unassignedItems: 0,
        newItems: 0,
        updatedItems: 0,
        forSaleLoads: 0,
        pickedLoads: 0,
        changesLogged: 0,
      },
    };

    // Log failed sync to activity_log
    try {
      const { locationId } = req.body;
      if (locationId) {
        const config = await getLocationConfig(locationId);
        await logSyncActivity({
          locationId: config.locationId,
          companyId: config.companyId,
          action: 'asis_sync',
          success: false,
          details: {
            duration_ms: result.duration,
          },
          error: message,
        });
      }
    } catch (logError) {
      console.error('Failed to log sync error:', logError);
    }

    res.status(500).json(result);
  }
});

// Sync FG (Finished Goods) data
app.post('/sync/fg', async (req, res) => {
  const startTime = Date.now();

  try {
    const { locationId } = req.body;

    if (!locationId) {
      return res.status(400).json({ error: 'locationId is required' });
    }

    console.log(`Starting FG sync for location: ${locationId}`);

    const config = await getLocationConfig(locationId);
    const result: SyncResult = await syncSimpleInventory(locationId, 'FG');

    console.log(`FG sync completed in ${Date.now() - startTime}ms`, result.stats);

    await logSyncActivity({
      locationId: config.locationId,
      companyId: config.companyId,
      action: 'fg_sync',
      success: true,
      details: {
        duration_ms: Date.now() - startTime,
        ...result.stats,
      },
    });

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('FG sync failed:', message);

    const result: SyncResult = {
      success: false,
      message: `FG sync failed: ${message}`,
      stats: {
        totalGEItems: 0,
        itemsInLoads: 0,
        unassignedItems: 0,
        newItems: 0,
        updatedItems: 0,
        forSaleLoads: 0,
        pickedLoads: 0,
        changesLogged: 0,
      },
      changes: [],
      error: message,
    };

    try {
      const { locationId } = req.body;
      if (locationId) {
        const config = await getLocationConfig(locationId);
        await logSyncActivity({
          locationId: config.locationId,
          companyId: config.companyId,
          action: 'fg_sync',
          success: false,
          details: { duration_ms: Date.now() - startTime },
          error: message,
        });
      }
    } catch (logError) {
      console.error('Failed to log sync error:', logError);
    }

    res.status(500).json(result);
  }
});

// Sync Backhaul orders
app.post('/sync/backhaul', async (req, res) => {
  const startTime = Date.now();

  try {
    const { locationId, includeClosed, maxOrders } = req.body;

    if (!locationId) {
      return res.status(400).json({ error: 'locationId is required' });
    }

    console.log(`Starting Backhaul sync for location: ${locationId}`);
    const config = await getLocationConfig(locationId);

    const result = await syncBackhaul(locationId, {
      includeClosed,
      maxOrders,
    });

    await logSyncActivity({
      locationId: config.locationId,
      companyId: config.companyId,
      action: 'backhaul_sync',
      success: result.success,
      details: {
        duration_ms: result.duration ?? Date.now() - startTime,
        message: result.message,
      },
      error: result.error,
    });

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Backhaul sync failed:', message);
    res.status(500).json({
      success: false,
      error: message,
      duration: Date.now() - startTime,
      stats: {
        totalGEItems: 0,
        itemsInLoads: 0,
        unassignedItems: 0,
        newItems: 0,
        updatedItems: 0,
        forSaleLoads: 0,
        pickedLoads: 0,
        changesLogged: 0,
      },
    });
  }
});

// Sync STA (Staged) data
app.post('/sync/sta', async (req, res) => {
  const startTime = Date.now();

  try {
    const { locationId } = req.body;

    if (!locationId) {
      return res.status(400).json({ error: 'locationId is required' });
    }

    console.log(`Starting STA sync for location: ${locationId}`);

    const config = await getLocationConfig(locationId);
    const result: SyncResult = await syncSimpleInventory(locationId, 'STA');

    console.log(`STA sync completed in ${Date.now() - startTime}ms`, result.stats);

    await logSyncActivity({
      locationId: config.locationId,
      companyId: config.companyId,
      action: 'sta_sync',
      success: true,
      details: {
        duration_ms: Date.now() - startTime,
        ...result.stats,
      },
    });

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('STA sync failed:', message);

    const result: SyncResult = {
      success: false,
      message: `STA sync failed: ${message}`,
      stats: {
        totalGEItems: 0,
        itemsInLoads: 0,
        unassignedItems: 0,
        newItems: 0,
        updatedItems: 0,
        forSaleLoads: 0,
        pickedLoads: 0,
        changesLogged: 0,
      },
      changes: [],
      error: message,
    };

    try {
      const { locationId } = req.body;
      if (locationId) {
        const config = await getLocationConfig(locationId);
        await logSyncActivity({
          locationId: config.locationId,
          companyId: config.companyId,
          action: 'sta_sync',
          success: false,
          details: { duration_ms: Date.now() - startTime },
          error: message,
        });
      }
    } catch (logError) {
      console.error('Failed to log sync error:', logError);
    }

    res.status(500).json(result);
  }
});

// Sync all inventory types in correct order (FG → ASIS → STA)
app.post('/sync/inventory', async (req, res) => {
  const startTime = Date.now();

  try {
    const { locationId } = req.body;

    if (!locationId) {
      return res.status(400).json({ error: 'locationId is required' });
    }

    console.log('\n' + '='.repeat(80));
    console.log('🚀 Starting UNIFIED INVENTORY SYNC');
    console.log('='.repeat(80));
    console.log(`Location: ${locationId}`);
    console.log('Order: FG → ASIS → STA');
    console.log('='.repeat(80) + '\n');

    const results: {
      fg: SyncResult | null;
      asis: SyncResult | null;
      sta: SyncResult | null;
    } = {
      fg: null,
      asis: null,
      sta: null,
    };

    const errors: string[] = [];

    // 1. Sync FG (Finished Goods) - Independent
    try {
      console.log('\n📦 [1/3] Syncing FG (Finished Goods)...\n');
      results.fg = await syncSimpleInventory(locationId, 'FG');
      console.log(`✅ FG sync completed: ${results.fg.stats?.newItems || 0} new, ${results.fg.stats?.updatedItems || 0} updated`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ FG sync failed: ${message}`);
      errors.push(`FG: ${message}`);
      results.fg = {
        success: false,
        message: `FG sync failed: ${message}`,
        stats: {
          totalGEItems: 0,
          itemsInLoads: 0,
          unassignedItems: 0,
          newItems: 0,
          updatedItems: 0,
          forSaleLoads: 0,
          pickedLoads: 0,
          changesLogged: 0,
        },
        changes: [],
        error: message,
      };
    }

    // 2. Sync ASIS (As-Is inventory - "for sale")
    try {
      console.log('\n🏪 [2/3] Syncing ASIS (For Sale inventory)...\n');
      results.asis = await syncASIS(locationId);
      console.log(`✅ ASIS sync completed: ${results.asis.stats?.newItems || 0} new, ${results.asis.stats?.updatedItems || 0} updated`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ ASIS sync failed: ${message}`);
      errors.push(`ASIS: ${message}`);
      results.asis = {
        success: false,
        message: `ASIS sync failed: ${message}`,
        stats: {
          totalGEItems: 0,
          itemsInLoads: 0,
          unassignedItems: 0,
          newItems: 0,
          updatedItems: 0,
          forSaleLoads: 0,
          pickedLoads: 0,
          changesLogged: 0,
        },
        changes: [],
        error: message,
      };
    }

    // 3. Sync STA (Staged inventory - "sold") - Migrates ASIS→STA as needed
    try {
      console.log('\n🎯 [3/3] Syncing STA (Staged inventory)...\n');
      results.sta = await syncSimpleInventory(locationId, 'STA');
      console.log(`✅ STA sync completed: ${results.sta.stats?.newItems || 0} new, ${results.sta.stats?.updatedItems || 0} updated`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ STA sync failed: ${message}`);
      errors.push(`STA: ${message}`);
      results.sta = {
        success: false,
        message: `STA sync failed: ${message}`,
        stats: {
          totalGEItems: 0,
          itemsInLoads: 0,
          unassignedItems: 0,
          newItems: 0,
          updatedItems: 0,
          forSaleLoads: 0,
          pickedLoads: 0,
          changesLogged: 0,
        },
        changes: [],
        error: message,
      };
    }

    const duration = Date.now() - startTime;
    const allSucceeded = results.fg?.success && results.asis?.success && results.sta?.success;

    // Combine stats
    const combinedStats = {
      totalGEItems: (results.fg?.stats?.totalGEItems || 0) +
                    (results.asis?.stats?.totalGEItems || 0) +
                    (results.sta?.stats?.totalGEItems || 0),
      itemsInLoads: (results.asis?.stats?.itemsInLoads || 0), // Only ASIS has loads
      unassignedItems: (results.asis?.stats?.unassignedItems || 0), // Only ASIS has unassigned
      newItems: (results.fg?.stats?.newItems || 0) +
                (results.asis?.stats?.newItems || 0) +
                (results.sta?.stats?.newItems || 0),
      updatedItems: (results.fg?.stats?.updatedItems || 0) +
                    (results.asis?.stats?.updatedItems || 0) +
                    (results.sta?.stats?.updatedItems || 0),
      forSaleLoads: (results.asis?.stats?.forSaleLoads || 0), // Only ASIS has loads
      pickedLoads: (results.asis?.stats?.pickedLoads || 0), // Only ASIS has loads
      changesLogged: (results.fg?.stats?.changesLogged || 0) +
                     (results.asis?.stats?.changesLogged || 0) +
                     (results.sta?.stats?.changesLogged || 0),
    };

    // Combine all changes
    const allChanges = [
      ...(results.fg?.changes || []),
      ...(results.asis?.changes || []),
      ...(results.sta?.changes || []),
    ];

    console.log('\n' + '='.repeat(80));
    console.log('✨ UNIFIED INVENTORY SYNC COMPLETE');
    console.log('='.repeat(80));
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`Total items from GE: ${combinedStats.totalGEItems}`);
    console.log(`New items: ${combinedStats.newItems}`);
    console.log(`Updated items: ${combinedStats.updatedItems}`);
    console.log(`Changes logged: ${combinedStats.changesLogged}`);
    if (errors.length > 0) {
      console.log(`Errors: ${errors.length}`);
      errors.forEach(err => console.log(`  - ${err}`));
    }
    console.log('='.repeat(80) + '\n');

    const result: SyncResult = {
      success: allSucceeded,
      message: allSucceeded
        ? 'All inventory types synced successfully'
        : `Sync completed with errors: ${errors.join(', ')}`,
      stats: combinedStats,
      changes: allChanges,
      duration,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      // Include individual results for debugging
      details: results,
    };

    // Log activity
    const config = await getLocationConfig(locationId);
    await logSyncActivity({
      locationId: config.locationId,
      companyId: config.companyId,
      action: 'inventory_sync',
      success: allSucceeded,
      details: {
        duration_ms: duration,
        ...combinedStats,
      },
      ...(errors.length > 0 ? { error: errors.join('; ') } : {}),
    });

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unified inventory sync failed:', message);

    const result: SyncResult = {
      success: false,
      message: `Unified inventory sync failed: ${message}`,
      stats: {
        totalGEItems: 0,
        itemsInLoads: 0,
        unassignedItems: 0,
        newItems: 0,
        updatedItems: 0,
        forSaleLoads: 0,
        pickedLoads: 0,
        changesLogged: 0,
      },
      changes: [],
      error: message,
      duration: Date.now() - startTime,
    };

    // Log error activity
    try {
      const { locationId } = req.body;
      if (locationId) {
        const config = await getLocationConfig(locationId);
        await logSyncActivity({
          locationId: config.locationId,
          companyId: config.companyId,
          action: 'inventory_sync',
          success: false,
          details: { duration_ms: Date.now() - startTime },
          error: message,
        });
      }
    } catch (logError) {
      console.error('Failed to log sync error:', logError);
    }

    res.status(500).json(result);
  }
});

// Sync inbound receiving reports
app.post('/sync/inbound', async (req, res) => {
  const startTime = Date.now();

  try {
    const { locationId } = req.body;

    if (!locationId) {
      return res.status(400).json({ error: 'locationId is required' });
    }

    console.log(`Starting inbound receipts sync for location: ${locationId}`);

    const result: SyncResult = await syncInboundReceipts(locationId);

    console.log(`Inbound receipts sync completed in ${Date.now() - startTime}ms`, result.stats);

    // Log activity
    const config = await getLocationConfig(locationId);
    await logSyncActivity({
      locationId: config.locationId,
      companyId: config.companyId,
      action: 'inbound_sync',
      success: result.success,
      details: {
        duration_ms: Date.now() - startTime,
        ...result.stats,
      },
    });

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Inbound receipts sync failed:', message);

    const result: SyncResult = {
      success: false,
      message: `Inbound receipts sync failed: ${message}`,
      stats: {
        totalGEItems: 0,
        itemsInLoads: 0,
        unassignedItems: 0,
        newItems: 0,
        updatedItems: 0,
        forSaleLoads: 0,
        pickedLoads: 0,
        changesLogged: 0,
      },
      changes: [],
      error: message,
    };

    // Log error activity
    try {
      const { locationId } = req.body;
      if (locationId) {
        const config = await getLocationConfig(locationId);
        await logSyncActivity({
          locationId: config.locationId,
          companyId: config.companyId,
          action: 'inbound_sync',
          success: false,
          details: { duration_ms: Date.now() - startTime },
          error: message,
        });
      }
    } catch (logError) {
      console.error('Failed to log sync error:', logError);
    }

    res.status(500).json(result);
  }
});

app.listen(PORT, () => {
  console.log(`GE Sync Service running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
