// JSON wire format for Firestore values between the demo's Firebase client
// stand-in (src/lib/demo/shims/firebase-firestore.ts) and /api/demo/firestore.
//
// Plain JSON values pass through. Everything else becomes a tagged object
// { "$type": ..., ... }: timestamps, geo points, document references, bytes,
// numbers JSON cannot hold, and write-only field values (serverTimestamp,
// increment, arrayUnion, arrayRemove, deleteField). A plain map that has its
// own "$type" key is wrapped so it can never be read as a tag.
//
// Pure: no window, no Node-only APIs, no imports. The browser and the server
// each pass hooks for the classes on their side (client classes below, or the
// firebase-admin ones in src/lib/demo/server/clientQuery.ts).

export const WIRE_TAG = '$type';

export type WireValue = null | boolean | number | string | WireValue[] | WireMap;
export interface WireMap {
  [key: string]: WireValue;
}

// ---------------------------------------------------------------------------
// Client-side value classes, re-exported by the firebase/firestore stand-in.

const MAX_SECONDS = 253402300799; // 9999-12-31T23:59:59Z
const MIN_SECONDS = -62135596800; // 0001-01-01T00:00:00Z

function codecError(message: string): Error {
  return Object.assign(new Error(message), { name: 'FirebaseError', code: 'invalid-argument' });
}

export class Timestamp {
  readonly seconds: number;
  readonly nanoseconds: number;

  constructor(seconds: number, nanoseconds: number) {
    if (!Number.isInteger(nanoseconds) || nanoseconds < 0 || nanoseconds >= 1e9) throw codecError(`Timestamp nanoseconds out of range: ${nanoseconds}`);
    if (!Number.isInteger(seconds) || seconds < MIN_SECONDS || seconds > MAX_SECONDS) throw codecError(`Timestamp seconds out of range: ${seconds}`);
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static now(): Timestamp {
    return Timestamp.fromMillis(Date.now());
  }

  static fromDate(date: Date): Timestamp {
    return Timestamp.fromMillis(date.getTime());
  }

  static fromMillis(milliseconds: number): Timestamp {
    const seconds = Math.floor(milliseconds / 1000);
    const nanoseconds = Math.floor((milliseconds - seconds * 1000) * 1e6);
    return new Timestamp(seconds, nanoseconds);
  }

  toDate(): Date {
    return new Date(this.toMillis());
  }

  toMillis(): number {
    return this.seconds * 1000 + this.nanoseconds / 1e6;
  }

  isEqual(other: Timestamp): boolean {
    return other instanceof Timestamp && other.seconds === this.seconds && other.nanoseconds === this.nanoseconds;
  }

  toString(): string {
    return `Timestamp(seconds=${this.seconds}, nanoseconds=${this.nanoseconds})`;
  }

  toJSON(): { seconds: number; nanoseconds: number; type: string } {
    return { seconds: this.seconds, nanoseconds: this.nanoseconds, type: 'firestore/timestamp/1.0' };
  }

  /** Sortable string, so <, > and === work like the real Timestamp. */
  valueOf(): string {
    const adjusted = this.seconds - MIN_SECONDS;
    return `${String(adjusted).padStart(12, '0')}.${String(this.nanoseconds).padStart(9, '0')}`;
  }
}

export class GeoPoint {
  readonly latitude: number;
  readonly longitude: number;

  constructor(latitude: number, longitude: number) {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw codecError(`Latitude must be between -90 and 90: ${latitude}`);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw codecError(`Longitude must be between -180 and 180: ${longitude}`);
    this.latitude = latitude;
    this.longitude = longitude;
  }

  isEqual(other: GeoPoint): boolean {
    return other instanceof GeoPoint && other.latitude === this.latitude && other.longitude === this.longitude;
  }

  toJSON(): { latitude: number; longitude: number; type: string } {
    return { latitude: this.latitude, longitude: this.longitude, type: 'firestore/geoPoint/1.0' };
  }
}

export class Bytes {
  private readonly data: Uint8Array;

