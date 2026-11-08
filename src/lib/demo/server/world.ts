// One fake world per demo visitor: a seeded FakeFirestore and FakeBucket, a
// change log, and the hooks that make the world move (print progress, demo
// life, seasonal packs). getAdminDb() and getAdminBucket() resolve to the
// current visitor's world in demo mode (src/lib/firebase/admin.ts).
//
// The world is picked by the swoop_demo_visitor cookie. Outside a request
// (setTimeout, after()) there is no cookie, so the shared 'default' world is
// used with one warning.
//
// Server only. Node tests import it, so runtime imports are relative.

import { AsyncLocalStorage } from 'node:async_hooks';
import { FakeBucket, FakeFirestore, fixtureBucketName } from '../../firebase/fakeAdmin.ts';
import { seedFakeDb } from '../../firebase/fakeSeed.ts';
import { DEFAULT_DEMO_DATE, DEMO_DATE_COOKIE, DEMO_VISITOR_COOKIE, isSeasonDocId, parseDemoDate } from '../contract.ts';
import type { DemoDateId } from '../contract.ts';
import { tickLife } from './life.ts';
import { tickOrders } from './orderProgress.ts';
import { applySeason } from './seasonPack.ts';

export const DEFAULT_WORLD_ID = 'default';
/** Worlds kept in memory; past this the least recently used one is dropped. */
export const MAX_WORLDS = 50;
/** tickOrders and tickLife run at most this often per world. */
export const WORLD_TICK_INTERVAL_MS = 2_000;

/** Collections whose writes never reach the change log. Season pack docs ('season-*') are left out too. */
const UNLOGGED_COLLECTIONS: ReadonlySet<string> = new Set(['_rate_limits', 'payment_idempotency']);

const VISITOR_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// ---------------------------------------------------------------------------
// Types

export type DemoChangeKind = 'doc' | 'file';

export interface DemoChange {
  rev: number;
  kind: DemoChangeKind;
  /** A document path, or a file name in the bucket. */
  path: string;
}

export interface DemoChangeSet {
  bootId: string;
  rev: number;
  /** Document paths changed after the given rev, oldest change first. */
  docs: string[];
  /** Bucket file names changed after the given rev, oldest change first. */
  files: string[];
}

export interface DemoWorld {
  readonly id: string;
  /** New each time the world is created, so the browser can tell a restart. */
  readonly bootId: string;
  /** Epoch ms when the world was created. */
  readonly createdAt: number;
  readonly db: FakeFirestore;
  readonly bucket: FakeBucket;
  /** Goes up by one for each logged write. */
  rev: number;
  /** The latest change per doc path or file name, oldest first. Keys are `${kind}:${path}`. */
  readonly changes: Map<string, DemoChange>;
  /** Settles once applySeason has run for the new world. */
  ready: Promise<void>;
  /** Epoch ms of the last tick. */
  lastTickAt: number;
  /** While above 0, writes are not logged (see withChangeLogPaused). */
  logPaused: number;
}

export interface WorldHooks {
  tickOrders: (world: DemoWorld, nowMs: number) => void | Promise<void>;
  tickLife: (world: DemoWorld, nowMs: number) => void | Promise<void>;
  applySeason: (world: DemoWorld, dateId: DemoDateId) => void | Promise<void>;
}

/** Anything with a `get(name)` that returns `{ value }`, like `await cookies()`. */
export interface DemoCookieReader {
  get(name: string): { value: string } | undefined;
}

/** Gives the current request's cookies, or null outside a request. */
export type DemoCookieSource = () => Promise<DemoCookieReader | null>;

export interface GetWorldOptions {
  /** The clock the seed uses. Default: now. */
  now?: Date;
  /** The demo date for the seasonal pack, used only when the world is created. Default: 'nov'. */
  dateId?: DemoDateId;
}

// ---------------------------------------------------------------------------
// Registry, kept on globalThis so dev reloads and separately bundled routes
// share the same worlds.

interface WorldRegistry {
  worlds: Map<string, DemoWorld>;
  warnedDefault: boolean;
  /** The world id whose hook is running, so calls made by the hook skip the ticks. */
  hookScope: AsyncLocalStorage<string>;
}

