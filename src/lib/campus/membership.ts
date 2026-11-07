// Campus membership rules (KADA-18). Pure: no Firebase, no Clerk, no Next.
// Node tests import this file directly, so runtime imports stay relative.
import type {
  CampusRef,
  CampusSession,
  CollegeMembership,
  MembershipCourse,
  MembershipStay,
  OnboardingStep,
  StayType,
  VerificationMethod,
  VerificationState,
  VerificationStatus,
} from '@/types/campus';
import type {
  Campus,
  CampusOverride,
  CollegeConfig,
  CollegeConfigOverride,
  GeoOrigin,
  Landmark,
  LaunchState,
  PickupPoint,
  SemesterStart,
} from '@/types/college';
import type { FixtureUserId } from '../firebase/fixtureMode.ts';
import { getCampus, getCollege, mergeCollegeConfig } from './catalog.ts';
import { validateCourse } from './courses.ts';
import { roundForPrivacy } from '../format/distance.ts';

/** Days a student verification lasts. Mirrors VERIFICATION_DAYS in constants.ts. */
export const MEMBERSHIP_VERIFICATION_DAYS = 365;
/** Furthest a shared stay distance may be, in metres. */
export const MAX_STAY_DISTANCE_M = 50_000;

export const COLLEGE_LOCKED_MESSAGE = 'Your college is locked after verification';
export const PICK_COLLEGE_FIRST_MESSAGE = 'Pick your college first';

// ---------------------------------------------------------------- products

/** Campus products a college can switch on or off. Stored as `<product>Enabled` on college_configs. */
export const CAMPUS_PRODUCTS = ['marketplace', 'housing', 'deals', 'lostFound', 'blood', 'games'] as const;
export type CampusProduct = (typeof CAMPUS_PRODUCTS)[number];
export type CampusFlags = Record<CampusProduct, boolean>;

export const CAMPUS_PRODUCT_LABELS: Record<CampusProduct, string> = {
  marketplace: 'Marketplace',
  housing: 'Housing',
  deals: 'Deals',
  lostFound: 'Lost and found',
  blood: 'Blood donors',
  games: 'Games',
};

/** A college config after runtime overrides, plus its product flags. */
export interface LoadedCollegeConfig extends CollegeConfig {
  flags: CampusFlags;
}

// ---------------------------------------------------------------- email domains

function cleanDomain(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/^[@.]+/, '').replace(/\.+$/, '') : '';
}

/**
 * True when the email's domain is one of the college domains or a subdomain of one.
 * 'a@kju.in' and 'a@students.kju.in' match 'kju.in'; 'a@notkju.in' and 'a@kju.in.evil.io' do not.
 */
export function emailMatchesDomains(email: string | null | undefined, domains: readonly string[] | null | undefined): boolean {
  if (typeof email !== 'string' || !domains?.length) return false;
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf('@');
  if (at <= 0 || at === address.length - 1) return false;
  const host = address.slice(at + 1).replace(/\.+$/, '');
  if (!host || host.includes('@')) return false;
  return domains.some((raw) => {
    const domain = cleanDomain(raw);
    return Boolean(domain) && (host === domain || host.endsWith(`.${domain}`));
  });
}

/** An email on the signed-in account, as auth.ts reads it from Clerk or a fixture. */
export interface IdentityEmail {
  address: string;
  verified: boolean;
  /** true when the address came from a Google sign-in. */
  google: boolean;
}

export interface CollegeEmailMatch {
  address: string;
  method: Extract<VerificationMethod, 'google' | 'email_code'>;
}

/** First verified email on a college domain, preferring a Google account. */
export function matchCollegeEmail(emails: readonly IdentityEmail[], domains: readonly string[] | null | undefined): CollegeEmailMatch | null {
  const matches = emails.filter((email) => email.verified && emailMatchesDomains(email.address, domains));
  const best = matches.find((email) => email.google) ?? matches[0];
  if (!best) return null;
  return { address: best.address.trim().toLowerCase(), method: best.google ? 'google' : 'email_code' };
}

