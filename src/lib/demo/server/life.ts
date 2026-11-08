// Demo life: the sample students on the other side answer the visitor.
// Called on each world access, at most every 2 s per world (see world.ts).
//
// - A pending contact request to a sample seller is approved 10 s after it
//   was made, as the seller's PATCH would, and the buyer gets an inbox item.
// - A new listing gets one ask from a sample student of the same campus after
//   45 s, written as POST /api/contact-requests writes it, with its notify.
// - A game the visitor is in gets one sample player 20 s after they joined,
//   through the same joinGame rules the games route uses.
//
// Each action happens once: the docs it touches carry a `demoLife` field.
// Rules: work only inside this call (no timers), write through `world.db`,
// never act on docs older than `world.createdAt`, and never call
// `world.db.runTransaction` here, since the caller may already be inside one.
//
// Server only. Node tests import it, so runtime imports are relative. notify.ts
// is loaded lazily (it imports '@/lib/firebase/admin', which imports world.ts).

import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { enqueue as notifyEnqueue, NotifyPayload } from '../../campus/notify.ts';
import { CAMPUS_COLLECTIONS, addHours, CONTACT_REQUEST_HOURS } from '../../campus/constants.ts';
import { FIXTURE_PEOPLE } from '../../campus/fixtures/core.ts';
import { joinGame, type GameRecord } from '../../campus/games.ts';
import { effectiveStatus, type ListingStatus } from '../../campus/listingRules.ts';
import { dedupeKey, nextSlot } from '../../campus/notifySlots.ts';
import { collectionForContentType, intentFor, type CampusContentType } from '../../campus/serial.ts';
import { FIXTURE_USER_IDS } from '../../firebase/fixtureMode.ts';
import { DEMO_SESSION_COOKIE, decodeDemoSession, isSeasonDocId } from '../contract.ts';
import type { DemoWorld } from './world.ts';

/** A visitor's ask to a sample seller is approved this long after it was made. */
export const APPROVE_AFTER_MS = 10_000;
/** A new listing gets its sample ask this long after it was posted. */
export const ASK_AFTER_MS = 45_000;
/** A sample player joins this long after the visitor joined the game. */
export const SEAT_AFTER_MS = 20_000;

/** The collection the contact-request routes read and write. */
export const CONTACT_REQUESTS = 'campus_contact_requests';
/** Per-post WhatsApp numbers, read by the approved-request reveal. */
export const PRIVATE_CONTACTS = 'campus_private_contacts';
const PRIVATE_PROFILES = 'campus_private_profiles';

const CONTENT_TYPES: readonly CampusContentType[] = ['marketplace', 'housing'];
const VISITOR_IDS: ReadonlySet<string> = new Set(FIXTURE_USER_IDS);

type DocData = Record<string, unknown>;
export type LifeEnqueue = typeof notifyEnqueue;

export interface LifeOptions {
  /**
   * The visitor's signed-in uid. Undefined: read from the swoop_demo_session
   * cookie. Null: unknown or signed out, so any persona counts as the visitor.
   */
  visitorUid?: string | null;
}

// ---------------------------------------------------------------------------
// Notify, through src/lib/campus/notify.ts

let enqueueOverride: LifeEnqueue | null = null;
let enqueueLoaded: Promise<LifeEnqueue> | null = null;

function loadEnqueue(): Promise<LifeEnqueue> {
  if (enqueueOverride) return Promise.resolve(enqueueOverride);
  enqueueLoaded ??= import('../../campus/notify.ts').then((module) => module.enqueue);
  return enqueueLoaded;
}

/** Tests only: replaces notify.ts's enqueue (node cannot load '@/' imports). Pass null to restore. */
export function setLifeEnqueueForTests(enqueue: LifeEnqueue | null): void {
  enqueueOverride = enqueue;
}

/**
 * Queues one urgent inbox item, as the routes do. Quiet hours would hold even
 * an urgent item until 07:00 IST; the demo's answers show straight away, so
 * the queued item is moved to now. A failed notify never fails the action.
 */
async function notifyNow(world: DemoWorld, nowMs: number, userId: string, payload: NotifyPayload): Promise<void> {
  try {
    const enqueue = await loadEnqueue();
    const now = new Date(nowMs);
    await enqueue([userId], { ...payload, urgent: true }, { db: world.db as unknown as Firestore, now });
    const slot = nextSlot(now, { urgent: true });
    if (slot.getTime() <= nowMs) return;
    const targetId = payload.ref ? `${payload.ref.type}/${payload.ref.id}` : null;
    const ref = world.db.collection(CAMPUS_COLLECTIONS.notifications).doc(dedupeKey({ userId, type: payload.kind, targetId, slot }));
    if ((await ref.get()).exists) await ref.update({ deliverAfter: Timestamp.fromMillis(nowMs) });
  } catch (error) {
    console.error('[demo] life notify failed', error);
  }
}

