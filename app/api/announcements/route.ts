import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

const ANNOUNCEMENTS_DIR = path.join(process.cwd(), 'public', 'announcements');
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

export async function GET() {
  try {
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


