import { storage } from '@/lib/firebase/config';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';

export async function uploadPdfAndGetPath(_userId: string, file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/storage/upload', { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.path) throw new Error(data?.error || 'Upload failed');
  return data.path as string;
}

// Generic image upload for marketplace listing images
export async function uploadListingImage(userId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const allowed = ['jpg', 'jpeg', 'png', 'webp'];
  if (!allowed.includes(ext)) {
    throw new Error('Only JPG, PNG, or WEBP images are allowed');
  }
  const maxBytes = 5 * 1024 * 1024; // 5MB
  if (file.size > maxBytes) {
    throw new Error('Image too large (max 5MB)');
  }

  const filePath = `listing_images/${userId}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, filePath);
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type || 'image/jpeg',
  });

  await new Promise<void>((resolve, reject) => {
    task.on('state_changed', () => {}, reject, () => resolve());
  });

  return getDownloadURL(task.snapshot.ref);
}
