import { NextRequest, NextResponse } from 'next/server';
import { auth as clerkAuth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { isAdminEmail } from '@/lib/admin/config';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await clerkAuth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const email = clerkUser.emailAddresses.find((item) => item.id === clerkUser.primaryEmailAddressId)?.emailAddress || null;
    const customToken = await getAuth(getAdminApp()).createCustomToken(userId, { provider: 'clerk', admin: isAdminEmail(email) });
    return NextResponse.json({ token: customToken });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to mint token' }, { status: 500 });
  }
}


