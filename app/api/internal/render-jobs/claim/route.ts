import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin';
import { bearerToken, safeTokenEqual } from '@/lib/server/secrets';

function authorized(request: NextRequest) {
  const token = bearerToken(request.headers.get('authorization')) || request.headers.get('x-video-worker-token');
  return safeTokenEqual(token, process.env.VIDEO_WORKER_TOKEN);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = getAdminDb();
  const workerId = String(request.headers.get('x-worker-id') || 'peasy-comotion').slice(0, 100);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const next = await db.collection('campus_render_packs').where('status', '==', 'queued').limit(1).get();
    if (next.empty) return NextResponse.json({ data: null });
    const ref = next.docs[0].ref;
    const claimed = await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(ref);
      if (!fresh.exists || fresh.data()!.status !== 'queued' || fresh.data()!.lockedAt) return null;
      transaction.update(ref, { status: 'running', lockedAt: Timestamp.now(), lockedBy: workerId, updatedAt: Timestamp.now() });
      return { id: fresh.id, ...fresh.data() } as any;
    });
    if (!claimed) continue;
    const props: { items: Array<Record<string, unknown>>; [key: string]: unknown } = {
      ...(claimed.propsSnapshot as Record<string, unknown>),
      items: Array.isArray(claimed.propsSnapshot?.items) ? claimed.propsSnapshot.items : [],
    };
    props.items = await Promise.all((props.items || []).map(async (item: any) => {
      if (!item.mediaId) return { ...item, imageUrl: '' };
      const media = await db.collection('campus_media').doc(item.mediaId).get();
      if (!media.exists || media.data()!.audience !== 'campus') return { ...item, imageUrl: '' };
      const [imageUrl] = await getAdminBucket().file(media.data()!.path).getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 });
      return { ...item, imageUrl, mediaId: undefined };
    }));
    return NextResponse.json({ data: { id: claimed.id, type: claimed.type, compositionId: claimed.compositionId, templateId: claimed.templateId, props } });
  }
  return NextResponse.json({ data: null });
}
