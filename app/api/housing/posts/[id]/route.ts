import { NextRequest, NextResponse } from 'next/server';
import { Timestamp, type DocumentSnapshot } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, getCampusPrincipal, type CampusPrincipal } from '@/lib/campus/auth';
import { AVAILABILITY_DAYS, CAMPUS_COLLECTIONS, RESERVE_HOURS, addDays, addHours } from '@/lib/campus/constants';
import { HousingPatchSchema, firstIssueMessage, type HousingPatch } from '@/lib/campus/housing/schema';
import { isoOrNull, serializeHousingListing, type ViewerOrigin } from '@/lib/campus/housing/serialize';
import { notifySavers } from '@/lib/campus/notify';
import { formatPrice } from '@/lib/format/price';
import type { CampusAudience } from '@/types/campus';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const NOT_FOUND = 'Housing post not found';
const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE_STATUSES: ReadonlySet<string> = new Set(['active', 'reserved']);
/** Statuses the owner can still change: live, or waiting for a confirm. */
const OPEN_STATUSES: ReadonlySet<string> = new Set(['active', 'reserved', 'needs_confirmation']);

type RouteContext = { params: Promise<{ id: string }> };

function routeAudience(request: NextRequest): CampusAudience {
  return request.nextUrl.pathname.startsWith('/api/girls-space/') ? 'girls' : 'campus';
}

function viewerOrigin(principal: CampusPrincipal): ViewerOrigin | null {
  const campusId = principal.campus?.id;
  const campus = campusId ? principal.config?.campuses.find((item) => item.id === campusId) : null;
  return campus ? { campusId: campus.id, lat: campus.origin.lat, lng: campus.origin.lng } : null;
}

async function isSavedBy(userId: string, id: string): Promise<boolean> {
  const saves = await getAdminDb().collection(CAMPUS_COLLECTIONS.saves).where('userId', '==', userId).limit(500).get();
  return saves.docs.some((item) => item.data().contentType === 'housing' && item.data().contentId === id);
}

