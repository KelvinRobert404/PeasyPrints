import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_RING,
  DISTANCE_RINGS,
  formatDistance,
  formatFromCampus,
  haversineMeters,
  ringLabel,
  roundForPrivacy,
  walkMinutes,
  withinRing,
} from '../../src/lib/format/distance.ts';

function assertWithinPercent(actual: number, expected: number, percent: number) {
  const error = Math.abs(actual - expected) / expected;
  assert.ok(error <= percent / 100, `${actual} is not within ${percent}% of ${expected}`);
}

test('haversineMeters matches known pairs within 1%', () => {
  // Nashville BNA to Los Angeles LAX: 2,886 km.
  assertWithinPercent(haversineMeters({ lat: 36.12, lng: -86.67 }, { lat: 33.94, lng: -118.4 }), 2_886_000, 1);
  // London to Paris city centres: 344 km.
  assertWithinPercent(haversineMeters({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 }), 343_900, 1);
  // One degree of latitude: 111.2 km.
  assertWithinPercent(haversineMeters({ lat: 0, lng: 77 }, { lat: 1, lng: 77 }), 111_195, 1);
});

test('haversineMeters is 0 for the same point and symmetric', () => {
  const a = { lat: 12.9716, lng: 77.5946 };
  const b = { lat: 12.9352, lng: 77.6245 };
  assert.equal(haversineMeters(a, a), 0);
  assert.equal(haversineMeters(a, b), haversineMeters(b, a));
});

test('roundForPrivacy rounds to 50 m, never below 50 m', () => {
  assert.equal(roundForPrivacy(649), 650);
  assert.equal(roundForPrivacy(624), 600);
  assert.equal(roundForPrivacy(625), 650);
  assert.equal(roundForPrivacy(1234), 1250);
  assert.equal(roundForPrivacy(12), 50);
  assert.equal(roundForPrivacy(0), 50);
});

test('formatDistance shows metres to 10 m under 1 km', () => {
  assert.equal(formatDistance(650), '650 m');
  assert.equal(formatDistance(654), '650 m');
  assert.equal(formatDistance(656), '660 m');
  assert.equal(formatDistance(3), '10 m');
  assert.equal(formatDistance(0), '0 m');
});

test('formatDistance shows km with one decimal', () => {
  assert.equal(formatDistance(1200), '1.2 km');
  assert.equal(formatDistance(996), '1 km');
  assert.equal(formatDistance(1000), '1 km');
  assert.equal(formatDistance(2049), '2 km');
  assert.equal(formatDistance(12_340), '12.3 km');
});

test('walkMinutes is metres over 80, at least 1', () => {
  assert.equal(walkMinutes(650), 8);
  assert.equal(walkMinutes(80), 1);
  assert.equal(walkMinutes(10), 1);
  assert.equal(walkMinutes(0), 1);
  assert.equal(walkMinutes(1200), 15);
});

test('formatFromCampus reads distance and walk time', () => {
  assert.equal(formatFromCampus(650, 'KJU'), '650 m from KJU, 8 min walk');
  assert.equal(formatFromCampus(1200, 'KJU Main'), '1.2 km from KJU Main, 15 min walk');
});

test('distance rings and labels', () => {
  assert.deepEqual([...DISTANCE_RINGS], [500, 1000, 2000]);
  assert.equal(DEFAULT_RING, 1000);
  assert.equal(ringLabel(500), 'Within 500 m');
  assert.equal(ringLabel(1000), 'Within 1 km');
  assert.equal(ringLabel(2000), 'Within 2 km');
});

test('withinRing includes the edge', () => {
  assert.equal(withinRing(499, 500), true);
  assert.equal(withinRing(500, 500), true);
  assert.equal(withinRing(501, 500), false);
  assert.equal(withinRing(Number.NaN, 500), false);
  assert.equal(withinRing(-1, 500), false);
});
