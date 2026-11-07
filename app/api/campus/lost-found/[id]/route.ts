import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, getCampusPrincipal } from '@/lib/campus/auth';
import { CAMPUS_COLLECTIONS } from '@/lib/campus/constants';
import {
  CLAIM_MESSAGE_MAX,
  MAX_CLAIMS_PER_POST,
  claimOf,
  redactForViewer,
  verifyClaimAnswer,
  type LostFoundClaimRecord,
  type LostFoundRecord,
} from '@/lib/campus/lostFound';
import { PICK_COLLEGE_FIRST_MESSAGE } from '@/lib/campus/membership';
import { enqueue } from '@/lib/campus/notify';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rateLimit';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const PAGE_HREF = '/campus/lost-found';

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('claim'),
    answer: z.string().trim().min(1, 'Type your answer').max(CLAIM_MESSAGE_MAX, 'Keep it short'),
  }),
  z.object({ action: z.literal('approve_claim'), claimId: z.string().trim().min(1).max(80) }),
  z.object({ action: z.literal('returned') }),
  z.object({ action: z.literal('close') }),
]);

type Patch = z.output<typeof patchSchema>;

/** Who to tell after the write, sent best effort once the transaction commits. */
type FollowUp = { userId: string; kind: 'lost_found_match' | 'contact_approved'; title: string } | null;

function notFound(): never {
  throw new CampusHttpError(404, 'Post not found');
}

/** Claim, approve a claim (reveals the poster's contact to that claimant), mark returned, or close. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id || id.includes('/') || id.length > 200) notFound();
    const principal = await getCampusPrincipal({ requireVerified: true, product: 'lostFound' });
    if (principal.blocked) throw new CampusHttpError(403, 'Your account is paused');
    const campus = principal.campus;
    if (!campus) throw new CampusHttpError(409, PICK_COLLEGE_FIRST_MESSAGE);
    const body: Patch = patchSchema.parse(await request.json());

    if (body.action === 'claim') {
      const rate = await checkRateLimit('lost-found-claim', principal.userId, 15, 3600);
      if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    }

    const db = getAdminDb();
    const ref = db.collection(CAMPUS_COLLECTIONS.lostFound).doc(id);
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) notFound();
      const item = snapshot.data() as LostFoundRecord;
      // Posts on other campuses do not exist for this viewer.
      if (item.campusId !== campus.id || item.status === 'removed') notFound();
      const isOwner = item.authorId === principal.userId;
      const now = Timestamp.now();
      const claims: Record<string, LostFoundClaimRecord> = { ...(item.claims ?? {}) };
      let next: LostFoundRecord = item;
      let followUp: FollowUp = null;

      if (body.action === 'claim') {
        if (isOwner) throw new CampusHttpError(403, 'This is your own post');
        if (item.status !== 'open') throw new CampusHttpError(409, 'This post is closed');
        if (claimOf(item, principal.userId)) throw new CampusHttpError(409, 'You already asked');
        if (Object.keys(claims).length >= MAX_CLAIMS_PER_POST) throw new CampusHttpError(409, 'Too many asks on this post');
        const claimId = crypto.randomUUID();
        claims[claimId] = {
          claimantId: principal.userId,
          claimantName: principal.displayName,
          answer: body.answer,
          matches: item.claimAnswer ? verifyClaimAnswer(item.claimAnswer, body.answer) : null,
          status: 'pending',
          createdAt: now,
          decidedAt: null,
        };
        next = { ...item, claims, updatedAt: now };
        transaction.update(ref, { claims, updatedAt: now });
        followUp = { userId: item.authorId, kind: 'lost_found_match', title: 'Someone asked about your post' };
      } else {
        if (!isOwner) throw new CampusHttpError(403, 'Only the poster can do this');
        if (body.action === 'approve_claim') {
          if (item.status !== 'open') throw new CampusHttpError(409, 'This post is closed');
          const claim = claims[body.claimId];
          if (!claim) throw new CampusHttpError(404, 'Ask not found');
          if (claim.status !== 'approved') {
            claims[body.claimId] = { ...claim, status: 'approved', decidedAt: now };
            next = { ...item, claims, updatedAt: now };
            transaction.update(ref, { claims, updatedAt: now });
            followUp = { userId: claim.claimantId, kind: 'contact_approved', title: 'The poster approved your ask' };
          }
        } else {
          const status = body.action === 'returned' ? 'returned' : 'closed';
          if (item.status !== status) {
            if (item.status !== 'open') throw new CampusHttpError(409, 'This post is already closed');
            next = { ...item, status, updatedAt: now };
            transaction.update(ref, { status, updatedAt: now });
          }
        }
      }
      return { next, followUp };
    });

    if (result.followUp) {
      try {
        await enqueue([result.followUp.userId], {
          kind: result.followUp.kind,
          title: result.followUp.title,
          href: PAGE_HREF,
          ref: { type: 'lost_found', id },
          campusId: campus.id,
          actorDisplayName: principal.displayName,
        });
      } catch (error) {
        console.error('[lost-found] notify failed', error);
      }
    }

    return NextResponse.json({ item: redactForViewer({ ...result.next, id }, principal.userId) }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid request' }, { status: 400, headers: NO_STORE });
    }
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
    return campusErrorResponse(error);
  }
}
