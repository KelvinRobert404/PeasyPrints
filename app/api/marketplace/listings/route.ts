import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { campusErrorResponse, getCampusPrincipal } from '@/lib/campus/auth';
import { AVAILABILITY_DAYS, MARKETPLACE_CATEGORIES, addDays } from '@/lib/campus/constants';
import { createCampusContentWithSerial } from '@/lib/campus/serial';
import { isAvailable, serializeMarketplace, toDate } from '@/lib/campus/serialize';
import { orderCampusItems } from '@/lib/campus/policy';
import { assertOwnedCampusMedia } from '@/lib/campus/media';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rateLimit';

const createSchema = z.object({
  audience: z.enum(['campus', 'girls']).default('campus'),
  postType: z.enum(['sell', 'wanted', 'free']),
  category: z.enum(MARKETPLACE_CATEGORIES),
  title: z.string().trim().min(4).max(90),
  description: z.string().trim().min(8).max(1200),
  price: z.number().nonnegative().nullable().optional(),
  negotiable: z.boolean().default(false),
  condition: z.string().trim().max(40).nullable().optional(),
  images: z.array(z.string().startsWith('/api/campus/media/')).max(5).default([]),
  pickupPointId: z.string().trim().max(60).nullable().optional(),
  pickupLabel: z.string().trim().max(100).nullable().optional(),
  area: z.string().trim().max(100).nullable().optional(),
  whatsappNumber: z.string().trim().min(8).max(20),
  promotionEligible: z.boolean().default(true),
});

function routeAudience(request: NextRequest) {
  return request.nextUrl.pathname.startsWith('/api/girls-space/') ? 'girls' as const : 'campus' as const;
}

export async function GET(request: NextRequest) {
  try {
    const audience = routeAudience(request);
    const principal = await getCampusPrincipal({ requireVerified: true, audience, product: 'marketplace' });
    const mine = request.nextUrl.searchParams.get('mine') === '1';
    const selectedCollege = request.nextUrl.searchParams.get('collegeId') || principal.membership!.collegeId;

    const query = mine
      ? getAdminDb().collection('marketplace_listings').where('authorId', '==', principal.userId).limit(150)
      : getAdminDb().collection('marketplace_listings').where('status', '==', 'active').limit(200);
    const [snapshot, saves] = await Promise.all([
      query.get(),
      getAdminDb().collection('campus_saves').where('userId', '==', principal.userId).limit(500).get(),
    ]);
    const savedIds = new Set(saves.docs.filter((item) => item.data().contentType === 'marketplace').map((item) => item.data().contentId));
    const docs = snapshot.docs
      .filter((doc) => doc.data().audience === audience && (mine || isAvailable(doc.data())))
      .sort((a, b) => (toDate(b.data().createdAt)?.getTime() || 0) - (toDate(a.data().createdAt)?.getTime() || 0));
    const items = orderCampusItems(docs.map((doc) => serializeMarketplace(doc, principal.userId, savedIds)), selectedCollege);
    return NextResponse.json(mine ? { items } : {
      own: items.filter((item) => item.collegeId === selectedCollege),
      other: items.filter((item) => item.collegeId !== selectedCollege),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = { ...createSchema.parse(raw), audience: routeAudience(request) };
    const principal = await getCampusPrincipal({ requireVerified: true, audience: parsed.audience, product: 'marketplace' });
    const rate = await checkRateLimit('marketplace-create', principal.userId, 20, 86400);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    await assertOwnedCampusMedia(parsed.images, principal.userId, parsed.audience);
    const now = new Date();
    const membership = principal.membership!;
    const result = await createCampusContentWithSerial({
      collection: 'marketplace_listings',
      collegeCode: membership.collegeCode,
      product: 'M',
      payload: {
        ...parsed,
        whatsappNumber: undefined,
        authorId: principal.userId,
        sellerDisplayName: principal.displayName,
        collegeId: membership.collegeId,
        collegeCode: membership.collegeCode,
        collegeName: membership.collegeName,
        status: 'active',
        promotionEligible: parsed.audience === 'campus' && parsed.promotionEligible,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
        availabilityConfirmedAt: Timestamp.fromDate(now),
        availabilityExpiresAt: Timestamp.fromDate(addDays(now, AVAILABILITY_DAYS)),
        moderation: { reportCount: 0, lastReviewedAt: null },
      },
    });
    await getAdminDb().collection('campus_private_profiles').doc(principal.userId).set({
      whatsappNumber: parsed.whatsappNumber,
      updatedAt: Timestamp.now(),
    }, { merge: true });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid listing' }, { status: 400 });
    return campusErrorResponse(error);
  }
}
