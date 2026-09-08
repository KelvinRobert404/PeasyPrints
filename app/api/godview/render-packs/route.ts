import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, requireAdminPrincipal } from '@/lib/campus/auth';
import { isAvailable, toIso } from '@/lib/campus/serialize';

const createSchema = z.object({
  type: z.enum(['marketplace', 'housing']),
  contentIds: z.array(z.string().min(1).max(100)).max(8),
  templateId: z.string().min(1).max(80),
});

function priceLabel(type: 'marketplace' | 'housing', data: any) {
  const value = type === 'marketplace' ? data.price : data.rent;
  if (typeof value !== 'number') return type === 'marketplace' && data.postType === 'free' ? 'Free' : 'Ask for details';
  return type === 'housing' ? `₹${value.toLocaleString('en-IN')}/month` : `₹${value.toLocaleString('en-IN')}`;
}

export async function GET() {
  try {
    await requireAdminPrincipal();
    const snapshot = await getAdminDb().collection('campus_render_packs').limit(100).get();
    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: toIso(doc.data().createdAt), updatedAt: toIso(doc.data().updatedAt), propsSnapshot: undefined }));
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({ items });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminPrincipal();
    const body = createSchema.parse(await request.json());
    if (new Set(body.contentIds).size !== body.contentIds.length) return NextResponse.json({ error: 'A post can only appear once in a reel' }, { status: 400 });
    const minimum = body.type === 'marketplace' ? 4 : 3;
    const maximum = body.type === 'marketplace' ? 8 : 5;
    if (body.contentIds.length < minimum || body.contentIds.length > maximum) {
      return NextResponse.json({ error: `${body.type === 'marketplace' ? 'Marketplace' : 'Housing'} packs require ${minimum}–${maximum} posts` }, { status: 400 });
    }
    const collection = body.type === 'marketplace' ? 'marketplace_listings' : 'housing_posts';
    const snapshots = await Promise.all(body.contentIds.map((id) => getAdminDb().collection(collection).doc(id).get()));
    if (snapshots.some((snapshot) => !snapshot.exists)) throw new CampusHttpError(404, 'One or more selected posts no longer exist');
    const origin = request.nextUrl.origin;
    const items = snapshots.map((snapshot) => {
      const data = snapshot.data()!;
      if (data.audience !== 'campus' || data.promotionEligible === false || !isAvailable(data)) {
        throw new CampusHttpError(409, `${data.serial || snapshot.id} is not eligible for public promotion`);
      }
      const imagePath = Array.isArray(data.images) ? data.images[0] || '' : '';
      const mediaId = imagePath.match(/\/api\/campus\/media\/([^/?]+)/)?.[1] || null;
      return {
        id: snapshot.id,
        serial: data.serial,
        title: data.title,
        mediaId,
        collegeCode: data.collegeCode,
        priceLabel: priceLabel(body.type, data),
        metadata: body.type === 'marketplace'
          ? [data.category, data.pickupLabel || data.area].filter(Boolean)
          : [data.area, data.commuteLabel, data.postType].filter(Boolean),
        deepLink: `${origin}/${body.type === 'marketplace' ? 'marketplace' : 'housing'}/${snapshot.id}`,
      };
    });
    const ref = getAdminDb().collection('campus_render_packs').doc();
    const now = Timestamp.now();
    await ref.set({
      type: body.type,
      templateId: body.templateId,
      compositionId: body.type === 'marketplace' ? 'PeasyMarketplaceReel' : 'PeasyHousingReel',
      status: 'queued',
      requestedBy: admin.email,
      propsSnapshot: {
        packId: ref.id,
        brand: 'PeasyPrints',
        college: { code: 'KJU', name: 'Kristu Jayanti University' },
        items,
      },
      assets: [],
      createdAt: now,
      updatedAt: now,
      lockedAt: null,
      lockedBy: null,
    });
    return NextResponse.json({ id: ref.id, status: 'queued' }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid render pack' }, { status: 400 });
    return campusErrorResponse(error);
  }
}
