// Demo stand-in for 'firebase/firestore' (aliased in the demo dev build only,
// see src/lib/demo/build-config.cjs). Never talks to Google.
//
// Every read and write posts to /api/demo/firestore, which runs it on the
// visitor's own sample world (src/lib/demo/server/clientQuery.ts). Values cross
// the wire through src/lib/demo/codec.ts. onSnapshot polls every 2.5 s while
// the tab is visible, all listeners in one request, and only calls back when
// the result changed. Writes nudge the listeners at once. Anything the app
// does not use throws 'Not in the demo: <name>'.

import { Bytes, FieldOp, GeoPoint, Timestamp, decodeData, encodeData, encodeValue } from '../codec.ts';
import type { CodecHooks, WireMap, WireValue } from '../codec.ts';
import type {
  ClientRequest,
  ClientWhereOp,
  WireDoc,
  WireError,
  WireFilter,
  WireOrder,
  WireReadResult,
  WireTarget,
  WireWrite,
} from '../server/clientQuery.ts';
import { getApp } from './firebase-app.ts';
import type { FirebaseApp } from './firebase-app.ts';

export { Bytes, GeoPoint, Timestamp };
export { FieldOp as FieldValue };

const DEMO_ENDPOINT = '/api/demo/firestore';
/** onSnapshot poll interval while the tab is visible. */
export const SNAPSHOT_POLL_MS = 2500;
/** How soon listeners refresh after a write from this tab. */
const POST_WRITE_POLL_MS = 60;
/** Matches CLIENT_MAX_TARGETS in clientQuery.ts. */
const MAX_TARGETS_PER_REQUEST = 100;
/** Matches CLIENT_MAX_WRITES in clientQuery.ts. */
const MAX_WRITES_PER_BATCH = 500;
const DOCUMENT_ID_FIELD = '__name__';

// ---------------------------------------------------------------------------
// Types

export type DocumentData = { [field: string]: any };
export type WhereFilterOp = ClientWhereOp;
export type OrderByDirection = 'asc' | 'desc';
export interface SetOptions {
  merge?: boolean;
  mergeFields?: Array<string | FieldPath>;
}
export type UpdateData<T = DocumentData> = Partial<T> & DocumentData;
export type WithFieldValue<T> = T;
export type PartialWithFieldValue<T> = Partial<T>;
export type Unsubscribe = () => void;
export interface SnapshotListenOptions {
  includeMetadataChanges?: boolean;
}

// ---------------------------------------------------------------------------
// Errors

export type FirestoreErrorCode =
  | 'cancelled'
  | 'unknown'
  | 'invalid-argument'
  | 'deadline-exceeded'
  | 'not-found'
  | 'already-exists'
  | 'permission-denied'
  | 'resource-exhausted'
  | 'failed-precondition'
  | 'aborted'
  | 'out-of-range'
  | 'unimplemented'
  | 'internal'
  | 'unavailable'
  | 'data-loss'
  | 'unauthenticated';

export class FirestoreError extends Error {
  readonly code: FirestoreErrorCode;

  constructor(code: FirestoreErrorCode, message: string) {
    super(message);
    this.name = 'FirebaseError';
    this.code = code;
  }
}

function notInDemo(name: string): FirestoreError {
  return new FirestoreError('unimplemented', `Not in the demo: ${name}`);
}

function invalidArgument(message: string): FirestoreError {
  return new FirestoreError('invalid-argument', message);
}

function fromWireError(error: WireError | undefined, fallback: string): FirestoreError {
  return new FirestoreError((error?.code as FirestoreErrorCode | undefined) ?? 'unavailable', error?.message ?? fallback);
}

// ---------------------------------------------------------------------------
// Firestore instance

export class Firestore {
  readonly type = 'firestore';
  readonly app: FirebaseApp;

  constructor(app: FirebaseApp) {
    this.app = app;
  }

  toJSON(): object {
    return { app: this.app.name, demo: true };
  }
}

const firestores = new Map<string, Firestore>();

/** Never throws, with or without env. */
export function getFirestore(app?: FirebaseApp): Firestore {
  const target = app ?? getApp();
  let db = firestores.get(target.name);
  if (!db) {
    db = new Firestore(target);
    firestores.set(target.name, db);
  }
  return db;
}

