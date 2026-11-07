import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, requireAdminPrincipal } from '@/lib/campus/auth';
import { campusesOf, getCollege, listColleges, mergeCollegeConfig } from '@/lib/campus/catalog';
import {
  DEFAULT_CONFIG_COLLEGE_ID,
  applyCampusOrigins,
  collegeConfigPutSchema,
  describeConfigIssue,
  flattenPickupPoints,
  readStoredCollegeConfig,
  serialNamespacePrefixes,
  toStoredCollegeConfig,
  unknownCampusIds,
} from '@/lib/campus/collegeConfigSchema';
import { toIso } from '@/lib/campus/serialize';
import type { College } from '@/types/college';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const SERIAL_CAPACITY = 10_000;

function collegeFrom(request: NextRequest): College {
  const collegeId = request.nextUrl.searchParams.get('collegeId') || DEFAULT_CONFIG_COLLEGE_ID;
  const college = getCollege(collegeId);
  if (!college) throw new CampusHttpError(404, 'Unknown college');
  return college;
}

async function loadConfig(college: College) {
  const db = getAdminDb();
  const prefixes = serialNamespacePrefixes(college.code);
  const [snapshot, ...metrics] = await Promise.all([
    db.collection('college_configs').doc(college.id).get(),
    ...prefixes.map((namespace) => db.collection('campus_serial_metrics').doc(namespace.prefix).get()),
  ]);
  const data = snapshot.data();
  const stored = readStoredCollegeConfig(data);
  const merged = mergeCollegeConfig(college.id, stored);
  if (!merged) throw new CampusHttpError(404, 'Unknown college');
  const campuses = applyCampusOrigins(merged.campuses, stored);
  return {
    collegeId: college.id,
    colleges: listColleges().map((item) => ({ id: item.id, code: item.code, shortName: item.shortName, name: item.name })),
    college: { id: college.id, code: college.code, name: college.name, shortName: college.shortName },
    launchState: merged.college.launchState,
    emailDomains: [...merged.college.emailDomains],
    marketplaceEnabled: stored.marketplaceEnabled !== false,
    housingEnabled: stored.housingEnabled !== false,
    campuses: campuses.map((campus) => ({
      id: campus.id,
      name: campus.name,
      label: campus.label,
      origin: campus.origin,
      pickupPoints: campus.pickupPoints.map((point) => ({ id: point.id, label: point.label })),
      landmarks: campus.landmarks.map((landmark) => ({ ...landmark, aliases: [...landmark.aliases] })),
    })),
    serialNamespaces: prefixes.map((namespace, index) => ({
      ...namespace,
      reserved: Number(metrics[index]?.data()?.reserved || 0),
      capacity: SERIAL_CAPACITY,
    })),
    updatedAt: data?.updatedAt ? toIso(data.updatedAt) : null,
    updatedBy: typeof data?.updatedBy === 'string' ? data.updatedBy : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminPrincipal();
    const college = collegeFrom(request);
    return NextResponse.json(await loadConfig(college), { headers: NO_STORE });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdminPrincipal();
    const college = collegeFrom(request);
    const body = collegeConfigPutSchema.parse(await request.json());
    const unknown = unknownCampusIds(body, campusesOf(college.id));
    if (unknown.length) {
      return NextResponse.json({ error: `Not a ${college.shortName} campus: ${unknown.join(', ')}` }, { status: 400, headers: NO_STORE });
    }
    await getAdminDb().collection('college_configs').doc(college.id).set({
      ...toStoredCollegeConfig(body),
      pickupPoints: flattenPickupPoints(body),
      collegeId: college.id,
      collegeCode: college.code,
      collegeName: college.name,
      updatedAt: Timestamp.now(),
      updatedBy: admin.email,
    }, { merge: true });
    return NextResponse.json({ ok: true, ...(await loadConfig(college)) }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid college configuration' }, { status: 400, headers: NO_STORE });
    if (error instanceof z.ZodError) return NextResponse.json({ error: describeConfigIssue(error) }, { status: 400, headers: NO_STORE });
    return campusErrorResponse(error);
  }
}