// ---------------------------------------------------------------------------
// Small readers

/** Epoch ms from a Timestamp, Date, number or ISO string; null when unreadable. */
function millis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    const ms = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function isoOrNull(value: unknown): string | null {
  const ms = millis(value);
  return ms === null ? null : new Date(ms).toISOString();
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** As liveStatus in src/lib/campus/serialize.ts. */
function liveStatus(data: DocData, nowMs: number): string {
  const status = typeof data.status === 'string' ? data.status : 'closed';
  return effectiveStatus(
    {
      status: status as ListingStatus,
      reservedUntil: isoOrNull(data.reservedUntil),
      hardExpiresAt: isoOrNull(data.hardExpiresAt),
      availabilityExpiresAt: isoOrNull(data.availabilityExpiresAt) ?? new Date(0).toISOString(),
    },
    nowMs,
  );
}

/** As isAvailable in src/lib/campus/serialize.ts: active, or reserved. */
function isAvailable(data: DocData, nowMs: number): boolean {
  const status = liveStatus(data, nowMs);
  return status === 'active' || status === 'reserved';
}

/** Made in this world, after it was created. */
function isNew(world: DemoWorld, id: string, at: unknown): boolean {
  const ms = millis(at);
  return !isSeasonDocId(id) && ms !== null && ms > world.createdAt;
}

function hasLife(data: DocData): boolean {
  return data.demoLife != null;
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || 'A student';
}

function nameOf(userId: string, fallback: unknown): string {
  return firstName(FIXTURE_PEOPLE[userId]?.displayName ?? text(fallback));
}

function listingHref(type: CampusContentType, id: string, audience: unknown): string {
  const base = audience === 'girls' ? '/girls-space' : '';
  return `${base}/${type === 'marketplace' ? 'marketplace' : 'housing'}/${encodeURIComponent(id)}`;
}

function placeLabel(place: unknown): string | null {
  const label = (place as { label?: unknown } | null | undefined)?.label;
  return typeof label === 'string' && label.trim() ? label.trim() : null;
}

function hash(value: string): number {
  let result = 5381;
  for (let index = 0; index < value.length; index += 1) result = ((result * 33) ^ value.charCodeAt(index)) >>> 0;
  return result;
}

/** A made-up 10 digit number for a sample seller, the same each time. */
export function sampleWhatsappNumber(userId: string): string {
  return `90000${String(hash(userId) % 100_000).padStart(5, '0')}`;
}

// ---------------------------------------------------------------------------
// Tick context: the visitor and the sample students, read once per tick

interface Tick {
  world: DemoWorld;
  nowMs: number;
  at: Timestamp;
  /** The signed-in uid, or null when unknown. */
  visitorUid(): Promise<string | null>;
  /** Sample students (never a persona) by campus id, sorted. */
  samplesByCampus(): Promise<Map<string, string[]>>;
}

async function readSessionUid(): Promise<string | null> {
  try {
    const [{ cookies }, { unstable_rethrow }] = await Promise.all([import('next/headers'), import('next/navigation')]);
    try {
      const jar = await cookies();
      return decodeDemoSession(jar.get(DEMO_SESSION_COOKIE)?.value)?.uid ?? null;
    } catch (error) {
      unstable_rethrow(error);
      return null;
    }
  } catch {
    return null;
  }
}

function isSampleStudent(userId: unknown): userId is string {
  return typeof userId === 'string' && !VISITOR_IDS.has(userId) && FIXTURE_PEOPLE[userId] !== undefined;
}

/** Which campus each sample student posts or plays on, from the world's own docs. */
async function readSamples(world: DemoWorld): Promise<Map<string, string[]>> {
  const byCampus = new Map<string, Set<string>>();
  const add = (campusId: unknown, userId: unknown) => {
    if (typeof campusId !== 'string' || !isSampleStudent(userId)) return;
    if (!byCampus.has(campusId)) byCampus.set(campusId, new Set());
    byCampus.get(campusId)!.add(userId);
  };
  for (const name of [CAMPUS_COLLECTIONS.market, CAMPUS_COLLECTIONS.housing, CAMPUS_COLLECTIONS.games]) {
    const snapshot = await world.db.collection(name).get();
    for (const doc of snapshot.docs) {
      const data = doc.data();
      add(data.campusId, data.authorId);
      if (Array.isArray(data.playerIds)) for (const id of data.playerIds) add(data.campusId, id);
    }
  }
  return new Map([...byCampus].map(([campusId, ids]) => [campusId, [...ids].sort()]));
}

function startTick(world: DemoWorld, nowMs: number, options: LifeOptions): Tick {
  let visitor: Promise<string | null> | null = options.visitorUid === undefined ? null : Promise.resolve(options.visitorUid);
  let samples: Promise<Map<string, string[]>> | null = null;
  return {
    world,
    nowMs,
    at: Timestamp.fromMillis(nowMs),
    visitorUid: () => (visitor ??= readSessionUid()),
    samplesByCampus: () => (samples ??= readSamples(world)),
  };
}

/** The ids that count as the visitor: the signed-in uid, or every persona when unknown. */
async function visitorIds(tick: Tick): Promise<ReadonlySet<string>> {
  const uid = await tick.visitorUid();
  return uid ? new Set([uid]) : VISITOR_IDS;
}

/** A sample student of this campus, not in `exclude`, picked steadily by `seed`. */
async function pickSample(tick: Tick, campusId: unknown, exclude: readonly unknown[], seed: string, girls: boolean): Promise<string | null> {
  if (typeof campusId !== 'string') return null;
  const skip = new Set(exclude);
  const candidates = ((await tick.samplesByCampus()).get(campusId) ?? []).filter(
    (id) => !skip.has(id) && (!girls || FIXTURE_PEOPLE[id]?.girls === true),
  );
  return candidates.length > 0 ? candidates[hash(seed) % candidates.length] : null;
}

// ---------------------------------------------------------------------------
// 1. Sample sellers approve the visitor's asks

/** Gives the post a sample WhatsApp number when its seller has none, so the reveal has one to show. */
async function ensureSellerNumber(tick: Tick, type: CampusContentType, contentId: string, sellerId: string, audience: unknown): Promise<void> {
  const { db } = tick.world;
  const contact = db.collection(PRIVATE_CONTACTS).doc(`${type}_${contentId}`);
  if ((await contact.get()).exists) return;
  const profile = await db.collection(PRIVATE_PROFILES).doc(sellerId).get();
  if (text(profile.exists ? profile.get('whatsappNumber') : null)) return;
  await contact.set({
    authorId: sellerId,
    audience: audience === 'girls' ? 'girls' : 'campus',
    whatsappNumber: sampleWhatsappNumber(sellerId),
    updatedAt: tick.at,
    demoLife: { sampleNumber: true },
  });
}

async function approveAsks(tick: Tick): Promise<void> {
  const { world, nowMs, at } = tick;
  const snapshot = await world.db.collection(CONTACT_REQUESTS).where('status', '==', 'pending').get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    // Asks the sample students made themselves (step 2) wait for the visitor.
    if (hasLife(data) || !isNew(world, doc.id, data.createdAt)) continue;
    if (nowMs - millis(data.createdAt)! < APPROVE_AFTER_MS) continue;
    const sellerId = text(data.sellerId);
    const buyerId = text(data.buyerId);
    if (!sellerId || !buyerId || sellerId === buyerId) continue;
    const expiresMs = millis(data.expiresAt);
    if (expiresMs !== null && expiresMs <= nowMs) continue;
    if (sellerId === (await tick.visitorUid())) continue;
    const type = data.contentType;
    if (type !== 'marketplace' && type !== 'housing') continue;
    const contentId = text(data.contentId);
    if (!contentId) continue;

    // As the seller's PATCH { action: 'approve' }: only while the post is live.
    const content = await world.db.collection(collectionForContentType(type)).doc(contentId).get();
    const listing = content.exists ? content.data() : undefined;
    if (!listing || !isAvailable(listing, nowMs)) continue;
    const fresh = await doc.ref.get();
    if (fresh.get('status') !== 'pending' || fresh.get('demoLife') != null) continue;

    await ensureSellerNumber(tick, type, contentId, sellerId, data.audience ?? listing.audience);
    await doc.ref.update({ status: 'approved', decidedAt: at, updatedAt: at, demoLife: { approvedAt: at } });

    const name = nameOf(sellerId, listing.sellerDisplayName ?? listing.posterDisplayName);
    await notifyNow(world, nowMs, buyerId, {
      kind: 'contact_approved',
      title: `${name} shared their number`,
      body: 'Say hey on WhatsApp.',
      href: listingHref(type, contentId, data.audience ?? listing.audience),
      ref: { type: 'contact_request', id: doc.id },
      campusId: typeof listing.campusId === 'string' ? listing.campusId : null,
      actorDisplayName: name,
    });
  }
}

