'use client';

// Keeps the demo visitor's changes in this browser. Pulls the server's change
// set after every same-origin /api write and every 15 s while the tab is
// visible, and merges it into IndexedDB. When the server has restarted (its
// world is fresh) and this browser holds changes, posts them back and reloads
// once so the page shows them. Renders nothing. Mounted by DemoRoot (demo only).

import { useEffect } from 'react';
import {
  hasOverlayChanges,
  isPersistenceHalted,
  loadOverlay,
  replaceOverlay,
  saveChanges,
  type DemoOverlay,
} from '@/lib/demo/client/persist';

const STATE_URL = '/api/demo/state';
const FIRESTORE_URL = '/api/demo/firestore';
const PULL_INTERVAL_MS = 15_000;
const PULL_DEBOUNCE_MS = 300;
const RELOADED_KEY_PREFIX = 'swoop-demo:restored:';
const RESTORE_CHUNK_CHARS = 4_000_000;
const RESTORE_CHUNK_ENTRIES = 1_000;
const RESTORE_MAX_FILE_CHARS = 8_500_000;
/** Calls that never trigger a pull: our own, and the reset. */
const UNWATCHED_PATHS: ReadonlySet<string> = new Set([STATE_URL, '/api/demo/reset']);

// ---------------------------------------------------------------------------
// fetch, wrapped once per page (kept on window so dev reloads never wrap twice)

interface FetchWatch {
  native: typeof fetch;
  listeners: Set<() => void>;
}

const watchHost = globalThis as typeof globalThis & { __swoopDemoFetchWatch?: FetchWatch };

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  const method = init?.method ?? (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET');
  return method.toUpperCase();
}

/** The Firebase stand-in posts its reads too (snapshot polls every few seconds): those change nothing. */
function isFirestoreRead(pathname: string, init?: RequestInit): boolean {
  if (pathname !== FIRESTORE_URL || typeof init?.body !== 'string') return false;
  try {
    return (JSON.parse(init.body) as { op?: unknown } | null)?.op === 'read';
  } catch {
    return false;
  }
}

function isWatchedWrite(input: RequestInfo | URL, init?: RequestInit): boolean {
  const method = requestMethod(input, init);
  if (method === 'GET' || method === 'HEAD') return false;
  try {
    const url = new URL(requestUrl(input), window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return false;
    return !UNWATCHED_PATHS.has(url.pathname) && !isFirestoreRead(url.pathname, init);
  } catch {
    return false;
  }
}

function fetchWatch(): FetchWatch {
  if (watchHost.__swoopDemoFetchWatch) return watchHost.__swoopDemoFetchWatch;
  const native = window.fetch.bind(window);
  const watch: FetchWatch = { native, listeners: new Set() };
  const notify = () => {
    for (const listener of watch.listeners) listener();
  };
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const response = native(input, init);
    if (isWatchedWrite(input, init)) response.then(notify, notify);
    return response;
  };
  watchHost.__swoopDemoFetchWatch = watch;
  return watch;
}

/** The fetch from before the wrap, so our own calls never trigger a pull. */
function nativeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetchWatch().native(input, init);
}

// ---------------------------------------------------------------------------
// Pulls

interface FreshReply {
  fresh: true;
  bootId: string;
  rev: number;
}

function isFreshReply(value: unknown): value is FreshReply {
  return !!value && typeof value === 'object' && (value as { fresh?: unknown }).fresh === true;
}

function isChangeSet(value: unknown): value is DemoOverlay {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DemoOverlay>;
  return typeof candidate.bootId === 'string' && typeof candidate.rev === 'number' && Array.isArray(candidate.docs) && Array.isArray(candidate.files);
}

async function getState(query: string): Promise<unknown> {
  const response = await nativeFetch(`${STATE_URL}${query}`, { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) return null;
  return response.json();
}

/** Reloads the page once per restored world, so a restore can never loop. */
function reloadOnce(bootId: string): void {
  const key = `${RELOADED_KEY_PREFIX}${bootId}`;
  try {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, '1');
  } catch {
    // No sessionStorage: reload anyway; the next pull finds the same boot.
  }
  window.location.reload();
}

