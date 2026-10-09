import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, getCampusPrincipal } from '@/lib/campus/auth';
import { isAvailable, toDate } from '@/lib/campus/serialize';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const principal = await getCampusPrincipal({ requireVerified: true });
    const { id } = await context.params;
    const ref = getAdminDb().collection('campus_contact_requests').doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new CampusHttpError(404, 'Request not found');
    const data = snapshot.data()!;
    // Non-parties get the same 404 as a missing request, before any other check or write.
    if (data.buyerId !== principal.userId && data.sellerId !== principal.userId) throw new CampusHttpError(404, 'Request not found');
    await getCampusPrincipal({ requireVerified: true, audience: data.audience, product: data.contentType });
    const body = await request.json();
    const action = String(body.action || '');
    if (action !== 'cancel' && data.status !== 'pending') throw new CampusHttpError(409, 'This request has already been decided');
    if (action === 'cancel' && !['pending', 'approved'].includes(data.status)) throw new CampusHttpError(409, 'This request is no longer active');
    if (data.status === 'pending' && data.expiresAt && toDate(data.expiresAt)!.getTime() <= Date.now()) {
      await ref.update({ status: 'expired', updatedAt: Timestamp.now() });
      throw new CampusHttpError(409, 'This request has expired');
    }
    if (action === 'cancel' && data.buyerId === principal.userId) {
      await ref.update({ status: 'cancelled', updatedAt: Timestamp.now() });
    } else if (['approve', 'decline'].includes(action) && data.sellerId === principal.userId) {
      if (action === 'approve') {
        const collection = data.contentType === 'marketplace' ? 'marketplace_listings' : 'housing_posts';
        const content = await getAdminDb().collection(collection).doc(data.contentId).get();
        if (!content.exists || !isAvailable(content.data())) throw new CampusHttpError(409, 'The post is no longer active');
      }
      await ref.update({ status: action === 'approve' ? 'approved' : 'declined', decidedAt: Timestamp.now(), updatedAt: Timestamp.now() });
    } else {
      throw new CampusHttpError(403, 'You cannot perform this action');
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return campusErrorResponse(error);
  }
}