// ---------------------------------------------------------------- stored doc -> membership

/** Raw campus_memberships document. Loose on purpose: it is read from Firestore. */
export type MembershipDoc = Record<string, unknown>;

type RawVerification = { status?: unknown; method?: unknown; expiresAt?: unknown } | null | undefined;

const VERIFICATION_STATUSES: readonly VerificationStatus[] = ['unverified', 'pending', 'approved', 'rejected', 'expired', 'revoked'];
const VERIFICATION_METHODS: readonly VerificationMethod[] = ['google', 'email_code', 'id_card'];
const STAY_TYPES: readonly StayType[] = ['pg', 'flat', 'hostel', 'home'];

/** Reads a Firestore Timestamp, Date, ISO string or millis. */
export function dateValue(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** An approved state with an expiry still in the future. */
export function isActiveVerification(state: RawVerification, now: Date = new Date()): boolean {
  const record = asRecord(state);
  if (record?.status !== 'approved') return false;
  const expiresAt = dateValue(record.expiresAt);
  return Boolean(expiresAt && expiresAt.getTime() > now.getTime());
}

/**
 * The status to report. An 'approved' state that is not active (expired or no
 * expiry) is reported as 'expired', never 'approved': it gates Girls' Space.
 */
export function verificationStatus(state: RawVerification, now: Date = new Date()): VerificationStatus {
  if (isActiveVerification(state, now)) return 'approved';
  const status = asRecord(state)?.status;
  if (status === 'approved') return 'expired';
  return VERIFICATION_STATUSES.includes(status as VerificationStatus) ? (status as VerificationStatus) : 'unverified';
}

function serializeVerification(state: RawVerification, now: Date): VerificationState {
  const record = asRecord(state);
  const method = VERIFICATION_METHODS.includes(record?.method as VerificationMethod) ? (record?.method as VerificationMethod) : undefined;
  return {
    status: verificationStatus(state, now),
    ...(method ? { method } : {}),
    expiresAt: dateValue(record?.expiresAt)?.toISOString() ?? null,
  };
}

function serializeStay(value: unknown): MembershipStay | undefined {
  const record = asRecord(value);
  if (!record || !STAY_TYPES.includes(record.type as StayType)) return undefined;
  const distance = typeof record.distanceM === 'number' && Number.isFinite(record.distanceM) ? record.distanceM : null;
  return { type: record.type as StayType, distanceM: distance };
}

function serializeCourse(value: unknown): MembershipCourse | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const programmeId = asString(record.programmeId);
  const semester = record.semester;
  if (!programmeId || typeof semester !== 'number' || !Number.isInteger(semester)) return undefined;
  const specialisation = asString(record.specialisation);
  return { programmeId, specialisation: specialisation || null, semester };
}

/** Campus from the membership, with a runtime label override when a config is loaded. */
function memberCampus(collegeId: string, campusId: string, config?: CollegeConfig | null): Campus | null {
  if (!campusId) return null;
  const fromConfig = config?.college.id === collegeId ? config.campuses.find((campus) => campus.id === campusId) : undefined;
  const campus = fromConfig ?? getCampus(campusId);
  return campus && campus.collegeId === collegeId ? campus : null;
}

/** Stored membership doc -> the membership clients see. No PII beyond the display name. */
export function serializeMembership(userId: string, data: MembershipDoc, config?: CollegeConfig | null, now: Date = new Date()): CollegeMembership {
  const college = getCollege(asString(data.collegeId));
  const collegeId = college?.id ?? '';
  const campus = memberCampus(collegeId, asString(data.campusId), config);
  const stay = serializeStay(data.stay);
  const course = serializeCourse(data.course);
  return {
    userId,
    collegeId,
    collegeCode: college?.code ?? '',
    collegeName: college?.name ?? '',
    displayName: asString(data.displayName) || 'Student',
    student: serializeVerification(data.studentVerification as RawVerification, now),
    girlsSpace: serializeVerification(data.girlsSpaceVerification as RawVerification, now),
    ...(campus ? { campusId: campus.id, campusLabel: campus.label } : {}),
    ...(stay ? { stay } : {}),
    ...(course ? { course } : {}),
  };
}