export function initializeFirestore(app: FirebaseApp, _settings?: unknown): Firestore {
  void _settings;
  return getFirestore(app);
}

// ---------------------------------------------------------------------------
// Paths and references

const AUTO_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function autoId(): string {
  const bytes = new Uint8Array(20);
  globalThis.crypto.getRandomValues(bytes);
  let id = '';
  for (const byte of bytes) id += AUTO_ID_CHARS[byte % AUTO_ID_CHARS.length];
  return id;
}

function joinSegments(base: string, path: string, more: string[]): string[] {
  const parts = [base, path, ...more].filter((part) => part !== '').join('/').split('/');
  if (parts.some((segment) => segment === '')) throw invalidArgument(`Invalid path (${[path, ...more].join('/')}): paths must not contain empty segments.`);
  return parts;
}

export class FieldPath {
  readonly segments: readonly string[];

  constructor(...fieldNames: string[]) {
    if (fieldNames.length === 0 || fieldNames.some((name) => typeof name !== 'string' || name === '')) throw invalidArgument('Invalid field path');
    this.segments = fieldNames;
  }

  /** The dotted form the wire uses. */
  toString(): string {
    return this.segments.join('.');
  }

  isEqual(other: FieldPath): boolean {
    return other instanceof FieldPath && other.toString() === this.toString();
  }
}

export function documentId(): FieldPath {
  return new FieldPath(DOCUMENT_ID_FIELD);
}

function fieldString(field: string | FieldPath): string {
  if (field instanceof FieldPath) return field.toString();
  if (typeof field !== 'string' || field === '') throw invalidArgument('Invalid field path');
  return field;
}

export class DocumentReference<T = DocumentData> {
  readonly type = 'document';
  readonly firestore: Firestore;
  readonly path: string;
  readonly converter = null;
  /** Type only: carries T so generic calls infer it. */
  declare readonly __type?: T;

  constructor(firestore: Firestore, path: string) {
    this.firestore = firestore;
    this.path = path;
  }

  get id(): string {
    return this.path.slice(this.path.lastIndexOf('/') + 1);
  }

  get parent(): CollectionReference {
    return new CollectionReference(this.firestore, this.path.slice(0, this.path.lastIndexOf('/')));
  }

  withConverter(): never {
    throw notInDemo('withConverter');
  }

  toJSON(): object {
    return { type: this.type, path: this.path };
  }
}

interface QueryState {
  filters: WireFilter[];
  orders: WireOrder[];
  limit: number | null;
  limitToLast: number | null;
}

const EMPTY_STATE: QueryState = { filters: [], orders: [], limit: null, limitToLast: null };

export class Query<T = DocumentData> {
  readonly type: 'query' | 'collection' = 'query';
  readonly firestore: Firestore;
  readonly converter = null;
  readonly _collectionPath: string;
  readonly _state: QueryState;
  /** Type only: carries T so generic calls infer it. */
  declare readonly __type?: T;

  constructor(firestore: Firestore, collectionPath: string, state: QueryState = EMPTY_STATE) {
    this.firestore = firestore;
    this._collectionPath = collectionPath;
    this._state = state;
  }

  withConverter(): never {
    throw notInDemo('withConverter');
  }
}

export class CollectionReference<T = DocumentData> extends Query<T> {
  readonly type = 'collection';

  constructor(firestore: Firestore, path: string) {
    super(firestore, path);
  }

  get path(): string {
    return this._collectionPath;
  }

  get id(): string {
    return this.path.slice(this.path.lastIndexOf('/') + 1);
  }

  get parent(): DocumentReference | null {
    const index = this.path.lastIndexOf('/');
    return index < 0 ? null : new DocumentReference(this.firestore, this.path.slice(0, index));
  }
}

type ParentRef = Firestore | DocumentReference<any> | CollectionReference<any>;

function basePath(parent: ParentRef): string {
  if (parent instanceof Firestore) return '';
  if (parent instanceof DocumentReference) return parent.path;
  if (parent instanceof CollectionReference) return parent.path;
  throw invalidArgument('Expected a Firestore instance or a reference');
}

function firestoreOf(parent: ParentRef): Firestore {
  return parent instanceof Firestore ? parent : parent.firestore;
}

