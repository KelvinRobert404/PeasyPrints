// A visitor's changes, carried between the server's in-memory world and the
// browser. The browser keeps the overlay (src/lib/demo/client/persist.ts) and
// posts it back when the server has restarted, so a visitor's saves, requests
// and joins survive `npm run demo` restarts without the server keeping state.
//
// exportChanges reads the current data for every doc and file changed after a
// rev. importOverlay writes an overlay into a world without logging it.
//
// Server only. Node tests import it, so runtime imports are relative.

import type { Firestore } from 'firebase-admin/firestore';
import { decodeData, encodeData } from '../codec.ts';
import type { CodecHooks, WireMap } from '../codec.ts';
import { isSeasonDocId } from '../contract.ts';
import { adminCodecHooks } from './clientQuery.ts';
import { changesSince } from './world.ts';
import type { DemoWorld } from './world.ts';

/** Most docs and files one overlay may carry. */
export const OVERLAY_MAX_DOCS = 5_000;
export const OVERLAY_MAX_FILES = 300;
/**
 * Largest POST /api/demo/state body. Files travel as base64. Under the proxy's
 * 10 MB body buffer, so a cut-off body is refused as too large, never misread.
 * The browser splits bigger overlays into several posts.
 */
export const OVERLAY_MAX_BODY_BYTES = 9_000_000;

const MAX_DOC_PATH_LENGTH = 1_500;
const MAX_FILE_NAME_LENGTH = 1_024;
const MAX_CONTENT_TYPE_LENGTH = 255;
const BOOT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// ---------------------------------------------------------------------------
// Types

export interface OverlayDoc {
  path: string;
  /** The doc's fields in the codec's wire format, or null when it was deleted. */
  data: WireMap | null;
}

export interface OverlayFile {
  name: string;
  /** The file's bytes, or null when it was deleted. */
  base64: string | null;
  /** Empty for a deleted file. */
  contentType: string;
}

/** A change set from the server, or the browser's merged overlay. */
export interface DemoOverlay {
  bootId: string;
  rev: number;
  docs: OverlayDoc[];
  files: OverlayFile[];
}

export class OverlayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OverlayError';
  }
}

// ---------------------------------------------------------------------------
// Paths

/** Docs the overlay carries: not server internals ('_*') and not seasonal pack docs. */
export function isOverlayDocPath(path: string): boolean {
  if (path.length === 0 || path.length > MAX_DOC_PATH_LENGTH) return false;
  const segments = path.split('/');
  if (segments.length % 2 !== 0) return false;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment === '' || segment === '.' || segment === '..' || /^__.*__$/.test(segment)) return false;
    if (index % 2 === 0 && segment.startsWith('_')) return false;
    if (index % 2 === 1 && isSeasonDocId(segment)) return false;
  }
  return true;
}

function isOverlayFileName(name: string): boolean {
  return name.length > 0 && name.length <= MAX_FILE_NAME_LENGTH && !name.includes('\0');
}

function worldHooks(world: DemoWorld): CodecHooks {
  return adminCodecHooks(world.db as unknown as Firestore);
}

// ---------------------------------------------------------------------------
// Export

/** The current data of every doc and file changed after `sinceRev`, oldest change first. */
export function exportChanges(world: DemoWorld, sinceRev: number): DemoOverlay {
  const changes = changesSince(world, sinceRev);
  const hooks = worldHooks(world);
  const docs: OverlayDoc[] = [];
  for (const path of changes.docs) {
    if (!isOverlayDocPath(path)) continue;
    const stored = world.db.store.docs.get(path);
    if (!stored) {
      docs.push({ path, data: null });
      continue;
    }
    try {
      docs.push({ path, data: encodeData(stored.data, hooks) });
    } catch (error) {
      console.error(`[demo] Could not export ${path}`, error);
    }
  }
  const files: OverlayFile[] = [];
  for (const name of changes.files) {
    if (!isOverlayFileName(name)) continue;
    const stored = world.bucket.store.files.get(name);
    files.push(stored ? { name, base64: stored.content.toString('base64'), contentType: stored.contentType } : { name, base64: null, contentType: '' });
  }
  return { bootId: changes.bootId, rev: changes.rev, docs, files };
}

