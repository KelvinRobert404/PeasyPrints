// Runs the demo Firebase client stand-in's operations on the visitor's world.
//
// The browser's firebase/firestore stand-in (src/lib/demo/shims/firebase-firestore.ts)
// posts one ClientRequest to /api/demo/firestore: a batch of reads (documents
// and queries), an atomic batch of writes, or a storage download URL. This
// module checks the request, runs it on the database it is given (in the demo,
// getAdminDb() is the visitor's own seeded world) and encodes the answer with
// the wire codec. There are no security rules: each visitor only ever reaches
// their own sample world. Collections whose id starts with '_' (server
// internals such as _rate_limits) are refused.
//
// Server only. Node tests import it, so runtime imports are relative.

import { FieldValue, GeoPoint, Timestamp } from 'firebase-admin/firestore';
import type { DocumentReference, Firestore, Query, WhereFilterOp } from 'firebase-admin/firestore';
import { decodeData, decodeValue, encodeData } from '../codec.ts';
import type { CodecHooks, FieldOp, WireMap, WireValue } from '../codec.ts';

// ---------------------------------------------------------------------------
// Wire protocol

export const CLIENT_WHERE_OPS = ['==', '!=', '<', '<=', '>', '>=', 'in', 'not-in', 'array-contains', 'array-contains-any'] as const;
export type ClientWhereOp = (typeof CLIENT_WHERE_OPS)[number];
export type ClientOrderDirection = 'asc' | 'desc';

/** The field path for the document id (the client's documentId()). */
export const DOCUMENT_ID_FIELD = '__name__';

export interface WireFilter {
  field: string;
  op: ClientWhereOp;
  value: WireValue;
}

export interface WireOrder {
  field: string;
  direction: ClientOrderDirection;
}

export interface WireDocTarget {
  kind: 'doc';
  path: string;
}

export interface WireQueryTarget {
  kind: 'query';
  /** A collection path. */
  path: string;
  filters: WireFilter[];
  orders: WireOrder[];
  limit: number | null;
  limitToLast: number | null;
}

export type WireTarget = WireDocTarget | WireQueryTarget;

export type WireWrite =
  | { kind: 'set'; path: string; data: WireMap; merge: boolean }
  | { kind: 'update'; path: string; data: WireMap }
  | { kind: 'create'; path: string; data: WireMap }
  | { kind: 'delete'; path: string };

export type ClientRequest =
  | { op: 'read'; targets: WireTarget[] }
  | { op: 'write'; writes: WireWrite[] }
  | { op: 'downloadUrl'; path: string };

/** A document in a result. `data` is null when the document does not exist. */
export interface WireDoc {
  path: string;
  data: WireMap | null;
}

export type ClientErrorCode =
  | 'invalid-argument'
  | 'not-found'
  | 'already-exists'
  | 'permission-denied'
  | 'failed-precondition'
  | 'resource-exhausted'
  | 'unavailable'
  | 'internal';

export interface WireError {
  code: ClientErrorCode;
  message: string;
}

export type WireReadResult =
  | { ok: true; kind: 'doc'; doc: WireDoc }
  | { ok: true; kind: 'query'; docs: WireDoc[] }
  | { ok: false; error: WireError };

export type ClientResponseBody =
  | { results: WireReadResult[] }
  | { ok: true }
  | { url: string }
  | { error: WireError };

/** A read the server refused while checking it; the other reads in the request still run. */
export interface RejectedTarget {
  kind: 'rejected';
  error: WireError;
}

/** A request after checking: each read is either runnable or refused on its own. */
export type CheckedRequest = { op: 'read'; targets: Array<WireTarget | RejectedTarget> } | Exclude<ClientRequest, { op: 'read' }>;

export interface ClientResponse {
  status: number;
  body: ClientResponseBody;
}

// ---------------------------------------------------------------------------
// Limits

/** Largest request body the route reads. */
export const CLIENT_MAX_BODY_BYTES = 1_000_000;
export const CLIENT_MAX_TARGETS = 100;
export const CLIENT_MAX_WRITES = 500;
const MAX_FILTERS = 30;
const MAX_ORDERS = 10;
const MAX_LIMIT = 10_000;
const MAX_PATH_LENGTH = 1_500;
const MAX_FIELD_LENGTH = 1_500;
/** Largest stored file whose data: URL the demo hands out. */
const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024;
const DOWNLOAD_URL_TTL_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Errors

const STATUS_BY_CODE: Record<ClientErrorCode, number> = {
  'invalid-argument': 400,
  'not-found': 404,
  'already-exists': 409,
  'permission-denied': 403,
  'failed-precondition': 412,
  'resource-exhausted': 413,
  unavailable: 503,
  internal: 500,
};

