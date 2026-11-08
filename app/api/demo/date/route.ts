// Demo only: moves the demo to another date ('nov' | 'may' | 'july'). Sets the
// swoop_demo_date cookie (readable by the browser, for useSeasonNow) and swaps
// the seasonal sample pack in this visitor's world. The visitor's own posts and
// saves stay. 404 outside the demo.
//
// Relative .ts imports and plain Response (no next/server) so node tests can load this route.
import { DEMO_DATE_COOKIE, isDemoDateId, parseDemoDate } from '../../../../src/lib/demo/contract.ts';
import { isDemoMode } from '../../../../src/lib/demo/mode.ts';
import { applySeason } from '../../../../src/lib/demo/server/seasonPack.ts';
import { currentWorldId, getWorld } from '../../../../src/lib/demo/server/world.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const DATE_MAX_AGE = 60 * 60 * 24 * 30;

function fail(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

/** Browsers send Origin on POST; a cross-site one is refused. */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host || new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}

function readCookie(request: Request, name: string): string | undefined {
  for (const pair of (request.headers.get('cookie') ?? '').split(';')) {
    const index = pair.indexOf('=');
    if (index > 0 && pair.slice(0, index).trim() === name) return pair.slice(index + 1).trim();
  }
  return undefined;
}

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isDemoMode()) return fail(404, 'Not found');
  if (!isSameOrigin(request)) return fail(403, 'Cross-site requests are refused');

  const body = await readBody(request);
  const date = body && typeof body === 'object' ? (body as { date?: unknown }).date : undefined;
  if (!isDemoDateId(date)) return fail(400, 'Pick nov, may or july');

  try {
    // A new world is seeded with this date's pack; an existing one swaps packs.
    const world = getWorld(await currentWorldId(), { dateId: date });
    await world.ready;
    applySeason(world, date);
  } catch (error) {
    console.error('[demo/date]', error);
    return fail(500, 'Could not change the demo date');
  }

  const headers = new Headers(NO_STORE);
  headers.append('Set-Cookie', `${DEMO_DATE_COOKIE}=${date}; Path=/; Max-Age=${DATE_MAX_AGE}; SameSite=Lax`);
  return Response.json({ ok: true, date }, { headers });
}

export async function GET(request: Request): Promise<Response> {
  if (!isDemoMode()) return fail(404, 'Not found');
  return Response.json({ date: parseDemoDate(readCookie(request, DEMO_DATE_COOKIE)) }, { headers: NO_STORE });
}
