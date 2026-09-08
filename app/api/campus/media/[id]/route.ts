import { NextRequest, NextResponse } from 'next/server';
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin';
import { campusErrorResponse, getCampusPrincipal } from '@/lib/campus/auth';
import { safeTokenEqual } from '@/lib/server/secrets';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const snapshot = await getAdminDb().collection('campus_media').doc(id).get();
    if (!snapshot.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const data = snapshot.data()!;
    const workerToken = request.headers.get('x-video-worker-token');
    const workerAllowed = safeTokenEqual(workerToken, process.env.VIDEO_WORKER_TOKEN) && data.audience === 'campus';
    if (!workerAllowed) {
      const principal = await getCampusPrincipal({ requireVerified: true, audience: data.audience });
      if (data.collegeId && data.collegeId !== principal.membership?.collegeId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const [buffer] = await getAdminBucket().file(data.path).download();
    const body = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    return new NextResponse(body, {
      headers: {
        'Content-Type': data.contentType || 'image/jpeg',
        'Cache-Control': data.audience === 'girls' ? 'private, no-store' : 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return campusErrorResponse(error);
  }
}