// ---------------------------------------------------------------------------
// 2. A sample student asks about each new listing

async function askAboutListing(tick: Tick, type: CampusContentType, id: string, listing: DocData): Promise<void> {
  const { world, nowMs, at } = tick;
  const authorId = text(listing.authorId);
  if (!authorId) return;
  // As POST /api/contact-requests: live and not held by a reserve.
  if (!isAvailable(listing, nowMs) || liveStatus(listing, nowMs) === 'reserved') return;
  const buyerId = await pickSample(tick, listing.campusId, [authorId], `${type}/${id}`, listing.audience === 'girls');
  if (!buyerId) return;

  const requestId = `${type}_${id}_${buyerId}`;
  const ref = world.db.collection(CONTACT_REQUESTS).doc(requestId);
  const intent = intentFor(type, listing);
  const buyerName = nameOf(buyerId, null);
  if (!(await ref.get()).exists) {
    await ref.set({
      contentType: type,
      contentId: id,
      serial: listing.serial,
      intent,
      listingKind: type === 'marketplace' && typeof listing.kind === 'string' ? listing.kind : null,
      title: typeof listing.title === 'string' ? listing.title : null,
      placeLabel: placeLabel(listing.place),
      audience: listing.audience,
      collegeId: listing.collegeId,
      buyerId,
      buyerDisplayName: FIXTURE_PEOPLE[buyerId]?.displayName ?? buyerName,
      sellerId: authorId,
      status: 'pending',
      createdAt: at,
      updatedAt: at,
      expiresAt: Timestamp.fromDate(addHours(new Date(nowMs), CONTACT_REQUEST_HOURS)),
      demoLife: { askedAt: at },
    });
  }
  await world.db.collection(collectionForContentType(type)).doc(id).update({ demoLife: { askedAt: at, askedBy: buyerId, requestId } });

  // As notifyOwner in app/api/contact-requests/route.ts.
  const serial = String(listing.serial || '');
  const listingTitle = text(listing.title);
  await notifyNow(world, nowMs, authorId, {
    kind: 'contact_request',
    title: intent === 'offer' ? `${buyerName} has what you asked for` : `${buyerName} asked about ${serial}`,
    body: listingTitle ? `${listingTitle}. Approve to share your number.` : 'Approve to share your number.',
    href: listingHref(type, id, listing.audience),
    ref: { type: 'contact_request', id: requestId },
    campusId: typeof listing.campusId === 'string' ? listing.campusId : null,
    actorDisplayName: buyerName,
  });
}

