import { auth, currentUser } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin';
import { fixtureUserId, isFixtureMode, type FixtureUserId } from '@/lib/firebase/fixtureMode';
import { isAdminUser, verifiedPrimaryEmail } from '@/lib/admin/config';
import { CAMPUS_COLLECTIONS, VERIFICATION_DAYS, addDays } from './constants';
import { loadCollegeConfig } from './collegeConfig';
import {
  CAMPUS_PRODUCT_LABELS,
  PICK_COLLEGE_FIRST_MESSAGE,
  buildCampusSession,
  campusRefOf,
  dateValue,
  fixtureIdentity,
  isActiveVerification,
  matchCollegeEmail,
  serializeMembership,
  type CampusProduct,
  type IdentityEmail,
  type LoadedCollegeConfig,
  type MembershipDoc,
} from './membership';
import type { CampusAudience, CampusRef, CampusSession, CollegeMembership } from '@/types/campus';

export class CampusHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface CampusPrincipal {
  userId: string;
  membership: CollegeMembership | null;
  displayName: string;
  /** Verified primary email, or null. */
  email: string | null;
  campus: CampusRef | null;
  /** The member's college config, or null before a college is picked. */
  config: LoadedCollegeConfig | null;
  blocked: boolean;
}

/** Who is signed in. Fixture mode reads the fixture cookie and never touches Clerk. */
interface Identity {
  userId: string;
  displayName: string | null;
  primaryEmail: string | null;
  emails: IdentityEmail[];
  admin: boolean;
}

// Clerk user shape this file needs, kept structural so it stays SDK-version proof.
type ClerkEmail = {
  id: string;
  emailAddress: string;
  verification: { status: string; strategy?: string } | null;
  linkedTo?: Array<{ type: string }>;
};

function clerkEmails(emails: readonly ClerkEmail[]): IdentityEmail[] {
  return emails.map((item) => ({
    address: item.emailAddress,
    verified: item.verification?.status === 'verified',
    google: Boolean(item.linkedTo?.some((link) => link.type === 'oauth_google')) || item.verification?.strategy === 'from_oauth_google',
  }));
}

async function fixtureId(): Promise<FixtureUserId> {
  return fixtureUserId(await cookies());
}

