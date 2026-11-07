import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { campusErrorResponse, getCampusPrincipal } from '@/lib/campus/auth';
import { CAMPUS_COLLECTIONS } from '@/lib/campus/constants';
import { toDate } from '@/lib/campus/serialize';
import type { CampusNotification } from '@/types/notifications';

const INBOX_LIMIT = 50;
/** Newest docs scanned per request; queued future items may sit among them. */
const SCAN_LIMIT = 200;
const NO_STORE = { 'Cache-Control': 'private, no-store' };

/** An inbox item as the client sees it, with its delivery time. */
type InboxItem = CampusNotification & { deliverAfter: string };

const markReadSchema = z.object({
  ids: z
    .array(z.string().min(1).max(500).refine((id) => !id.includes('/'), 'Invalid notification id'))
    .min(1)
    .max(INBOX_LIMIT),
});

function iso(value: unknown): string | null {
  return toDate(value)?.toISOString() ?? null;
}

/**
 * When an item shows in the inbox. Queued items carry deliverAfter (set by
 * notify.ts); items without it are due from createdAt.
 */
function deliveryTime(data: Record<string, unknown>): Date {
  return toDate(data.deliverAfter) ?? toDate(data.createdAt) ?? new Date(0);
}

function serialize(id: string, data: Record<string, unknown>): InboxItem {
  return {
    id,
    campusId: (data.campusId as string | null) ?? null,
    kind: data.kind as InboxItem['kind'],
    title: String(data.title ?? ''),
    body: (data.body as string | null) ?? null,
    href: (data.href as string | null) ?? null,
    ref: (data.ref as InboxItem['ref']) ?? null,
    actorDisplayName: (data.actorDisplayName as string | null) ?? null,
    read: data.read === true,
    readAt: iso(data.readAt),
    createdAt: iso(data.createdAt) ?? new Date(0).toISOString(),
    deliverAfter: deliveryTime(data).toISOString(),
  };
}

/** The viewer's due inbox items, newest first. Future slots stay hidden. */
export async function GET() {
  try {
    const principal = await getCampusPrincipal();
    // Docs without deliverAfter are due from createdAt, so filter here
    // rather than with a deliverAfter range (which would drop them).
    const snapshot = await getAdminDb()
      .collection(CAMPUS_COLLECTIONS.notifications)
      .where('userId', '==', principal.userId)
      .orderBy('createdAt', 'desc')
      .limit(SCAN_LIMIT)
      .get();
    const now = Date.now();
    const notifications = snapshot.docs
      .map((item) => ({ id: item.id, data: item.data(), at: deliveryTime(item.data()).getTime() }))
      .filter((item) => item.at <= now)
      .sort((a, b) => b.at - a.at)
      .slice(0, INBOX_LIMIT)
      .map((item) => serialize(item.id, item.data));
    const unread = notifications.filter((item) => !item.read).length;
    return NextResponse.json({ notifications, unread }, { headers: NO_STORE });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

/** Marks the viewer's own items read. Other users' ids are ignored. */
export async function PATCH(request: NextRequest) {
  try {
    const principal = await getCampusPrincipal();
    const body = markReadSchema.parse(await request.json());
    const db = getAdminDb();
    const collection = db.collection(CAMPUS_COLLECTIONS.notifications);
    const ids = [...new Set(body.ids)];
    const snapshots = await db.getAll(...ids.map((id) => collection.doc(id)));
    const now = Timestamp.now();
    const batch = db.batch();
    let updated = 0;
    for (const snapshot of snapshots) {
      if (!snapshot.exists) continue;
      const data = snapshot.data() ?? {};
      if (data.userId !== principal.userId || data.read === true) continue;
      batch.update(snapshot.ref, { read: true, readAt: now });
      updated += 1;
    }
    if (updated > 0) await batch.commit();
    return NextResponse.json({ ok: true, updated }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid request' }, { status: 400, headers: NO_STORE });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
    }
    return campusErrorResponse(error);
  }
}