/**
 * The overlay split into posts of about RESTORE_CHUNK_CHARS each. The proxy
 * buffers at most 10 MB of a request body, and the route refuses bodies over 9 MB.
 */
function restoreChunks(saved: DemoOverlay): DemoOverlay[] {
  const chunks: DemoOverlay[] = [];
  let current: DemoOverlay = { bootId: saved.bootId, rev: saved.rev, docs: [], files: [] };
  let size = 0;
  const add = (entrySize: number, put: (chunk: DemoOverlay) => void) => {
    const count = current.docs.length + current.files.length;
    if (count > 0 && (size + entrySize > RESTORE_CHUNK_CHARS || count >= RESTORE_CHUNK_ENTRIES)) {
      chunks.push(current);
      current = { bootId: saved.bootId, rev: saved.rev, docs: [], files: [] };
      size = 0;
    }
    put(current);
    size += entrySize;
  };
  for (const doc of saved.docs) add(JSON.stringify(doc).length, (chunk) => chunk.docs.push(doc));
  for (const file of saved.files) {
    if ((file.base64?.length ?? 0) > RESTORE_MAX_FILE_CHARS) {
      console.warn(`[demo] ${file.name} is too large to restore.`);
      continue;
    }
    add(file.name.length + (file.base64?.length ?? 0) + 100, (chunk) => chunk.files.push(file));
  }
  chunks.push(current);
  return chunks;
}

/** Posts the saved overlay to the fresh world, saves what comes back, reloads once. */
async function restore(saved: DemoOverlay): Promise<void> {
  let response: Response | null = null;
  for (const chunk of restoreChunks(saved)) {
    if (isPersistenceHalted()) return;
    response = await nativeFetch(STATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (response.status === 400) {
      // The saved changes no longer fit this build of the demo: start over from the server.
      console.warn('[demo] Saved demo changes could not be restored. Starting from sample data.');
      const all = await getState('?since=0');
      if (isChangeSet(all)) await replaceOverlay(all);
      return;
    }
    // Anything else (a restart mid-way, say): the next pull tries the whole overlay again.
    if (!response.ok) return;
  }
  if (!response) return;
  const changes: unknown = await response.json();
  if (!isChangeSet(changes)) return;
  const merged = await saveChanges(changes);
  if (merged) reloadOnce(changes.bootId);
}

async function pull(): Promise<void> {
  if (isPersistenceHalted()) return;
  const saved = await loadOverlay();
  const reply = await getState(saved ? `?since=${saved.rev}&boot=${encodeURIComponent(saved.bootId)}` : '?since=0');
  if (isPersistenceHalted()) return;
  if (isFreshReply(reply)) {
    if (hasOverlayChanges(saved)) {
      await restore(saved);
      return;
    }
    const all = await getState('?since=0');
    if (isChangeSet(all)) await replaceOverlay(all);
    return;
  }
  if (!isChangeSet(reply)) return;
  const unchanged = saved && saved.bootId === reply.bootId && saved.rev === reply.rev && reply.docs.length === 0 && reply.files.length === 0;
  if (!unchanged) await saveChanges(reply);
}

// One pull at a time; a request during a pull runs one more afterwards.
let running: Promise<void> | null = null;
let queued = false;

function requestPull(): void {
  if (running) {
    queued = true;
    return;
  }
  running = (async () => {
    try {
      do {
        queued = false;
        try {
          await pull();
        } catch {
          // Offline or mid-restart: the next pull tries again.
        }
      } while (queued && !isPersistenceHalted());
    } finally {
      running = null;
    }
  })();
}

// ---------------------------------------------------------------------------

export function DemoPersistence() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const pullSoon = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        requestPull();
      }, PULL_DEBOUNCE_MS);
    };
    const pullIfVisible = () => {
      if (document.visibilityState === 'visible') requestPull();
    };

    const { listeners } = fetchWatch();
    listeners.add(pullSoon);
    const interval = setInterval(pullIfVisible, PULL_INTERVAL_MS);
    document.addEventListener('visibilitychange', pullIfVisible);
    requestPull();

    return () => {
      listeners.delete(pullSoon);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', pullIfVisible);
      if (timer !== null) clearTimeout(timer);
    };
  }, []);

  return null;
}
