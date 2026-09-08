import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, getCampusPrincipal } from '@/lib/campus/auth';
import { AVAILABILITY_DAYS, addDays } from '@/lib/campus/constants';
import { isAvailable, serializeMarketplace } from '@/lib/campus/serialize';

function routeAudience(request: NextRequest) {
  return request.nextUrl.pathname.startsWith('/api/girls-space/') ? 'girls' as const : 'campus' as const;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const snapshot = await getAdminDb().collection('marketplace_listings').doc(id).get();
    if (!snapshot.exists) throw new CampusHttpError(404, 'Listing not found');
    const data = snapshot.data()!;
    if (data.audience !== routeAudience(request)) throw new CampusHttpError(404, 'Listing not found');
    const principal = await getCampusPrincipal({ requireVerified: true, audience: data.audience, product: 'marketplace' });
    if (!isAvailable(data) && data.authorId !== principal.userId) throw new CampusHttpError(404, 'Listing is no longer available');
    return NextResponse.json({ item: serializeMarketplace(snapshot, principal.userId) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const ref = getAdminDb().collection('marketplace_listings').doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new CampusHttpError(404, 'Listing not found');
    if (snapshot.data()!.audience !== routeAudience(request)) throw new CampusHttpError(404, 'Listing not found');
    const principal = await getCampusPrincipal({ requireVerified: true, audience: snapshot.data()!.audience, product: 'marketplace' });
    if (snapshot.data()!.authorId !== principal.userId) throw new CampusHttpError(403, 'Only the seller can update this listing');
    const body = await request.json();
    const action = String(body.action || '');
    const now = new Date();
    if (action === 'confirm') {
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
