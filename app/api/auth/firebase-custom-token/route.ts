import { NextRequest, NextResponse } from 'next/server';
import { auth as clerkAuth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { isAdminUser } from '@/lib/admin/config';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from '@/lib/firebase/admin';
import { isDemoMode } from '@/lib/demo/mode';
import { demoTokenFor } from '@/lib/demo/server/identity';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await clerkAuth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Demo: a stand-in token the Firebase client stand-in and requestAuth understand.
    if (isDemoMode()) return NextResponse.json({ token: demoTokenFor(userId) }, { headers: { 'Cache-Control': 'no-store' } });

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const customToken = await getAuth(getAdminApp()).createCustomToken(userId, { provider: 'clerk', admin: isAdminUser(clerkUser) });
    return NextResponse.json({ token: customToken }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('[firebase-custom-token]', e);
    return NextResponse.json({ error: 'Failed to mint token' }, { status: 500 });
  }
}


