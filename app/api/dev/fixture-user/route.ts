import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_FIXTURE_USER_ID, FIXTURE_USER_COOKIE, FIXTURE_USER_IDS, isFixtureMode, isFixtureUserId } from '@/lib/firebase/fixtureMode';
import { safeRedirectPath } from '@/lib/utils/safeRedirect';

// Dev only: picks the signed-in fixture user, e.g.
// /api/dev/fixture-user?id=verified-kju-main&next=/marketplace
export function GET(req: NextRequest) {
  if (!isFixtureMode()) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const id = searchParams.get('id') || DEFAULT_FIXTURE_USER_ID;
  if (!isFixtureUserId(id)) {
    return NextResponse.json({ error: 'Unknown fixture user', ids: FIXTURE_USER_IDS }, { status: 400 });
  }

  const response = NextResponse.redirect(new URL(safeRedirectPath(searchParams.get('next')), req.url));
  // Readable from the browser so client code can tell which fixture user is active.
  response.cookies.set(FIXTURE_USER_COOKIE, id, { path: '/', sameSite: 'lax', httpOnly: false, maxAge: 60 * 60 * 24 * 30 });
  return response;
}
