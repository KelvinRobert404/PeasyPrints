import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, getCampusPrincipal } from '@/lib/campus/auth';

const schema = z.object({
  action: z.enum(['save', 'unsave', 'report']),
  contentType: z.enum(['marketplace', 'housing']),
  contentId: z.string().min(1).max(100),
  reason: z.string().trim().min(3).max(400).optional(),
});

function collectionFor(type: 'marketplace' | 'housing') {
  return type === 'marketplace' ? 'marketplace_listings' : 'housing_posts';
}

export async function POST(request: NextRequest) {
  try {
    const principal = await getCampusPrincipal({ requireVerified: true });
    const body = schema.parse(await request.json());
    const content = await getAdminDb().collection(collectionFor(body.contentType)).doc(body.contentId).get();
    if (!content.exists) throw new CampusHttpError(404, 'Post not found');
    await getCampusPrincipal({ requireVerified: true, audience: content.data()!.audience, product: body.contentType });

    const saveId = `${principal.userId}_${body.contentType}_${body.contentId}`;
    if (body.action === 'save') {
      await getAdminDb().collection('campus_saves').doc(saveId).set({
        userId: principal.userId,
        contentType: body.contentType,
        contentId: body.contentId,
        createdAt: Timestamp.now(),
      });
    } else if (body.action === 'unsave') {
      await getAdminDb().collection('campus_saves').doc(saveId).delete();
    } else {
      if (!body.reason) return NextResponse.json({ error: 'A report reason is required' }, { status: 400 });
      await getAdminDb().runTransaction(async (transaction) => {
        const contentRef = getAdminDb().collection(collectionFor(body.contentType)).doc(body.contentId);
        const reportRef = getAdminDb().collection('campus_content_reports').doc(crypto.randomUUID());
        transaction.create(reportRef, {
          reporterId: principal.userId,
          contentType: body.contentType,
          contentId: body.contentId,
          serial: content.data()!.serial,
          reason: body.reason,
          status: 'open',
          createdAt: Timestamp.now(),
        });
        transaction.update(contentRef, { 'moderation.reportCount': FieldValue.increment(1), updatedAt: Timestamp.now() });
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid action' }, { status: 400 });
    return campusErrorResponse(error);
  }
}
