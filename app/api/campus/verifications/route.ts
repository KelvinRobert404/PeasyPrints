import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, getCampusPrincipal } from '@/lib/campus/auth';
import { PILOT_COLLEGE } from '@/lib/campus/constants';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rateLimit';
import { matchesDeclaredFileType } from '@/lib/server/fileValidation';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const principal = await getCampusPrincipal();
    const rate = await checkRateLimit('campus-verification', principal.userId, 5, 86400);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    const form = await request.formData();
    const kind = form.get('kind') === 'girls_space' ? 'girls_space' : 'student';
    const currentVerification = kind === 'student'
      ? principal.membership?.student
      : principal.membership?.girlsSpace;
    if (currentVerification?.status === 'approved' && currentVerification.expiresAt && new Date(currentVerification.expiresAt).getTime() > Date.now()) {
      return NextResponse.json({ error: 'This verification is already active' }, { status: 409 });
    }
    if (kind === 'girls_space' && principal.membership?.student.status !== 'approved') {
      return NextResponse.json({ error: 'Complete student verification first' }, { status: 409 });
    }
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'College iCard is required' }, { status: 400 });
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) return NextResponse.json({ error: 'Upload a JPG, PNG, WEBP, or PDF' }, { status: 400 });
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'iCard must be under 8MB' }, { status: 413 });

    const db = getAdminDb();
    const existing = await db.collection('campus_verification_requests')
      .where('userId', '==', principal.userId)
      .where('kind', '==', kind)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    if (!existing.empty) return NextResponse.json({ error: 'A review is already pending' }, { status: 409 });

    const id = crypto.randomUUID();
    const extension = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `campus_verification/${principal.userId}/${id}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!matchesDeclaredFileType(buffer, file.type)) return NextResponse.json({ error: 'File content does not match its declared type' }, { status: 400 });
    const lockRef = db.collection('campus_verification_locks').doc(`${principal.userId}_${kind}`);
    const requestRef = db.collection('campus_verification_requests').doc(id);
    await db.runTransaction(async (transaction) => {
      const lock = await transaction.get(lockRef);
      if (lock.exists) {
        const lockData = lock.data()!;
        const lockedRequest = lockData.requestId
          ? await transaction.get(db.collection('campus_verification_requests').doc(lockData.requestId))
          : null;
        const lockAge = Date.now() - (lockData.createdAt?.toDate?.().getTime() || Date.now());
        if (lockedRequest?.data()?.status === 'pending' || lockAge < 15 * 60 * 1000) {
          throw new CampusHttpError(409, 'A review is already pending');
        }
      }
      transaction.set(lockRef, { userId: principal.userId, kind, requestId: id, createdAt: Timestamp.now() });
    });

    try {
      await getAdminBucket().file(path).save(buffer, {
        contentType: file.type,
        resumable: false,
        public: false,
        metadata: { cacheControl: 'private,no-store' },
      });
      const batch = db.batch();
      batch.set(requestRef, {
        userId: principal.userId,
        kind,
        status: 'pending',
        collegeId: PILOT_COLLEGE.id,
        collegeCode: PILOT_COLLEGE.code,
        collegeName: PILOT_COLLEGE.name,
        displayName: principal.displayName,
        email: principal.email,
        idCardPath: path,
        idCardContentType: file.type,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      batch.set(db.collection('campus_memberships').doc(principal.userId), {
        collegeId: PILOT_COLLEGE.id,
        collegeCode: PILOT_COLLEGE.code,
        collegeName: PILOT_COLLEGE.name,
        displayName: principal.displayName,
        [kind === 'student' ? 'studentVerification' : 'girlsSpaceVerification']: {
          status: 'pending',
          method: 'id_card',
          requestId: id,
        },
        updatedAt: Timestamp.now(),
      }, { merge: true });
      await batch.commit();
    } catch (error) {
      await Promise.all([
        getAdminBucket().file(path).delete({ ignoreNotFound: true }),
        lockRef.delete(),
      ]);
      throw error;
    }
    return NextResponse.json({ id, status: 'pending' }, { status: 201 });
  } catch (error) {
    return campusErrorResponse(error);
  }
}
