import { NextRequest, NextResponse } from 'next/server';
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, requireAdminPrincipal } from '@/lib/campus/auth';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminPrincipal();
    const { id } = await context.params;
    const name = request.nextUrl.searchParams.get('name') || 'posting-pack.zip';
    const pack = await getAdminDb().collection('campus_render_packs').doc(id).get();
    if (!pack.exists || pack.data()!.status !== 'succeeded') throw new CampusHttpError(404, 'Render artifact is not ready');
    const asset = (pack.data()!.assets || []).find((item: any) => item.name === name);
    if (!asset?.path) throw new CampusHttpError(404, 'Artifact not found');
    const [url] = await getAdminBucket().file(asset.path).getSignedUrl({ action: 'read', expires: Date.now() + 10 * 60 * 1000 });
    return NextResponse.redirect(url);
  } catch (error) {
    return campusErrorResponse(error);
  }
}

