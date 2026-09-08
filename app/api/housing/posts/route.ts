import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { campusErrorResponse, getCampusPrincipal } from '@/lib/campus/auth';
import { AVAILABILITY_DAYS, addDays } from '@/lib/campus/constants';
import { createCampusContentWithSerial } from '@/lib/campus/serial';
import { isAvailable, serializeHousing, toDate } from '@/lib/campus/serialize';
import { orderCampusItems } from '@/lib/campus/policy';
import { assertOwnedCampusMedia } from '@/lib/campus/media';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rateLimit';

const createSchema = z.object({
  audience: z.enum(['campus', 'girls']).default('campus'),
  postType: z.enum(['room', 'roommate', 'replacement', 'sublet']),
  title: z.string().trim().min(4).max(90),
  description: z.string().trim().min(12).max(1600),
  rent: z.number().nonnegative().nullable().optional(),
  deposit: z.number().nonnegative().nullable().optional(),
  availableFrom: z.string().max(30).nullable().optional(),
  area: z.string().trim().min(2).max(100),
  commuteLabel: z.string().trim().max(100).nullable().optional(),
  occupancy: z.string().trim().max(50).nullable().optional(),
  furnishing: z.string().trim().max(50).nullable().optional(),
  amenities: z.array(z.string().trim().max(50)).max(12).default([]),
  images: z.array(z.string().startsWith('/api/campus/media/')).max(10).default([]),
  compatibility: z.object({
    budget: z.number().nonnegative().nullable().optional(),
    moveInDate: z.string().max(30).nullable().optional(),
    sleepSchedule: z.string().max(40).nullable().optional(),
    foodPreference: z.string().max(40).nullable().optional(),
    cleanliness: z.string().max(40).nullable().optional(),
    smokingPreference: z.string().max(40).nullable().optional(),
  }).nullable().optional(),
  whatsappNumber: z.string().trim().min(8).max(20),
  promotionEligible: z.boolean().default(true),
});

function routeAudience(request: NextRequest) {
  return request.nextUrl.pathname.startsWith('/api/girls-space/') ? 'girls' as const : 'campus' as const;
}

export async function GET(request: NextRequest) {
  try {
    const audience = routeAudience(request);
    const principal = await getCampusPrincipal({ requireVerified: true, audience, product: 'housing' });
    const mine = request.nextUrl.searchParams.get('mine') === '1';
    const selectedCollege = request.nextUrl.searchParams.get('collegeId') || principal.membership!.collegeId;
    const query = mine
      ? getAdminDb().collection('housing_posts').where('authorId', '==', principal.userId).limit(150)
      : getAdminDb().collection('housing_posts').where('status', '==', 'active').limit(200);
    const [snapshot, saves] = await Promise.all([
      query.get(),
      getAdminDb().collection('campus_saves').where('userId', '==', principal.userId).limit(500).get(),
    ]);
    const savedIds = new Set(saves.docs.filter((item) => item.data().contentType === 'housing').map((item) => item.data().contentId));
    const items = orderCampusItems(snapshot.docs
      .filter((doc) => doc.data().audience === audience && (mine || isAvailable(doc.data())))
      .sort((a, b) => (toDate(b.data().createdAt)?.getTime() || 0) - (toDate(a.data().createdAt)?.getTime() || 0))
      .map((doc) => serializeHousing(doc, principal.userId, savedIds)), selectedCollege);
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
    const parsed = { ...createSchema.parse(await request.json()), audience: routeAudience(request) };
    const principal = await getCampusPrincipal({ requireVerified: true, audience: parsed.audience, product: 'housing' });
    const rate = await checkRateLimit('housing-create', principal.userId, 10, 86400);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    await assertOwnedCampusMedia(parsed.images, principal.userId, parsed.audience);
    const membership = principal.membership!;
    const now = new Date();
    const result = await createCampusContentWithSerial({
      collection: 'housing_posts',
      collegeCode: membership.collegeCode,
      product: 'H',
      payload: {
        ...parsed,
        whatsappNumber: undefined,
        authorId: principal.userId,
        posterDisplayName: principal.displayName,
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
    await getAdminDb().collection('campus_private_profiles').doc(principal.userId).set({ whatsappNumber: parsed.whatsappNumber, updatedAt: Timestamp.now() }, { merge: true });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid housing post' }, { status: 400 });
    return campusErrorResponse(error);
  }
}
