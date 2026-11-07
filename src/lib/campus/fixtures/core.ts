// Fixture data for offline fixture mode (KADA-18): people, memberships, the KJU
// college config, print shops and the shared builders the other fixture files use.
// Server only: it builds Firestore Timestamps for the fake Admin DB.
// Node tests import it directly, so '@/...' is type-only and runtime imports are relative.
import { Timestamp } from 'firebase-admin/firestore';
import type { DocTime, ListingPlace, MembershipCourse, MembershipStay, VerificationMethod, VerificationStatus } from '@/types/campus';
import type { CollegeConfigOverride } from '@/types/college';
import type { FixtureUserId } from '../../firebase/fixtureMode.ts';
import { getCampus, getCollege } from '../catalog.ts';
import { VERIFICATION_DAYS } from '../constants.ts';
import { haversineMeters, roundForPrivacy } from '../../format/distance.ts';

/** A document and the id it is stored under. */
export interface FixtureDoc<T> {
  id: string;
  data: T;
}

const KJU_COLLEGE = getCollege('kju');
if (!KJU_COLLEGE) throw new Error('Fixture college kju is missing from the catalog');

export const KJU = {
  collegeId: KJU_COLLEGE.id,
  collegeCode: KJU_COLLEGE.code,
  collegeName: KJU_COLLEGE.name,
} as const;

export const KJU_MAIN = 'kju-main';
export const KJU_AIRPORT = 'kju-airport-road';
export type FixtureCampusId = typeof KJU_MAIN | typeof KJU_AIRPORT;

/** Email domain the fixture college accepts. Never a real domain. */
export const FIXTURE_EMAIL_DOMAIN = 'kju.test';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A time `days` from seed time (negative is in the past; fractions are fine). */
export function fixtureTime(now: Date, days: number): Timestamp {
  return Timestamp.fromMillis(now.getTime() + Math.round(days * DAY_MS));
}

/** Midnight IST of a 'YYYY-MM-DD' day. */
export function istDay(key: string): Timestamp {
  return Timestamp.fromMillis(Date.parse(`${key}T00:00:00.000+05:30`));
}

/* People. Fixture users first, then other students who post. */

export interface FixturePerson {
  displayName: string;
  /** Can see and post in Girls' Space. */
  girls: boolean;
}

/** Display names match the fixture identities the session uses. */
export const FIXTURE_PEOPLE: Readonly<Record<string, FixturePerson>> = {
  'new-user': { displayName: 'Riya', girls: false },
  'unverified-kju': { displayName: 'Arjun', girls: false },
  'pending-id-card': { displayName: 'Meera', girls: false },
  'verified-kju-main': { displayName: 'Sana', girls: false },
  'verified-kju-airport': { displayName: 'Kabir', girls: false },
  'girls-approved': { displayName: 'Ananya', girls: true },
  admin: { displayName: 'Swoop admin', girls: false },
  'student-farhan': { displayName: 'Farhan', girls: false },
  'student-joel': { displayName: 'Joel', girls: false },
  'student-vivek': { displayName: 'Vivek', girls: false },
  'student-rahul': { displayName: 'Rahul', girls: false },
  'student-aditya': { displayName: 'Aditya', girls: false },
  'student-tanvi': { displayName: 'Tanvi', girls: true },
  'student-priya': { displayName: 'Priya', girls: true },
  'student-sneha': { displayName: 'Sneha', girls: true },
  'student-isha': { displayName: 'Isha', girls: true },
};

export function displayNameOf(userId: string): string {
  const person = FIXTURE_PEOPLE[userId];
  if (!person) throw new Error(`Unknown fixture person: ${userId}`);
  return person.displayName;
}

/* Places. Built from the catalog so every landmark id is real. */

/** A listing place at a catalog landmark, e.g. landmarkPlace('kju-main', 'falcon-hospital'). */
export function landmarkPlace(campusId: string, slug: string): ListingPlace {
  const campus = getCampus(campusId);
  if (!campus) throw new Error(`Unknown campus: ${campusId}`);
  const landmark = campus.landmarks.find((item) => item.id === `${campusId}-${slug}`);
  if (!landmark) throw new Error(`Unknown landmark: ${campusId}-${slug}`);
  return {
    landmarkId: landmark.id,
    label: landmark.label,
    area: landmark.area,
    lat: landmark.lat,
    lng: landmark.lng,
    campusId,
    roughDistanceM: roundForPrivacy(haversineMeters(campus.origin, landmark)),
  };
}

/** A place the poster typed without picking a landmark. Distance only, no coordinates. */
export function areaPlace(campusId: string, label: string, area: string, distanceM: number): ListingPlace {
  if (!getCampus(campusId)) throw new Error(`Unknown campus: ${campusId}`);
  return { landmarkId: null, label, area, lat: null, lng: null, campusId, roughDistanceM: roundForPrivacy(distanceM) };
}

/* Memberships (campus_memberships/{userId}). */

export interface StoredVerification {
  status: VerificationStatus;
  method: VerificationMethod | null;
  submittedAt: DocTime | null;
  approvedAt: DocTime | null;
  expiresAt: DocTime | null;
}