const registryGlobal = globalThis as typeof globalThis & { __swoopDemoWorlds?: WorldRegistry };

function registry(): WorldRegistry {
  if (!registryGlobal.__swoopDemoWorlds) {
    registryGlobal.__swoopDemoWorlds = { worlds: new Map(), warnedDefault: false, hookScope: new AsyncLocalStorage<string>() };
  }
  return registryGlobal.__swoopDemoWorlds;
}

const defaultHooks: WorldHooks = { tickOrders, tickLife, applySeason };
let hooks: WorldHooks = defaultHooks;
let cookieSourceOverride: DemoCookieSource | null = null;

async function runHook(world: DemoWorld, name: keyof WorldHooks, run: () => void | Promise<void>): Promise<void> {
  try {
    await registry().hookScope.run(world.id, run);
  } catch (error) {
    console.error(`[demo] ${name} failed in world ${world.id}`, error);
  }
}

// ---------------------------------------------------------------------------
// Change log

function isLoggedDocPath(path: string): boolean {
  const segments = path.split('/');
  if (UNLOGGED_COLLECTIONS.has(segments[0])) return false;
  for (let index = 1; index < segments.length; index += 2) {
    if (isSeasonDocId(segments[index])) return false;
  }
  return true;
}

function logChanges(world: DemoWorld, kind: DemoChangeKind, paths: string[]): void {
  if (world.logPaused > 0) return;
  const logged = kind === 'doc' ? paths.filter(isLoggedDocPath) : paths;
  if (logged.length === 0) return;
  world.rev += 1;
  for (const path of logged) {
    const key = `${kind}:${path}`;
    world.changes.delete(key);
    world.changes.set(key, { rev: world.rev, kind, path });
  }
}

/** The docs and files changed after `since`, each listed once. */
export function changesSince(world: DemoWorld, since: number): DemoChangeSet {
  const recent: DemoChange[] = [];
  const entries = [...world.changes.values()];
  for (let index = entries.length - 1; index >= 0 && entries[index].rev > since; index -= 1) recent.push(entries[index]);
  recent.reverse();
  return {
    bootId: world.bootId,
    rev: world.rev,
    docs: recent.filter((change) => change.kind === 'doc').map((change) => change.path),
    files: recent.filter((change) => change.kind === 'file').map((change) => change.path),
  };
}

/** Runs `task` without logging its writes, for example to restore a saved overlay. */
export async function withChangeLogPaused<T>(world: DemoWorld, task: () => Promise<T>): Promise<T> {
  world.logPaused += 1;
  try {
    return await task();
  } finally {
    world.logPaused -= 1;
  }
}

// ---------------------------------------------------------------------------
// Worlds

function createWorld(id: string, now: Date, dateId: DemoDateId): DemoWorld {
  const db = new FakeFirestore();
  seedFakeDb(db, now);
  const world: DemoWorld = {
    id,
    bootId: globalThis.crypto.randomUUID(),
    createdAt: now.getTime(),
    db,
    bucket: new FakeBucket(fixtureBucketName()),
    rev: 0,
    changes: new Map(),
    ready: Promise.resolve(),
    lastTickAt: Number.NEGATIVE_INFINITY,
    logPaused: 0,
  };
  db.store.onWrite = (paths) => logChanges(world, 'doc', paths);
  world.bucket.store.onChange = (names) => logChanges(world, 'file', names);
  world.ready = runHook(world, 'applySeason', () => hooks.applySeason(world, dateId));
  return world;
}

/** The world for this visitor id, created and seeded on first use. Marks it most recently used. */
export function getWorld(id: string, options: GetWorldOptions = {}): DemoWorld {
  const { worlds } = registry();
  const existing = worlds.get(id);
  if (existing) {
    worlds.delete(id);
    worlds.set(id, existing);
    return existing;
  }
  const world = createWorld(id, options.now ?? new Date(), options.dateId ?? DEFAULT_DEMO_DATE);
  worlds.set(id, world);
  while (worlds.size > MAX_WORLDS) {
    const oldest = worlds.keys().next().value;
    if (oldest === undefined) break;
    worlds.delete(oldest);
  }
  return world;
}

