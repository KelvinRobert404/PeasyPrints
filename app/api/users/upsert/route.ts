import { NextRequest, NextResponse } from 'next/server';
import { auth as clerkAuth, clerkClient } from '@clerk/nextjs/server';
import admin from 'firebase-admin';

let adminInitialized = false;
function ensureAdminInit() {
  if (adminInitialized) return;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin envs');
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
  adminInitialized = true;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await clerkAuth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    ensureAdminInit();

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const username = user.username || [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
    const email = user.emailAddresses?.find(e => e.id === user.primaryEmailAddressId)?.emailAddress || user.emailAddresses?.[0]?.emailAddress || null;
    const phoneNumber = user.phoneNumbers?.find(p => p.id === user.primaryPhoneNumberId)?.phoneNumber || user.phoneNumbers?.[0]?.phoneNumber || null;

    const payload: any = {
      username,
      phoneNumber,
      email,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = admin.firestore().collection('users').doc(userId);
    const snap = await ref.get();
    if (!snap.exists) {
      payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }
    await ref.set(payload, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to upsert user' }, { status: 500 });
  }
}


