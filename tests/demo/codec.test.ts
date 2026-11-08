import test from 'node:test';
import assert from 'node:assert/strict';

import {
  Bytes,
  FieldOp,
  GeoPoint,
  Timestamp,
  WIRE_TAG,
  decodeData,
  decodeValue,
  encodeData,
  encodeValue,
} from '../../src/lib/demo/codec.ts';
import type { CodecHooks, WireValue } from '../../src/lib/demo/codec.ts';
import { GeoPoint as AdminGeoPoint, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';

// A stand-in document reference, like the client stand-in's DocumentReference.
class Ref {
  readonly path: string;
  constructor(path: string) {
    this.path = path;
  }
}

const hooks: CodecHooks = {
  refPath: (value) => (value instanceof Ref ? value.path : null),
  makeRef: (path) => new Ref(path),
};

/** Encodes, sends through JSON like the wire does, and decodes. */
function roundTrip(value: unknown, options: { allowFieldOps?: boolean } = {}): unknown {
  const wire = encodeValue(value, hooks, options);
  const sent = JSON.parse(JSON.stringify(wire)) as WireValue;
  return decodeValue(sent, hooks, options);
}

test('plain JSON values pass through unchanged', () => {
  const value = { a: 1, b: 'two', c: true, d: null, e: [1, 'x', false], f: { g: { h: 2.5 } } };
  assert.deepEqual(encodeValue(value, hooks), value);
  assert.deepEqual(roundTrip(value), value);
});

test('Timestamp round-trips, and a Date becomes a Timestamp', () => {
  const ts = new Timestamp(1_731_000_000, 123_456_789);
  const back = roundTrip(ts);
  assert.ok(back instanceof Timestamp);
  assert.ok(back.isEqual(ts));

  const date = new Date('2026-11-08T10:15:30.250Z');
  const fromDate = roundTrip({ at: date }) as { at: Timestamp };
  assert.ok(fromDate.at instanceof Timestamp);
  assert.equal(fromDate.at.toMillis(), date.getTime());
  assert.equal(fromDate.at.toDate().toISOString(), date.toISOString());
});

test('firebase-admin Timestamp and GeoPoint encode like the client ones', () => {
  assert.deepEqual(encodeValue(new AdminTimestamp(10, 5), hooks), { [WIRE_TAG]: 'timestamp', seconds: 10, nanoseconds: 5 });
  assert.deepEqual(encodeValue(new AdminGeoPoint(1.5, -2), hooks), { [WIRE_TAG]: 'geopoint', latitude: 1.5, longitude: -2 });
  // A plain map that only looks like a timestamp stays a map (functions are refused).
  assert.throws(() => encodeValue({ seconds: 1, nanoseconds: 2, toMillis: () => 1 }, hooks), /Unsupported/);
});

test('Timestamp compares like the SDK', () => {
  const early = Timestamp.fromMillis(1_000);
  const late = Timestamp.fromMillis(2_000);
  assert.ok(early.valueOf() < late.valueOf());
  assert.equal(Timestamp.fromMillis(-1).toMillis(), -1);
});

test('GeoPoint round-trips', () => {
  const point = new GeoPoint(12.9716, 77.5946);
  const back = roundTrip({ where: point }) as { where: GeoPoint };
  assert.ok(back.where instanceof GeoPoint);
  assert.ok(back.where.isEqual(point));
  assert.throws(() => new GeoPoint(91, 0));
});

test('document references round-trip through the hooks', () => {
  const back = roundTrip({ shop: new Ref('shops/kju-main'), list: [new Ref('orders/a')] }) as { shop: Ref; list: Ref[] };
  assert.ok(back.shop instanceof Ref);
  assert.equal(back.shop.path, 'shops/kju-main');
  assert.equal(back.list[0].path, 'orders/a');
});

test('bytes round-trip from Uint8Array and Bytes', () => {
  const raw = new Uint8Array([0, 1, 2, 250, 255]);
  const back = roundTrip(raw);
  assert.ok(back instanceof Bytes);
  assert.deepEqual([...back.toUint8Array()], [...raw]);

  const bytes = Bytes.fromUint8Array(raw);
  const again = roundTrip(bytes);
  assert.ok(again instanceof Bytes && again.isEqual(bytes));

  const serverHooks: CodecHooks = { ...hooks, makeBytes: (data) => Buffer.from(data) };
  const asBuffer = decodeValue(encodeValue(raw, hooks), serverHooks);
  assert.ok(Buffer.isBuffer(asBuffer));
  assert.deepEqual([...asBuffer], [...raw]);
});

test('nested arrays and maps round-trip', () => {
  const ts = Timestamp.fromMillis(5_000);
  const value = { grid: [[1, 2], [3, [4, ts]]], deep: { list: [{ at: ts, tags: ['a', 'b'] }] } };
  const back = roundTrip(value) as typeof value;
  assert.deepEqual(back.grid[0], [1, 2]);
  const inner = back.grid[1][1] as unknown as [number, Timestamp];
  assert.equal(inner[0], 4);
  assert.ok(inner[1] instanceof Timestamp && inner[1].isEqual(ts));
  assert.ok(back.deep.list[0].at.isEqual(ts));
  assert.deepEqual(back.deep.list[0].tags, ['a', 'b']);
});

test('numbers JSON cannot hold survive', () => {
  const back = roundTrip({ a: Number.NaN, b: Number.POSITIVE_INFINITY, c: Number.NEGATIVE_INFINITY }) as Record<string, number>;
  assert.ok(Number.isNaN(back.a));
  assert.equal(back.b, Number.POSITIVE_INFINITY);
  assert.equal(back.c, Number.NEGATIVE_INFINITY);
});

test('a map with its own $type key is never read as a tag', () => {
  const value = { [WIRE_TAG]: 'timestamp', seconds: 'nope', inner: { [WIRE_TAG]: 'ref' } };
  assert.deepEqual(roundTrip(value), value);
});

test('a __proto__ key stays an own property', () => {
  const wire = JSON.parse('{"__proto__": {"polluted": true}, "ok": 1}') as WireValue;
  const back = decodeData(wire, hooks) as Record<string, unknown>;
  assert.equal(Object.getPrototypeOf(back), Object.prototype);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.deepEqual(Object.keys(back).sort(), ['__proto__', 'ok']);
});

test('field values round-trip only when allowed', () => {
  const data = {
    at: new FieldOp('serverTimestamp'),
    gone: new FieldOp('delete'),
    count: new FieldOp('increment', 2),
    tags: new FieldOp('arrayUnion', undefined, ['x', new Ref('shops/a')]),
    old: new FieldOp('arrayRemove', undefined, ['y']),
  };
  assert.throws(() => encodeData(data, hooks), /only be used in writes/);
  const back = roundTrip(data, { allowFieldOps: true }) as Record<string, FieldOp>;
  assert.equal(back.at.kind, 'serverTimestamp');
  assert.equal(back.gone.kind, 'delete');
  assert.equal(back.count.kind, 'increment');
  assert.equal(back.count.operand, 2);
  assert.equal(back.tags.kind, 'arrayUnion');
  assert.equal((back.tags.elements?.[1] as Ref).path, 'shops/a');
  assert.deepEqual(back.old.elements, ['y']);

  const wire = encodeData(data, hooks, { allowFieldOps: true });
  assert.throws(() => decodeData(wire, hooks), /only be used in writes/);
});

test('the server can map field values to its own sentinels', () => {
  const wire = encodeData({ at: new FieldOp('serverTimestamp') }, hooks, { allowFieldOps: true });
  const back = decodeData(wire, { ...hooks, makeFieldOp: (op) => `sentinel:${op.kind}` }, { allowFieldOps: true });
  assert.deepEqual(back, { at: 'sentinel:serverTimestamp' });
});

test('bad values are refused', () => {
  assert.throws(() => encodeValue({ a: undefined }, hooks), /undefined/);
  assert.throws(() => encodeValue({ f: () => 1 }, hooks), /Unsupported/);
  assert.throws(() => encodeValue(new Map(), hooks), /custom Map/);
  assert.throws(() => decodeValue({ [WIRE_TAG]: 'nope' }, hooks), /Unknown value type/);
  assert.throws(() => decodeValue({ [WIRE_TAG]: 'timestamp', seconds: 1, nanoseconds: 2e9 }, hooks), /Invalid timestamp/);
  assert.throws(() => decodeValue({ [WIRE_TAG]: 'bytes', base64: '!!' }, hooks), /base64/);
  assert.throws(() => decodeData([1, 2], hooks), /must be a map/);
});