// ---------------------------------------------------------------------------
// Parse

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Checks an overlay posted by the browser. Throws OverlayError when anything is off. */
export function parseOverlay(value: unknown): DemoOverlay {
  if (!isRecord(value)) throw new OverlayError('Overlay must be an object');
  const { bootId, rev, docs, files } = value;
  if (typeof bootId !== 'string' || !BOOT_ID_PATTERN.test(bootId)) throw new OverlayError('Invalid bootId');
  if (typeof rev !== 'number' || !Number.isSafeInteger(rev) || rev < 0) throw new OverlayError('Invalid rev');
  if (!Array.isArray(docs) || docs.length > OVERLAY_MAX_DOCS) throw new OverlayError('Invalid docs');
  if (!Array.isArray(files) || files.length > OVERLAY_MAX_FILES) throw new OverlayError('Invalid files');

  const cleanDocs: OverlayDoc[] = docs.map((entry) => {
    if (!isRecord(entry) || typeof entry.path !== 'string') throw new OverlayError('Invalid doc');
    if (!isOverlayDocPath(entry.path)) throw new OverlayError(`Doc not allowed: ${entry.path}`);
    if (entry.data !== null && !isRecord(entry.data)) throw new OverlayError(`Invalid data for ${entry.path}`);
    return { path: entry.path, data: entry.data as WireMap | null };
  });
  const cleanFiles: OverlayFile[] = files.map((entry) => {
    if (!isRecord(entry) || typeof entry.name !== 'string' || !isOverlayFileName(entry.name)) throw new OverlayError('Invalid file');
    if (entry.base64 !== null && typeof entry.base64 !== 'string') throw new OverlayError(`Invalid content for ${entry.name}`);
    if (typeof entry.contentType !== 'string' || entry.contentType.length > MAX_CONTENT_TYPE_LENGTH) throw new OverlayError(`Invalid content type for ${entry.name}`);
    return { name: entry.name, base64: entry.base64, contentType: entry.contentType };
  });
  return { bootId, rev, docs: cleanDocs, files: cleanFiles };
}

// ---------------------------------------------------------------------------
// Import

type DocWrite = { kind: 'set'; path: string; data: Record<string, unknown>; merge: false } | { kind: 'delete'; path: string };

/**
 * Writes an overlay into the world, all docs at once, without logging them as
 * new changes. Runs after any transaction already queued in the world. Throws
 * OverlayError on bad data, and then writes nothing.
 */
export async function importOverlay(world: DemoWorld, overlay: DemoOverlay): Promise<void> {
  const hooks = worldHooks(world);
  const writes: DocWrite[] = overlay.docs.map((doc) => {
    if (doc.data === null) return { kind: 'delete', path: doc.path };
    try {
      return { kind: 'set', path: doc.path, data: decodeData(doc.data, hooks), merge: false };
    } catch (error) {
      throw new OverlayError(`Invalid data for ${doc.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  const files = overlay.files.map((file) => {
    if (file.base64 === null) return { name: file.name, content: null };
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64)) throw new OverlayError(`Invalid content for ${file.name}`);
    return { name: file.name, content: Buffer.from(file.base64, 'base64'), contentType: file.contentType || 'application/octet-stream' };
  });

  await world.db.store.serialize(async () => {
    // Paused by hand, not with withChangeLogPaused: the writes below are
    // synchronous, so no other request's write can slip in while paused.
    world.logPaused += 1;
    try {
      if (writes.length > 0) {
        try {
          world.db.store.commit(writes as Parameters<typeof world.db.store.commit>[0]);
        } catch (error) {
          throw new OverlayError(`Could not restore docs: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      const now = new Date();
      for (const file of files) {
        if (file.content === null) {
          world.bucket.store.files.delete(file.name);
          continue;
        }
        const previous = world.bucket.store.files.get(file.name);
        world.bucket.store.files.set(file.name, {
          content: file.content,
          contentType: file.contentType ?? 'application/octet-stream',
          cacheControl: undefined,
          metadata: {},
          created: previous?.created ?? now,
          updated: now,
        });
      }
    } finally {
      world.logPaused -= 1;
    }
  });
}
