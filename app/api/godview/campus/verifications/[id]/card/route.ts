import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, requireAdminPrincipal } from '@/lib/campus/auth';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminPrincipal();
    const { id } = await context.params;
    const snapshot = await getAdminDb().collection('campus_verification_requests').doc(id).get();
    const path = snapshot.data()?.idCardPath;
    if (!snapshot.exists || !path) throw new CampusHttpError(404, 'iCard is not available');
    const [url] = await getAdminBucket().file(path).getSignedUrl({ action: 'read', expires: Date.now() + 5 * 60 * 1000 });
    await getAdminDb().collection('campus_admin_audit').add({
      action: 'view_id_card',
      verificationRequestId: id,
      adminUserId: admin.userId,
      adminEmail: admin.email,
      createdAt: Timestamp.now(),
    });
    return NextResponse.redirect(url, { status: 307, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return campusErrorResponse(error);
  }
}
