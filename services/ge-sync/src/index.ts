import 'dotenv/config';
import express from 'express';
import { getAuthStatus, refreshAuth } from './auth/playwright.js';
import { syncASIS } from './sync/asis.js';
import type { SyncResult, AuthStatus } from './types/index.js';

const app = express();

// Basic CORS for local UI -> service requests.
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY;

// Simple API key auth middleware
function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
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

// Check auth status
app.get('/auth/status', async (_req, res) => {
  try {
    const status: AuthStatus = await getAuthStatus();
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

    const result: SyncResult = await syncASIS(locationId);

    console.log(`ASIS sync completed in ${result.duration}ms`, result.stats);

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

    res.status(500).json(result);
  }
});

app.listen(PORT, () => {
  console.log(`GE Sync Service running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
