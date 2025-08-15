import { storage } from '@/lib/firebase/config';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

export async function uploadPdfAndGetUrl(userId: string, file: File): Promise<string> {
  const filePath = `uploads/${userId}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, filePath);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
