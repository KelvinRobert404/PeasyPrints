// In-memory stand-ins for the Firebase Admin Firestore and Storage bucket,
// used only in offline fixture mode (see fixtureMode.ts) and by node tests.
// They cover the API surface the app uses and accept the real FieldValue
// sentinels and Timestamp class from firebase-admin/firestore, so route code
// runs unchanged against them.
import { FieldValue, GeoPoint, Timestamp } from 'firebase-admin/firestore';

type DocData = Record<string, unknown>;

export type WhereOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'not-in' | 'array-contains' | 'array-contains-any';
export type OrderDirection = 'asc' | 'desc';

interface StoredDoc {
  data: DocData;
  createTime: Timestamp;
  updateTime: Timestamp;
}

interface QueryFilter {
  field: string;
  op: WhereOp;
  value: unknown;
}

interface QueryOrder {
  field: string;
  direction: OrderDirection;
}

interface QueryState {
  filters: QueryFilter[];
  orders: QueryOrder[];
  limit: number | null;
  limitToLast: number | null;
  offset: number;
}

export interface FakeSetOptions {
  merge?: boolean;
  mergeFields?: string[];
}

export interface FakeWriteResult {
  writeTime: Timestamp;
}

type PendingWrite =
  | { kind: 'create'; path: string; data: DocData }
  | { kind: 'set'; path: string; data: DocData; merge: boolean }
  | { kind: 'update'; path: string; fields: DocData }
  | { kind: 'delete'; path: string };

// ---------------------------------------------------------------- errors

function firestoreError(code: number, status: string, message: string): Error {
  return Object.assign(new Error(`${code} ${status}: ${message}`), { code, details: message });
}

function invalidArgument(message: string): Error {
  return firestoreError(3, 'INVALID_ARGUMENT', message);
}

// ---------------------------------------------------------------- paths and ids

const AUTO_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function autoId(): string {
  const bytes = new Uint8Array(20);
  globalThis.crypto.getRandomValues(bytes);
  let id = '';
  for (const byte of bytes) id += AUTO_ID_CHARS[byte % AUTO_ID_CHARS.length];
  return id;
}

function splitPath(path: string): string[] {
  const segments = path.split('/');
  if (!path || segments.some((segment) => segment === '')) throw invalidArgument(`Invalid resource path: "${path}"`);
  return segments;
}

function assertCollectionPath(path: string): void {
  if (splitPath(path).length % 2 !== 1) throw invalidArgument(`Value for argument "collectionPath" must point to a collection, but was "${path}".`);
}

function assertDocumentPath(path: string): void {
  if (splitPath(path).length % 2 !== 0) throw invalidArgument(`Value for argument "documentPath" must point to a document, but was "${path}".`);
}

function parentPath(path: string): string {
  const index = path.lastIndexOf('/');
  return index < 0 ? '' : path.slice(0, index);
}

function lastSegment(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function fieldSegments(fieldPath: string): string[] {
  const segments = fieldPath.split('.');
  if (!fieldPath || segments.some((segment) => segment === '')) throw invalidArgument(`Invalid field path: "${fieldPath}"`);
  return segments;
}

// ---------------------------------------------------------------- values

function isPlainObject(value: unknown): value is DocData {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isBytes(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

function sentinelKind(value: unknown): string | null {
  return value instanceof FieldValue ? String((value as unknown as { methodName?: string }).methodName) : null;
}

/** Deep copy of a stored value; immutable leaf classes are shared. */
function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isBytes(value)) return Buffer.from(value);
  if (isPlainObject(value)) {
    const copy: DocData = {};
    for (const [key, child] of Object.entries(value)) copy[key] = cloneValue(child);
    return copy;
  }
  return value;
}

function cloneData(data: DocData): DocData {
  return cloneValue(data) as DocData;
}

/** Converts a written value to its stored form. No sentinels allowed except those the caller handles. */
function toStoredValue(value: unknown, field: string, now: Timestamp, inArray = false): unknown {
  if (value === undefined) throw invalidArgument(`Cannot use "undefined" as a Firestore value (found in field "${field}").`);
  const kind = sentinelKind(value);
  if (kind) {
    if (inArray) throw invalidArgument(`${kind}() cannot be used inside of an array (found in field "${field}").`);
    if (kind === 'FieldValue.delete') throw invalidArgument(`FieldValue.delete() must appear at the top-level and can only be used in update() or set() with {merge:true} (found in field "${field}").`);
    return applyTransform(kind, value, undefined, now);
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (value instanceof Timestamp || value instanceof GeoPoint || value instanceof FakeDocumentReference) return value;
  if (isBytes(value)) return Buffer.from(value);
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (Array.isArray(item)) throw invalidArgument(`Nested arrays are not supported (found in field "${field}.${index}").`);
      return toStoredValue(item, `${field}.${index}`, now, true);
    });
  }
  if (isPlainObject(value)) {
    const out: DocData = {};
    for (const [key, child] of Object.entries(value)) out[key] = toStoredValue(child, field ? `${field}.${key}` : key, now, inArray);
    return out;
  }
  const typeName = (value as object)?.constructor?.name ?? typeof value;
  throw invalidArgument(`Couldn't serialize object of type "${typeName}" (found in field "${field}"). Firestore only accepts plain objects.`);
}

