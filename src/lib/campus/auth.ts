import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin';
import { isAdminEmail } from '@/lib/admin/config';
import { PILOT_COLLEGE, VERIFICATION_DAYS, addDays } from './constants';
import type { CampusAudience, CollegeMembership } from '@/types/campus';

export class CampusHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function dateValue(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') return (value as { toDate: () => Date }).toDate();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function activeVerification(state: any) {
  return state?.status === 'approved' && Boolean(dateValue(state?.expiresAt) && dateValue(state.expiresAt)!.getTime() > Date.now());
}

function serializeMembership(userId: string, data: any): CollegeMembership {
  return {
    userId,
    collegeId: data.collegeId || PILOT_COLLEGE.id,
    collegeCode: data.collegeCode || PILOT_COLLEGE.code,
    collegeName: data.collegeName || PILOT_COLLEGE.name,
    displayName: data.displayName || 'Student',
    student: {
      status: activeVerification(data.studentVerification) ? 'approved' : data.studentVerification?.status || 'unverified',
      method: data.studentVerification?.method,
      expiresAt: dateValue(data.studentVerification?.expiresAt)?.toISOString() || null,
    },
    girlsSpace: {
      status: activeVerification(data.girlsSpaceVerification) ? 'approved' : data.girlsSpaceVerification?.status || 'unverified',
      method: data.girlsSpaceVerification?.method,
      expiresAt: dateValue(data.girlsSpaceVerification?.expiresAt)?.toISOString() || null,
    },
  };
}

async function maybeVerifyCollegeEmail(userId: string, membershipData: any | null) {
  const user = await currentUser();
  if (!user) return membershipData;
  const primary = user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId) || user.emailAddresses[0];
  const email = primary?.emailAddress?.toLowerCase();
  const verified = primary?.verification?.status === 'verified';
  if (!email || !verified || activeVerification(membershipData?.studentVerification)) return membershipData;

  const configSnap = await getAdminDb().collection('college_configs').doc(PILOT_COLLEGE.id).get();
  const domains = (configSnap.data()?.emailDomains || []).map((domain: string) => String(domain).toLowerCase());
  const domain = email.split('@')[1];
  if (!domain || !domains.includes(domain)) return membershipData;

  const displayName = user.firstName || user.fullName || email.split('@')[0] || 'Student';
  const patch = {
    collegeId: PILOT_COLLEGE.id,
    collegeCode: PILOT_COLLEGE.code,
    collegeName: PILOT_COLLEGE.name,
    displayName,
    studentVerification: {
      status: 'approved',
      method: 'college_email',
      approvedAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(addDays(new Date(), VERIFICATION_DAYS)),
    },
    updatedAt: Timestamp.now(),
  };
  await getAdminDb().collection('campus_memberships').doc(userId).set(patch, { merge: true });
  return { ...(membershipData || {}), ...patch };
}

async function expireIdCardVerifications(userId: string, membershipData: any | null) {
  if (!membershipData) return membershipData;
  const updates: Record<string, unknown> = {};
  const files: string[] = [];
  for (const [field, value] of [
    ['studentVerification', membershipData.studentVerification],
    ['girlsSpaceVerification', membershipData.girlsSpaceVerification],
  ] as const) {
    const expiresAt = dateValue(value?.expiresAt);
    if (value?.status === 'approved' && expiresAt && expiresAt.getTime() <= Date.now()) {
      if (value.idCardPath) files.push(value.idCardPath);
      updates[field] = { ...value, status: 'expired', idCardPath: null, expiredAt: Timestamp.now() };
      membershipData[field] = updates[field];
    }
  }
  if (Object.keys(updates).length) {
    await getAdminDb().collection('campus_memberships').doc(userId).set({ ...updates, updatedAt: Timestamp.now() }, { merge: true });
    await Promise.all(files.map((path) => getAdminBucket().file(path).delete({ ignoreNotFound: true })));
  }
  return membershipData;
}

export async function getCampusPrincipal(options?: { requireVerified?: boolean; audience?: CampusAudience; product?: 'marketplace' | 'housing' }) {
  const { userId } = await auth();
  if (!userId) throw new CampusHttpError(401, 'Sign in required');
  const ref = getAdminDb().collection('campus_memberships').doc(userId);
  const snapshot = await ref.get();
  const current = await expireIdCardVerifications(userId, snapshot.exists ? snapshot.data() : null);
  const data = await maybeVerifyCollegeEmail(userId, current);
  const membership = data ? serializeMembership(userId, data) : null;

  if (options?.requireVerified && membership?.student.status !== 'approved') {
    throw new CampusHttpError(403, 'Student verification required');
  }
  if (options?.audience === 'girls' && membership?.girlsSpace.status !== 'approved') {
    throw new CampusHttpError(403, 'Girls’ Space approval required');
  }
  if (options?.product && membership) {
    if (membership.collegeId !== PILOT_COLLEGE.id) throw new CampusHttpError(403, 'This campus pilot is not enabled for your college');
    const config = await getAdminDb().collection('college_configs').doc(membership.collegeId).get();
    const enabled = config.data()?.[`${options.product}Enabled`] !== false;
    if (!enabled) throw new CampusHttpError(404, `${options.product === 'marketplace' ? 'Marketplace' : 'Housing'} is not enabled for this campus`);
  }

  const user = await currentUser();
  return {
    userId,
    membership,
    displayName: membership?.displayName || user?.firstName || user?.fullName || 'Student',
    email: user?.primaryEmailAddress?.emailAddress || null,
  };
}

export async function requireAdminPrincipal() {
  const { userId } = await auth();
  if (!userId) throw new CampusHttpError(401, 'Sign in required');
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress || null;
  if (!isAdminEmail(email)) throw new CampusHttpError(403, 'Admin access required');
  return { userId, email };
}

export function campusErrorResponse(error: unknown) {
  if (error instanceof CampusHttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } });
  }
  console.error('[campus]', error);
  return NextResponse.json({ error: 'Unexpected campus service error' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } });
}