class ClientOpError extends Error {
  readonly code: ClientErrorCode;

  constructor(code: ClientErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function invalid(message: string): ClientOpError {
  return new ClientOpError('invalid-argument', message);
}

/** gRPC status numbers the fake (and the real Admin SDK) put on `code`. */
const CODE_BY_GRPC: Record<number, ClientErrorCode> = {
  3: 'invalid-argument',
  5: 'not-found',
  6: 'already-exists',
  7: 'permission-denied',
  8: 'resource-exhausted',
  9: 'failed-precondition',
  14: 'unavailable',
};

const CLIENT_CODES: ReadonlySet<string> = new Set(Object.keys(STATUS_BY_CODE));

/** Maps anything thrown while running an op to a wire error. */
export function toWireError(error: unknown): WireError {
  if (error instanceof ClientOpError) return { code: error.code, message: error.message };
  const raw = error as { code?: unknown; details?: unknown; message?: unknown } | null;
  let code: ClientErrorCode = 'internal';
  if (typeof raw?.code === 'number' && CODE_BY_GRPC[raw.code]) code = CODE_BY_GRPC[raw.code];
  else if (typeof raw?.code === 'string' && CLIENT_CODES.has(raw.code)) code = raw.code as ClientErrorCode;
  if (code === 'internal') return { code, message: 'Something went wrong in the sample data' };
  const message = typeof raw?.details === 'string' ? raw.details : typeof raw?.message === 'string' ? raw.message : code;
  return { code, message };
}

function errorResponse(error: unknown): ClientResponse {
  const wire = toWireError(error);
  if (wire.code === 'internal') console.error('[demo/firestore]', error);
  return { status: STATUS_BY_CODE[wire.code], body: { error: wire } };
}

// ---------------------------------------------------------------------------
// Paths

/** True when a collection id is a server internal the client may never reach. */
export function isRefusedCollectionId(id: string): boolean {
  return id.startsWith('_');
}

/** Checks a document or collection path. Throws invalid-argument or permission-denied. */
export function checkPath(path: unknown, expect: 'doc' | 'collection'): string {
  if (typeof path !== 'string' || path.length === 0 || path.length > MAX_PATH_LENGTH) throw invalid('Invalid path');
  const segments = path.split('/');
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') throw invalid(`Invalid path: "${path}"`);
    if (/^__.*__$/.test(segment)) throw invalid(`Reserved id in path: "${path}"`);
  }
  const isDoc = segments.length % 2 === 0;
  if (expect === 'doc' && !isDoc) throw invalid(`Path must point to a document: "${path}"`);
  if (expect === 'collection' && isDoc) throw invalid(`Path must point to a collection: "${path}"`);
  for (let index = 0; index < segments.length; index += 2) {
    if (isRefusedCollectionId(segments[index])) throw new ClientOpError('permission-denied', `Collection "${segments[index]}" is not open to the browser`);
  }
  return path;
}

function checkField(field: unknown): string {
  if (typeof field !== 'string' || field.length === 0 || field.length > MAX_FIELD_LENGTH) throw invalid('Invalid field path');
  if (field === DOCUMENT_ID_FIELD) return field;
  if (field.split('.').some((segment) => segment === '')) throw invalid(`Invalid field path: "${field}"`);
  return field;
}

function checkCount(value: unknown, what: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_LIMIT) throw invalid(`Invalid ${what}`);
  return value;
}

// ---------------------------------------------------------------------------
// Parsing

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function checkMap(value: unknown): WireMap {
  if (!isRecord(value)) throw invalid('Document data must be a map');
  return value as WireMap;
}

const WHERE_OPS: ReadonlySet<string> = new Set(CLIENT_WHERE_OPS);

function parseTarget(raw: unknown): WireTarget {
  if (!isRecord(raw)) throw invalid('Invalid read');
  if (raw.kind === 'doc') return { kind: 'doc', path: checkPath(raw.path, 'doc') };
  if (raw.kind !== 'query') throw invalid('Invalid read');
  const path = checkPath(raw.path, 'collection');
  const filters = raw.filters ?? [];
  const orders = raw.orders ?? [];
  if (!Array.isArray(filters) || filters.length > MAX_FILTERS) throw invalid('Invalid filters');
  if (!Array.isArray(orders) || orders.length > MAX_ORDERS) throw invalid('Invalid orderBy');
  const limit = checkCount(raw.limit, 'limit');
  const limitToLast = checkCount(raw.limitToLast, 'limitToLast');
  if (limit !== null && limitToLast !== null) throw invalid('Use limit or limitToLast, not both');
  return {
    kind: 'query',
    path,
    filters: filters.map((filter): WireFilter => {
      if (!isRecord(filter) || typeof filter.op !== 'string' || !WHERE_OPS.has(filter.op) || !('value' in filter)) throw invalid('Invalid filter');
      return { field: checkField(filter.field), op: filter.op as ClientWhereOp, value: filter.value as WireValue };
    }),
    orders: orders.map((order): WireOrder => {
      if (!isRecord(order) || (order.direction !== 'asc' && order.direction !== 'desc')) throw invalid('Invalid orderBy');
      return { field: checkField(order.field), direction: order.direction };
    }),
    limit,
    limitToLast,
  };
}

