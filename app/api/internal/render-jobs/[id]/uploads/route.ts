import { NextRequest, NextResponse } from 'next/server';
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin';
import { bearerToken, safeTokenEqual } from '@/lib/server/secrets';

const FILES = ['video.mp4', 'cover.png', 'caption.txt', 'manifest.json', 'deep-links.json', 'posting-pack.zip'] as const;

function authorized(request: NextRequest) {
  const token = bearerToken(request.headers.get('authorization')) || request.headers.get('x-video-worker-token');
  return safeTokenEqual(token, process.env.VIDEO_WORKER_TOKEN);
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!authorized(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await context.params;
  const job = await getAdminDb().collection('campus_render_packs').doc(id).get();
  const workerId = request.headers.get('x-worker-id') || 'peasy-comotion';
  if (!job.exists) return NextResponse.json({ error: 'Render job not found' }, { status: 404 });
  if (job.data()!.status !== 'running' || job.data()!.lockedBy !== workerId) {
    return NextResponse.json({ error: 'Render job is not owned by this worker' }, { status: 409 });
  }
  const urls = await Promise.all(FILES.map(async (name) => {
    const path = `campus_render_packs/${id}/${name}`;
    const options: { action: 'write'; expires: number; contentType?: string } = { action: 'write', expires: Date.now() + 60 * 60 * 1000 };
    if (name.endsWith('.mp4')) options.contentType = 'video/mp4';
    const [uploadUrl] = await getAdminBucket().file(path).getSignedUrl(options);
    return { name, path, uploadUrl };
  }));
  return NextResponse.json({ data: urls });
}
