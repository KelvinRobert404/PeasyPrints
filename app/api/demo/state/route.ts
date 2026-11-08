// Demo only: keeps each visitor's changes in their own browser.
// GET ?since=<rev>&boot=<bootId> returns the docs and files changed after
// `since`, or { fresh: true } when the world was created again (a server
// restart) since the browser last pulled. POST imports a full overlay saved in
// the browser and returns this world's changes since 0. 404 outside the demo.
//
// Relative .ts imports so node tests can load this route.
import { isDemoMode } from '../../../../src/lib/demo/mode.ts';
import { currentWorld } from '../../../../src/lib/demo/server/world.ts';
import { OVERLAY_MAX_BODY_BYTES, OverlayError, exportChanges, importOverlay, parseOverlay } from '../../../../src/lib/demo/server/overlay.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

function fail(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

function notFound(): Response {
  return fail(404, 'Not found');
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

function parseSince(raw: string | null): number | null {
  if (raw === null || raw === '') return 0;
  if (!/^\d{1,15}$/.test(raw)) return null;
  return Number(raw);
}

export async function GET(request: Request): Promise<Response> {
  if (!isDemoMode()) return notFound();
  const params = new URL(request.url).searchParams;
  const since = parseSince(params.get('since'));
  if (since === null) return fail(400, 'Invalid since');
  const boot = params.get('boot');
  const world = await currentWorld();
  if (boot && boot !== world.bootId) {
    return Response.json({ fresh: true, bootId: world.bootId, rev: world.rev }, { headers: NO_STORE });
  }
  return Response.json(exportChanges(world, since), { headers: NO_STORE });
}

export async function POST(request: Request): Promise<Response> {
  if (!isDemoMode()) return notFound();
  if (!isSameOrigin(request)) return fail(403, 'Cross-site requests are refused');
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return fail(415, 'Send JSON');
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > OVERLAY_MAX_BODY_BYTES) return fail(413, 'Overlay too large');

  let text: string;
  try {
    text = await request.text();
  } catch {
    return fail(400, 'Could not read the request');
  }
  if (text.length > OVERLAY_MAX_BODY_BYTES) return fail(413, 'Overlay too large');

  const world = await currentWorld();
  try {
    await importOverlay(world, parseOverlay(JSON.parse(text)));
  } catch (error) {
    if (error instanceof OverlayError || error instanceof SyntaxError) return fail(400, error.message);
    console.error('[demo/state]', error);
    return fail(500, 'Could not restore your changes');
  }
  return Response.json(exportChanges(world, 0), { headers: NO_STORE });
}