function parseWrite(raw: unknown): WireWrite {
  if (!isRecord(raw)) throw invalid('Invalid write');
  const path = checkPath(raw.path, 'doc');
  switch (raw.kind) {
    case 'set':
      return { kind: 'set', path, data: checkMap(raw.data), merge: raw.merge === true };
    case 'update': {
      const data = checkMap(raw.data);
      if (Object.keys(data).length === 0) throw invalid('At least one field must be updated');
      for (const field of Object.keys(data)) checkField(field);
      return { kind: 'update', path, data };
    }
    case 'create':
      return { kind: 'create', path, data: checkMap(raw.data) };
    case 'delete':
      return { kind: 'delete', path };
    default:
      throw invalid('Invalid write');
  }
}

function checkFilePath(path: unknown): string {
  if (typeof path !== 'string' || path.length === 0 || path.length > 1024) throw invalid('Invalid file path');
  if (path.startsWith('/') || path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) throw invalid('Invalid file path');
  return path;
}

function checkTarget(raw: unknown): WireTarget | RejectedTarget {
  try {
    return parseTarget(raw);
  } catch (error) {
    return { kind: 'rejected', error: toWireError(error) };
  }
}

/**
 * Checks a decoded request body. Throws invalid-argument or permission-denied
 * for the request as a whole; a bad read among several is refused on its own,
 * so one listener can never starve the others in a batched poll.
 */
export function parseClientRequest(body: unknown): CheckedRequest {
  if (!isRecord(body)) throw invalid('Invalid request');
  switch (body.op) {
    case 'read': {
      const targets = body.targets;
      if (!Array.isArray(targets) || targets.length === 0 || targets.length > CLIENT_MAX_TARGETS) throw invalid('Invalid reads');
      return { op: 'read', targets: targets.map(checkTarget) };
    }
    case 'write': {
      const writes = body.writes;
      if (!Array.isArray(writes) || writes.length === 0 || writes.length > CLIENT_MAX_WRITES) throw invalid('Invalid writes');
      return { op: 'write', writes: writes.map(parseWrite) };
    }
    case 'downloadUrl':
      return { op: 'downloadUrl', path: checkFilePath(body.path) };
    default:
      throw invalid('Unknown operation');
  }
}

// ---------------------------------------------------------------------------
// Codec hooks for firebase-admin values

function adminFieldValue(op: FieldOp): unknown {
  switch (op.kind) {
    case 'serverTimestamp':
      return FieldValue.serverTimestamp();
    case 'delete':
      return FieldValue.delete();
    case 'increment':
      return FieldValue.increment(op.operand ?? 0);
    case 'arrayUnion':
      return FieldValue.arrayUnion(...(op.elements ?? []));
    case 'arrayRemove':
      return FieldValue.arrayRemove(...(op.elements ?? []));
    default:
      throw invalid('Unknown field value');
  }
}

/** Hooks that turn wire values into firebase-admin ones for `db`, and back. */
export function adminCodecHooks(db: Firestore): CodecHooks {
  const refClass = (db.doc('_probe/_probe') as object).constructor;
  return {
    refPath: (value) => (value instanceof refClass ? (value as DocumentReference).path : null),
    makeRef: (path) => db.doc(checkPath(path, 'doc')),
    makeTimestamp: (seconds, nanoseconds) => new Timestamp(seconds, nanoseconds),
    makeGeoPoint: (latitude, longitude) => new GeoPoint(latitude, longitude),
    makeBytes: (bytes) => Buffer.from(bytes),
    makeFieldOp: adminFieldValue,
  };
}

// ---------------------------------------------------------------------------
// Running

function encodeDoc(path: string, data: Record<string, unknown> | undefined, hooks: CodecHooks): WireDoc {
  return { path, data: data === undefined ? null : encodeData(data, hooks) };
}

/** Builds the admin query for a wire query. */
export function buildAdminQuery(db: Firestore, target: WireQueryTarget, hooks: CodecHooks = adminCodecHooks(db)): Query {
  let query: Query = db.collection(target.path);
  for (const filter of target.filters) {
    query = query.where(filter.field, filter.op as WhereFilterOp, decodeValue(filter.value, hooks));
  }
  for (const order of target.orders) query = query.orderBy(order.field, order.direction);
  if (target.limit !== null) query = query.limit(target.limit);
  if (target.limitToLast !== null) query = query.limitToLast(target.limitToLast);
  return query;
}

