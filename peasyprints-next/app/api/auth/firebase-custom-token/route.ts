import { NextRequest, NextResponse } from 'next/server';
import { auth as clerkAuth } from '@clerk/nextjs/server';
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
    const customToken = await admin.auth().createCustomToken(userId, { provider: 'clerk' });
    return NextResponse.json({ token: customToken });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to mint token' }, { status: 500 });
  }
}


