import { db, auth } from '@/lib/firebase/config';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';

export async function recordAdminAction(action: string, details: Record<string, any>) {
  const userId = auth.currentUser?.uid || 'unknown';
  const ref = doc(collection(db, 'admin_actions'));
  await setDoc(ref, {
    action,
    details,
    actorId: userId,
    createdAt: serverTimestamp() as any,
  } as any);
}


