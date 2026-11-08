// The browser's copy of a demo visitor's changes: one overlay in IndexedDB
// ('swoop-demo'), built by merging each change set the server sends
// (GET /api/demo/state). After a server restart it is posted back, so the
// visitor's changes come back. Only this browser profile ever sees it.
//
// Nothing here touches window or indexedDB at import. mergeOverlay is pure,
// so node tests can import this file.

import type { DemoOverlay, OverlayDoc, OverlayFile } from '../server/overlay.ts';

export type { DemoOverlay, OverlayDoc, OverlayFile };

export const DEMO_IDB_NAME = 'swoop-demo';
const IDB_VERSION = 1;
const IDB_STORE = 'overlay';
const IDB_KEY = 'current';

/** True when the overlay holds any doc or file change worth restoring. */
export function hasOverlayChanges(overlay: DemoOverlay | null | undefined): overlay is DemoOverlay {
  return !!overlay && (overlay.docs.length > 0 || overlay.files.length > 0);
}

/**
 * Merges a change set into the overlay. The newer value for a path wins and
 * moves to the end, so the overlay stays in change order. The result takes the
 * change set's bootId and rev. A change set older than the overlay (same boot,
 * lower rev, say from another tab's slower pull) is ignored.
 */
export function mergeOverlay(base: DemoOverlay | null, changes: DemoOverlay): DemoOverlay {
  if (base && base.bootId === changes.bootId && changes.rev < base.rev) return base;
  const docs = new Map<string, OverlayDoc>();
  for (const doc of base?.docs ?? []) docs.set(doc.path, doc);
  for (const doc of changes.docs) {
    docs.delete(doc.path);
    docs.set(doc.path, doc);
  }
  const files = new Map<string, OverlayFile>();
  for (const file of base?.files ?? []) files.set(file.name, file);
  for (const file of changes.files) {
    files.delete(file.name);
    files.set(file.name, file);
  }
  return { bootId: changes.bootId, rev: changes.rev, docs: [...docs.values()], files: [...files.values()] };
}

// ---------------------------------------------------------------------------
// IndexedDB

/** Set by resetDemo: no more writes, so nothing is saved again after the store is deleted. */
let halted = false;

export function haltPersistence(): void {
  halted = true;
}

export function resumePersistence(): void {
  halted = false;
}

export function isPersistenceHalted(): boolean {
  return halted;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DEMO_IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IDB_STORE)) request.result.createObjectStore(IDB_STORE);
    };
    request.onsuccess = () => {
      const db = request.result;
      // Let a delete (resetDemo, another tab) go through.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

/** Runs one transaction and closes the connection once it completes. */
async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, done: (value: T) => void) => void): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE, mode);
      let result: T;
      run(transaction.objectStore(IDB_STORE), (value) => {
        result = value;
      });
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    });
  } finally {
    db.close();
  }
}

function isOverlay(value: unknown): value is DemoOverlay {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DemoOverlay>;
  return typeof candidate.bootId === 'string' && typeof candidate.rev === 'number' && Array.isArray(candidate.docs) && Array.isArray(candidate.files);
}

/** The saved overlay, or null when there is none or IndexedDB is unavailable. */
export async function loadOverlay(): Promise<DemoOverlay | null> {
  if (!hasIndexedDb()) return null;
  return withStore<DemoOverlay | null>('readonly', (store, done) => {
    const request = store.get(IDB_KEY);
    request.onsuccess = () => done(isOverlay(request.result) ? request.result : null);
  });
}

/**
 * Merges a change set into the saved overlay in one transaction and returns
 * the result. Does nothing while halted (returns null).
 */
export async function saveChanges(changes: DemoOverlay): Promise<DemoOverlay | null> {
  if (halted || !hasIndexedDb()) return null;
  return withStore<DemoOverlay | null>('readwrite', (store, done) => {
    const request = store.get(IDB_KEY);
    request.onsuccess = () => {
      if (halted) {
        done(null);
        return;
      }
      const merged = mergeOverlay(isOverlay(request.result) ? request.result : null, changes);
      store.put(merged, IDB_KEY);
      done(merged);
    };
  });
}

/** Replaces the saved overlay. Does nothing while halted. */
export async function replaceOverlay(overlay: DemoOverlay): Promise<void> {
  if (halted || !hasIndexedDb()) return;
  await withStore<void>('readwrite', (store) => {
    store.put(overlay, IDB_KEY);
  });
}

/** Deletes the whole 'swoop-demo' database. Resolves even if it cannot (gives up after 3 s). */
export function deleteOverlayStore(): Promise<void> {
  if (!hasIndexedDb()) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 3_000);
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    const request = indexedDB.deleteDatabase(DEMO_IDB_NAME);
    request.onsuccess = finish;
    request.onerror = finish;
  });
}