/** The campus the session resolves to, or null before onboarding picks one. */
export function campusRefOf(membership: CollegeMembership | null | undefined, config?: CollegeConfig | null): CampusRef | null {
  if (!membership?.collegeId || !membership.campusId) return null;
  const campus = memberCampus(membership.collegeId, membership.campusId, config);
  const college = getCollege(membership.collegeId);
  if (!campus || !college) return null;
  return { id: campus.id, collegeId: college.id, code: college.code, label: campus.label };
}

/** Next onboarding step: pick college and campus, then verify, then course. */
export function computeNeeds(membership: CollegeMembership | null | undefined): OnboardingStep | null {
  if (!membership?.collegeId || !membership.campusId) return 'college';
  if (membership.student.status !== 'approved') return 'verify';
  if (!membership.course) return 'course';
  return null;
}

/** The /api/campus/session payload for a signed-in member. */
export function buildCampusSession(
  membership: CollegeMembership | null,
  config: CollegeConfig | null | undefined,
  unreadContactRequests: number,
): CampusSession {
  return {
    signedIn: true,
    membership,
    verifiedStudent: membership?.student.status === 'approved',
    girlsSpaceApproved: membership?.girlsSpace.status === 'approved',
    unreadContactRequests,
    campus: campusRefOf(membership, config),
    onboarding: { needs: computeNeeds(membership) },
  };
}

export const SIGNED_OUT_SESSION: CampusSession = {
  signedIn: false,
  membership: null,
  verifiedStudent: false,
  girlsSpaceApproved: false,
  unreadContactRequests: 0,
  campus: null,
  onboarding: { needs: null },
};

// ---------------------------------------------------------------- onboarding

export interface OnboardingStayInput {
  type: StayType;
  distanceM?: number | null;
}

export interface OnboardingInput {
  collegeId?: string;
  campusId?: string;
  /** null clears the stay. */
  stay?: OnboardingStayInput | null;
  course?: { programmeId: string; semester: number; specialisation?: string | null };
}

/** Fields onboarding writes onto campus_memberships/{userId} (merged). */
export interface OnboardingPatch {
  collegeId: string;
  collegeCode: string;
  collegeName: string;
  campusId: string;
  stay?: MembershipStay | null;
  course?: MembershipCourse;
}

export type OnboardingResult =
  | { ok: true; patch: OnboardingPatch; collegeChanged: boolean }
  | { ok: false; status: 400 | 409; error: string };

function fail(status: 400 | 409, error: string): OnboardingResult {
  return { ok: false, status, error };
}

function hasCoordinates(value: unknown): boolean {
  const record = asRecord(value);
  return Boolean(record && ('lat' in record || 'lng' in record || 'lon' in record || 'latitude' in record || 'longitude' in record));
}

