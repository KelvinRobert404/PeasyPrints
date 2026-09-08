import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin';
import { campusErrorResponse, getCampusPrincipal } from '@/lib/campus/auth';
import type { CampusAudience } from '@/types/campus';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rateLimit';
import { matchesDeclaredFileType } from '@/lib/server/fileValidation';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const audience = form.get('audience') === 'girls' ? 'girls' : 'campus' as CampusAudience;
    const principal = await getCampusPrincipal({ requireVerified: true, audience });
    const rate = await checkRateLimit('campus-media', principal.userId, 30, 3600);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return NextResponse.json({ error: 'Use a JPG, PNG, or WEBP image' }, { status: 400 });
    }
    if (file.size > 6 * 1024 * 1024) return NextResponse.json({ error: 'Image must be under 6MB' }, { status: 413 });

    const id = crypto.randomUUID();
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `campus_media/${principal.userId}/${id}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!matchesDeclaredFileType(buffer, file.type)) return NextResponse.json({ error: 'File content does not match its declared image type' }, { status: 400 });
    await getAdminBucket().file(path).save(buffer, {
      contentType: file.type,
      resumable: false,
      public: false,
      metadata: { cacheControl: 'private,max-age=3600' },
    });
    await getAdminDb().collection('campus_media').doc(id).set({
      ownerId: principal.userId,
      collegeId: principal.membership!.collegeId,
      audience,
      path,
      contentType: file.type,
      createdAt: Timestamp.now(),
    });
    return NextResponse.json({ id, url: `/api/campus/media/${id}` }, { status: 201 });
  } catch (error) {
    return campusErrorResponse(error);
  }
}
