import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { campusErrorResponse, requireAdminPrincipal } from '@/lib/campus/auth';
import { DEFAULT_PICKUP_POINTS, PILOT_COLLEGE } from '@/lib/campus/constants';

const schema = z.object({
  emailDomains: z.array(z.string().trim().toLowerCase().min(3).max(100)).max(20),
  pickupPoints: z.array(z.object({ id: z.string().min(1).max(60), label: z.string().min(2).max(100) })).max(30),
  marketplaceEnabled: z.boolean(),
  housingEnabled: z.boolean(),
});

export async function GET() {
  try {
    await requireAdminPrincipal();
    const [snapshot, marketMetric, housingMetric] = await Promise.all([
      getAdminDb().collection('college_configs').doc(PILOT_COLLEGE.id).get(),
      getAdminDb().collection('campus_serial_metrics').doc(`${PILOT_COLLEGE.code}-M`).get(),
      getAdminDb().collection('campus_serial_metrics').doc(`${PILOT_COLLEGE.code}-H`).get(),
    ]);
    return NextResponse.json({
      college: PILOT_COLLEGE,
      emailDomains: snapshot.data()?.emailDomains || [],
      pickupPoints: snapshot.data()?.pickupPoints || DEFAULT_PICKUP_POINTS,
      marketplaceEnabled: snapshot.data()?.marketplaceEnabled !== false,
      housingEnabled: snapshot.data()?.housingEnabled !== false,
      serialNamespaces: [
        { product: 'marketplace', prefix: `${PILOT_COLLEGE.code}-M`, reserved: Number(marketMetric.data()?.reserved || 0), capacity: 10_000 },
        { product: 'housing', prefix: `${PILOT_COLLEGE.code}-H`, reserved: Number(housingMetric.data()?.reserved || 0), capacity: 10_000 },
      ],
    });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdminPrincipal();
    const body = schema.parse(await request.json());
    await getAdminDb().collection('college_configs').doc(PILOT_COLLEGE.id).set({
      ...body,
      ...PILOT_COLLEGE,
      updatedAt: Timestamp.now(),
      updatedBy: admin.email,
    }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid college configuration' }, { status: 400 });
    return campusErrorResponse(error);
  }
}