export function collection(parent: ParentRef, path: string, ...pathSegments: string[]): CollectionReference {
  const segments = joinSegments(basePath(parent), path, pathSegments);
  if (segments.length % 2 !== 1) throw invalidArgument(`Invalid collection reference. Collection references must have an odd number of segments, but ${segments.join('/')} has ${segments.length}.`);
  return new CollectionReference(firestoreOf(parent), segments.join('/'));
}

export function doc(parent: ParentRef, path?: string, ...pathSegments: string[]): DocumentReference {
  if (path === undefined && pathSegments.length === 0) {
    if (!(parent instanceof CollectionReference)) throw invalidArgument('doc() needs a path when called with a Firestore instance');
    path = autoId();
  }
  const segments = joinSegments(basePath(parent), path ?? '', pathSegments);
  if (segments.length % 2 !== 0) throw invalidArgument(`Invalid document reference. Document references must have an even number of segments, but ${segments.join('/')} has ${segments.length}.`);
  return new DocumentReference(firestoreOf(parent), segments.join('/'));
}

export function collectionGroup(): never {
  throw notInDemo('collectionGroup');
}

export function refEqual(left: DocumentReference<any> | CollectionReference<any>, right: DocumentReference<any> | CollectionReference<any>): boolean {
  return left.type === right.type && left.path === right.path && left.firestore === right.firestore;
}

// ---------------------------------------------------------------------------
// Codec hooks

const encodeHooks: CodecHooks = {
  refPath: (value) => (value instanceof DocumentReference ? value.path : null),
  makeRef: () => {
    throw invalidArgument('Unexpected reference');
  },
};

function decodeHooks(db: Firestore): CodecHooks {
  return {
    refPath: encodeHooks.refPath,
    makeRef: (path) => new DocumentReference(db, path),
  };
}