async function askAboutNewListings(tick: Tick): Promise<void> {
  for (const type of CONTENT_TYPES) {
    const snapshot = await tick.world.db.collection(collectionForContentType(type)).get();
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (hasLife(data) || !isNew(tick.world, doc.id, data.createdAt)) continue;
      if (tick.nowMs - millis(data.createdAt)! < ASK_AFTER_MS) continue;
      await askAboutListing(tick, type, doc.id, data);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. A sample player joins the visitor's game

async function seatSamplePlayers(tick: Tick): Promise<void> {
  const { world, nowMs, at } = tick;
  const snapshot = await world.db.collection(CAMPUS_COLLECTIONS.games).get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    // updatedAt is when the visitor joined (or posted) the game.
    if (hasLife(data) || !isNew(world, doc.id, data.updatedAt)) continue;
    if (nowMs - millis(data.updatedAt)! < SEAT_AFTER_MS) continue;
    const players: unknown[] = Array.isArray(data.playerIds) ? data.playerIds : [];
    const visitors = await visitorIds(tick);
    if (!players.some((id) => typeof id === 'string' && visitors.has(id))) continue;
    const playerId = await pickSample(tick, data.campusId, [...players, data.authorId], `game/${doc.id}`, false);
    if (!playerId) continue;
    // As PATCH /api/campus/games/[id] { action: 'join' }: the same seat rules.
    const result = joinGame(data as unknown as GameRecord, { userId: playerId, verified: true, now: new Date(nowMs) });
    if (!result.ok) continue;
    await doc.ref.update({ playerIds: result.playerIds, status: result.status, updatedAt: at, demoLife: { seatedAt: at, playerId } });
  }
}

// ---------------------------------------------------------------------------

/** One step of demo life. Each part runs on its own, so one failing never stops the others. */
export async function tickLife(world: DemoWorld, nowMs: number, options: LifeOptions = {}): Promise<void> {
  const tick = startTick(world, nowMs, options);
  const steps: Array<[string, (tick: Tick) => Promise<void>]> = [
    ['approve', approveAsks],
    ['ask', askAboutNewListings],
    ['seat', seatSamplePlayers],
  ];
  for (const [name, step] of steps) {
    try {
      await step(tick);
    } catch (error) {
      console.error(`[demo] life ${name} failed in world ${world.id}`, error);
    }
  }
}