function applyTransform(kind: string, sentinel: unknown, existing: unknown, now: Timestamp): unknown {
  const raw = sentinel as { operand?: unknown; elements?: unknown[] };
  switch (kind) {
    case 'FieldValue.serverTimestamp':
      return now;
    case 'FieldValue.increment': {
      const operand = Number(raw.operand);
      return typeof existing === 'number' ? existing + operand : operand;
    }
    case 'FieldValue.arrayUnion': {
      const next = Array.isArray(existing) ? existing.map(cloneValue) : [];
      for (const element of raw.elements ?? []) {
        const stored = toStoredValue(element, 'arrayUnion', now, true);
        if (!next.some((item) => valuesEqual(item, stored))) next.push(stored);
      }
      return next;
    }
    case 'FieldValue.arrayRemove': {
      if (!Array.isArray(existing)) return [];
      const removed = (raw.elements ?? []).map((element) => toStoredValue(element, 'arrayRemove', now, true));
      return existing.filter((item) => !removed.some((element) => valuesEqual(item, element))).map(cloneValue);
    }
    default:
      throw invalidArgument(`${kind}() is not supported by the fixture Firestore.`);
  }
}

// Firestore cross-type ordering.
function typeRank(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'boolean') return 1;
  if (typeof value === 'number') return 2;
  if (value instanceof Timestamp) return 3;
  if (typeof value === 'string') return 4;
  if (isBytes(value)) return 5;
  if (value instanceof FakeDocumentReference) return 6;
  if (value instanceof GeoPoint) return 7;
  if (Array.isArray(value)) return 8;
  return 9;
}