async function runTarget(db: Firestore, target: WireTarget | RejectedTarget, hooks: CodecHooks): Promise<WireReadResult> {
  if (target.kind === 'rejected') return { ok: false, error: target.error };
  try {
    if (target.kind === 'doc') {
      const snap = await db.doc(target.path).get();
      return { ok: true, kind: 'doc', doc: encodeDoc(target.path, snap.exists ? snap.data() : undefined, hooks) };
    }
    const snap = await buildAdminQuery(db, target, hooks).get();
    return { ok: true, kind: 'query', docs: snap.docs.map((doc) => encodeDoc(doc.ref.path, doc.data(), hooks)) };
  } catch (error) {
    const wire = toWireError(error);
    if (wire.code === 'internal') console.error('[demo/firestore]', error);
    return { ok: false, error: wire };
  }
}

async function runWrites(db: Firestore, writes: WireWrite[], hooks: CodecHooks): Promise<void> {
  const batch = db.batch();
  for (const write of writes) {
    const ref = db.doc(write.path);
    switch (write.kind) {
      case 'set': {
        const data = decodeData(write.data, hooks, { allowFieldOps: true });
        if (write.merge) batch.set(ref, data, { merge: true });
        else batch.set(ref, data);
        break;
      }
      case 'update':
        batch.update(ref, decodeData(write.data, hooks, { allowFieldOps: true }));
        break;
      case 'create':
        batch.create(ref, decodeData(write.data, hooks, { allowFieldOps: true }));
        break;
      case 'delete':
        batch.delete(ref);
        break;
    }
  }
  await batch.commit();
}

/** The bucket surface the download URL op needs (the demo's FakeBucket, or a real one). */
export interface ClientBucket {
  file(name: string): {
    exists(): Promise<[boolean]>;
    getMetadata(): Promise<[{ size?: number | string }]>;
    getSignedUrl(config: { action: 'read'; expires: number }): Promise<[string]>;
  };
}

async function runDownloadUrl(bucket: ClientBucket | undefined, path: string): Promise<string> {
  if (!bucket) throw new ClientOpError('unavailable', 'Storage is not open here');
  const file = bucket.file(path);
  const [exists] = await file.exists();
  if (!exists) throw new ClientOpError('not-found', `No file at "${path}"`);
  const [metadata] = await file.getMetadata();
  if (Number(metadata.size ?? 0) > MAX_DOWNLOAD_BYTES) throw new ClientOpError('resource-exhausted', 'This sample file is too large to open');
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + DOWNLOAD_URL_TTL_MS });
  // Only inline data: URLs, so the demo never points the browser at another host.
  if (!url.startsWith('data:')) throw new ClientOpError('unavailable', 'This file cannot be opened in the demo');
  return url;
}

export interface ClientRunOptions {
  bucket?: ClientBucket;
}

/** Runs a checked request. Reads report errors per target; writes are all or nothing. */
export async function runClientRequest(db: Firestore, request: CheckedRequest, options: ClientRunOptions = {}): Promise<ClientResponse> {
  const hooks = adminCodecHooks(db);
  try {
    switch (request.op) {
      case 'read': {
        const results = await Promise.all(request.targets.map((target) => runTarget(db, target, hooks)));
        return { status: 200, body: { results } };
      }
      case 'write':
        await runWrites(db, request.writes, hooks);
        return { status: 200, body: { ok: true } };
      case 'downloadUrl':
        return { status: 200, body: { url: await runDownloadUrl(options.bucket, request.path) } };
    }
  } catch (error) {
    return errorResponse(error);
  }
}

/** Parses and runs a decoded request body. `db` is only resolved once the body checks out. */
export async function handleClientRequest(getDb: () => Firestore, body: unknown, options: { getBucket?: () => ClientBucket } = {}): Promise<ClientResponse> {
  let request: CheckedRequest;
  try {
    request = parseClientRequest(body);
  } catch (error) {
    return errorResponse(error);
  }
  // Every read refused: answer with the first refusal, without touching the database.
  if (request.op === 'read' && request.targets.every((target) => target.kind === 'rejected')) {
    const first = request.targets[0] as RejectedTarget;
    return { status: STATUS_BY_CODE[first.error.code], body: { error: first.error } };
  }
  try {
    const db = getDb();
    const bucket = request.op === 'downloadUrl' ? options.getBucket?.() : undefined;
    return await runClientRequest(db, request, { bucket });
  } catch (error) {
    return errorResponse(error);
  }
}
