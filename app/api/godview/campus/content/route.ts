import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, requireAdminPrincipal } from '@/lib/campus/auth';
import { serializeHousing, serializeMarketplace, toIso } from '@/lib/campus/serialize';

export async function GET(request: NextRequest) {
  try {
    await requireAdminPrincipal();
    const type = request.nextUrl.searchParams.get('type') === 'housing' ? 'housing' : 'marketplace';
    const search = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
    const collection = type === 'housing' ? 'housing_posts' : 'marketplace_listings';
    const [content, reports] = await Promise.all([
      getAdminDb().collection(collection).limit(300).get(),
      getAdminDb().collection('campus_content_reports').where('status', '==', 'open').limit(300).get(),
    ]);
    const reportCounts = new Map<string, number>();
    reports.docs.forEach((report) => reportCounts.set(report.data().contentId, (reportCounts.get(report.data().contentId) || 0) + 1));
    const items = content.docs
      .filter((doc) => !search || String(doc.data().serial || '').toLowerCase().includes(search) || String(doc.data().title || '').toLowerCase().includes(search))
      .map((doc) => ({
        ...(type === 'housing' ? serializeHousing(doc, '__admin__') : serializeMarketplace(doc, '__admin__')),
        authorId: doc.data().authorId,
        reportCount: reportCounts.get(doc.id) || 0,
        updatedAt: toIso(doc.data().updatedAt),
      }));
    return NextResponse.json({ items });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminPrincipal();
    const body = await request.json();
    const type = body.type === 'housing' ? 'housing' : 'marketplace';
    const collection = type === 'housing' ? 'housing_posts' : 'marketplace_listings';
    const status = String(body.status || '');
    if (!['active', 'removed', 'closed'].includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    const ref = getAdminDb().collection(collection).doc(String(body.id || ''));
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new CampusHttpError(404, 'Content not found');
    await ref.update({
      status,
      'moderation.lastReviewedAt': Timestamp.now(),
      'moderation.lastReviewedBy': admin.email,
      'moderation.reason': String(body.reason || '').slice(0, 300),
      updatedAt: Timestamp.now(),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

