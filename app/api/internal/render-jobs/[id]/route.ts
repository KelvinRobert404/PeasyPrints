import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { bearerToken, safeTokenEqual } from '@/lib/server/secrets';

function authorized(request: NextRequest) {
  const token = bearerToken(request.headers.get('authorization')) || request.headers.get('x-video-worker-token');
  return safeTokenEqual(token, process.env.VIDEO_WORKER_TOKEN);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!authorized(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json();
  if (!['succeeded', 'failed'].includes(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  const db = getAdminDb();
  const ref = db.collection('campus_render_packs').doc(id);
  const workerId = request.headers.get('x-worker-id') || 'peasy-comotion';
  const result = await db.runTransaction(async (transaction) => {
    const job = await transaction.get(ref);
    if (!job.exists) return 'not_found' as const;
    if (job.data()!.status !== 'running' || job.data()!.lockedBy !== workerId) {
      return 'conflict' as const;
    }
    transaction.update(ref, {
      status: body.status,
      assets: Array.isArray(body.assets) ? body.assets : [],
      errorMessage: body.status === 'failed' ? String(body.errorMessage || 'Render failed').slice(0, 1000) : null,
      completedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return 'updated' as const;
  });
  if (result === 'not_found') return NextResponse.json({ error: 'Render job not found' }, { status: 404 });
  if (result === 'conflict') return NextResponse.json({ error: 'Render job is not owned by this worker' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
