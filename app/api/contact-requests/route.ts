import { NextRequest, NextResponse } from 'next/server';
import { DocumentSnapshot, QueryDocumentSnapshot, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, getCampusPrincipal } from '@/lib/campus/auth';
import { CONTACT_REQUEST_HOURS, addHours } from '@/lib/campus/constants';
import { isAvailable, toIso } from '@/lib/campus/serialize';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rateLimit';

const createSchema = z.object({
  contentType: z.enum(['marketplace', 'housing']),
  contentId: z.string().min(1).max(100),
});

function collectionFor(type: 'marketplace' | 'housing') {
  return type === 'marketplace' ? 'marketplace_listings' : 'housing_posts';
}

function digits(value: string) {
  return value.replace(/[^\d]/g, '');
}

async function serializeRequest(doc: QueryDocumentSnapshot | DocumentSnapshot, viewerId: string) {
  const data = doc.data()!;
  const item: Record<string, unknown> = {
    id: doc.id,
    contentType: data.contentType,
    contentId: data.contentId,
    serial: data.serial,
    buyerId: data.buyerId,
    sellerId: data.sellerId,
    buyerDisplayName: data.buyerDisplayName,
    status: data.status,
    createdAt: toIso(data.createdAt),
    expiresAt: toIso(data.expiresAt),
  };
  if (data.status === 'pending' && toIso(data.expiresAt) <= new Date().toISOString()) {
    item.status = 'expired';
    await doc.ref.update({ status: 'expired', updatedAt: Timestamp.now() });
  }
  if (data.status === 'approved' && data.buyerId === viewerId) {
    const content = await getAdminDb().collection(collectionFor(data.contentType)).doc(data.contentId).get();
    if (!content.exists || !isAvailable(content.data())) {
      item.status = 'expired';
      await doc.ref.update({ status: 'expired', updatedAt: Timestamp.now() });
    } else {
      const profile = await getAdminDb().collection('campus_private_profiles').doc(data.sellerId).get();
      const phone = digits(String(profile.data()?.whatsappNumber || ''));
      if (phone) {
        const text = encodeURIComponent(`Hi, I’m interested in ${data.serial} on PeasyPrints.`);
        item.whatsappUrl = `https://wa.me/${phone}?text=${text}`;
      }
    }
  }
  return item;
}

export async function GET(request: NextRequest) {
  try {
    const audience = request.nextUrl.searchParams.get('audience') === 'girls' ? 'girls' : 'campus';
    const principal = await getCampusPrincipal({ requireVerified: true, audience });
    const role = request.nextUrl.searchParams.get('role') === 'buyer' ? 'buyer' : 'seller';
    const field = role === 'buyer' ? 'buyerId' : 'sellerId';
    const snapshot = await getAdminDb().collection('campus_contact_requests').where(field, '==', principal.userId).limit(150).get();
    const visible = snapshot.docs.filter((doc) => doc.data().audience === audience);
    const items = await Promise.all(visible.map((doc) => serializeRequest(doc, principal.userId)));
    items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return NextResponse.json({ items });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const principal = await getCampusPrincipal({ requireVerified: true });
    const rate = await checkRateLimit('contact-request', principal.userId, 30, 3600);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    const body = createSchema.parse(await request.json());
    const content = await getAdminDb().collection(collectionFor(body.contentType)).doc(body.contentId).get();
    if (!content.exists || !isAvailable(content.data())) throw new CampusHttpError(404, 'Post is no longer available');
    const data = content.data()!;
    await getCampusPrincipal({ requireVerified: true, audience: data.audience, product: body.contentType });
    if (data.authorId === principal.userId) throw new CampusHttpError(409, 'You own this post');
    const id = `${body.contentType}_${body.contentId}_${principal.userId}`;
    const ref = getAdminDb().collection('campus_contact_requests').doc(id);
    const existing = await ref.get();
    if (existing.exists && ['pending', 'approved'].includes(existing.data()!.status)) {
      const existingData = existing.data()!;
      const pendingExpired = existingData.status === 'pending'
        && (existingData.expiresAt?.toDate?.().getTime() || 0) <= Date.now();
      if (!pendingExpired) return NextResponse.json({ id, status: existingData.status });
    }
    const now = new Date();
    await ref.set({
      contentType: body.contentType,
      contentId: body.contentId,
      serial: data.serial,
      audience: data.audience,
      collegeId: data.collegeId,
      buyerId: principal.userId,
      buyerDisplayName: principal.displayName,
      sellerId: data.authorId,
      status: 'pending',
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      expiresAt: Timestamp.fromDate(addHours(now, CONTACT_REQUEST_HOURS)),
    });
    return NextResponse.json({ id, status: 'pending' }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid contact request' }, { status: 400 });
    return campusErrorResponse(error);
  }
}