/** Loose request body -> OnboardingInput. Coordinates are refused, never stored. */
export function parseOnboardingBody(body: unknown): { ok: true; input: OnboardingInput } | { ok: false; error: string } {
  const record = asRecord(body);
  if (!record) return { ok: false, error: 'Send your college and campus' };
  if (hasCoordinates(record) || hasCoordinates(record.stay)) return { ok: false, error: 'Share distance only, not your location' };
  const input: OnboardingInput = {};
  if (record.collegeId !== undefined) {
    if (typeof record.collegeId !== 'string') return { ok: false, error: 'Pick your college from the list' };
    input.collegeId = record.collegeId.trim();
  }
  if (record.campusId !== undefined) {
    if (typeof record.campusId !== 'string') return { ok: false, error: 'Pick your campus from the list' };
    input.campusId = record.campusId.trim();
  }
  if (record.stay === null) input.stay = null;
  else if (record.stay !== undefined) {
    const stay = asRecord(record.stay);
    if (!stay || !STAY_TYPES.includes(stay.type as StayType)) return { ok: false, error: 'Pick where you stay' };
    const distance = stay.distanceM;
    if (distance !== undefined && distance !== null && typeof distance !== 'number') return { ok: false, error: 'Distance must be in metres' };
    input.stay = { type: stay.type as StayType, distanceM: distance ?? null };
  }
  if (record.course !== undefined && record.course !== null) {
    const course = asRecord(record.course);
    if (!course || typeof course.programmeId !== 'string') return { ok: false, error: 'Pick a course from the list.' };
    const specialisation = course.specialisation;
    input.course = {
      programmeId: course.programmeId,
      semester: typeof course.semester === 'number' ? course.semester : Number.NaN,
      specialisation: typeof specialisation === 'string' ? specialisation : null,
    };
  }
  return { ok: true, input };
}

function collegeLocked(current: CollegeMembership, blocked: boolean): boolean {
  if (blocked) return true;
  const locking: readonly VerificationStatus[] = ['pending', 'approved', 'revoked'];
  return locking.includes(current.student.status) || locking.includes(current.girlsSpace.status);
}

/**
 * Validates an onboarding step against the current membership and returns the patch.
 * College and campus fall back to the current ones, so the course step can send only the course.
 * The college is locked once a verification is pending or approved (or revoked, or the member is
 * blocked); the campus can always change inside the same college.
 */
export function applyOnboardingInput(
  current: CollegeMembership | null | undefined,
  input: OnboardingInput,
  options?: { blocked?: boolean },
): OnboardingResult {
  if (hasCoordinates(input) || hasCoordinates(input.stay)) return fail(400, 'Share distance only, not your location');

  const collegeId = (input.collegeId ?? current?.collegeId ?? '').trim();
  if (!collegeId) return fail(409, PICK_COLLEGE_FIRST_MESSAGE);
  const college = getCollege(collegeId);
  if (!college) return fail(400, 'Pick your college from the list');

  const collegeChanged = Boolean(current?.collegeId) && current?.collegeId !== college.id;
  if (collegeChanged && current && collegeLocked(current, options?.blocked === true)) return fail(409, COLLEGE_LOCKED_MESSAGE);

  const campusId = (input.campusId ?? (collegeChanged ? '' : current?.campusId) ?? '').trim();
  if (!campusId) return fail(400, 'Pick your campus');
  const campus = getCampus(campusId);
  if (!campus || campus.collegeId !== college.id) return fail(400, 'Pick a campus of your college');

  const patch: OnboardingPatch = {
    collegeId: college.id,
    collegeCode: college.code,
    collegeName: college.name,
    campusId: campus.id,
  };

  if (input.stay === null) patch.stay = null;
  else if (input.stay !== undefined) {
    if (!STAY_TYPES.includes(input.stay.type)) return fail(400, 'Pick where you stay');
    const raw = input.stay.distanceM;
    let distanceM: number | null = null;
    if (raw !== undefined && raw !== null) {
      if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > MAX_STAY_DISTANCE_M) {
        return fail(400, 'Distance must be 0 to 50 km');
      }
      distanceM = roundForPrivacy(raw);
    }
    patch.stay = { type: input.stay.type, distanceM };
  }

  if (input.course !== undefined) {
    const result = validateCourse(input.course);
    if (!result.ok) return fail(400, result.message);
    patch.course = {
      programmeId: result.course.programmeId,
      specialisation: result.course.specialisation,
      semester: result.course.semester,
    };
  }

  return { ok: true, patch, collegeChanged };
}

// ---------------------------------------------------------------- college config docs

function parseLaunchState(value: unknown): LaunchState | undefined {
  return value === 'live' || value === 'waitlist' ? value : undefined;
}

function parseDomains(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return [...new Set(value.map(cleanDomain).filter((domain) => domain.includes('.')))];
}

