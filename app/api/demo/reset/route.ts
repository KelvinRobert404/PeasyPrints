// Demo only: starts the visitor over. Drops their world, gives them a new
// visitor id, and signs them out back to the default demo date. The browser
// clears its own saved changes (src/lib/demo/client/reset.ts). 404 outside the demo.
//
// Relative .ts imports and plain Response (no next/server) so node tests can load this route.
import { DEMO_DATE_COOKIE, DEMO_SESSION_COOKIE, DEMO_VISITOR_COOKIE } from '../../../../src/lib/demo/contract.ts';
import { isDemoMode } from '../../../../src/lib/demo/mode.ts';
import { DEFAULT_WORLD_ID, dropWorld } from '../../../../src/lib/demo/server/world.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
// Same as the proxy, which mints the first visitor id (proxy.ts).
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365;
const VISITOR_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

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

export async function POST(request: Request): Promise<Response> {
  if (!isDemoMode()) return fail(404, 'Not found');
  if (!isSameOrigin(request)) return fail(403, 'Cross-site requests are refused');

  const current = readCookie(request, DEMO_VISITOR_COOKIE);
  // Only a visitor's own world: never the shared 'default' one.
  if (current && current !== DEFAULT_WORLD_ID && VISITOR_ID_PATTERN.test(current)) dropWorld(current);

  const headers = new Headers(NO_STORE);
  headers.append('Set-Cookie', `${DEMO_VISITOR_COOKIE}=${crypto.randomUUID()}; Path=/; Max-Age=${VISITOR_MAX_AGE}; HttpOnly; SameSite=Lax`);
  headers.append('Set-Cookie', `${DEMO_SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`);
  headers.append('Set-Cookie', `${DEMO_DATE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`);
  return Response.json({ ok: true }, { headers });
}

export async function GET(): Promise<Response> {
  if (!isDemoMode()) return fail(404, 'Not found');
  return Response.json({ error: 'Use POST' }, { status: 405, headers: { ...NO_STORE, Allow: 'POST' } });
}
