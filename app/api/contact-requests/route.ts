import { NextRequest, NextResponse } from 'next/server';
import { DocumentSnapshot, QueryDocumentSnapshot, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import type { CampusAudience } from '@/types/campus';
import { CampusHttpError, campusErrorResponse, getCampusPrincipal } from '@/lib/campus/auth';
import { CONTACT_REQUEST_HOURS, addHours } from '@/lib/campus/constants';
import { enqueue } from '@/lib/campus/notify';
import {
  collectionForContentType as collectionFor,
  contactRequestIntent,
  intentFor,
  type CampusContentType,
  type ContactIntent,
} from '@/lib/campus/serial';
import { isAvailable, liveStatus, toIso } from '@/lib/campus/serialize';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rateLimit';

const createSchema = z.object({
  contentType: z.enum(['marketplace', 'housing']),
  contentId: z.string().min(1).max(100),
});

type ContentType = CampusContentType;

// Contact requests stay in the collection the [id] route and the session count read.
const CONTACT_REQUESTS = 'campus_contact_requests';

function whatsappText(serial: string, intent: ContactIntent) {
  return intent === 'offer' ? `Hey, I have what you asked for (${serial}) on Swoop` : `Hey, about ${serial} on Swoop`;
}

function listingHref(type: ContentType, id: string, audience: unknown) {
  const base = audience === 'girls' ? '/girls-space' : '';
  return `${base}/${type === 'marketplace' ? 'marketplace' : 'housing'}/${encodeURIComponent(id)}`;
}

function firstName(displayName: string) {
  return displayName.trim().split(/\s+/)[0] || 'A student';
}

function placeLabel(place: unknown): string | null {
  const label = (place as { label?: unknown } | null | undefined)?.label;
  return typeof label === 'string' && label.trim() ? label.trim() : null;
}

/** Tells the owner about a new request. A failed enqueue never fails the request. */
async function notifyOwner(input: {
  requestId: string;
  ownerId: string;
  type: ContentType;
  contentId: string;
  data: Record<string, unknown>;
  intent: ContactIntent;
  buyerDisplayName: string;
}) {
  const name = firstName(input.buyerDisplayName);
  const serial = String(input.data.serial || '');
  const listingTitle = typeof input.data.title === 'string' ? input.data.title.trim() : '';
  try {
    await enqueue([input.ownerId], {
      kind: 'contact_request',
      title: input.intent === 'offer' ? `${name} has what you asked for` : `${name} asked about ${serial}`,
      body: listingTitle ? `${listingTitle}. Approve to share your number.` : 'Approve to share your number.',
      href: listingHref(input.type, input.contentId, input.data.audience),
      ref: { type: 'contact_request', id: input.requestId },
      campusId: typeof input.data.campusId === 'string' ? input.data.campusId : null,
      actorDisplayName: name,
    });
  } catch (error) {
    console.error('[contact-requests] notify failed', error);
  }
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
    // Lets /campus/activity say 'has what you asked for' on an offer.
    intent: contactRequestIntent(data),
    title: data.title ?? null,
    placeLabel: data.placeLabel ?? null,
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
      const contact = await getAdminDb().collection('campus_private_contacts').doc(`${data.contentType}_${data.contentId}`).get();
      // Posts created before per-post contacts fall back to the legacy per-user profile.
      const number = contact.exists
        ? contact.data()?.whatsappNumber
        : (await getAdminDb().collection('campus_private_profiles').doc(data.sellerId).get()).data()?.whatsappNumber;
      const phone = digits(String(number || ''));
      if (phone) {
        const text = encodeURIComponent(whatsappText(String(data.serial || ''), contactRequestIntent(data)));
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
    const snapshot = await getAdminDb().collection(CONTACT_REQUESTS).where(field, '==', principal.userId).limit(150).get();
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
    const data = content.data() as Record<string, unknown>;
    await getCampusPrincipal({ requireVerified: true, audience: data.audience as CampusAudience, product: body.contentType });
    if (data.authorId === principal.userId) throw new CampusHttpError(409, 'You own this post');
    const id = `${body.contentType}_${body.contentId}_${principal.userId}`;
    const ref = getAdminDb().collection(CONTACT_REQUESTS).doc(id);
    const existing = await ref.get();
    // A declined request is final; re-requesting would let a buyer spam the seller.
    if (existing.exists && existing.data()!.status === 'declined') throw new CampusHttpError(409, 'The seller declined this request');
    if (existing.exists && ['pending', 'approved'].includes(existing.data()!.status)) {
      const existingData = existing.data()!;
      const pendingExpired = existingData.status === 'pending'
        && (existingData.expiresAt?.toDate?.().getTime() || 0) <= Date.now();
      if (!pendingExpired) return NextResponse.json({ id, status: existingData.status });
    }
    // A live reserve holds the post; contacts approved before it still work (isAvailable).
    if (liveStatus(data) === 'reserved') throw new CampusHttpError(409, 'Reserved for someone right now');
    const intent = intentFor(body.contentType, data);
    const now = new Date();
    await ref.set({
      contentType: body.contentType,
      contentId: body.contentId,
      serial: data.serial,
      intent,
      listingKind: body.contentType === 'marketplace' && typeof data.kind === 'string' ? data.kind : null,
      title: typeof data.title === 'string' ? data.title : null,
      placeLabel: placeLabel(data.place),
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
    await notifyOwner({
      requestId: id,
      ownerId: String(data.authorId || ''),
      type: body.contentType,
      contentId: body.contentId,
      data,
      intent,
      buyerDisplayName: String(principal.displayName || ''),
    });
    return NextResponse.json({ id, status: 'pending', intent }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid contact request' }, { status: 400 });
    return campusErrorResponse(error);
  }
}