function parseSemesterStarts(value: unknown): SemesterStart[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const starts = value.flatMap((item): SemesterStart[] => {
    const record = asRecord(item);
    const month = record?.month;
    if ((record?.term !== 'odd' && record?.term !== 'even') || typeof month !== 'number' || !Number.isInteger(month) || month < 1 || month > 12) return [];
    return [{ term: record.term, month }];
  });
  return starts.length ? starts : undefined;
}

function parsePickupPoints(value: unknown): PickupPoint[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item): PickupPoint[] => {
    const record = asRecord(item);
    const id = asString(record?.id);
    const label = asString(record?.label);
    return id && label ? [{ id, label }] : [];
  });
}

function finiteIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function parseLandmarks(value: unknown): Landmark[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item): Landmark[] => {
    const record = asRecord(item);
    const id = asString(record?.id);
    const label = asString(record?.label);
    if (!record || !id || !label || !finiteIn(record.lat, -90, 90) || !finiteIn(record.lng, -180, 180)) return [];
    const aliases = Array.isArray(record.aliases) ? record.aliases.map(asString).filter(Boolean).map((alias) => alias.toLowerCase()) : [];
    return [{ id, label, area: asString(record.area) || label, lat: record.lat, lng: record.lng, aliases }];
  });
}

function parseCampusOverrides(value: unknown): Record<string, CampusOverride> | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const result: Record<string, CampusOverride> = {};
  for (const [campusId, raw] of Object.entries(record)) {
    const item = asRecord(raw);
    if (!item) continue;
    const override: CampusOverride = {};
    const label = asString(item.label);
    if (label) override.label = label;
    const pickupPoints = parsePickupPoints(item.pickupPoints);
    if (pickupPoints) override.pickupPoints = pickupPoints;
    const landmarks = parseLandmarks(item.landmarks);
    if (landmarks) override.landmarks = landmarks;
    result[campusId] = override;
  }
  return result;
}

/** college_configs/{id} document -> a sanitized override. Bad fields are dropped, never trusted. */
export function parseCollegeConfigDoc(data: unknown): CollegeConfigOverride {
  const record = asRecord(data) ?? {};
  const override: { -readonly [K in keyof CollegeConfigOverride]: CollegeConfigOverride[K] } = {};
  const launchState = parseLaunchState(record.launchState);
  if (launchState) override.launchState = launchState;
  const emailDomains = parseDomains(record.emailDomains);
  if (emailDomains) override.emailDomains = emailDomains;
  const semesterStarts = parseSemesterStarts(record.semesterStarts);
  if (semesterStarts) override.semesterStarts = semesterStarts;
  const campuses = parseCampusOverrides(record.campuses);
  if (campuses) override.campuses = campuses;
  return override;
}

/** Product flags from a college_configs document. A product is on unless set to false. */
export function parseCampusFlags(data: unknown): CampusFlags {
  const record = asRecord(data) ?? {};
  const flags = {} as CampusFlags;
  for (const product of CAMPUS_PRODUCTS) flags[product] = record[`${product}Enabled`] !== false;
  return flags;
}

/** Static catalog + the stored document. Null for an unknown college. */
export function collegeConfigFromDoc(collegeId: string, data: unknown): LoadedCollegeConfig | null {
  const merged = mergeCollegeConfig(collegeId, parseCollegeConfigDoc(data));
  return merged ? { ...merged, flags: parseCampusFlags(data) } : null;
}

// ---------------------------------------------------------------- /api/campus/config payload

export interface CampusConfigPayload {
  college: { id: string; code: string; name: string; shortName: string; launchState: LaunchState };
  campus: {
    id: string;
    name: string;
    label: string;
    origin: GeoOrigin;
    pickupPoints: PickupPoint[];
    landmarks: Landmark[];
  };
  flags: CampusFlags;
}