export function hasWorld(id: string): boolean {
  return registry().worlds.has(id);
}

/** Forgets the world; the next access creates a fresh one with a new bootId. */
export function dropWorld(id: string): boolean {
  return registry().worlds.delete(id);
}

/**
 * Runs tickOrders and tickLife, at most once per WORLD_TICK_INTERVAL_MS per world.
 * Skipped while a transaction is running in the world, so a tick never waits on its caller.
 */
export async function touchWorld(world: DemoWorld, nowMs: number = Date.now()): Promise<void> {
  if (nowMs - world.lastTickAt < WORLD_TICK_INTERVAL_MS) return;
  if (world.db.store.busy) return;
  world.lastTickAt = nowMs;
  await runHook(world, 'tickOrders', () => hooks.tickOrders(world, nowMs));
  await runHook(world, 'tickLife', () => hooks.tickLife(world, nowMs));
}

/** Waits for the new world's season pack, then ticks. Calls made from inside a hook skip both. */
export async function openWorld(world: DemoWorld, nowMs: number = Date.now()): Promise<DemoWorld> {
  if (registry().hookScope.getStore() === world.id) return world;
  await world.ready;
  await touchWorld(world, nowMs);
  return world;
}

// ---------------------------------------------------------------------------
// Request context

type NextRequestApis = [typeof import('next/headers'), typeof import('next/navigation')];
let nextApis: Promise<NextRequestApis> | null = null;

/** Reads `await cookies()`, or null outside a request. Next's own control-flow errors are rethrown. */
async function nextCookieSource(): Promise<DemoCookieReader | null> {
  let apis: NextRequestApis;
  try {
    nextApis ??= Promise.all([import('next/headers'), import('next/navigation')]);
    apis = await nextApis;
  } catch {
    return null;
  }
  const [{ cookies }, { unstable_rethrow }] = apis;
  try {
    return await cookies();
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}

function readCookies(): Promise<DemoCookieReader | null> {
  return (cookieSourceOverride ?? nextCookieSource)();
}

function warnDefaultOnce(reason: string): void {
  const state = registry();
  if (state.warnedDefault) return;
  state.warnedDefault = true;
  console.warn(`[demo] ${reason}: using the shared '${DEFAULT_WORLD_ID}' world. Changes made here reach every visitor without a world.`);
}

function worldIdFrom(cookies: DemoCookieReader | null): string {
  if (!cookies) {
    warnDefaultOnce('No request context');
    return DEFAULT_WORLD_ID;
  }
  const raw = cookies.get(DEMO_VISITOR_COOKIE)?.value;
  if (!raw || !VISITOR_ID_PATTERN.test(raw)) {
    warnDefaultOnce(`No valid ${DEMO_VISITOR_COOKIE} cookie`);
    return DEFAULT_WORLD_ID;
  }
  return raw;
}

/** The visitor id from swoop_demo_visitor, or 'default' when missing or outside a request. */
export async function currentWorldId(): Promise<string> {
  return worldIdFrom(await readCookies());
}

/** The current visitor's world: created with their demo date if new, ticked, ready to use. */
export async function currentWorld(): Promise<DemoWorld> {
  const cookies = await readCookies();
  const id = worldIdFrom(cookies);
  const world = getWorld(id, { dateId: parseDemoDate(cookies?.get(DEMO_DATE_COOKIE)?.value) });
  return openWorld(world);
}

// ---------------------------------------------------------------------------
// Test seams

/** Tests only: replaces where cookies come from. Pass null to go back to `await cookies()`. */
export function setDemoCookieSourceForTests(source: DemoCookieSource | null): void {
  cookieSourceOverride = source;
}

/** Tests only: replaces some hooks. Returns a function that restores the real ones. */
export function setWorldHooksForTests(overrides: Partial<WorldHooks>): () => void {
  hooks = { ...defaultHooks, ...overrides };
  return () => {
    hooks = defaultHooks;
  };
}

/** Tests only: drops every world and re-arms the one-time warning. */
export function resetWorldsForTests(): void {
  const state = registry();
  state.worlds.clear();
  state.warnedDefault = false;
}
