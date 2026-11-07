// In-app notification queue. Server only (Firebase Admin). No push: the inbox
// route reads due items (deliverAfter <= now). Each item's id is its dedupe
// key, so enqueueing the same thing twice for the same slot writes once.
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import type { DocTime } from '@/types/campus';
import type { NotificationDoc, NotificationKind, NotificationPrefsDoc, NotificationRef } from '@/types/notifications';
import { CAMPUS_COLLECTIONS } from './constants';
import { dedupeKey, nextSlot } from './notifySlots';

/** A queued inbox item: the shared NotificationDoc plus its delivery time. */
export interface QueuedNotificationDoc extends NotificationDoc {
  /** Shown in the inbox from this time on. Set by nextSlot. */
  deliverAfter: DocTime;
  urgent: boolean;
}

export interface NotifyPayload {
  kind: NotificationKind;
  /** One short line. Clamped to 9 words. */
  title: string;
  body?: string | null;
  href?: string | null;
  ref?: NotificationRef | null;
  /** Send now unless quiet hours, instead of the next batched slot. */
  urgent?: boolean;
  campusId?: string | null;
  actorDisplayName?: string | null;
}

export interface NotifyOptions {
  now?: Date;
  db?: Firestore;
}

export interface EnqueueResult {
  /** New inbox items written. */
  queued: number;
  /** Already queued for this slot, or muted by the user's prefs. */
  skipped: number;
}

export type SavedContentType = 'marketplace' | 'housing';

export const TITLE_MAX_WORDS = 9;
const TITLE_MAX_CHARS = 90;
const BODY_MAX_CHARS = 160;
const WRITE_CHUNK = 100;
const PREFS_CHUNK = 100;
const MAX_SAVERS = 500;
const ALREADY_EXISTS = 6;

/** Keeps a title under 10 words and 90 characters. */
export function clampTitle(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean).slice(0, TITLE_MAX_WORDS);
  return words.join(' ').slice(0, TITLE_MAX_CHARS).trim();
}

function clampText(value: string | null | undefined, max: number): string | null {
  const text = value?.trim();
  return text ? text.slice(0, max) : null;
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

function isAlreadyExists(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === ALREADY_EXISTS || code === 'already-exists' || code === 'ALREADY_EXISTS';
}

/** Users who switched this kind off in notification_prefs. Missing prefs mean on. */
async function mutedUsers(db: Firestore, userIds: readonly string[], kind: NotificationKind): Promise<Set<string>> {
  const muted = new Set<string>();
  const prefs = db.collection(CAMPUS_COLLECTIONS.notificationPrefs);
  for (const group of chunks(userIds, PREFS_CHUNK)) {
    const snapshots = await db.getAll(...group.map((id) => prefs.doc(id)));
    for (const snapshot of snapshots) {
      const data = snapshot.exists ? (snapshot.data() as Partial<NotificationPrefsDoc>) : null;
      if (data?.kinds?.[kind] === false) muted.add(snapshot.id);
    }
  }
  return muted;
}

/**
 * Queues one inbox item per user, delivered at the next slot (or now if urgent
 * and outside quiet hours). Idempotent per user, kind, target and slot.
 */
export async function enqueue(userIds: readonly string[], payload: NotifyPayload, options: NotifyOptions = {}): Promise<EnqueueResult> {
  const recipients = [...new Set(userIds.map((id) => id.trim()).filter((id) => id && !id.includes('/')))];
  const title = clampTitle(payload.title);
  if (recipients.length === 0) return { queued: 0, skipped: 0 };
  if (!title) throw new Error('A notification needs a title');

  const db = options.db ?? getAdminDb();
  const now = options.now ?? new Date();
  const urgent = Boolean(payload.urgent);
  const deliverAt = nextSlot(now, { urgent });
  const createdAt = Timestamp.fromDate(now);
  const deliverAfter = Timestamp.fromDate(deliverAt);
  const ref = payload.ref ?? null;
  const targetId = ref ? `${ref.type}/${ref.id}` : null;

  const muted = await mutedUsers(db, recipients, payload.kind);
  const collection = db.collection(CAMPUS_COLLECTIONS.notifications);
  let queued = 0;
  let skipped = muted.size;

  for (const group of chunks(recipients.filter((id) => !muted.has(id)), WRITE_CHUNK)) {
    const results = await Promise.all(
      group.map(async (userId) => {
        const doc: QueuedNotificationDoc = {
          userId,
          campusId: payload.campusId ?? null,
          kind: payload.kind,
          title,
          body: clampText(payload.body, BODY_MAX_CHARS),
          href: clampText(payload.href, 300),
          ref,
          actorDisplayName: clampText(payload.actorDisplayName, 60),
          read: false,
          readAt: null,
          createdAt,
          deliverAfter,
          urgent,
        };
        const id = dedupeKey({ userId, type: payload.kind, targetId, slot: deliverAt });
        try {
          await collection.doc(id).create(doc);
          return true;
        } catch (error) {
          if (isAlreadyExists(error)) return false;
          throw error;
        }
      }),
    );
    for (const written of results) {
      if (written) queued += 1;
      else skipped += 1;
    }
  }
  return { queued, skipped };
}

function listingCollection(contentType: SavedContentType): string {
  return contentType === 'marketplace' ? CAMPUS_COLLECTIONS.market : CAMPUS_COLLECTIONS.housing;
}

/**
 * Notifies everyone who saved a post, except its owner. Pass ownerId when the
 * caller already has the post; otherwise it is read from the post.
 */
export async function notifySavers(
  contentType: SavedContentType,
  contentId: string,
  kind: NotificationKind,
  payload: Omit<NotifyPayload, 'kind'>,
  options: NotifyOptions & { ownerId?: string | null } = {},
): Promise<EnqueueResult> {
  const db = options.db ?? getAdminDb();
  let ownerId = options.ownerId;
  if (ownerId === undefined) {
    const post = await db.collection(listingCollection(contentType)).doc(contentId).get();
    const authorId = post.exists ? post.get('authorId') : null;
    ownerId = typeof authorId === 'string' ? authorId : null;
  }
  const saves = await db
    .collection(CAMPUS_COLLECTIONS.saves)
    .where('contentType', '==', contentType)
    .where('contentId', '==', contentId)
    .limit(MAX_SAVERS)
    .get();
  const savers = saves.docs
    .map((item) => item.get('userId'))
    .filter((userId): userId is string => typeof userId === 'string' && userId !== ownerId);
  const ref = payload.ref ?? { type: contentType === 'marketplace' ? 'market_listing' : 'housing_listing', id: contentId };
  return enqueue(savers, { ...payload, kind, ref }, { ...options, db });
}