  private constructor(data: Uint8Array) {
    this.data = data;
  }

  static fromUint8Array(array: Uint8Array): Bytes {
    return new Bytes(new Uint8Array(array));
  }

  static fromBase64String(base64: string): Bytes {
    return new Bytes(base64ToBytes(base64));
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.data);
  }

  toBase64(): string {
    return bytesToBase64(this.data);
  }

  isEqual(other: Bytes): boolean {
    return other instanceof Bytes && other.toBase64() === this.toBase64();
  }

  toString(): string {
    return `Bytes(base64: ${this.toBase64()})`;
  }
}

export type FieldOpKind = 'serverTimestamp' | 'delete' | 'increment' | 'arrayUnion' | 'arrayRemove';

/** A write-only field value (the client SDK's FieldValue). */
export class FieldOp {
  readonly kind: FieldOpKind;
  readonly operand: number | undefined;
  readonly elements: readonly unknown[] | undefined;

  constructor(kind: FieldOpKind, operand?: number, elements?: readonly unknown[]) {
    this.kind = kind;
    this.operand = operand;
    this.elements = elements;
  }

  isEqual(other: FieldOp): boolean {
    return other instanceof FieldOp && other.kind === this.kind && other.operand === this.operand && other.elements === this.elements;
  }
}

// ---------------------------------------------------------------------------
// Base64 (btoa and atob exist in browsers and in Node)

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw codecError('Invalid base64 string');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

// ---------------------------------------------------------------------------
// Hooks

export interface CodecHooks {
  /** The document path if `value` is a document reference on this side, else null. */
  refPath(value: object): string | null;
  /** A document reference on this side for a decoded path. May throw to refuse the path. */
  makeRef(path: string): unknown;
  /** Default: the client Timestamp above. */
  makeTimestamp?: (seconds: number, nanoseconds: number) => unknown;
  /** Default: the client GeoPoint above. */
  makeGeoPoint?: (latitude: number, longitude: number) => unknown;
  /** Default: the client Bytes above. */
  makeBytes?: (bytes: Uint8Array) => unknown;
  /** Default: the FieldOp itself. Only called when decoding with `allowFieldOps`. */
  makeFieldOp?: (op: FieldOp) => unknown;
}

export interface EncodeOptions {
  /** Allow write-only field values (serverTimestamp and the like). Default false. */
  allowFieldOps?: boolean;
}

export interface DecodeOptions {
  /** Allow write-only field values. Default false. */
  allowFieldOps?: boolean;
}

/** Deepest nesting the codec accepts (Firestore allows 20 levels of maps). */
const MAX_DEPTH = 64;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Sets an own property; a '__proto__' key never changes the object's prototype. */
function setOwn(target: Record<string, unknown>, key: string, value: unknown): void {
  if (key === '__proto__') Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
  else target[key] = value;
}

function isTimestampLike(value: object): value is { seconds: number; nanoseconds: number } {
  const candidate = value as { seconds?: unknown; nanoseconds?: unknown; toMillis?: unknown };
  return typeof candidate.seconds === 'number' && typeof candidate.nanoseconds === 'number' && typeof candidate.toMillis === 'function';
}

function isGeoPointLike(value: object): value is { latitude: number; longitude: number } {
  const candidate = value as { latitude?: unknown; longitude?: unknown; isEqual?: unknown };
  return typeof candidate.latitude === 'number' && typeof candidate.longitude === 'number' && typeof candidate.isEqual === 'function';
}

function encodeNumber(value: number): WireValue {
  if (Number.isFinite(value)) return value;
  return { [WIRE_TAG]: 'number', value: Number.isNaN(value) ? 'NaN' : value > 0 ? 'Infinity' : '-Infinity' };
}