/** The member's campus config, or null when the campus is not part of the college. */
export function campusConfigPayload(config: LoadedCollegeConfig, campusId: string | null | undefined): CampusConfigPayload | null {
  const campus = config.campuses.find((item) => item.id === campusId);
  if (!campus) return null;
  const { college } = config;
  return {
    college: { id: college.id, code: college.code, name: college.name, shortName: college.shortName, launchState: college.launchState },
    campus: {
      id: campus.id,
      name: campus.name,
      label: campus.label,
      origin: { ...campus.origin },
      pickupPoints: campus.pickupPoints.map((point) => ({ ...point })),
      landmarks: campus.landmarks.map((landmark) => ({ ...landmark, aliases: [...landmark.aliases] })),
    },
    flags: { ...config.flags },
  };
}

// ---------------------------------------------------------------- fixture identities

export interface FixtureIdentity {
  displayName: string;
  emails: IdentityEmail[];
  admin: boolean;
  /** Membership doc written to the fake DB the first time the user is seen. Null for a brand new user. */
  membership: MembershipDoc | null;
}

function approvedState(method: VerificationMethod, now: Date) {
  const day = 24 * 60 * 60 * 1000;
  return {
    status: 'approved',
    method,
    approvedAt: new Date(now.getTime() - 30 * day).toISOString(),
    expiresAt: new Date(now.getTime() + (MEMBERSHIP_VERIFICATION_DAYS - 30) * day).toISOString(),
  };
}

function kjuMember(displayName: string, campusId: string, extra: MembershipDoc): MembershipDoc {
  const college = getCollege('kju');
  return { collegeId: 'kju', collegeCode: 'KJU', collegeName: college?.name ?? 'KJU', campusId, displayName, ...extra };
}

/** Offline fixture users: who they are and the membership the fake DB starts with. */
export function fixtureIdentity(id: FixtureUserId, now: Date = new Date()): FixtureIdentity {
  const personal = (name: string): IdentityEmail[] => [{ address: `${name}@example.com`, verified: true, google: true }];
  const course = { programmeId: 'bcom', specialisation: null, semester: 3 };
  switch (id) {
    case 'new-user':
      return { displayName: 'Riya', emails: personal('riya'), admin: false, membership: null };
    case 'unverified-kju':
      return {
        displayName: 'Arjun',
        emails: personal('arjun'),
        admin: false,
        membership: kjuMember('Arjun', 'kju-main', { studentVerification: { status: 'unverified' } }),
      };
    case 'pending-id-card':
      return {
        displayName: 'Meera',
        emails: personal('meera'),
        admin: false,
        membership: kjuMember('Meera', 'kju-main', { studentVerification: { status: 'pending', method: 'id_card' } }),
      };
    case 'verified-kju-airport':
      return {
        displayName: 'Kabir',
        emails: personal('kabir'),
        admin: false,
        membership: kjuMember('Kabir', 'kju-airport-road', {
          studentVerification: approvedState('id_card', now),
          stay: { type: 'pg', distanceM: 900 },
          course,
        }),
      };
    case 'girls-approved':
      return {
        displayName: 'Ananya',
        emails: personal('ananya'),
        admin: false,
        membership: kjuMember('Ananya', 'kju-main', {
          studentVerification: approvedState('id_card', now),
          girlsSpaceVerification: approvedState('id_card', now),
          stay: { type: 'hostel', distanceM: 300 },
          course,
        }),
      };
    case 'admin':
      return {
        displayName: 'Swoop admin',
        emails: [{ address: 'admin@example.com', verified: true, google: false }],
        admin: true,
        membership: kjuMember('Swoop admin', 'kju-main', { studentVerification: approvedState('id_card', now), course }),
      };
    case 'verified-kju-main':
    default:
      return {
        displayName: 'Sana',
        emails: personal('sana'),
        admin: false,
        membership: kjuMember('Sana', 'kju-main', {
          studentVerification: approvedState('id_card', now),
          stay: { type: 'pg', distanceM: 650 },
          course,
        }),
      };
  }
}
