import { storage } from '@/lib/firebase/config';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';

export async function uploadPdfAndGetUrl(userId: string, file: File): Promise<string> {
  try {
    // Prefer local server endpoint to bypass CORS entirely
    const form = new FormData();
    form.append('file', file);
    form.append('userId', userId);
    const res = await fetch('/api/storage/upload', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok || !data?.url) throw new Error(data?.error || 'Upload failed');
    return data.url as string;
  } catch (e) {
    // Fallback to client SDK if server endpoint not available
    const filePath = `uploads/${userId}/${Date.now()}-${file.name}`;
    const storageRef = ref(storage, filePath);
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type || 'application/pdf' });
    await new Promise<void>((resolve, reject) => {
      task.on('state_changed', () => {}, reject, () => resolve());
    });
    return getDownloadURL(task.snapshot.ref);
  }
}
