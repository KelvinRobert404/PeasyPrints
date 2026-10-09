import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from '@/lib/firebase/admin';
import { bearerToken } from '@/lib/server/secrets';

/**
 * The caller's Firebase-compatible user id. Shop owners sign in to the shopfront
 * with Firebase email/password and their shop doc is keyed by that Firebase uid,
 * so a verified Firebase ID token is accepted first. Customers bridged from Clerk
 * have uid === Clerk userId, so the Clerk session is the fallback.
 */
export async function getRequestUserId(request: Request): Promise<string | null> {
  const token = bearerToken(request.headers.get('authorization'));
  if (token) {
    try {
      const decoded = await getAuth(getAdminApp()).verifyIdToken(token, true);
      return decoded.uid;
    } catch {
      return null;
    }
  }
  const { userId } = await auth();
  return userId;
}
