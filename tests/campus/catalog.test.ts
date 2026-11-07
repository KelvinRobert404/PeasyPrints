import assert from 'node:assert/strict';
import test from 'node:test';
import {
  campusesOf,
  campusLabel,
  findLandmark,
  getCampus,
  getCollege,
  listCampuses,
  listColleges,
  mergeCollegeConfig,
  searchCampuses,
  searchColleges,
} from '../../src/lib/campus/catalog.ts';

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

test('catalog has 7 colleges and 21 campuses', () => {
  assert.equal(listColleges().length, 7);
  assert.equal(listCampuses().length, 21);
  const counts = Object.fromEntries(listColleges().map((college) => [college.id, campusesOf(college.id).length]));
  assert.deepEqual(counts, { christ: 4, jain: 9, kju: 2, pes: 2, presidency: 1, reva: 1, sju: 2 });
});

test('ids are unique and codes are upper-case letters', () => {
  const collegeIds = listColleges().map((college) => college.id);
  assert.equal(new Set(collegeIds).size, collegeIds.length);
  const codes = listColleges().map((college) => college.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const code of codes) assert.match(code, /^[A-Z]{2,8}$/);
  assert.deepEqual([...codes].sort(), ['CHRIST', 'JAIN', 'KJU', 'PES', 'PU', 'REVA', 'SJU']);

  const campusIds = listCampuses().map((campus) => campus.id);
  assert.equal(new Set(campusIds).size, campusIds.length);
  const landmarkIds = listCampuses().flatMap((campus) => campus.landmarks.map((landmark) => landmark.id));
  assert.equal(new Set(landmarkIds).size, landmarkIds.length);
  const pickupIds = listCampuses().flatMap((campus) => campus.pickupPoints.map((point) => point.id));
  assert.equal(new Set(pickupIds).size, pickupIds.length);
  for (const campus of listCampuses()) assert.ok(getCollege(campus.collegeId), `${campus.id} has a college`);
});

test('only KJU is live', () => {
  for (const college of listColleges()) assert.equal(college.launchState, college.id === 'kju' ? 'live' : 'waitlist');
});

test('KJU campuses have the right labels and origins over 1 km apart', () => {
  const main = getCampus('kju-main');
  const airport = getCampus('kju-airport-road');
  assert.ok(main && airport);
  assert.equal(main.label, 'KJU Main');
  assert.equal(airport.label, 'KJU Airport Rd');
  assert.equal(campusLabel('kju-main'), 'KJU Main');
  assert.equal(campusLabel('nope'), 'Campus');
  assert.deepEqual(main.origin, { lat: 13.059, lng: 77.6428, approx: false });
  assert.equal(airport.origin.approx, true);
  assert.ok(haversineKm(main.origin, airport.origin) > 1);
  assert.ok(main.landmarks.length >= 8);
  assert.ok(airport.landmarks.length >= 8);
  assert.ok(main.pickupPoints.length > 0);
});

test('every campus has 2+ landmarks within 5 km of its origin', () => {
  for (const campus of listCampuses()) {
    assert.ok(campus.landmarks.length >= 2, `${campus.id} landmark count`);
    for (const landmark of campus.landmarks) {
      const km = haversineKm(campus.origin, landmark);
      assert.ok(km <= 5, `${landmark.id} is ${km.toFixed(2)} km from ${campus.id}`);
      assert.ok(landmark.label && landmark.area, `${landmark.id} has label and area`);
    }
  }
});

test('approx is set only where the facts have no coordinates', () => {
  const approx = listCampuses().filter((campus) => campus.origin.approx).map((campus) => `${campus.collegeId}:${campus.id}`);
  for (const id of approx) assert.ok(/^(jain|sju|kju):/.test(id), id);
  assert.equal(approx.length, 9 + 2 + 1);
});

test('college search matches codes, names and aliases', () => {
  for (const alias of ['kjc', 'clg', 'kristu', 'KJU', 'Kristu Jayanthi', 'new campus']) {
    assert.equal(searchColleges(alias)[0]?.id, 'kju', alias);
  }
  assert.equal(searchColleges('PU')[0]?.id, 'presidency');
  assert.equal(searchColleges("St. Joseph's")[0]?.id, 'sju');
  assert.equal(searchColleges('pesu')[0]?.id, 'pes');
  assert.equal(searchColleges('reva')[0]?.id, 'reva');
  assert.equal(searchColleges('chr')[0]?.id, 'christ');
  assert.deepEqual(searchColleges('   '), []);
  assert.deepEqual(searchColleges('zzzz'), []);
});

test('campus search maps sub-campus nicknames', () => {
  assert.equal(searchCampuses('airport campus')[0]?.id, 'kju-airport-road');
  assert.equal(searchCampuses('main campus', 'kju')[0]?.id, 'kju-main');
  assert.equal(searchCampuses('kengeri')[0]?.id, 'christ-kengeri');
});

test('landmark search uses aliases and areas', () => {
  assert.equal(findLandmark('kju-main', 'kothnur')?.label, 'Kothanur');
  assert.equal(findLandmark('kju-main', 'knp')?.label, 'K Narayanapura');
  assert.equal(findLandmark('kju-main', 'Hennur')?.label, 'Hennur');
  assert.equal(findLandmark('kju-main', 'hormavu')?.label, 'Horamavu');
  assert.equal(findLandmark('kju-main', 'bharthiya')?.label, 'Bhartiya City');
  assert.equal(findLandmark('kju-main', 'falcon')?.label, 'Falcon Hospital');
  assert.equal(findLandmark('kju-main', 'byrthi')?.area, 'Byrathi');
  assert.equal(findLandmark('kju-airport-road', 'baglur')?.label, 'Bagalur');
  assert.equal(findLandmark('kju-main', 'baglur'), null);
  assert.equal(findLandmark('unknown', 'falcon'), null);
  assert.equal(findLandmark('kju-main', ''), null);
});

test('catalog is frozen', () => {
  const main = getCampus('kju-main');
  assert.ok(main);
  assert.ok(Object.isFrozen(main));
  assert.ok(Object.isFrozen(main.landmarks));
  assert.throws(() => {
    (main as { label: string }).label = 'Hacked';
  });
});

test('mergeCollegeConfig applies overrides without mutating the catalog', () => {
  assert.equal(mergeCollegeConfig('nope'), null);
  const plain = mergeCollegeConfig('kju');
  assert.ok(plain);
  assert.equal(plain.campuses.length, 2);

  const merged = mergeCollegeConfig('christ', {
    launchState: 'live',
    emailDomains: [' Example.EDU ', ''],
    campuses: {
      'christ-central': { label: 'Christ Hosur Rd', pickupPoints: [{ id: 'gate', label: 'Main gate' }] },
      'not-a-campus': { label: 'Ignored' },
    },
  });
  assert.ok(merged);
  assert.equal(merged.college.launchState, 'live');
  assert.deepEqual(merged.college.emailDomains, ['example.edu']);
  assert.equal(merged.campuses.length, 4);
  const central = merged.campuses.find((campus) => campus.id === 'christ-central');
  assert.equal(central?.label, 'Christ Hosur Rd');
  assert.deepEqual(central?.pickupPoints, [{ id: 'gate', label: 'Main gate' }]);
  assert.ok((central?.landmarks.length ?? 0) >= 2);

  assert.equal(getCollege('christ')?.launchState, 'waitlist');
  assert.equal(getCampus('christ-central')?.label, 'Christ Central');
  assert.equal(getCampus('christ-central')?.pickupPoints.length, 0);
});
