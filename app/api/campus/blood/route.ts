import { NextRequest, NextResponse } from 'next/server';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, getCampusPrincipal, type CampusPrincipal } from '@/lib/campus/auth';
import {
  BLOOD_GROUPS,
  CONSENT_VERSION,
  HOSPITAL_MAX,
  HOSPITAL_MIN,
  MAX_HELPERS,
  UNITS_MAX,
  UNITS_MIN,
  alertCopy,
  countByGroup,
  firstName,
  helperOf,
  isBloodGroup,
  isListed,
  isoOf,
  matchDonors,
  neededByError,
  normalizeWhatsapp,
  sortRequests,
  urgencyFor,
  viewRequest,
  type BloodDonorRecord,
  type BloodHelperRecord,
  type BloodMeView,
  type BloodRequestRecord,
} from '@/lib/campus/blood';
import { CAMPUS_COLLECTIONS } from '@/lib/campus/constants';
import { PICK_COLLEGE_FIRST_MESSAGE } from '@/lib/campus/membership';
import { enqueue } from '@/lib/campus/notify';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rateLimit';
import type { CampusRef } from '@/types/campus';
import type { BloodGroup } from '@/types/utilities';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const REQUEST_LIMIT = 200;
const DONOR_LIMIT = 2000;
/** Firestore caps an 'in' filter at 30 values. */
const MAX_CAMPUSES = 30;

const groupSchema = z.enum(BLOOD_GROUPS as [BloodGroup, ...BloodGroup[]], { errorMap: () => ({ message: 'Pick a blood group' }) });
const idSchema = z.string().trim().min(1).max(128).regex(/^[^/]+$/, 'Invalid request');

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('opt_in'),
    group: groupSchema,
    consent: z.literal(true, { errorMap: () => ({ message: 'Tick the consent box first' }) }),
  }),
  z.object({ action: z.literal('opt_out') }),
  z.object({
    action: z.literal('request'),
    group: groupSchema,
    units: z.number().int().min(UNITS_MIN, 'At least 1 unit').max(UNITS_MAX, `Up to ${UNITS_MAX} units`),
    hospital: z.string().trim().min(HOSPITAL_MIN, 'Add the hospital').max(HOSPITAL_MAX, 'Keep the hospital short'),
    neededBy: z.string().datetime({ offset: true, message: 'Pick when it is needed' }),
  }),
  z.object({ action: z.literal('close'), id: idSchema, fulfilled: z.boolean().optional().default(false) }),
  z.object({ action: z.literal('can_help'), id: idSchema }),
  z.object({ action: z.literal('share_whatsapp'), id: idSchema, helperKey: idSchema, whatsapp: z.string().max(20) }),
]);

type BloodPrincipal = CampusPrincipal & { campus: CampusRef };

async function bloodPrincipal(): Promise<BloodPrincipal> {
  const principal = await getCampusPrincipal({ requireVerified: true, product: 'blood' });
  if (principal.blocked) throw new CampusHttpError(403, 'Your account is paused');
  if (!principal.campus) throw new CampusHttpError(409, PICK_COLLEGE_FIRST_MESSAGE);
  return principal as BloodPrincipal;
}

/** Every campus of the viewer's college: requests and counts are college wide. */
function collegeCampusIds(principal: BloodPrincipal): string[] {
  const ids = (principal.config?.campuses ?? []).map((campus) => campus.id);
  return [...new Set([principal.campus.id, ...ids])].slice(0, MAX_CAMPUSES);
}

function meOf(donor: BloodDonorRecord | null): BloodMeView {
  if (!donor || !isBloodGroup(donor.bloodGroup)) return { optedIn: false, bloodGroup: null, available: false };
  return { optedIn: true, bloodGroup: donor.bloodGroup, available: donor.available !== false };
}