function encodeAt(value: unknown, hooks: CodecHooks, options: EncodeOptions, field: string, depth: number): WireValue {
  if (depth > MAX_DEPTH) throw codecError(`Value is nested too deeply (field "${field}")`);
  if (value === undefined) throw codecError(`Unsupported field value: undefined (found in field "${field}")`);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return encodeNumber(value);
  if (typeof value !== 'object') throw codecError(`Unsupported field value: ${typeof value} (found in field "${field}")`);

  if (Array.isArray(value)) return value.map((item, index) => encodeAt(item, hooks, options, `${field}.${index}`, depth + 1));
  if (value instanceof Date) {
    const time = value.getTime();
    if (Number.isNaN(time)) throw codecError(`Invalid Date (found in field "${field}")`);
    const ts = Timestamp.fromMillis(time);
    return { [WIRE_TAG]: 'timestamp', seconds: ts.seconds, nanoseconds: ts.nanoseconds };
  }
  if (value instanceof FieldOp) {
    if (!options.allowFieldOps) throw codecError(`${value.kind}() can only be used in writes (found in field "${field}")`);
    const out: WireMap = { [WIRE_TAG]: 'fieldOp', op: value.kind };
    if (value.kind === 'increment') out.operand = encodeNumber(value.operand ?? 0);
    if (value.kind === 'arrayUnion' || value.kind === 'arrayRemove') {
      out.elements = (value.elements ?? []).map((item, index) => encodeAt(item, hooks, { allowFieldOps: false }, `${field}.${index}`, depth + 1));
    }
    return out;
  }
  if (value instanceof Bytes) return { [WIRE_TAG]: 'bytes', base64: value.toBase64() };
  if (value instanceof Uint8Array) return { [WIRE_TAG]: 'bytes', base64: bytesToBase64(value) };

  const refPath = hooks.refPath(value);
  if (refPath !== null) return { [WIRE_TAG]: 'ref', path: refPath };

  if (isPlainObject(value)) {
    const out: WireMap = {};
    for (const [key, child] of Object.entries(value)) setOwn(out, key, encodeAt(child, hooks, options, field ? `${field}.${key}` : key, depth + 1));
    return Object.prototype.hasOwnProperty.call(value, WIRE_TAG) ? { [WIRE_TAG]: 'map', value: out } : out;
  }
  if (isTimestampLike(value)) return { [WIRE_TAG]: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (isGeoPointLike(value)) return { [WIRE_TAG]: 'geopoint', latitude: value.latitude, longitude: value.longitude };

  const typeName = (value as { constructor?: { name?: string } }).constructor?.name ?? 'object';
  throw codecError(`Unsupported field value: a custom ${typeName} object (found in field "${field}")`);
}

/** Encodes one Firestore value for the wire. Throws on undefined, functions and unknown classes. */
export function encodeValue(value: unknown, hooks: CodecHooks, options: EncodeOptions = {}): WireValue {
  return encodeAt(value, hooks, options, '', 0);
}

/** Encodes a document's fields. */
export function encodeData(data: Record<string, unknown>, hooks: CodecHooks, options: EncodeOptions = {}): WireMap {
  if (!isPlainObject(data)) throw codecError('Document data must be a plain object');
  return encodeAt(data, hooks, options, '', 0) as WireMap;
}

function wireNumber(value: WireValue | undefined, what: string): number {
  if (typeof value === 'number') return value;
  if (isPlainObject(value) && value[WIRE_TAG] === 'number') {
    if (value.value === 'NaN') return Number.NaN;
    if (value.value === 'Infinity') return Number.POSITIVE_INFINITY;
    if (value.value === '-Infinity') return Number.NEGATIVE_INFINITY;
  }
  throw codecError(`Invalid ${what} on the wire`);
}

const FIELD_OP_KINDS: ReadonlySet<string> = new Set<FieldOpKind>(['serverTimestamp', 'delete', 'increment', 'arrayUnion', 'arrayRemove']);

function decodeTagged(value: WireMap, hooks: CodecHooks, options: DecodeOptions, depth: number): unknown {
  switch (value[WIRE_TAG]) {
    case 'map': {
      if (!isPlainObject(value.value)) throw codecError('Invalid map on the wire');
      return decodeMap(value.value as WireMap, hooks, options, depth + 1);
    }
    case 'number':
      return wireNumber(value, 'number');
    case 'timestamp': {
      const seconds = wireNumber(value.seconds, 'timestamp');
      const nanoseconds = wireNumber(value.nanoseconds, 'timestamp');
      if (!Number.isInteger(seconds) || !Number.isInteger(nanoseconds) || nanoseconds < 0 || nanoseconds >= 1e9) throw codecError('Invalid timestamp on the wire');
      return (hooks.makeTimestamp ?? ((s: number, n: number) => new Timestamp(s, n)))(seconds, nanoseconds);
    }
    case 'geopoint': {
      const latitude = wireNumber(value.latitude, 'geo point');
      const longitude = wireNumber(value.longitude, 'geo point');
      return (hooks.makeGeoPoint ?? ((lat: number, lng: number) => new GeoPoint(lat, lng)))(latitude, longitude);
    }
    case 'bytes': {
      if (typeof value.base64 !== 'string') throw codecError('Invalid bytes on the wire');
      const bytes = base64ToBytes(value.base64);
      return (hooks.makeBytes ?? ((data: Uint8Array) => Bytes.fromUint8Array(data)))(bytes);
    }
    case 'ref': {
      if (typeof value.path !== 'string') throw codecError('Invalid reference on the wire');
      return hooks.makeRef(value.path);
    }
    case 'fieldOp': {
      if (!options.allowFieldOps) throw codecError('Field values can only be used in writes');
      const kind = value.op;
      if (typeof kind !== 'string' || !FIELD_OP_KINDS.has(kind)) throw codecError('Invalid field value on the wire');
      let op: FieldOp;
      if (kind === 'increment') {
        op = new FieldOp('increment', wireNumber(value.operand, 'increment'));
      } else if (kind === 'arrayUnion' || kind === 'arrayRemove') {
        if (!Array.isArray(value.elements)) throw codecError('Invalid field value on the wire');
        const elements = value.elements.map((item) => decodeAt(item, hooks, { allowFieldOps: false }, depth + 1));
        op = new FieldOp(kind, undefined, elements);
      } else {
        op = new FieldOp(kind as FieldOpKind);
      }
      return hooks.makeFieldOp ? hooks.makeFieldOp(op) : op;
    }
    default:
      throw codecError(`Unknown value type on the wire: ${String(value[WIRE_TAG])}`);
  }
}

function decodeMap(value: WireMap, hooks: CodecHooks, options: DecodeOptions, depth: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) setOwn(out, key, decodeAt(child, hooks, options, depth + 1));
  return out;
}

function decodeAt(value: WireValue | undefined, hooks: CodecHooks, options: DecodeOptions, depth: number): unknown {
  if (depth > MAX_DEPTH) throw codecError('Value is nested too deeply');
  if (value === undefined) throw codecError('Missing value on the wire');
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
  if (Array.isArray(value)) return value.map((item) => decodeAt(item, hooks, options, depth + 1));
  if (!isPlainObject(value)) throw codecError('Invalid value on the wire');
  if (Object.prototype.hasOwnProperty.call(value, WIRE_TAG)) return decodeTagged(value, hooks, options, depth);
  return decodeMap(value, hooks, options, depth);
}

/** Decodes one wire value. Throws on anything malformed. */
export function decodeValue(value: WireValue, hooks: CodecHooks, options: DecodeOptions = {}): unknown {
  return decodeAt(value, hooks, options, 0);
}

/** Decodes a document's fields. */
export function decodeData(value: WireValue, hooks: CodecHooks, options: DecodeOptions = {}): Record<string, unknown> {
  const decoded = decodeAt(value, hooks, options, 0);
  if (!isPlainObject(decoded)) throw codecError('Document data must be a map');
  return decoded;
}
