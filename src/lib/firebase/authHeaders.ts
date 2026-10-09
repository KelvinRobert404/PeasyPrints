import { auth } from '@/lib/firebase/config';

/**
 * Authorization header carrying the current Firebase ID token. Shopfront owners
 * are signed in to Firebase (not Clerk), so shop API calls must send this.
 */
export async function firebaseAuthHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Opens a protected order file (/api/orders/:id/file) in a new tab. A plain link
 * can't carry the ID token, so fetch the short-lived signed URL first. The tab is
 * opened synchronously so popup blockers treat it as user-initiated.
 */
export async function openProtectedFile(fileUrl: string) {
  const tab = window.open('', '_blank');
  try {
    const separator = fileUrl.includes('?') ? '&' : '?';
    const response = await fetch(`${fileUrl}${separator}format=json`, { headers: await firebaseAuthHeaders() });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.url) throw new Error(data?.error || 'Unable to open file');
    if (tab) {
      tab.opener = null;
      tab.location.href = data.url;
    } else {
      window.location.assign(data.url);
    }
  } catch (error) {
    tab?.close();
    throw error;
  }
}
