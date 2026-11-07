import assert from 'node:assert/strict';
import test from 'node:test';
import { courseLabel, getProgramme, listProgrammes, validateCourse } from '../../src/lib/campus/courses.ts';

test('programmes have unique ids, both levels and sane semester counts', () => {
  const all = listProgrammes();
  assert.equal(new Set(all.map((programme) => programme.id)).size, all.length);
  assert.ok(listProgrammes('ug').length > 0);
  assert.ok(listProgrammes('pg').length > 0);
  assert.equal(listProgrammes('ug').length + listProgrammes('pg').length, all.length);
  for (const programme of all) {
    assert.ok(Number.isInteger(programme.semesters) && programme.semesters >= 2 && programme.semesters <= 10, programme.id);
    assert.equal(new Set(programme.specialisations).size, programme.specialisations.length, programme.id);
  }
  assert.equal(getProgramme('mba')?.semesters, 4);
  assert.equal(getProgramme('ba-llb')?.semesters, 10);
  assert.equal(getProgramme('nope'), null);
});

test('valid course returns the canonical shape', () => {
  const result = validateCourse({ programmeId: 'bba', semester: 3, specialisation: '  finance ' });
  assert.deepEqual(result, {
    ok: true,
    course: { programmeId: 'bba', level: 'ug', programmeName: 'BBA', semester: 3, year: 2, specialisation: 'Finance' },
  });
  if (result.ok) assert.equal(courseLabel(result.course), 'BBA Finance, sem 3');

  const plain = validateCourse({ programmeId: 'mca', semester: 4 });
  assert.ok(plain.ok);
  if (plain.ok) {
    assert.equal(plain.course.specialisation, null);
    assert.equal(plain.course.year, 2);
    assert.equal(courseLabel(plain.course), 'MCA, sem 4');
  }
  assert.ok(validateCourse({ programmeId: 'llb', semester: 6, specialisation: '' }).ok);
});

test('bad semester is rejected', () => {
  for (const semester of [0, -1, 5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = validateCourse({ programmeId: 'mba', semester });
    assert.equal(result.ok, false, String(semester));
    if (!result.ok) assert.equal(result.error, 'bad_semester');
  }
  const wrongType = validateCourse({ programmeId: 'bcom', semester: '3' as unknown as number });
  assert.equal(wrongType.ok, false);
});

test('unknown programme and specialisation are rejected', () => {
  const unknown = validateCourse({ programmeId: 'mbbs', semester: 1 });
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.error, 'unknown_programme');

  const badSpec = validateCourse({ programmeId: 'bcom', semester: 2, specialisation: 'Astrology' });
  assert.equal(badSpec.ok, false);
  if (!badSpec.ok) assert.equal(badSpec.error, 'bad_specialisation');

  const noSpecs = validateCourse({ programmeId: 'llm', semester: 1, specialisation: 'Corporate' });
  assert.equal(noSpecs.ok, false);
});
