import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, getCampusPrincipal } from '@/lib/campus/auth';
import { CAMPUS_COLLECTIONS } from '@/lib/campus/constants';
import { MarketActionError, applyMarketAction } from '@/lib/campus/marketActions';
import { serializeMarketListing } from '@/lib/campus/marketSerialize';
import { notifySavers } from '@/lib/campus/notify';

function routeAudience(request: NextRequest) {
  return request.nextUrl.pathname.startsWith('/api/girls-space/') ? 'girls' as const : 'campus' as const;
}

const VISIBLE_STATUSES = new Set(['active', 'reserved']);
const NO_STORE = { 'Cache-Control': 'private, no-store' };

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
    return NextResponse.json({ item }, { headers: NO_STORE });
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
    const data = snapshot.data()!;
    if (data.audience !== routeAudience(request)) throw new CampusHttpError(404, 'Listing not found');
    const principal = await getCampusPrincipal({ requireVerified: true, audience: data.audience, product: 'marketplace' });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new CampusHttpError(400, 'Unsupported action');
    }
    const result = await applyMarketAction(ref, data, body, principal, { notifySavers });
    return NextResponse.json({ ok: true, status: result.status, notified: result.notified }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof MarketActionError) return NextResponse.json({ error: error.message }, { status: error.status, headers: NO_STORE });
    return campusErrorResponse(error);
  }
}
