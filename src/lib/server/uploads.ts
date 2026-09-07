import { getAdminBucket } from '@/lib/firebase/admin';

export function assertOwnedUploadPath(path: string, userId: string) {
  const prefix = `uploads/${userId}/`;
  if (!path.startsWith(prefix) || path.includes('..') || !path.toLowerCase().endsWith('.pdf')) {
    throw new Error('Invalid upload path');
  }
}

export async function assertUploadExists(path: string, userId: string) {
  assertOwnedUploadPath(path, userId);
  const [exists] = await getAdminBucket().file(path).exists();
  if (!exists) throw new Error('Uploaded file not found');
}

export function protectedOrderFileUrl(orderId: string, variant = 'original') {
  return `/api/orders/${encodeURIComponent(orderId)}/file?variant=${encodeURIComponent(variant)}`;
}
