// Seasonal sample packs: May move-out and July arrivals. Runs when a world is
// created (with the visitor's swoop_demo_date) and when the date changes.
// Pack doc ids start with 'season-', so they stay out of the change log.
//
// applySeason removes every season doc that is not in this date's pack and
// seeds the pack's docs that are missing, in one write. Running it twice is a
// no-op, and docs without the prefix (the visitor's own posts and saves) are
// never touched. Writes go straight to world.db's store: no transaction.

import { buildSeasonPack, type SeasonPack, type SeasonPackId } from '../../campus/fixtures/seasonal.ts';
import { CAMPUS_COLLECTIONS } from '../../campus/constants.ts';
import { isSeasonDocId } from '../contract.ts';
import type { DemoDateId } from '../contract.ts';
import { demoInstant } from '../season.ts';
import type { DemoWorld } from './world.ts';

type DocData = Record<string, unknown>;

/** The season pack for a demo date. 'nov' has none. */
export function seasonPackFor(dateId: DemoDateId): SeasonPackId | null {
  return dateId === 'may' || dateId === 'july' ? dateId : null;
}

/** Firestore rejects undefined; optional fields are dropped (as fakeSeed does). */
function withoutUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutUndefined);
  if (!value || typeof value !== 'object' || typeof (value as { toMillis?: unknown }).toMillis === 'function') return value;
  return Object.fromEntries(
    Object.entries(value as DocData)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, withoutUndefined(item)]),
  );
}

/** Document path -> data for every doc in the pack. */
export function seasonPackDocs(pack: SeasonPack): Map<string, DocData> {
  const docs = new Map<string, DocData>();
  const add = (collection: string, entries: readonly { id: string; data: object }[]) => {
    for (const entry of entries) docs.set(`${collection}/${entry.id}`, withoutUndefined(entry.data) as DocData);
  };
  add(CAMPUS_COLLECTIONS.market, pack.market);
  add(CAMPUS_COLLECTIONS.housing, pack.housing);
  add(CAMPUS_COLLECTIONS.deals, pack.deals);
  return docs;
}

/** True when a path's own doc id carries the season prefix. */
function isSeasonPath(path: string): boolean {
  const segments = path.split('/');
  return segments.length % 2 === 0 && isSeasonDocId(segments[segments.length - 1]);
}

/**
 * Swaps the world's seasonal pack to this demo date's. `nowMs` is the real
 * clock (default: now); the pack's move-in and travel dates follow the demo instant.
 */
export function applySeason(world: DemoWorld, dateId: DemoDateId, nowMs: number = Date.now()): void {
  const packId = seasonPackFor(dateId);
  const now = new Date(nowMs);
  const wanted = packId ? seasonPackDocs(buildSeasonPack(packId, now, demoInstant(dateId, now))) : new Map<string, DocData>();

  const store = world.db.store;
  const writes: Parameters<typeof store.commit>[0] = [];
  for (const path of store.docs.keys()) {
    if (isSeasonPath(path) && !wanted.has(path)) writes.push({ kind: 'delete', path });
  }
  for (const [path, data] of wanted) {
    if (!store.docs.has(path)) writes.push({ kind: 'set', path, data, merge: false });
  }
  if (writes.length > 0) store.commit(writes);
}
