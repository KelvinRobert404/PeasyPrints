import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isAdminUser, verifiedPrimaryEmail } from '@/lib/admin/config';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ isAdmin: false }, { status: 401 });
  const user = await currentUser();
  const email = verifiedPrimaryEmail(user);
  const isAdmin = isAdminUser(user);
  return NextResponse.json({ isAdmin, email: isAdmin ? email : null }, { status: isAdmin ? 200 : 403, headers: { 'Cache-Control': 'no-store' } });
}
