import type { ScanningSession, SessionSummary } from '@/types/session';

const SESSION_STORAGE_KEY = 'warehouse_scanning_sessions';
const ACTIVE_SESSION_KEY = 'warehouse_active_session';

/**
 * Get all saved sessions from localStorage
 */
export function getAllSessions(): ScanningSession[] {
  const stored = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored);
  } catch (err) {
    console.error('Failed to parse sessions:', err);
    return [];
  }
}

/**
 * Get session summaries (lighter weight for listing)
 */
export function getSessionSummaries(): SessionSummary[] {
  const sessions = getAllSessions();
  return sessions.map(session => ({
    id: session.id,
    name: session.name,
    inventoryType: session.inventoryType,
    totalItems: session.items.length,
    scannedCount: session.scannedItemIds.length,
    createdAt: session.createdAt
  }));
}

/**
 * Save a new session
 */
export function saveSession(session: ScanningSession): void {
  const sessions = getAllSessions();
  sessions.push(session);
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
}

/**
 * Update an existing session
 */
export function updateSession(session: ScanningSession): void {
  const sessions = getAllSessions();
  const index = sessions.findIndex(s => s.id === session.id);

  if (index !== -1) {
    sessions[index] = session;
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
  }
}

/**
 * Delete a session
 */
export function deleteSession(sessionId: string): void {
  const sessions = getAllSessions();
  const filtered = sessions.filter(s => s.id !== sessionId);
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(filtered));

  // Clear active session if it's the one being deleted
  const activeId = getActiveSessionId();
  if (activeId === sessionId) {
    clearActiveSession();
  }
}

/**
 * Get a specific session by ID
 */
export function getSession(sessionId: string): ScanningSession | null {
  const sessions = getAllSessions();
  return sessions.find(s => s.id === sessionId) || null;
}

/**
 * Set the active session ID
 */
export function setActiveSession(sessionId: string): void {
  localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
}

/**
 * Get the active session ID
 */
export function getActiveSessionId(): string | null {
  return localStorage.getItem(ACTIVE_SESSION_KEY);
}

/**
 * Get the active session
 */
export function getActiveSession(): ScanningSession | null {
  const activeId = getActiveSessionId();
  if (!activeId) return null;
  return getSession(activeId);
}

/**
 * Clear the active session
 */
export function clearActiveSession(): void {
  localStorage.removeItem(ACTIVE_SESSION_KEY);
}

/**
 * Mark an item as scanned in a session
 */
export function markItemScannedInSession(sessionId: string, itemId: string): boolean {
  const session = getSession(sessionId);
  if (!session) return false;

  if (!session.scannedItemIds.includes(itemId)) {
    session.scannedItemIds.push(itemId);
    updateSession(session);
  }

  return true;
}

/**
 * Mark multiple items as scanned in a session
 */
export function markItemsScannedInSession(sessionId: string, itemIds: string[]): boolean {
  const session = getSession(sessionId);
  if (!session) return false;

  itemIds.forEach(itemId => {
    if (!session.scannedItemIds.includes(itemId)) {
      session.scannedItemIds.push(itemId);
    }
  });

  updateSession(session);
  return true;
}

/**
 * Check if an item is scanned in a session
 */
export function isItemScannedInSession(sessionId: string, itemId: string): boolean {
  const session = getSession(sessionId);
  if (!session) return false;
  return session.scannedItemIds.includes(itemId);
}

/**
 * Get unscanned items in a session
 */
export function getUnscannedItems(sessionId: string) {
  const session = getSession(sessionId);
  if (!session) return [];

  return session.items.filter(item => !session.scannedItemIds.includes(item.id!));
}

/**
 * Get scanned items in a session
 */
export function getScannedItems(sessionId: string) {
  const session = getSession(sessionId);
  if (!session) return [];

  return session.items.filter(item => session.scannedItemIds.includes(item.id!));
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
