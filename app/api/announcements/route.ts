import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getAdminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ANNOUNCEMENTS_DIR = path.join(process.cwd(), 'public', 'announcements');
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

export async function GET() {
  try {
    // Try Firestore first
    const firestoreImages = await getFirestoreAnnouncements();
    if (firestoreImages.length > 0) {
      return NextResponse.json({ images: firestoreImages }, { status: 200 });
    }

    // Fallback to file system
    const stat = await fs.stat(ANNOUNCEMENTS_DIR).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      return NextResponse.json({ images: [] }, { status: 200 });
    }

    const files = await fs.readdir(ANNOUNCEMENTS_DIR);
    const images = files
      .filter((name) => ALLOWED_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .sort()
      .map((filename) => ({
        src: `/announcements/${filename}`,
        alt: filename.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' '),
      }));

    return NextResponse.json({ images }, { status: 200 });
  } catch (_error) {
    return NextResponse.json({ images: [], error: 'Failed to read announcements' }, { status: 200 });
  }
}

async function getFirestoreAnnouncements(): Promise<{ src: string; alt: string }[]> {
  try {
    // Rules restrict this collection to admins, so read it with the Admin SDK.
    const snapshot = await getAdminDb()
      .collection('announcements')
      .where('active', '==', true)
      .orderBy('order', 'asc')
      .get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        src: data.imageUrl || '',
        alt: data.alt || 'Announcement',
      };
    }).filter((img) => img.src); // Filter out empty URLs
  } catch (error) {
    console.error('Error fetching Firestore announcements:', error);
    return [];
  }
}