async function readDonor(db: Firestore, userId: string): Promise<BloodDonorRecord | null> {
  const snapshot = await db.collection(CAMPUS_COLLECTIONS.bloodDonors).doc(userId).get();
  return snapshot.exists ? (snapshot.data() as BloodDonorRecord) : null;
}

async function collegeDonors(db: Firestore, campusIds: string[]): Promise<BloodDonorRecord[]> {
  const snapshot = await db.collection(CAMPUS_COLLECTIONS.bloodDonors).where('campusId', 'in', campusIds).limit(DONOR_LIMIT).get();
  return snapshot.docs.map((doc) => ({ ...(doc.data() as BloodDonorRecord), userId: doc.id }));
}

function errorJson(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

/** My donor status, available donors per group at my college, and open requests. */
export async function GET() {
  try {
    const principal = await bloodPrincipal();
    const db = getAdminDb();
    const campusIds = collegeCampusIds(principal);
    const [donor, donors, requests] = await Promise.all([
      readDonor(db, principal.userId),
      collegeDonors(db, campusIds),
      db.collection(CAMPUS_COLLECTIONS.bloodRequests).where('campusId', 'in', campusIds).where('status', '==', 'open').limit(REQUEST_LIMIT).get(),
    ]);
    const me = meOf(donor);
    const now = Date.now();
    const items = sortRequests(
      requests.docs
        .map((doc) => ({ ...(doc.data() as BloodRequestRecord), id: doc.id }))
        .filter((record) => isListed(record, now))
        .map((record) => viewRequest(record, principal.userId, me.bloodGroup)),
    );
    return NextResponse.json({ campus: principal.campus, me, counts: countByGroup(donors), requests: items }, { headers: NO_STORE });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

/** Opt in or out, post or close a request, offer help, or share a WhatsApp with a helper. */
export async function POST(request: NextRequest) {
  try {
    const principal = await bloodPrincipal();
    const input = actionSchema.parse(await request.json());
    const db = getAdminDb();
    const donors = db.collection(CAMPUS_COLLECTIONS.bloodDonors);
    const requests = db.collection(CAMPUS_COLLECTIONS.bloodRequests);
    const campusIds = collegeCampusIds(principal);
    const now = new Date();
    const stamp = Timestamp.fromDate(now);

    if (input.action === 'opt_in') {
      const existing = await readDonor(db, principal.userId);
      const record: BloodDonorRecord = {
        userId: principal.userId,
        campusId: principal.campus.id,
        collegeId: principal.campus.collegeId,
        bloodGroup: input.group,
        available: true,
        lastDonatedAt: existing?.lastDonatedAt ?? null,
        consentVersion: CONSENT_VERSION,
        consentAt: stamp,
        updatedAt: stamp,
      };
      await donors.doc(principal.userId).set(record);
      return NextResponse.json({ me: meOf(record) }, { headers: NO_STORE });
    }

    if (input.action === 'opt_out') {
      // The group is sensitive: opting out deletes the record outright.
      await donors.doc(principal.userId).delete();
      return NextResponse.json({ me: meOf(null) }, { headers: NO_STORE });
    }

    const me = meOf(await readDonor(db, principal.userId));

    if (input.action === 'request') {
      const neededBy = new Date(input.neededBy);
      const timeError = neededByError(neededBy, now);
      if (timeError) return errorJson(timeError);
      const rate = await checkRateLimit('blood-request', principal.userId, 3, 24 * 3600);
      if (!rate.allowed) return rateLimitResponse(rate.retryAfter);

      const record: BloodRequestRecord = {
        authorId: principal.userId,
        campusId: principal.campus.id,
        collegeId: principal.campus.collegeId,
        bloodGroup: input.group,
        units: input.units,
        urgency: urgencyFor(neededBy, now),
        status: 'open',
        hospital: input.hospital,
        area: '',
        forWhom: null,
        neededBy: Timestamp.fromDate(neededBy),
        posterDisplayName: principal.displayName,
        helpers: {},
        notifiedCount: 0,
        createdAt: stamp,
        updatedAt: stamp,
      };
      const ref = requests.doc();
      await ref.set(record);

      // Alert matching opted-in donors at this college. Urgent: now from 07:00
      // to 22:00 IST, held to 07:00 otherwise. A failed alert keeps the post.
      let notified = 0;
      try {
        const matched = matchDonors(
          (await collegeDonors(db, campusIds)).map((donor) => ({ ...donor, lastDonatedAt: isoOf(donor.lastDonatedAt) })),
          input.group,
          { now, excludeUserId: principal.userId },
        );
        const copy = alertCopy(record);
        const result = await enqueue(
          matched.map((donor) => donor.userId),
          {
            kind: 'blood_request',
            title: copy.title,
            body: copy.body,
            href: '/campus/blood',
            ref: { type: 'blood_request', id: ref.id },
            urgent: true,
            campusId: principal.campus.id,
          },
          { now, db },
        );
        notified = result.queued;
        await ref.update({ notifiedCount: notified });
        record.notifiedCount = notified;
      } catch (error) {
        console.error('[campus] blood alert failed', error);
      }
      return NextResponse.json(
        { item: viewRequest({ ...record, id: ref.id }, principal.userId, me.bloodGroup), notified },
        { status: 201, headers: NO_STORE },
      );
    }

    if (input.action === 'can_help') {
      const rate = await checkRateLimit('blood-can-help', principal.userId, 30, 24 * 3600);
      if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    }

    // close, can_help and share_whatsapp change one request in a transaction.
    const ref = requests.doc(input.id);
    const updated = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new CampusHttpError(404, 'Request not found');
      const record = snapshot.data() as BloodRequestRecord;
      if (!campusIds.includes(record.campusId)) throw new CampusHttpError(404, 'Request not found');
      const isOwner = record.authorId === principal.userId;

      if (input.action === 'close') {
        if (!isOwner) throw new CampusHttpError(403, 'Only the requester can close this');
        if (record.status !== 'open') return record;
        const next: BloodRequestRecord = { ...record, status: input.fulfilled ? 'fulfilled' : 'closed', updatedAt: stamp };
        transaction.update(ref, { status: next.status, updatedAt: stamp });
        return next;
      }

      if (record.status !== 'open') throw new CampusHttpError(409, 'This request is closed');
      const helpers = { ...(record.helpers ?? {}) };

      if (input.action === 'can_help') {
        if (isOwner) throw new CampusHttpError(400, 'This is your own request');
        if (helperOf(record, principal.userId)) return record;
        if (Object.keys(helpers).length >= MAX_HELPERS) throw new CampusHttpError(409, 'Enough people offered. Thank you.');
        const helper: BloodHelperRecord = {
          userId: principal.userId,
          firstName: firstName(principal.displayName),
          createdAt: stamp,
          sharedWhatsapp: null,
          sharedAt: null,
        };
        helpers[crypto.randomUUID()] = helper;
      } else {
        if (!isOwner) throw new CampusHttpError(403, 'Only the requester can share');
        const helper = helpers[input.helperKey];
        if (!helper) throw new CampusHttpError(404, 'That helper is gone');
        const number = normalizeWhatsapp(input.whatsapp);
        if (!number.ok) throw new CampusHttpError(400, number.error);
        helpers[input.helperKey] = { ...helper, sharedWhatsapp: number.value, sharedAt: stamp };
      }

      transaction.update(ref, { helpers, updatedAt: stamp });
      return { ...record, helpers, updatedAt: stamp };
    });

    return NextResponse.json({ item: viewRequest({ ...updated, id: ref.id }, principal.userId, me.bloodGroup) }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof z.ZodError) return errorJson(error.issues[0]?.message || 'Invalid request');
    if (error instanceof SyntaxError) return errorJson('Invalid request');
    return campusErrorResponse(error);
  }
}