/** Writes the fixture user's starting membership into the fake DB the first time it is seen. */
async function ensureFixtureMembership(userId: FixtureUserId) {
  const seed = fixtureIdentity(userId).membership;
  if (!seed) return;
  const ref = getAdminDb().collection(CAMPUS_COLLECTIONS.memberships).doc(userId);
  if (!(await ref.get()).exists) await ref.set({ ...seed, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
}

async function currentIdentity(): Promise<Identity | null> {
  if (isFixtureMode()) {
    const userId = await fixtureId();
    const fixture = fixtureIdentity(userId);
    await ensureFixtureMembership(userId);
    const primary = fixture.emails.find((email) => email.verified)?.address ?? null;
    return { userId, displayName: fixture.displayName, primaryEmail: primary, emails: fixture.emails, admin: fixture.admin };
  }
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  return {
    userId,
    displayName: user?.firstName || user?.fullName || null,
    primaryEmail: verifiedPrimaryEmail(user),
    emails: user ? clerkEmails(user.emailAddresses) : [],
    admin: isAdminUser(user),
  };
}

/** The signed-in user id without loading the membership. Fixture mode: the fixture cookie. */
export async function getSignedInUserId(): Promise<string | null> {
  if (isFixtureMode()) return fixtureId();
  const { userId } = await auth();
  return userId ?? null;
}

function verificationRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

/**
 * Auto-approves a member when any verified email on the account is on their college's domains.
 * Never re-approves a revoked or blocked member: that would undo an admin decision.
 */
async function maybeApproveByCollegeEmail(identity: Identity, data: MembershipDoc | null, config: LoadedCollegeConfig | null) {
  if (!data || !config || data.collegeId !== config.college.id) return data;
  const student = verificationRecord(data.studentVerification);
  if (isActiveVerification(student)) return data;
  if (student?.status === 'revoked' || data.blocked) return data;
  const match = matchCollegeEmail(identity.emails, config.college.emailDomains);
  if (!match) return data;

  const patch = {
    displayName: typeof data.displayName === 'string' && data.displayName.trim() ? data.displayName : identity.displayName || match.address.split('@')[0] || 'Student',
    studentVerification: {
      status: 'approved',
      method: match.method,
      approvedAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(addDays(new Date(), VERIFICATION_DAYS)),
    },
    updatedAt: Timestamp.now(),
  };
  await getAdminDb().collection(CAMPUS_COLLECTIONS.memberships).doc(identity.userId).set(patch, { merge: true });
  return { ...data, ...patch };
}

/** Expired ID-card approvals flip to 'expired' and their card image is deleted. */
async function expireIdCardVerifications(userId: string, data: MembershipDoc | null) {
  if (!data) return data;
  const next: MembershipDoc = { ...data };
  const updates: Record<string, unknown> = {};
  const files: string[] = [];
  for (const field of ['studentVerification', 'girlsSpaceVerification'] as const) {
    const value = verificationRecord(data[field]);
    const expiresAt = dateValue(value?.expiresAt);
    if (value?.status === 'approved' && (!expiresAt || expiresAt.getTime() <= Date.now())) {
      if (typeof value.idCardPath === 'string' && value.idCardPath) files.push(value.idCardPath);
      updates[field] = { ...value, status: 'expired', idCardPath: null, expiredAt: Timestamp.now() };
      next[field] = updates[field];
    }
  }
  if (Object.keys(updates).length) {
    await getAdminDb().collection(CAMPUS_COLLECTIONS.memberships).doc(userId).set({ ...updates, updatedAt: Timestamp.now() }, { merge: true });
    await Promise.all(files.map((path) => getAdminBucket().file(path).delete({ ignoreNotFound: true })));
  }
  return next;
}

export async function getCampusPrincipal(options?: { requireVerified?: boolean; audience?: CampusAudience; product?: CampusProduct }): Promise<CampusPrincipal> {
  const identity = await currentIdentity();
  if (!identity) throw new CampusHttpError(401, 'Sign in required');
  const snapshot = await getAdminDb().collection(CAMPUS_COLLECTIONS.memberships).doc(identity.userId).get();
  const stored = snapshot.exists ? ((snapshot.data() ?? {}) as MembershipDoc) : null;
  const current = await expireIdCardVerifications(identity.userId, stored);
  const config = typeof current?.collegeId === 'string' ? await loadCollegeConfig(current.collegeId) : null;
  const data = await maybeApproveByCollegeEmail(identity, current, config);
  const membership = data ? serializeMembership(identity.userId, data, config) : null;

  if (options?.requireVerified && membership?.student.status !== 'approved') {
    throw new CampusHttpError(403, 'Student verification required');
  }
  if (options?.audience === 'girls' && membership?.girlsSpace.status !== 'approved') {
    throw new CampusHttpError(403, 'Girls’ Space approval required');
  }
  if (options?.product) {
    if (!membership?.collegeId || !config) throw new CampusHttpError(409, PICK_COLLEGE_FIRST_MESSAGE);
    if (config.college.launchState !== 'live') throw new CampusHttpError(403, 'Swoop is not live at your college yet');
    if (!config.flags[options.product]) throw new CampusHttpError(404, `${CAMPUS_PRODUCT_LABELS[options.product]} is not on at your campus`);
  }

  return {
    userId: identity.userId,
    membership,
    displayName: membership?.displayName || identity.displayName || 'Student',
    email: identity.primaryEmail,
    campus: campusRefOf(membership, config),
    config,
    blocked: Boolean(data?.blocked),
  };
}

export async function requireAdminPrincipal() {
  const identity = await currentIdentity();
  if (!identity) throw new CampusHttpError(401, 'Sign in required');
  if (!identity.admin) throw new CampusHttpError(403, 'Admin access required');
  return { userId: identity.userId, email: identity.primaryEmail };
}

/** The session payload for a signed-in principal: membership, campus, onboarding step, unread requests. */
export async function campusSessionFor(principal: CampusPrincipal): Promise<CampusSession> {
  // Contact requests still live in the collection the contact-request routes write.
  const pending = await getAdminDb()
    .collection('campus_contact_requests')
    .where('sellerId', '==', principal.userId)
    .where('status', '==', 'pending')
    .limit(100)
    .get();
  const unread = pending.docs.filter((item) => (dateValue(item.data().expiresAt)?.getTime() || 0) > Date.now()).length;
  return buildCampusSession(principal.membership, principal.config, unread);
}

export function campusErrorResponse(error: unknown) {
  if (error instanceof CampusHttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } });
  }
  console.error('[campus]', error);
  return NextResponse.json({ error: 'Unexpected campus service error' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } });
}
