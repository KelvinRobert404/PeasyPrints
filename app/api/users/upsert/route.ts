import { NextRequest, NextResponse } from 'next/server';
import { auth as clerkAuth, clerkClient } from '@clerk/nextjs/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await clerkAuth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const username = user.username || [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
    const email = user.emailAddresses?.find(e => e.id === user.primaryEmailAddressId)?.emailAddress || user.emailAddresses?.[0]?.emailAddress || null;
    const phoneNumber = user.phoneNumbers?.find(p => p.id === user.primaryPhoneNumberId)?.phoneNumber || user.phoneNumbers?.[0]?.phoneNumber || null;

    const payload: any = {
      username,
      phoneNumber,
      email,
      updatedAt: FieldValue.serverTimestamp(),
    };

    const ref = getAdminDb().collection('users').doc(userId);
    const snap = await ref.get();
    if (!snap.exists) {
      payload.createdAt = FieldValue.serverTimestamp();
    }
    await ref.set(payload, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to upsert user' }, { status: 500 });
  }
}


