// Demo only: the Firebase client stand-ins (src/lib/demo/shims/firebase-*.ts)
// post every Firestore read and write here, and storage download URLs. Each op
// runs on getAdminDb(), which in the demo is the visitor's own seeded world.
// No security rules; collections starting with '_' are refused. 404 outside the demo.
//
// Relative .ts imports so node tests can load this route.
import { isDemoMode } from '../../../../src/lib/demo/mode.ts';
import { getAdminBucket, getAdminDb } from '../../../../src/lib/firebase/admin.ts';
import { CLIENT_MAX_BODY_BYTES, handleClientRequest } from '../../../../src/lib/demo/server/clientQuery.ts';
import type { ClientBucket } from '../../../../src/lib/demo/server/clientQuery.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

function fail(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status, headers: NO_STORE });
}

function notFound(): Response {
  return Response.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
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

export async function POST(request: Request): Promise<Response> {
  if (!isDemoMode()) return notFound();
  if (!isSameOrigin(request)) return fail(403, 'permission-denied', 'Cross-site requests are refused');
  // A JSON content type forces a CORS preflight for any cross-site caller.
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return fail(415, 'invalid-argument', 'Send JSON');
  }
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > CLIENT_MAX_BODY_BYTES) return fail(413, 'resource-exhausted', 'Request too large');

  let text: string;
  try {
    text = await request.text();
  } catch {
    return fail(400, 'invalid-argument', 'Could not read the request');
  }
  if (text.length > CLIENT_MAX_BODY_BYTES) return fail(413, 'resource-exhausted', 'Request too large');

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, 'invalid-argument', 'Invalid JSON');
  }

  const result = await handleClientRequest(getAdminDb, body, { getBucket: () => getAdminBucket() as unknown as ClientBucket });
  return Response.json(result.body, { status: result.status, headers: NO_STORE });
}

export async function GET(): Promise<Response> {
  if (!isDemoMode()) return notFound();
  return Response.json({ error: 'Use POST' }, { status: 405, headers: { ...NO_STORE, Allow: 'POST' } });
}