function encodeWriteData(data: unknown, method: string): WireMap {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw invalidArgument(`Function ${method}() called with invalid data. Data must be an object.`);
  }
  try {
    return encodeData(data as Record<string, unknown>, encodeHooks, { allowFieldOps: true });
  } catch (error) {
    throw invalidArgument(`Function ${method}() called with invalid data. ${(error as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Query constraints

export abstract class QueryConstraint {
  abstract readonly type: string;
  abstract _apply(state: QueryState): QueryState;
}

class WhereConstraint extends QueryConstraint {
  readonly type = 'where';
  private readonly filter: WireFilter;

  constructor(filter: WireFilter) {
    super();
    this.filter = filter;
  }

  _apply(state: QueryState): QueryState {
    return { ...state, filters: [...state.filters, this.filter] };
  }
}

class OrderByConstraint extends QueryConstraint {
  readonly type = 'orderBy';
  private readonly order: WireOrder;

  constructor(order: WireOrder) {
    super();
    this.order = order;
  }

  _apply(state: QueryState): QueryState {
    return { ...state, orders: [...state.orders, this.order] };
  }
}

class LimitConstraint extends QueryConstraint {
  readonly type: 'limit' | 'limitToLast';
  private readonly count: number;

  constructor(type: 'limit' | 'limitToLast', count: number) {
    super();
    if (!Number.isInteger(count) || count < 1) throw invalidArgument(`Function ${type}() requires a positive number, but it was: ${count}.`);
    this.type = type;
    this.count = count;
  }

  _apply(state: QueryState): QueryState {
    return this.type === 'limit' ? { ...state, limit: this.count, limitToLast: null } : { ...state, limitToLast: this.count, limit: null };
  }
}

const WHERE_OPS: ReadonlySet<string> = new Set(['==', '!=', '<', '<=', '>', '>=', 'in', 'not-in', 'array-contains', 'array-contains-any']);

export function where(fieldPath: string | FieldPath, opStr: WhereFilterOp, value: unknown): QueryConstraint {
  if (!WHERE_OPS.has(opStr)) throw invalidArgument(`Invalid query operator: ${String(opStr)}`);
  let wire: WireValue;
  try {
    wire = encodeValue(value, encodeHooks);
  } catch (error) {
    throw invalidArgument(`Function where() called with invalid data. ${(error as Error).message}`);
  }
  return new WhereConstraint({ field: fieldString(fieldPath), op: opStr, value: wire });
}

export function orderBy(fieldPath: string | FieldPath, directionStr: OrderByDirection = 'asc'): QueryConstraint {
  if (directionStr !== 'asc' && directionStr !== 'desc') throw invalidArgument(`Invalid orderBy direction: ${String(directionStr)}`);
  return new OrderByConstraint({ field: fieldString(fieldPath), direction: directionStr });
}

export function limit(count: number): QueryConstraint {
  return new LimitConstraint('limit', count);
}

export function limitToLast(count: number): QueryConstraint {
  return new LimitConstraint('limitToLast', count);
}

export function startAt(): never {
  throw notInDemo('startAt');
}

export function startAfter(): never {
  throw notInDemo('startAfter');
}

export function endAt(): never {
  throw notInDemo('endAt');
}

export function endBefore(): never {
  throw notInDemo('endBefore');
}

export function and(): never {
  throw notInDemo('and');
}

export function or(): never {
  throw notInDemo('or');
}

export function query<T>(base: Query<T>, ...constraints: QueryConstraint[]): Query<T> {
  if (!(base instanceof Query)) throw invalidArgument('query() needs a collection or a query');
  let state = base._state;
  for (const constraint of constraints) {
    if (!(constraint instanceof QueryConstraint)) throw invalidArgument('query() was given something that is not a query constraint');
    state = constraint._apply(state);
  }
  return new Query<T>(base.firestore, base._collectionPath, state);
}

// ---------------------------------------------------------------------------
// Field values

export function serverTimestamp(): FieldOp {
  return new FieldOp('serverTimestamp');
}

export function deleteField(): FieldOp {
  return new FieldOp('delete');
}

export function increment(n: number): FieldOp {
  if (typeof n !== 'number') throw invalidArgument('increment() needs a number');
  return new FieldOp('increment', n);
}

export function arrayUnion(...elements: unknown[]): FieldOp {
  return new FieldOp('arrayUnion', undefined, elements);
}

export function arrayRemove(...elements: unknown[]): FieldOp {
  return new FieldOp('arrayRemove', undefined, elements);
}

// ---------------------------------------------------------------------------
// Snapshots

export class SnapshotMetadata {
  readonly hasPendingWrites = false;
  readonly fromCache = false;

  isEqual(other: SnapshotMetadata): boolean {
    return other instanceof SnapshotMetadata;
  }
}

const METADATA = new SnapshotMetadata();

function walkField(data: Record<string, unknown>, field: string): unknown {
  let current: unknown = data;
  for (const segment of field.split('.')) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export class DocumentSnapshot<T = DocumentData> {
  readonly ref: DocumentReference<T>;
  readonly metadata = METADATA;
  private readonly wire: WireMap | null;

  constructor(ref: DocumentReference<T>, wire: WireMap | null) {
    this.ref = ref;
    this.wire = wire;
  }

  get id(): string {
    return this.ref.id;
  }

  exists(): boolean {
    return this.wire !== null;
  }

  /** A fresh copy on every call, like the SDK. */
  data(_options?: unknown): T | undefined {
    void _options;
    if (this.wire === null) return undefined;
    return decodeData(this.wire, decodeHooks(this.ref.firestore)) as T;
  }

  get(fieldPath: string | FieldPath): any {
    const data = this.data() as Record<string, unknown> | undefined;
    if (!data) return undefined;
    const field = fieldString(fieldPath);
    return field === DOCUMENT_ID_FIELD ? this.id : walkField(data, field);
  }
}

export class QueryDocumentSnapshot<T = DocumentData> extends DocumentSnapshot<T> {
  data(_options?: unknown): T {
    return super.data(_options) as T;
  }
}

export type DocumentChangeType = 'added' | 'removed' | 'modified';

export interface DocumentChange<T = DocumentData> {
  readonly type: DocumentChangeType;
  readonly doc: QueryDocumentSnapshot<T>;
  readonly oldIndex: number;
  readonly newIndex: number;
}

export class QuerySnapshot<T = DocumentData> {
  readonly query: Query<T>;
  readonly docs: Array<QueryDocumentSnapshot<T>>;
  readonly metadata = METADATA;
  private readonly changes: Array<DocumentChange<T>>;

  constructor(query: Query<T>, docs: Array<QueryDocumentSnapshot<T>>, changes: Array<DocumentChange<T>>) {
    this.query = query;
    this.docs = docs;
    this.changes = changes;
  }

  get size(): number {
    return this.docs.length;
  }

  get empty(): boolean {
    return this.docs.length === 0;
  }

  forEach(callback: (result: QueryDocumentSnapshot<T>) => void, thisArg?: unknown): void {
    for (const docSnap of this.docs) callback.call(thisArg, docSnap);
  }

  docChanges(_options?: SnapshotListenOptions): Array<DocumentChange<T>> {
    void _options;
    return [...this.changes];
  }
}

interface DocKeyIndex {
  key: string;
  index: number;
}

/** The changes from `previous` (path -> key and index) to `docs`, removals first. */
function diffDocs<T>(previous: Map<string, DocKeyIndex>, docs: WireDoc[], snaps: Array<QueryDocumentSnapshot<T>>, firestore: Firestore): Array<DocumentChange<T>> {
  const changes: Array<DocumentChange<T>> = [];
  const nextPaths = new Set(docs.map((entry) => entry.path));
  for (const [path, old] of previous) {
    if (nextPaths.has(path)) continue;
    const ref = new DocumentReference<T>(firestore, path);
    changes.push({ type: 'removed', doc: new QueryDocumentSnapshot<T>(ref, {}), oldIndex: old.index, newIndex: -1 });
  }
  docs.forEach((entry, index) => {
    const old = previous.get(entry.path);
    const key = JSON.stringify(entry.data);
    if (!old) changes.push({ type: 'added', doc: snaps[index], oldIndex: -1, newIndex: index });
    else if (old.key !== key || old.index !== index) changes.push({ type: 'modified', doc: snaps[index], oldIndex: old.index, newIndex: index });
  });
  return changes;
}

function indexDocs(docs: WireDoc[]): Map<string, DocKeyIndex> {
  return new Map(docs.map((entry, index) => [entry.path, { key: JSON.stringify(entry.data), index }]));
}

function querySnapshotFrom<T>(target: Query<T>, docs: WireDoc[], previous: Map<string, DocKeyIndex>): QuerySnapshot<T> {
  const snaps = docs.map((entry) => new QueryDocumentSnapshot<T>(new DocumentReference<T>(target.firestore, entry.path), entry.data ?? {}));
  return new QuerySnapshot<T>(target, snaps, diffDocs(previous, docs, snaps, target.firestore));
}

// ---------------------------------------------------------------------------
// Transport

async function post(body: ClientRequest, method: string): Promise<Record<string, unknown>> {
  if (typeof window === 'undefined') throw notInDemo(`${method} on the server`);
  let response: Response;
  try {
    response = await fetch(DEMO_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify(body),
    });
  } catch {
    throw new FirestoreError('unavailable', 'Could not reach the demo server.');
  }
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !json) throw fromWireError(json?.error as WireError | undefined, 'The demo server did not answer.');
  return json;
}

function toTarget(target: DocumentReference<any> | Query<any>): WireTarget {
  if (target instanceof DocumentReference) return { kind: 'doc', path: target.path };
  if (target instanceof Query) {
    const { filters, orders, limit: max, limitToLast: last } = target._state;
    return { kind: 'query', path: target._collectionPath, filters, orders, limit: max, limitToLast: last };
  }
  throw invalidArgument('Expected a document reference or a query');
}

async function readOne(target: WireTarget, method: string): Promise<WireReadResult> {
  const json = await post({ op: 'read', targets: [target] }, method);
  const results = json.results as WireReadResult[] | undefined;
  const result = results?.[0];
  if (!result) throw new FirestoreError('unavailable', 'The demo server did not answer.');
  if (!result.ok) throw fromWireError(result.error, 'Read failed');
  return result;
}

// ---------------------------------------------------------------------------
// Reads

export async function getDoc<T>(reference: DocumentReference<T>): Promise<DocumentSnapshot<T>> {
  const result = await readOne(toTarget(reference), 'getDoc');
  if (result.ok && result.kind === 'doc') return new DocumentSnapshot<T>(reference, result.doc.data);
  throw new FirestoreError('internal', 'Unexpected answer for getDoc');
}

export const getDocFromServer = getDoc;

export async function getDocs<T>(target: Query<T>): Promise<QuerySnapshot<T>> {
  const result = await readOne(toTarget(target), 'getDocs');
  if (result.ok && result.kind === 'query') return querySnapshotFrom(target, result.docs, new Map());
  throw new FirestoreError('internal', 'Unexpected answer for getDocs');
}

export const getDocsFromServer = getDocs;

export async function getDocFromCache(): Promise<never> {
  throw notInDemo('getDocFromCache');
}

export async function getDocsFromCache(): Promise<never> {
  throw notInDemo('getDocsFromCache');
}

export async function getCountFromServer(target: Query<any>): Promise<{ data(): { count: number } }> {
  const snap = await getDocs(target);
  const count = snap.size;
  return { data: () => ({ count }) };
}

// ---------------------------------------------------------------------------
// Writes

async function commitWrites(writes: WireWrite[], method: string): Promise<void> {
  if (writes.length === 0) return;
  if (writes.length > MAX_WRITES_PER_BATCH) throw invalidArgument(`A batch can hold at most ${MAX_WRITES_PER_BATCH} writes.`);
  await post({ op: 'write', writes }, method);
  nudgeListeners();
}

function setWrite(reference: DocumentReference<any>, data: unknown, options: SetOptions | undefined, method: string): WireWrite {
  if (options?.mergeFields) throw notInDemo(`${method} with mergeFields`);
  return { kind: 'set', path: reference.path, data: encodeWriteData(data, method), merge: options?.merge === true };
}

function updateWrite(reference: DocumentReference<any>, fieldOrData: string | FieldPath | DocumentData, rest: unknown[], method: string): WireWrite {
  let fields: Record<string, unknown>;
  if (typeof fieldOrData === 'string' || fieldOrData instanceof FieldPath) {
    const pairs = [fieldOrData, ...rest];
    if (pairs.length % 2 !== 0) throw invalidArgument(`Function ${method}() needs alternating field paths and values.`);
    fields = {};
    for (let index = 0; index < pairs.length; index += 2) fields[fieldString(pairs[index] as string | FieldPath)] = pairs[index + 1];
  } else {
    fields = fieldOrData;
  }
  if (Object.keys(fields ?? {}).length === 0) throw invalidArgument(`Function ${method}() needs at least one field.`);
  return { kind: 'update', path: reference.path, data: encodeWriteData(fields, method) };
}

export async function setDoc<T>(reference: DocumentReference<T>, data: WithFieldValue<T> | PartialWithFieldValue<T>, options?: SetOptions): Promise<void> {
  await commitWrites([setWrite(reference, data, options, 'setDoc')], 'setDoc');
}

export async function updateDoc<T>(reference: DocumentReference<T>, fieldOrData: string | FieldPath | UpdateData<T>, ...moreFieldsAndValues: unknown[]): Promise<void> {
  await commitWrites([updateWrite(reference, fieldOrData as string | FieldPath | DocumentData, moreFieldsAndValues, 'updateDoc')], 'updateDoc');
}

export async function addDoc<T>(reference: CollectionReference<T>, data: WithFieldValue<T>): Promise<DocumentReference<T>> {
  const created = doc(reference) as unknown as DocumentReference<T>;
  await commitWrites([{ kind: 'create', path: created.path, data: encodeWriteData(data, 'addDoc') }], 'addDoc');
  return created;
}

export async function deleteDoc<T>(reference: DocumentReference<T>): Promise<void> {
  await commitWrites([{ kind: 'delete', path: reference.path }], 'deleteDoc');
}

export class WriteBatch {
  private readonly writes: WireWrite[] = [];
  private committed = false;

  private check(): void {
    if (this.committed) throw new FirestoreError('failed-precondition', 'A write batch can no longer be used after commit() has been called.');
  }

  set<T>(reference: DocumentReference<T>, data: WithFieldValue<T> | PartialWithFieldValue<T>, options?: SetOptions): WriteBatch {
    this.check();
    this.writes.push(setWrite(reference, data, options, 'WriteBatch.set'));
    return this;
  }

  update<T>(reference: DocumentReference<T>, fieldOrData: string | FieldPath | UpdateData<T>, ...moreFieldsAndValues: unknown[]): WriteBatch {
    this.check();
    this.writes.push(updateWrite(reference, fieldOrData as string | FieldPath | DocumentData, moreFieldsAndValues, 'WriteBatch.update'));
    return this;
  }

  delete<T>(reference: DocumentReference<T>): WriteBatch {
    this.check();
    this.writes.push({ kind: 'delete', path: reference.path });
    return this;
  }

  async commit(): Promise<void> {
    this.check();
    this.committed = true;
    await commitWrites(this.writes, 'WriteBatch.commit');
  }
}

export function writeBatch(_firestore: Firestore): WriteBatch {
  void _firestore;
  return new WriteBatch();
}

export async function runTransaction(): Promise<never> {
  throw notInDemo('runTransaction');
}

// ---------------------------------------------------------------------------
// onSnapshot: one poller for every listener in the tab

interface Listener {
  readonly target: WireTarget;
  readonly targetKey: string;
  readonly reference: DocumentReference<any> | Query<any>;
  readonly onNext: (snapshot: any) => void;
  readonly onError?: (error: FirestoreError) => void;
  /** JSON of the last result delivered, or null before the first one. */
  lastKey: string | null;
  lastDocs: Map<string, DocKeyIndex>;
}

const listeners = new Set<Listener>();
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let pollDueAt = Number.POSITIVE_INFINITY;
let polling = false;
let pollAgain = false;
let visibilityHooked = false;

function isTabVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

function hookVisibility(): void {
  if (visibilityHooked || typeof document === 'undefined') return;
  visibilityHooked = true;
  document.addEventListener('visibilitychange', () => {
    if (isTabVisible()) schedulePoll(0);
  });
}

function schedulePoll(delayMs: number): void {
  if (listeners.size === 0 || typeof window === 'undefined') return;
  const dueAt = Date.now() + delayMs;
  if (pollTimer !== null) {
    if (dueAt >= pollDueAt) return;
    clearTimeout(pollTimer);
  }
  pollDueAt = dueAt;
  pollTimer = setTimeout(() => {
    pollTimer = null;
    pollDueAt = Number.POSITIVE_INFINITY;
    void poll();
  }, delayMs);
}

/** Refreshes listeners soon, for example after a write from this tab. */
function nudgeListeners(): void {
  schedulePoll(POST_WRITE_POLL_MS);
}

function deliver(listener: Listener, result: WireReadResult): void {
  if (!listeners.has(listener)) return;
  if (!result.ok) {
    // Like the SDK: an error ends the listener.
    listeners.delete(listener);
    listener.onError?.(fromWireError(result.error, 'Listen failed'));
    return;
  }
  const key = JSON.stringify(result);
  if (key === listener.lastKey) return;
  listener.lastKey = key;
  if (result.kind === 'doc') {
    listener.onNext(new DocumentSnapshot(listener.reference as DocumentReference<any>, result.doc.data));
    return;
  }
  const snapshot = querySnapshotFrom(listener.reference as Query<any>, result.docs, listener.lastDocs);
  listener.lastDocs = indexDocs(result.docs);
  listener.onNext(snapshot);
}

async function poll(): Promise<void> {
  if (polling) {
    pollAgain = true;
    return;
  }
  polling = true;
  try {
    const visible = isTabVisible();
    // A hidden tab still gets each new listener's first answer.
    const due = [...listeners].filter((listener) => visible || listener.lastKey === null);
    const byTarget = new Map<string, { target: WireTarget; listeners: Listener[] }>();
    for (const listener of due) {
      const group = byTarget.get(listener.targetKey);
      if (group) group.listeners.push(listener);
      else byTarget.set(listener.targetKey, { target: listener.target, listeners: [listener] });
    }
    const groups = [...byTarget.values()];
    for (let start = 0; start < groups.length; start += MAX_TARGETS_PER_REQUEST) {
      const chunk = groups.slice(start, start + MAX_TARGETS_PER_REQUEST);
      let results: WireReadResult[];
      try {
        const json = await post({ op: 'read', targets: chunk.map((group) => group.target) }, 'onSnapshot');
        results = (json.results as WireReadResult[] | undefined) ?? [];
      } catch (error) {
        const code = error instanceof FirestoreError ? error.code : 'unavailable';
        // The demo server is restarting or busy: try again on the next tick.
        if (code === 'unavailable' || code === 'internal') continue;
        // Refused outright: like the SDK, the error ends these listeners.
        results = chunk.map(() => ({ ok: false, error: { code, message: (error as Error).message } }) as WireReadResult);
      }
      chunk.forEach((group, index) => {
        const result = results[index];
        if (!result) return;
        for (const listener of group.listeners) {
          try {
            deliver(listener, result);
          } catch (error) {
            console.error('[demo] onSnapshot listener failed', error);
          }
        }
      });
    }
  } finally {
    polling = false;
    if (pollAgain) {
      pollAgain = false;
      schedulePoll(0);
    } else if (isTabVisible()) {
      schedulePoll(SNAPSHOT_POLL_MS);
    }
  }
}

type SnapshotObserver<S> = { next?: (snapshot: S) => void; error?: (error: FirestoreError) => void; complete?: () => void };

function isObserver(value: unknown): value is SnapshotObserver<unknown> {
  return value !== null && typeof value === 'object' && ('next' in value || 'error' in value || 'complete' in value);
}

export function onSnapshot<T>(
  reference: DocumentReference<T>,
  onNext: (snapshot: DocumentSnapshot<T>) => void,
  onError?: (error: FirestoreError) => void,
  onCompletion?: () => void,
): Unsubscribe;
export function onSnapshot<T>(
  reference: DocumentReference<T>,
  options: SnapshotListenOptions,
  onNext: (snapshot: DocumentSnapshot<T>) => void,
  onError?: (error: FirestoreError) => void,
  onCompletion?: () => void,
): Unsubscribe;
export function onSnapshot<T>(reference: DocumentReference<T>, observer: SnapshotObserver<DocumentSnapshot<T>>): Unsubscribe;
export function onSnapshot<T>(reference: DocumentReference<T>, options: SnapshotListenOptions, observer: SnapshotObserver<DocumentSnapshot<T>>): Unsubscribe;
export function onSnapshot<T>(
  query: Query<T>,
  onNext: (snapshot: QuerySnapshot<T>) => void,
  onError?: (error: FirestoreError) => void,
  onCompletion?: () => void,
): Unsubscribe;
export function onSnapshot<T>(
  query: Query<T>,
  options: SnapshotListenOptions,
  onNext: (snapshot: QuerySnapshot<T>) => void,
  onError?: (error: FirestoreError) => void,
  onCompletion?: () => void,
): Unsubscribe;
export function onSnapshot<T>(query: Query<T>, observer: SnapshotObserver<QuerySnapshot<T>>): Unsubscribe;
export function onSnapshot<T>(query: Query<T>, options: SnapshotListenOptions, observer: SnapshotObserver<QuerySnapshot<T>>): Unsubscribe;
export function onSnapshot(reference: DocumentReference<any> | Query<any>, ...args: unknown[]): Unsubscribe {
  if (!(reference instanceof DocumentReference) && !(reference instanceof Query)) throw notInDemo('onSnapshot on this target');
  const rest = [...args];
  // Skip listen options ({ includeMetadataChanges }).
  if (rest[0] !== null && typeof rest[0] === 'object' && !isObserver(rest[0])) rest.shift();
  let onNext: (snapshot: any) => void;
  let onError: ((error: FirestoreError) => void) | undefined;
  if (typeof rest[0] === 'function') {
    onNext = rest[0] as (snapshot: any) => void;
    onError = typeof rest[1] === 'function' ? (rest[1] as (error: FirestoreError) => void) : undefined;
  } else if (isObserver(rest[0])) {
    const observer = rest[0] as SnapshotObserver<any>;
    onNext = (snapshot) => observer.next?.(snapshot);
    onError = observer.error ? (error) => observer.error?.(error) : undefined;
  } else {
    throw invalidArgument('onSnapshot() needs a callback');
  }

  const target = toTarget(reference);
  const listener: Listener = { target, targetKey: JSON.stringify(target), reference, onNext, onError, lastKey: null, lastDocs: new Map() };
  listeners.add(listener);
  hookVisibility();
  schedulePoll(0);
  return () => {
    listeners.delete(listener);
  };
}

export function onSnapshotsInSync(): never {
  throw notInDemo('onSnapshotsInSync');
}

// ---------------------------------------------------------------------------
// Setup calls the app does not make in the demo

export function connectFirestoreEmulator(): void {
  throw notInDemo('connectFirestoreEmulator');
}

export async function enableIndexedDbPersistence(): Promise<void> {
  throw notInDemo('enableIndexedDbPersistence');
}

export async function enableNetwork(): Promise<void> {
  // Always online to the local demo server.
}

export async function disableNetwork(): Promise<void> {
  throw notInDemo('disableNetwork');
}

export async function terminate(): Promise<void> {
  listeners.clear();
}

export async function clearIndexedDbPersistence(): Promise<void> {
  // Nothing is cached in the demo.
}