function compareNumbers(a: number, b: number): number {
  if (Number.isNaN(a)) return Number.isNaN(b) ? 0 : -1;
  if (Number.isNaN(b)) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareValues(a: unknown, b: unknown): number {
  const rankA = typeRank(a);
  const rankB = typeRank(b);
  if (rankA !== rankB) return rankA - rankB;
  switch (rankA) {
    case 0:
      return 0;
    case 1:
      return Number(a) - Number(b);
    case 2:
      return compareNumbers(a as number, b as number);
    case 3: {
      const ta = a as Timestamp;
      const tb = b as Timestamp;
      return ta.seconds !== tb.seconds ? ta.seconds - tb.seconds : ta.nanoseconds - tb.nanoseconds;
    }
    case 4:
      return compareStrings(a as string, b as string);
    case 5:
      return Buffer.compare(Buffer.from(a as Uint8Array), Buffer.from(b as Uint8Array));
    case 6:
      return compareStrings((a as FakeDocumentReference).path, (b as FakeDocumentReference).path);
    case 7: {
      const ga = a as GeoPoint;
      const gb = b as GeoPoint;
      return compareNumbers(ga.latitude, gb.latitude) || compareNumbers(ga.longitude, gb.longitude);
    }
    case 8: {
      const xa = a as unknown[];
      const xb = b as unknown[];
      for (let i = 0; i < Math.min(xa.length, xb.length); i++) {
        const result = compareValues(xa[i], xb[i]);
        if (result !== 0) return result;
      }
      return xa.length - xb.length;
    }
    default: {
      const ma = a as DocData;
      const mb = b as DocData;
      const keysA = Object.keys(ma).sort();
      const keysB = Object.keys(mb).sort();
      for (let i = 0; i < Math.min(keysA.length, keysB.length); i++) {
        const keyResult = compareStrings(keysA[i], keysB[i]);
        if (keyResult !== 0) return keyResult;
        const valueResult = compareValues(ma[keysA[i]], mb[keysB[i]]);
        if (valueResult !== 0) return valueResult;
      }
      return keysA.length - keysB.length;
    }
  }
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return typeRank(a) === typeRank(b) && compareValues(a, b) === 0;
}

// ---------------------------------------------------------------- field paths

function hasAtPath(data: DocData, segments: string[]): boolean {
  let current: unknown = data;
  for (const segment of segments) {
    if (!isPlainObject(current) || !Object.prototype.hasOwnProperty.call(current, segment)) return false;
    current = current[segment];
  }
  return true;
}

function getAtPath(data: DocData, segments: string[]): unknown {
  let current: unknown = data;
  for (const segment of segments) {
    if (!isPlainObject(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function setAtPath(data: DocData, segments: string[], value: unknown): void {
  let current = data;
  for (const segment of segments.slice(0, -1)) {
    if (!isPlainObject(current[segment])) current[segment] = {};
    current = current[segment] as DocData;
  }
  current[segments[segments.length - 1]] = value;
}

function deleteAtPath(data: DocData, segments: string[]): void {
  let current: unknown = data;
  for (const segment of segments.slice(0, -1)) {
    if (!isPlainObject(current)) return;
    current = current[segment];
  }
  if (isPlainObject(current)) delete current[segments[segments.length - 1]];
}

// ---------------------------------------------------------------- write application

function assertDocData(data: unknown, method: string): asserts data is DocData {
  if (!isPlainObject(data)) throw invalidArgument(`Value for argument "data" in ${method}() is not a valid Firestore document. Input is not a plain JavaScript object.`);
}

/** set() without merge: sentinels resolve against an empty document. */
function materializeDocument(data: DocData, now: Timestamp): DocData {
  return toStoredValue(data, '', now) as DocData;
}

/** set(..., { merge: true }): maps merge deeply, keys are literal, delete sentinels remove. */
function mergeInto(target: DocData, data: DocData, prefix: string, now: Timestamp): void {
  for (const [key, value] of Object.entries(data)) {
    const field = prefix ? `${prefix}.${key}` : key;
    const kind = sentinelKind(value);
    if (kind === 'FieldValue.delete') {
      delete target[key];
    } else if (kind) {
      target[key] = applyTransform(kind, value, target[key], now);
    } else if (isPlainObject(value) && Object.keys(value).length > 0) {
      const child = isPlainObject(target[key]) ? (target[key] as DocData) : {};
      target[key] = child;
      mergeInto(child, value, field, now);
    } else {
      target[key] = toStoredValue(value, field, now);
    }
  }
}

/** update(): top-level keys are dotted field paths whose values replace what is there. */
function applyUpdate(target: DocData, fields: DocData, now: Timestamp): void {
  const entries = Object.entries(fields);
  if (entries.length === 0) throw invalidArgument('At least one field must be updated.');
  for (const [fieldPath, value] of entries) {
    const segments = fieldSegments(fieldPath);
    const kind = sentinelKind(value);
    if (kind === 'FieldValue.delete') deleteAtPath(target, segments);
    else if (kind) setAtPath(target, segments, applyTransform(kind, value, getAtPath(target, segments), now));
    else setAtPath(target, segments, toStoredValue(value, fieldPath, now));
  }
}

function normalizeUpdateArgs(dataOrField: DocData | string, rest: unknown[]): DocData {
  if (typeof dataOrField !== 'string') {
    assertDocData(dataOrField, 'update');
    return dataOrField;
  }
  const pairs: unknown[] = [dataOrField, ...rest];
  const fields: DocData = {};
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    if (typeof pairs[i] !== 'string') throw invalidArgument('update() expects alternating field paths and values.');
    fields[pairs[i] as string] = pairs[i + 1];
  }
  return fields;
}

function resolveSetOptions(options: FakeSetOptions | undefined): boolean {
  if (options?.mergeFields) throw invalidArgument('set() with mergeFields is not supported by the fixture Firestore; use merge: true.');
  return options?.merge === true;
}

// ---------------------------------------------------------------- snapshots

export class FakeDocumentSnapshot {
  readonly ref: FakeDocumentReference;
  readonly exists: boolean;
  readonly createTime: Timestamp | undefined;
  readonly updateTime: Timestamp | undefined;
  readonly readTime: Timestamp;
  private readonly stored: DocData | undefined;

  constructor(ref: FakeDocumentReference, stored: StoredDoc | undefined, readTime: Timestamp) {
    this.ref = ref;
    this.exists = stored !== undefined;
    this.stored = stored ? cloneData(stored.data) : undefined;
    this.createTime = stored?.createTime;
    this.updateTime = stored?.updateTime;
    this.readTime = readTime;
  }

  get id(): string {
    return this.ref.id;
  }

  data(): DocData | undefined {
    return this.stored ? cloneData(this.stored) : undefined;
  }

  get(fieldPath: string): unknown {
    if (!this.stored) return undefined;
    return cloneValue(getAtPath(this.stored, fieldSegments(fieldPath)));
  }

  isEqual(other: FakeDocumentSnapshot): boolean {
    return other.ref.path === this.ref.path && compareValues(other.stored ?? null, this.stored ?? null) === 0;
  }
}

export class FakeQueryDocumentSnapshot extends FakeDocumentSnapshot {
  data(): DocData {
    return super.data() ?? {};
  }
}

export class FakeQuerySnapshot {
  readonly query: FakeQuery;
  readonly docs: FakeQueryDocumentSnapshot[];
  readonly readTime: Timestamp;

  constructor(query: FakeQuery, docs: FakeQueryDocumentSnapshot[], readTime: Timestamp) {
    this.query = query;
    this.docs = docs;
    this.readTime = readTime;
  }

  get size(): number {
    return this.docs.length;
  }

  get empty(): boolean {
    return this.docs.length === 0;
  }

  forEach(callback: (doc: FakeQueryDocumentSnapshot) => void, thisArg?: unknown): void {
    this.docs.forEach((doc) => callback.call(thisArg, doc));
  }
}

// ---------------------------------------------------------------- queries

function emptyQueryState(): QueryState {
  return { filters: [], orders: [], limit: null, limitToLast: null, offset: 0 };
}

function normalizeQueryValue(value: unknown, field: string): unknown {
  if (value === undefined) throw invalidArgument(`Value for argument "value" is not a valid query constraint. Cannot use "undefined" (field "${field}").`);
  if (sentinelKind(value)) throw invalidArgument('FieldValue sentinels cannot be used in queries.');
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (Array.isArray(value)) return value.map((item) => normalizeQueryValue(item, field));
  return value;
}

function fieldValueOf(id: string, data: DocData, field: string): { has: boolean; value: unknown } {
  if (field === '__name__') return { has: true, value: id };
  const segments = fieldSegments(field);
  return hasAtPath(data, segments) ? { has: true, value: getAtPath(data, segments) } : { has: false, value: undefined };
}

function matchesFilter(id: string, data: DocData, filter: QueryFilter): boolean {
  const { has, value } = fieldValueOf(id, data, filter.field);
  if (!has) return false;
  const expected = filter.field === '__name__' && filter.value instanceof FakeDocumentReference ? filter.value.id : filter.value;
  const list = Array.isArray(expected) ? expected : [];
  switch (filter.op) {
    case '==':
      return valuesEqual(value, expected);
    case '!=':
      return value !== null && !valuesEqual(value, expected);
    case '<':
    case '<=':
    case '>':
    case '>=': {
      if (typeRank(value) !== typeRank(expected)) return false;
      const result = compareValues(value, expected);
      if (filter.op === '<') return result < 0;
      if (filter.op === '<=') return result <= 0;
      if (filter.op === '>') return result > 0;
      return result >= 0;
    }
    case 'in':
      return list.some((item) => valuesEqual(value, item));
    case 'not-in':
      return value !== null && !list.some((item) => valuesEqual(value, item));
    case 'array-contains':
      return Array.isArray(value) && value.some((item) => valuesEqual(item, expected));
    case 'array-contains-any':
      return Array.isArray(value) && value.some((item) => list.some((candidate) => valuesEqual(item, candidate)));
    default:
      throw invalidArgument(`Unsupported where() operator "${String(filter.op)}".`);
  }
}

const INEQUALITY_OPS: ReadonlySet<WhereOp> = new Set<WhereOp>(['!=', '<', '<=', '>', '>=', 'not-in']);
const LIST_OPS: ReadonlySet<WhereOp> = new Set<WhereOp>(['in', 'not-in', 'array-contains-any']);

export class FakeQuery {
  readonly firestore: FakeFirestore;
  protected readonly collectionPath: string;
  private readonly state: QueryState;

  constructor(firestore: FakeFirestore, collectionPath: string, state?: QueryState) {
    this.firestore = firestore;
    this.collectionPath = collectionPath;
    this.state = state ?? emptyQueryState();
  }

  private with(patch: Partial<QueryState>): FakeQuery {
    return new FakeQuery(this.firestore, this.collectionPath, {
      ...this.state,
      filters: [...this.state.filters],
      orders: [...this.state.orders],
      ...patch,
    });
  }

  where(field: string, op: WhereOp, value: unknown): FakeQuery {
    fieldSegments(field);
    const normalized = normalizeQueryValue(value, field);
    if (LIST_OPS.has(op)) {
      if (!Array.isArray(normalized) || normalized.length === 0) throw invalidArgument(`A non-empty array is required for '${op}' filters.`);
      if (normalized.length > 30) throw invalidArgument(`'${op}' filters support a maximum of 30 elements.`);
    }
    return this.with({ filters: [...this.state.filters, { field, op, value: normalized }] });
  }

  orderBy(field: string, direction: OrderDirection = 'asc'): FakeQuery {
    fieldSegments(field);
    if (direction !== 'asc' && direction !== 'desc') throw invalidArgument(`Invalid orderBy direction "${String(direction)}".`);
    return this.with({ orders: [...this.state.orders, { field, direction }] });
  }

  limit(count: number): FakeQuery {
    return this.with({ limit: count, limitToLast: null });
  }

  limitToLast(count: number): FakeQuery {
    return this.with({ limitToLast: count, limit: null });
  }

  offset(count: number): FakeQuery {
    return this.with({ offset: count });
  }

  /** Runs the query against the current store contents. */
  resolve(): FakeQueryDocumentSnapshot[] {
    const readTime = Timestamp.now();
    const { filters, limit, limitToLast, offset } = this.state;
    let orders = this.state.orders;
    if (orders.length === 0) {
      const inequality = filters.find((filter) => INEQUALITY_OPS.has(filter.op));
      if (inequality) orders = [{ field: inequality.field, direction: 'asc' }];
    }
    if (limitToLast !== null && orders.length === 0) throw invalidArgument('limitToLast() queries require specifying at least one orderBy() clause.');

    const rows = this.firestore._listCollection(this.collectionPath)
      .map(([path, stored]) => ({ path, id: lastSegment(path), stored }))
      .filter((row) => filters.every((filter) => matchesFilter(row.id, row.stored.data, filter)))
      .filter((row) => orders.every((order) => fieldValueOf(row.id, row.stored.data, order.field).has));

    const tieDirection = orders.length > 0 ? orders[orders.length - 1].direction : 'asc';
    rows.sort((a, b) => {
      for (const order of orders) {
        const result = compareValues(fieldValueOf(a.id, a.stored.data, order.field).value, fieldValueOf(b.id, b.stored.data, order.field).value);
        if (result !== 0) return order.direction === 'desc' ? -result : result;
      }
      const tie = compareStrings(a.path, b.path);
      return tieDirection === 'desc' ? -tie : tie;
    });

    let selected = rows.slice(offset);
    if (limit !== null) selected = selected.slice(0, Math.max(0, limit));
    if (limitToLast !== null) selected = selected.slice(Math.max(0, selected.length - limitToLast));

    return selected.map((row) => new FakeQueryDocumentSnapshot(this.firestore.doc(row.path), row.stored, readTime));
  }

  async get(): Promise<FakeQuerySnapshot> {
    return new FakeQuerySnapshot(this, this.resolve(), Timestamp.now());
  }

  count(): { get(): Promise<{ data(): { count: number } }> } {
    return {
      get: async () => {
        const count = this.resolve().length;
        return { data: () => ({ count }) };
      },
    };
  }
}

// ---------------------------------------------------------------- references

export class FakeCollectionReference extends FakeQuery {
  constructor(firestore: FakeFirestore, path: string) {
    assertCollectionPath(path);
    super(firestore, path);
  }

  get path(): string {
    return this.collectionPath;
  }

  get id(): string {
    return lastSegment(this.collectionPath);
  }

  get parent(): FakeDocumentReference | null {
    const parent = parentPath(this.collectionPath);
    return parent ? new FakeDocumentReference(this.firestore, parent) : null;
  }

  doc(documentPath?: string): FakeDocumentReference {
    if (documentPath === undefined) return new FakeDocumentReference(this.firestore, `${this.collectionPath}/${autoId()}`);
    if (typeof documentPath !== 'string' || documentPath === '') throw invalidArgument('Value for argument "documentPath" is not a valid resource path. Path must be a non-empty string.');
    return new FakeDocumentReference(this.firestore, `${this.collectionPath}/${documentPath}`);
  }

  async add(data: DocData): Promise<FakeDocumentReference> {
    const ref = this.doc();
    await ref.create(data);
    return ref;
  }

  isEqual(other: FakeCollectionReference): boolean {
    return other instanceof FakeCollectionReference && other.path === this.path;
  }
}

export class FakeDocumentReference {
  readonly firestore: FakeFirestore;
  readonly path: string;

  constructor(firestore: FakeFirestore, path: string) {
    assertDocumentPath(path);
    this.firestore = firestore;
    this.path = path;
  }

  get id(): string {
    return lastSegment(this.path);
  }

  get parent(): FakeCollectionReference {
    return new FakeCollectionReference(this.firestore, parentPath(this.path));
  }

  collection(collectionPath: string): FakeCollectionReference {
    return new FakeCollectionReference(this.firestore, `${this.path}/${collectionPath}`);
  }

  isEqual(other: FakeDocumentReference): boolean {
    return other instanceof FakeDocumentReference && other.path === this.path;
  }

  async get(): Promise<FakeDocumentSnapshot> {
    return this.firestore._snapshot(this);
  }

  async create(data: DocData): Promise<FakeWriteResult> {
    assertDocData(data, 'create');
    return this.firestore._commit([{ kind: 'create', path: this.path, data }])[0];
  }

  async set(data: DocData, options?: FakeSetOptions): Promise<FakeWriteResult> {
    assertDocData(data, 'set');
    return this.firestore._commit([{ kind: 'set', path: this.path, data, merge: resolveSetOptions(options) }])[0];
  }

  async update(dataOrField: DocData | string, ...rest: unknown[]): Promise<FakeWriteResult> {
    return this.firestore._commit([{ kind: 'update', path: this.path, fields: normalizeUpdateArgs(dataOrField, rest) }])[0];
  }

  async delete(): Promise<FakeWriteResult> {
    return this.firestore._commit([{ kind: 'delete', path: this.path }])[0];
  }
}

// ---------------------------------------------------------------- batches and transactions

const MAX_BATCH_WRITES = 500;

export class FakeWriteBatch {
  private readonly firestore: FakeFirestore;
  private readonly writes: PendingWrite[] = [];
  private committed = false;

  constructor(firestore: FakeFirestore) {
    this.firestore = firestore;
  }

  private push(write: PendingWrite): this {
    if (this.committed) throw new Error('Cannot modify a WriteBatch that has been committed.');
    this.writes.push(write);
    return this;
  }

  create(ref: FakeDocumentReference, data: DocData): this {
    assertDocData(data, 'create');
    return this.push({ kind: 'create', path: ref.path, data });
  }

  set(ref: FakeDocumentReference, data: DocData, options?: FakeSetOptions): this {
    assertDocData(data, 'set');
    return this.push({ kind: 'set', path: ref.path, data, merge: resolveSetOptions(options) });
  }

  update(ref: FakeDocumentReference, dataOrField: DocData | string, ...rest: unknown[]): this {
    return this.push({ kind: 'update', path: ref.path, fields: normalizeUpdateArgs(dataOrField, rest) });
  }

  delete(ref: FakeDocumentReference): this {
    return this.push({ kind: 'delete', path: ref.path });
  }

  async commit(): Promise<FakeWriteResult[]> {
    if (this.committed) throw new Error('Cannot commit a WriteBatch twice.');
    if (this.writes.length > MAX_BATCH_WRITES) throw invalidArgument(`A write batch can contain at most ${MAX_BATCH_WRITES} operations.`);
    this.committed = true;
    return this.firestore._commit(this.writes);
  }
}

export class FakeTransaction {
  private readonly firestore: FakeFirestore;
  private readonly writes: PendingWrite[] = [];

  constructor(firestore: FakeFirestore) {
    this.firestore = firestore;
  }

  private assertNoWritesYet(): void {
    if (this.writes.length > 0) throw new Error('Firestore transactions require all reads to be executed before all writes.');
  }

  get(ref: FakeDocumentReference): Promise<FakeDocumentSnapshot>;
  get(query: FakeQuery): Promise<FakeQuerySnapshot>;
  async get(target: FakeDocumentReference | FakeQuery): Promise<FakeDocumentSnapshot | FakeQuerySnapshot> {
    this.assertNoWritesYet();
    if (target instanceof FakeDocumentReference) return this.firestore._snapshot(target);
    return target.get();
  }

  async getAll(...refs: unknown[]): Promise<FakeDocumentSnapshot[]> {
    this.assertNoWritesYet();
    return this.firestore.getAll(...refs);
  }

  create(ref: FakeDocumentReference, data: DocData): this {
    assertDocData(data, 'create');
    this.writes.push({ kind: 'create', path: ref.path, data });
    return this;
  }

  set(ref: FakeDocumentReference, data: DocData, options?: FakeSetOptions): this {
    assertDocData(data, 'set');
    this.writes.push({ kind: 'set', path: ref.path, data, merge: resolveSetOptions(options) });
    return this;
  }

  update(ref: FakeDocumentReference, dataOrField: DocData | string, ...rest: unknown[]): this {
    this.writes.push({ kind: 'update', path: ref.path, fields: normalizeUpdateArgs(dataOrField, rest) });
    return this;
  }

  delete(ref: FakeDocumentReference): this {
    this.writes.push({ kind: 'delete', path: ref.path });
    return this;
  }

  /** Applies the buffered writes atomically. Called by runTransaction. */
  _commit(): void {
    if (this.writes.length > 0) this.firestore._commit(this.writes);
  }
}

// ---------------------------------------------------------------- database

export class FakeFirestore {
  private readonly docs = new Map<string, StoredDoc>();
  private transactionQueue: Promise<unknown> = Promise.resolve();

  collection(collectionPath: string): FakeCollectionReference {
    return new FakeCollectionReference(this, collectionPath);
  }

  doc(documentPath: string): FakeDocumentReference {
    return new FakeDocumentReference(this, documentPath);
  }

  /** Snapshots in the same order as the refs; a trailing read-options object is ignored. */
  async getAll(...refs: unknown[]): Promise<FakeDocumentSnapshot[]> {
    const targets = refs.filter((ref): ref is FakeDocumentReference => ref instanceof FakeDocumentReference);
    if (targets.length === 0) throw invalidArgument('getAll() requires at least one document reference.');
    return targets.map((ref) => this._snapshot(ref));
  }

  batch(): FakeWriteBatch {
    return new FakeWriteBatch(this);
  }

  /**
   * Transactions run one at a time, so reads inside one never go stale.
   * Writes are buffered and applied atomically when the callback resolves;
   * if it throws, nothing is written.
   */
  runTransaction<T>(updateFunction: (transaction: FakeTransaction) => Promise<T>, _options?: unknown): Promise<T> {
    void _options;
    const run = this.transactionQueue.then(async () => {
      const transaction = new FakeTransaction(this);
      const result = await updateFunction(transaction);
      transaction._commit();
      return result;
    });
    this.transactionQueue = run.catch(() => undefined);
    return run;
  }

  /** Synchronous write for seeding fixtures (set without merge). */
  seedDoc(documentPath: string, data: DocData): void {
    assertDocData(data, 'seedDoc');
    this._commit([{ kind: 'set', path: documentPath, data, merge: false }]);
  }

  /** Removes every document. */
  clear(): void {
    this.docs.clear();
  }

  // Internal helpers shared with the reference, query and batch classes.

  _snapshot(ref: FakeDocumentReference): FakeDocumentSnapshot {
    return new FakeDocumentSnapshot(ref, this.docs.get(ref.path), Timestamp.now());
  }

  _listCollection(collectionPath: string): Array<[string, StoredDoc]> {
    const depth = collectionPath.split('/').length + 1;
    const prefix = `${collectionPath}/`;
    const rows: Array<[string, StoredDoc]> = [];
    for (const [path, stored] of this.docs) {
      if (path.startsWith(prefix) && path.split('/').length === depth) rows.push([path, stored]);
    }
    return rows;
  }

  /** Applies writes in order, all or nothing. */
  _commit(writes: PendingWrite[]): FakeWriteResult[] {
    const now = Timestamp.now();
    const overlay = new Map<string, StoredDoc | null>();
    const read = (path: string): StoredDoc | null => (overlay.has(path) ? overlay.get(path) ?? null : this.docs.get(path) ?? null);

    for (const write of writes) {
      assertDocumentPath(write.path);
      const previous = read(write.path);
      switch (write.kind) {
        case 'create':
          if (previous) throw firestoreError(6, 'ALREADY_EXISTS', `Document already exists: ${write.path}`);
          overlay.set(write.path, { data: materializeDocument(write.data, now), createTime: now, updateTime: now });
          break;
        case 'set': {
          let data: DocData;
          if (write.merge) {
            data = previous ? cloneData(previous.data) : {};
            mergeInto(data, write.data, '', now);
          } else {
            data = materializeDocument(write.data, now);
          }
          overlay.set(write.path, { data, createTime: previous?.createTime ?? now, updateTime: now });
          break;
        }
        case 'update': {
          if (!previous) throw firestoreError(5, 'NOT_FOUND', `No document to update: ${write.path}`);
          const data = cloneData(previous.data);
          applyUpdate(data, write.fields, now);
          overlay.set(write.path, { data, createTime: previous.createTime, updateTime: now });
          break;
        }
        case 'delete':
          overlay.set(write.path, null);
          break;
      }
    }

    for (const [path, stored] of overlay) {
      if (stored) this.docs.set(path, stored);
      else this.docs.delete(path);
    }
    return writes.map(() => ({ writeTime: now }));
  }
}

// ---------------------------------------------------------------- storage bucket

interface StoredFile {
  content: Buffer;
  contentType: string;
  cacheControl: string | undefined;
  metadata: Record<string, string>;
  created: Date;
  updated: Date;
}

export interface FakeFileMetadata {
  name: string;
  bucket: string;
  contentType: string;
  cacheControl?: string;
  size: string;
  timeCreated: string;
  updated: string;
  metadata: Record<string, string>;
}

export interface FakeSaveOptions {
  contentType?: string;
  resumable?: boolean;
  metadata?: {
    contentType?: string;
    cacheControl?: string;
    metadata?: Record<string, string>;
  };
}

export interface FakeSignedUrlConfig {
  action: 'read' | 'write' | 'delete' | 'resumable';
  expires: number | string | Date;
  contentType?: string;
  version?: string;
}

function storageNotFound(bucket: string, path: string): Error {
  return Object.assign(new Error(`No such object: ${bucket}/${path}`), { code: 404 });
}

/** Where signed URLs point when there is no stored content to inline. Never resolves. */
export const FIXTURE_STORAGE_ORIGIN = 'https://fixture-storage.invalid';

export class FakeFile {
  readonly bucket: FakeBucket;
  readonly name: string;

  constructor(bucket: FakeBucket, name: string) {
    this.bucket = bucket;
    this.name = name;
  }

  async save(data: Buffer | Uint8Array | string, options: FakeSaveOptions = {}): Promise<void> {
    const now = new Date();
    const previous = this.bucket._files.get(this.name);
    this.bucket._files.set(this.name, {
      content: typeof data === 'string' ? Buffer.from(data) : Buffer.from(data),
      contentType: options.metadata?.contentType ?? options.contentType ?? 'application/octet-stream',
      cacheControl: options.metadata?.cacheControl,
      metadata: { ...(options.metadata?.metadata ?? {}) },
      created: previous?.created ?? now,
      updated: now,
    });
  }

  async exists(): Promise<[boolean]> {
    return [this.bucket._files.has(this.name)];
  }

  async download(): Promise<[Buffer]> {
    const file = this.bucket._files.get(this.name);
    if (!file) throw storageNotFound(this.bucket.name, this.name);
    return [Buffer.from(file.content)];
  }

  async getMetadata(): Promise<[FakeFileMetadata]> {
    const file = this.bucket._files.get(this.name);
    if (!file) throw storageNotFound(this.bucket.name, this.name);
    return [{
      name: this.name,
      bucket: this.bucket.name,
      contentType: file.contentType,
      ...(file.cacheControl ? { cacheControl: file.cacheControl } : {}),
      size: String(file.content.length),
      timeCreated: file.created.toISOString(),
      updated: file.updated.toISOString(),
      metadata: { ...file.metadata },
    }];
  }

  async delete(options: { ignoreNotFound?: boolean } = {}): Promise<[unknown]> {
    const existed = this.bucket._files.delete(this.name);
    if (!existed && !options.ignoreNotFound) throw storageNotFound(this.bucket.name, this.name);
    return [{}];
  }

  /**
   * Read URLs for stored files are data: URLs, so the browser can show them
   * offline. Anything else points at an unresolvable .invalid host.
   */
  async getSignedUrl(config: FakeSignedUrlConfig): Promise<[string]> {
    const file = this.bucket._files.get(this.name);
    if (config.action === 'read' && file) return [`data:${file.contentType};base64,${file.content.toString('base64')}`];
    const expires = new Date(config.expires).getTime();
    const path = this.name.split('/').map(encodeURIComponent).join('/');
    return [`${FIXTURE_STORAGE_ORIGIN}/${encodeURIComponent(this.bucket.name)}/${path}?action=${config.action}&expires=${expires}`];
  }
}

export class FakeBucket {
  readonly name: string;
  readonly _files = new Map<string, StoredFile>();

  constructor(name = 'swoop-fixtures') {
    this.name = name;
  }

  file(name: string): FakeFile {
    if (!name) throw new Error('A file name must be specified.');
    return new FakeFile(this, name);
  }

  async getFiles(query: { prefix?: string } = {}): Promise<[FakeFile[]]> {
    const prefix = query.prefix ?? '';
    return [[...this._files.keys()].filter((name) => name.startsWith(prefix)).sort().map((name) => new FakeFile(this, name))];
  }

  async deleteFiles(query: { prefix?: string } = {}): Promise<void> {
    const prefix = query.prefix ?? '';
    for (const name of [...this._files.keys()]) if (name.startsWith(prefix)) this._files.delete(name);
  }
}
