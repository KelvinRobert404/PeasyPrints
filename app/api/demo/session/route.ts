import { NextResponse, type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { CAMPUS_COLLECTIONS } from '@/lib/campus/constants';
import { DEMO_SESSION_COOKIE, WALKTHROUGH_UID, encodeDemoSession, type DemoSession } from '@/lib/demo/contract';
import { isDemoMode } from '@/lib/demo/mode';
import { addDemoEmail, demoSessionPayload, parseSessionPost, readDemoSession } from '@/lib/demo/server/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Demo only: signs in as a sample student or as Riya (the new-student
// walk-through), adds a college email, and signs out. 404 outside the demo.

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
}

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

function withSession(session: DemoSession | null) {
  const response = NextResponse.json(demoSessionPayload(session), { headers: NO_STORE });
  if (session) {
    // Readable by the browser on purpose: the client stand-ins read it (dev-only, local demo).
    response.cookies.set(DEMO_SESSION_COOKIE, encodeDemoSession(session), {
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
      maxAge: SESSION_MAX_AGE,
    });
  } else {
    response.cookies.set(DEMO_SESSION_COOKIE, '', { path: '/', sameSite: 'lax', httpOnly: false, maxAge: 0 });
  }
  return response;
}

async function readBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Walk-through sign-ins start Riya's onboarding again in this visitor's world. */
async function resetWalkthrough() {
  const db = getAdminDb();
  await Promise.all([
    db.collection(CAMPUS_COLLECTIONS.memberships).doc(WALKTHROUGH_UID).delete(),
    db.collection('campus_verification_locks').doc(`${WALKTHROUGH_UID}_student`).delete(),
    db.collection('campus_verification_locks').doc(`${WALKTHROUGH_UID}_girls_space`).delete(),
  ]);
}

export async function GET(request: NextRequest) {
  if (!isDemoMode()) return notFound();
  return NextResponse.json(demoSessionPayload(readDemoSession(request.cookies)), { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  if (!isDemoMode()) return notFound();
  const parsed = parseSessionPost(await readBody(request));
  if (!parsed.ok) return fail(parsed.status, parsed.error);
  try {
    if (parsed.value.kind === 'walkthrough') await resetWalkthrough();
  } catch (error) {
    console.error('[demo/session]', error);
    return fail(500, 'Could not start the walk-through');
  }
  return withSession(parsed.value.session);
}

export async function PATCH(request: NextRequest) {
  if (!isDemoMode()) return notFound();
  const session = readDemoSession(request.cookies);
  if (!session) return fail(401, 'Sign in required');
  const body = await readBody(request);
  const address = body && typeof body === 'object' ? (body as Record<string, unknown>).addEmail : undefined;
  const result = addDemoEmail(session, address);
  if (!result.ok) return fail(result.status, result.error);
  return withSession(result.value);
}

export async function DELETE() {
  if (!isDemoMode()) return notFound();
  return withSession(null);
}
