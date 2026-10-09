import { NextRequest, NextResponse } from 'next/server';
import { auth as clerkAuth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { isAdminUser } from '@/lib/admin/config';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await clerkAuth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const customToken = await getAuth(getAdminApp()).createCustomToken(userId, { provider: 'clerk', admin: isAdminUser(clerkUser) });
    return NextResponse.json({ token: customToken }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('[firebase-custom-token]', e);
    return NextResponse.json({ error: 'Failed to mint token' }, { status: 500 });
  }
}