function serializeFor(snapshot: DocumentSnapshot, principal: CampusPrincipal, saved: boolean, now = Date.now()) {
  return serializeHousingListing(snapshot, principal.userId, saved ? new Set([snapshot.id]) : new Set(), viewerOrigin(principal), now);
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const audience = routeAudience(request);
    const principal = await getCampusPrincipal({ requireVerified: true, audience, product: 'housing' });
    const snapshot = await getAdminDb().collection(CAMPUS_COLLECTIONS.housing).doc(id).get();
    if (!snapshot.exists) throw new CampusHttpError(404, NOT_FOUND);
    const data = snapshot.data()!;
    if (data.audience !== audience) throw new CampusHttpError(404, NOT_FOUND);
    const isOwner = data.authorId === principal.userId;
    if (!isOwner && data.collegeId !== principal.membership!.collegeId) throw new CampusHttpError(404, NOT_FOUND);
    const item = serializeFor(snapshot, principal, await isSavedBy(principal.userId, id));
    if (!isOwner && !LIVE_STATUSES.has(item.status)) throw new CampusHttpError(404, 'Housing post is no longer available');
    return NextResponse.json({ item }, { headers: NO_STORE });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

/** What a price drop tells the savers, after the write commits. */
type PriceDrop = { title: string; campusId: string | null; previous: number; next: number };

/**
 * The update for one lifecycle action, from the current doc. `status` is the
 * effective status (a lapsed reserve already reads as active).
 */
function planUpdate(
  patch: HousingPatch,
  stored: Record<string, unknown>,
  status: string,
  audience: CampusAudience,
  now: Date,
): { update: Record<string, unknown>; priceDrop: PriceDrop | null } {
  const at = Timestamp.fromDate(now);
  const open = OPEN_STATUSES.has(status);
  switch (patch.action) {
    case 'reserve':
      if (status !== 'active') throw new CampusHttpError(409, 'Only a live post can be reserved');
      return { update: { status: 'reserved', reservedUntil: Timestamp.fromDate(addHours(now, RESERVE_HOURS)) }, priceDrop: null };
    case 'unreserve':
      // A lapsed reserve still reads 'reserved' in storage; clearing it is fine.
      if (stored.status !== 'reserved') throw new CampusHttpError(409, 'This post is not reserved');
      return { update: { status: 'active', reservedUntil: null }, priceDrop: null };
    case 'booked':
      if (!open) throw new CampusHttpError(409, 'Only an open post can be marked booked');
      return { update: { status: 'booked', bedsLeft: 0, reservedUntil: null }, priceDrop: null };
    case 'close':
      if (status === 'closed') throw new CampusHttpError(409, 'This post is already closed');
      return { update: { status: 'closed', reservedUntil: null }, priceDrop: null };
    case 'beds':
      if (!open) throw new CampusHttpError(409, 'Only an open post can change beds');
      if (patch.bedsLeft === 0) return { update: { status: 'booked', bedsLeft: 0, reservedUntil: null }, priceDrop: null };
      return { update: { bedsLeft: patch.bedsLeft }, priceDrop: null };
    case 'confirm':
      if (!open) throw new CampusHttpError(409, 'Only an open post can be confirmed');
      // Re-arms the 7-day window and clears the nudge. A holding reserve stays.
      return {
        update: {
          status: status === 'reserved' ? 'reserved' : 'active',
          confirmedAt: at,
          availabilityExpiresAt: Timestamp.fromDate(addDays(now, AVAILABILITY_DAYS)),
          stillAvailableNudgedAt: null,
        },
        priceDrop: null,
      };
    case 'lower_price': {
      if (!open) throw new CampusHttpError(409, 'Only an open post can lower its rent');
      const current = typeof stored.rentPp === 'number' && Number.isFinite(stored.rentPp) ? stored.rentPp : null;
      if (current === null || patch.rentPp <= 0 || patch.rentPp >= current) {
        throw new CampusHttpError(400, 'New rent must be lower');
      }
      const lastDrop = isoOrNull(stored.priceDroppedAt);
      if (lastDrop && now.getTime() - Date.parse(lastDrop) < DAY_MS) {
        throw new CampusHttpError(429, 'You can lower the rent once a day');
      }
      return {
        update: { rentPp: patch.rentPp, previousRentPp: current, priceDroppedAt: at },
        priceDrop: {
          title: typeof stored.title === 'string' ? stored.title : '',
          campusId: typeof stored.campusId === 'string' ? stored.campusId : null,
          previous: current,
          next: patch.rentPp,
        },
      };
    }
    case 'promotion':
      if (audience !== 'campus') throw new CampusHttpError(400, 'Only campus posts can be promoted');
      return { update: { promotionEligible: patch.eligible }, priceDrop: null };
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const audience = routeAudience(request);
    const patch = HousingPatchSchema.parse(await request.json());
    const principal = await getCampusPrincipal({ requireVerified: true, audience, product: 'housing' });
    const db = getAdminDb();
    const ref = db.collection(CAMPUS_COLLECTIONS.housing).doc(id);

    const priceDrop = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new CampusHttpError(404, NOT_FOUND);
      const stored = snapshot.data()!;
      if (stored.audience !== audience) throw new CampusHttpError(404, NOT_FOUND);
      if (stored.authorId !== principal.userId) throw new CampusHttpError(403, 'Only the poster can update this post');
      if (stored.status === 'removed') throw new CampusHttpError(409, 'This post was removed by moderators');
      const now = new Date();
      const { status } = serializeHousingListing(snapshot, principal.userId, undefined, null, now);
      const plan = planUpdate(patch, stored, status, audience, now);
      transaction.update(ref, { ...plan.update, updatedAt: Timestamp.fromDate(now) });
      return plan.priceDrop;
    });

    if (priceDrop) {
      // Best effort: the drop is saved even if the inbox write fails.
      try {
        await notifySavers(
          'housing',
          id,
          'price_drop',
          {
            title: 'Rent dropped on a room you saved',
            body: `Now ${formatPrice(priceDrop.next, 'pp')}, was ${formatPrice(priceDrop.previous, 'pp')}`,
            href: audience === 'girls' ? `/girls-space/housing/${id}` : `/housing/${id}`,
            campusId: priceDrop.campusId,
          },
          { ownerId: principal.userId },
        );
      } catch (error) {
        console.error('Housing price-drop notification failed', error);
      }
    }

    const updated = await ref.get();
    const item = serializeFor(updated, principal, await isSavedBy(principal.userId, id));
    return NextResponse.json({ ok: true, item }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: firstIssueMessage(error) }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    return campusErrorResponse(error);
  }
}
