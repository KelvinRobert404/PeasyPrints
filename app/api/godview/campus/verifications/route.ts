import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { campusErrorResponse, requireAdminPrincipal } from '@/lib/campus/auth';
import { toIso } from '@/lib/campus/serialize';

export async function GET(request: NextRequest) {
  try {
    await requireAdminPrincipal();
    const status = request.nextUrl.searchParams.get('status') || 'pending';
    const snapshot = await getAdminDb().collection('campus_verification_requests').where('status', '==', status).limit(200).get();
    const items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        kind: data.kind,
        status: data.status,
        collegeCode: data.collegeCode,
        displayName: data.displayName,
        email: data.email || null,
        createdAt: toIso(data.createdAt),
      };
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({ items });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

