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

/**
 * Page count recorded by /api/storage/upload when it parsed the PDF. Only the
 * server can write under uploads/, so this metadata is trustworthy for pricing.
 */
export async function getVerifiedUploadPageCount(path: string, userId: string): Promise<number> {
  assertOwnedUploadPath(path, userId);
  let custom: Record<string, unknown> | undefined;
  try {
    const [metadata] = await getAdminBucket().file(path).getMetadata();
    custom = metadata.metadata as Record<string, unknown> | undefined;
  } catch {
    throw new Error('Uploaded file not found');
  }
  const pageCount = Number(custom?.pageCount);
  // Zero is valid for one half of a split assignment (e.g. every page in colour).
  if (custom?.ownerId !== userId || !Number.isInteger(pageCount) || pageCount < 0) {
    throw new Error('Uploaded file could not be verified');
  }
  return pageCount;
}

export function protectedOrderFileUrl(orderId: string, variant = 'original') {
  return `/api/orders/${encodeURIComponent(orderId)}/file?variant=${encodeURIComponent(variant)}`;
}