/** Stored membership, in the shape the session reads (studentVerification, girlsSpaceVerification). */
export interface MembershipFixtureDoc {
  userId: string;
  collegeId: string;
  collegeCode: string;
  collegeName: string;
  displayName: string;
  campusId: string;
  campusLabel: string;
  stay: MembershipStay | null;
  course: MembershipCourse | null;
  studentVerification: StoredVerification;
  girlsSpaceVerification: StoredVerification;
  createdAt: DocTime;
  updatedAt: DocTime;
}

function unverified(): StoredVerification {
  return { status: 'unverified', method: null, submittedAt: null, approvedAt: null, expiresAt: null };
}

function approved(now: Date, method: VerificationMethod, daysAgo: number): StoredVerification {
  return {
    status: 'approved',
    method,
    submittedAt: fixtureTime(now, -daysAgo - 1),
    approvedAt: fixtureTime(now, -daysAgo),
    expiresAt: fixtureTime(now, VERIFICATION_DAYS - daysAgo),
  };
}

function member(
  now: Date,
  userId: FixtureUserId,
  campusId: FixtureCampusId,
  fields: Pick<MembershipFixtureDoc, 'stay' | 'course' | 'studentVerification'> & { girlsSpaceVerification?: StoredVerification },
  joinedDaysAgo: number,
): FixtureDoc<MembershipFixtureDoc> {
  const campus = getCampus(campusId);
  if (!campus) throw new Error(`Unknown campus: ${campusId}`);
  return {
    id: userId,
    data: {
      userId,
      ...KJU,
      displayName: displayNameOf(userId),
      campusId,
      campusLabel: campus.label,
      stay: fields.stay,
      course: fields.course,
      studentVerification: fields.studentVerification,
      girlsSpaceVerification: fields.girlsSpaceVerification ?? unverified(),
      createdAt: fixtureTime(now, -joinedDaysAgo),
      updatedAt: fixtureTime(now, -Math.min(joinedDaysAgo, 2)),
    },
  };
}

/** One membership per fixture user, except new-user who has none yet. */
export function buildMemberships(now: Date): FixtureDoc<MembershipFixtureDoc>[] {
  return [
    member(
      now,
      'unverified-kju',
      KJU_MAIN,
      { stay: null, course: null, studentVerification: unverified() },
      1,
    ),
    member(
      now,
      'pending-id-card',
      KJU_MAIN,
      {
        stay: { type: 'hostel', distanceM: 400 },
        course: { programmeId: 'bba', specialisation: 'Marketing', semester: 1 },
        studentVerification: { status: 'pending', method: 'id_card', submittedAt: fixtureTime(now, -0.25), approvedAt: null, expiresAt: null },
      },
      1,
    ),
    member(
      now,
      'verified-kju-main',
      KJU_MAIN,
      {
        stay: { type: 'pg', distanceM: 650 },
        course: { programmeId: 'bcom', specialisation: null, semester: 3 },
        studentVerification: approved(now, 'email_code', 60),
      },
      60,
    ),
    member(
      now,
      'verified-kju-airport',
      KJU_AIRPORT,
      {
        stay: { type: 'pg', distanceM: 900 },
        course: { programmeId: 'bca', specialisation: 'Data Science', semester: 5 },
        studentVerification: approved(now, 'google', 120),
      },
      120,
    ),
    member(
      now,
      'girls-approved',
      KJU_MAIN,
      {
        stay: { type: 'hostel', distanceM: 300 },
        course: { programmeId: 'ba', specialisation: 'Psychology', semester: 3 },
        studentVerification: approved(now, 'email_code', 45),
        girlsSpaceVerification: approved(now, 'id_card', 40),
      },
      45,
    ),
    member(
      now,
      'admin',
      KJU_MAIN,
      {
        stay: { type: 'home', distanceM: null },
        course: { programmeId: 'mba', specialisation: 'Finance', semester: 2 },
        studentVerification: approved(now, 'id_card', 200),
      },
      200,
    ),
  ];
}

/* College config (college_configs/kju). */

export type CollegeConfigFixtureDoc = CollegeConfigOverride & {
  collegeId: string;
  marketplaceEnabled: boolean;
  housingEnabled: boolean;
  dealsEnabled: boolean;
  lostFoundEnabled: boolean;
  bloodEnabled: boolean;
  gamesEnabled: boolean;
  updatedAt: DocTime;
};

export function buildCollegeConfigs(now: Date): FixtureDoc<CollegeConfigFixtureDoc>[] {
  const college = getCollege(KJU.collegeId);
  if (!college) throw new Error('KJU is missing from the catalog');
  return [
    {
      id: college.id,
      data: {
        collegeId: college.id,
        launchState: 'live',
        emailDomains: [FIXTURE_EMAIL_DOMAIN],
        semesterStarts: college.semesterStarts.map((start) => ({ ...start })),
        marketplaceEnabled: true,
        housingEnabled: true,
        dealsEnabled: true,
        lostFoundEnabled: true,
        bloodEnabled: true,
        gamesEnabled: true,
        updatedAt: fixtureTime(now, -3),
      },
    },
  ];
}

/* Print shops (shops/{id}) live in ./shops.ts, which client pages can import too. */
export { FIXTURE_SHOPS } from './shops.ts';
