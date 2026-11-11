import { SavedPdfSession } from '../types';

const DAILY_USAGE_STORAGE_KEY = 'gemini_daily_requests_usage';
const SESSION_PREFIX = 'gemini_pdf_session_';

const SESSION_DB_NAME = 'pdf-extractor-sessions';
const SESSION_STORE = 'sessions';

/**
 * Returns current date string in Pacific Time (America/Los_Angeles)
 * Format: YYYY-MM-DD
 * This accurately aligns with Google Gemini API free-tier midnight reset boundary.
 */
export function getPacificDateString(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    // Fallback if Intl timeZone is not supported
    const isDst = date.getUTCMonth() >= 2 && date.getUTCMonth() <= 10;
    const ptOffset = isDst ? -7 : -8;
    const ptTime = new Date(date.getTime() + ptOffset * 3600000);
    return ptTime.toISOString().slice(0, 10);
  }
}

/**
 * Gets requests used today (resetting if date changed in Pacific Time)
 */
export function getRequestsUsedToday(): number {
  try {
    const raw = localStorage.getItem(DAILY_USAGE_STORAGE_KEY);
    if (!raw) return 0;

    const parsed = JSON.parse(raw);
    const todayPt = getPacificDateString();

    if (parsed.date !== todayPt) {
      // New day in Pacific Time: auto-reset
      localStorage.setItem(
        DAILY_USAGE_STORAGE_KEY,
        JSON.stringify({ date: todayPt, count: 0 })
      );
      return 0;
    }

    return typeof parsed.count === 'number' ? parsed.count : 0;
  } catch (err) {
    console.warn('Storage read error (getRequestsUsedToday):', err);
    return 0;
  }
}

/**
 * Increments requests used today count
 */
export function incrementRequestsUsedToday(delta = 1): number {
  try {
    const todayPt = getPacificDateString();
    const current = getRequestsUsedToday();
    const updated = current + delta;
    localStorage.setItem(
      DAILY_USAGE_STORAGE_KEY,
      JSON.stringify({ date: todayPt, count: updated })
    );
    return updated;
  } catch (err) {
    console.warn('Storage write error (incrementRequestsUsedToday):', err);
    return 0;
  }
}

/**
 * Generates storage key for a specific PDF file
 * (used for both IndexedDB and the legacy localStorage format)
 */
export function getSessionStorageKey(fileName: string, fileSizeBytes: number): string {
  return `${SESSION_PREFIX}${encodeURIComponent(fileName)}_${fileSizeBytes}`;
}

/* -------------------------------------------------------------------------- */
/*  Legacy localStorage session helpers (read-only fallback + cleanup)         */
/* -------------------------------------------------------------------------- */

function loadLegacySession(fileName: string, fileSizeBytes: number): SavedPdfSession | null {
  try {
    const key = getSessionStorageKey(fileName, fileSizeBytes);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as SavedPdfSession;
  } catch (err) {
    console.warn('Could not load legacy PDF session from localStorage:', err);
    return null;
  }
}

function clearLegacySession(fileName: string, fileSizeBytes: number): void {
  try {
    const key = getSessionStorageKey(fileName, fileSizeBytes);
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('Could not clear legacy PDF session:', err);
  }
}

/* -------------------------------------------------------------------------- */
/*  IndexedDB session persistence                                              */
/* -------------------------------------------------------------------------- */

function openSessionDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB không khả dụng'));
      return;
    }
    const req = indexedDB.open(SESSION_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(SESSION_STORE)) {
        req.result.createObjectStore(SESSION_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Không mở được IndexedDB'));
  });
}

async function idbRun<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openSessionDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE, mode);
      const req = fn(tx.objectStore(SESSION_STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error ?? new Error('Lỗi giao dịch IndexedDB'));
      tx.onabort = () => reject(tx.error ?? new Error('Giao dịch IndexedDB bị hủy'));
    });
  } finally {
    db.close();
  }
}

/**
 * Persists completed chunks session to IndexedDB.
 * Never throws: on failure (e.g. quota exceeded) only a warning is logged.
 */
export async function savePdfSession(session: SavedPdfSession): Promise<void> {
  try {
    await idbRun('readwrite', (store) =>
      store.put(session, getSessionStorageKey(session.fileName, session.fileSizeBytes))
    );
  } catch (err) {
    console.warn('Could not save PDF session to IndexedDB:', err);
  }
}

/**
 * Loads saved PDF session from IndexedDB; if absent, falls back to the old
 * localStorage format and migrates it to IndexedDB.
 */
export async function loadPdfSession(
  fileName: string,
  fileSizeBytes: number
): Promise<SavedPdfSession | null> {
  try {
    const found = await idbRun<SavedPdfSession | undefined>('readonly', (store) =>
      store.get(getSessionStorageKey(fileName, fileSizeBytes))
    );
    if (found) return found;
  } catch (err) {
    console.warn('Could not load PDF session from IndexedDB:', err);
  }

  // Fallback: sessions saved by the previous version in localStorage
  try {
    const legacy = loadLegacySession(fileName, fileSizeBytes);
    if (legacy) {
      await savePdfSession(legacy); // migrate to IndexedDB
      clearLegacySession(fileName, fileSizeBytes);
      return legacy;
    }
  } catch (err) {
    console.warn('Ignoring unreadable legacy PDF session:', err);
  }
  return null;
}

/**
 * Clears saved session for a PDF file (IndexedDB and legacy localStorage)
 */
export async function clearPdfSession(fileName: string, fileSizeBytes: number): Promise<void> {
  try {
    await idbRun('readwrite', (store) =>
      store.delete(getSessionStorageKey(fileName, fileSizeBytes))
    );
  } catch (err) {
    console.warn('Could not clear PDF session from IndexedDB:', err);
  }
  clearLegacySession(fileName, fileSizeBytes);
}