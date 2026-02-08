export type GeSyncType = 'asis' | 'fg' | 'sta' | 'inbound' | 'inventory';

const GE_SYNC_URL =
  (import.meta.env.VITE_GE_SYNC_URL as string | undefined) ?? 'http://localhost:3001';
const GE_SYNC_API_KEY = import.meta.env.VITE_GE_SYNC_API_KEY as string | undefined;

export type GeSyncStats = {
  totalGEItems: number;
  newItems: number;
  updatedItems: number;
  changesLogged: number;
  unassignedItems?: number;
};

export type GeSyncLog = string[];

export async function syncGeInventory(type: GeSyncType, locationId: string) {
  const response = await fetch(`${GE_SYNC_URL}/sync/${type}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(GE_SYNC_API_KEY ? { 'X-API-Key': GE_SYNC_API_KEY } : {}),
    },
    body: JSON.stringify({ locationId }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const message = payload?.error || payload?.message || response.statusText || 'Sync failed';
    throw new Error(message);
  }

  return {
    stats: (payload.stats ?? {}) as GeSyncStats,
    log: (payload.log ?? []) as GeSyncLog,
  };
}

export async function syncBackhaul(locationId: string, options?: { includeClosed?: boolean; maxOrders?: number }) {
  const response = await fetch(`${GE_SYNC_URL}/sync/backhaul`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(GE_SYNC_API_KEY ? { 'X-API-Key': GE_SYNC_API_KEY } : {}),
    },
    body: JSON.stringify({ locationId, ...options }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const message = payload?.error || payload?.message || response.statusText || 'Sync failed';
    throw new Error(message);
  }

  return {
    stats: (payload.stats ?? {}) as GeSyncStats,
    log: (payload.log ?? []) as GeSyncLog,
    message: payload.message as string | undefined,
  };
}
