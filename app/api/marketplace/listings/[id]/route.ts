import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, getCampusPrincipal } from '@/lib/campus/auth';
import { AVAILABILITY_DAYS, CAMPUS_COLLECTIONS, addDays } from '@/lib/campus/constants';
import { serializeMarketListing } from '@/lib/campus/marketSerialize';

function routeAudience(request: NextRequest) {
  return request.nextUrl.pathname.startsWith('/api/girls-space/') ? 'girls' as const : 'campus' as const;
}

const VISIBLE_STATUSES = new Set(['active', 'reserved']);

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const snapshot = await getAdminDb().collection(CAMPUS_COLLECTIONS.market).doc(id).get();
    if (!snapshot.exists) throw new CampusHttpError(404, 'Listing not found');
    const data = snapshot.data()!;
    if (data.audience !== routeAudience(request)) throw new CampusHttpError(404, 'Listing not found');
    const principal = await getCampusPrincipal({ requireVerified: true, audience: data.audience, product: 'marketplace' });
    const campus = principal.campus && principal.config?.campuses.find((item) => item.id === principal.campus!.id);
    const origin = campus ? { campusId: campus.id, lat: campus.origin.lat, lng: campus.origin.lng } : null;
    const saved = await getAdminDb().collection(CAMPUS_COLLECTIONS.saves).doc(`${principal.userId}_marketplace_${id}`).get();
    const item = serializeMarketListing(snapshot, principal.userId, saved.exists ? new Set([id]) : new Set(), origin);
    if (!item.isOwner && !VISIBLE_STATUSES.has(item.status)) throw new CampusHttpError(404, 'Listing is no longer available');
    return NextResponse.json({ item }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const ref = getAdminDb().collection(CAMPUS_COLLECTIONS.market).doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new CampusHttpError(404, 'Listing not found');
    if (snapshot.data()!.audience !== routeAudience(request)) throw new CampusHttpError(404, 'Listing not found');
    const principal = await getCampusPrincipal({ requireVerified: true, audience: snapshot.data()!.audience, product: 'marketplace' });
    if (snapshot.data()!.authorId !== principal.userId) throw new CampusHttpError(403, 'Only the seller can update this listing');
    const body = await request.json();
    const action = String(body.action || '');
    const now = new Date();
    const status = snapshot.data()!.status;
    if (status === 'removed') throw new CampusHttpError(409, 'This listing was removed by moderators');
    if (action === 'confirm') {
      // Only re-confirm live content; closed or sold/filled posts stay closed.
      if (!['active', 'needs_confirmation'].includes(status)) throw new CampusHttpError(409, 'Only a live listing can be confirmed');
      await ref.update({ status: 'active', availabilityConfirmedAt: Timestamp.fromDate(now), availabilityExpiresAt: Timestamp.fromDate(addDays(now, AVAILABILITY_DAYS)), updatedAt: Timestamp.now() });
    } else if (action === 'sold' || action === 'close') {
      await ref.update({ status: action === 'sold' ? 'sold' : 'closed', updatedAt: Timestamp.now() });
    } else if (action === 'promotion') {
      await ref.update({ promotionEligible: snapshot.data()!.audience === 'campus' && body.enabled === true, updatedAt: Timestamp.now() });
    } else {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return campusErrorResponse(error);
  }
}
