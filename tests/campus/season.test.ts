import assert from 'node:assert/strict';
import test from 'node:test';
import {
  homeSeasonalSlot,
  isExamSeason,
  isPeakHousingSeason,
  istDateKey,
  moveInLabel,
  nextSemStart,
  resolveMoveIn,
  seasonalPrompt,
} from '../../src/lib/campus/season.ts';

// Midday IST on an IST calendar date.
const ist = (date: string, time = '12:00') => new Date(`${date}T${time}:00+05:30`);

test('seasonal prompt follows IST month edges', () => {
  assert.equal(seasonalPrompt(ist('2026-03-31', '23:59')), null);
  assert.equal(seasonalPrompt(ist('2026-04-01', '00:00')), 'moving_out');
  assert.equal(seasonalPrompt(ist('2026-05-31', '23:59')), 'moving_out');
  assert.equal(seasonalPrompt(ist('2026-06-01', '00:00')), 'set_up_room');
  assert.equal(seasonalPrompt(ist('2026-08-31', '23:59')), 'set_up_room');
  assert.equal(seasonalPrompt(ist('2026-09-01', '00:00')), null);
  assert.equal(seasonalPrompt(ist('2026-12-15')), null);
});

test('month edges use IST, not UTC', () => {
  // 31 Mar 19:00 UTC is 1 Apr 00:30 IST.
  assert.equal(seasonalPrompt(new Date('2026-03-31T19:00:00Z')), 'moving_out');
  // 31 Aug 18:00 UTC is 31 Aug 23:30 IST, still August.
  assert.equal(seasonalPrompt(new Date('2026-08-31T18:00:00Z')), 'set_up_room');
  assert.equal(istDateKey(new Date('2026-03-31T19:00:00Z')), '2026-04-01');
});

test('7 Nov is the exams slot', () => {
  assert.deepEqual(homeSeasonalSlot(ist('2026-11-07')), { id: 'exams', title: 'Exams soon? Print your notes', href: '/upload' });
});

test('home seasonal slot edges', () => {
  assert.equal(homeSeasonalSlot(ist('2026-10-14', '23:59')), null);
  assert.equal(homeSeasonalSlot(ist('2026-10-15', '00:00'))?.id, 'exams');
  assert.equal(homeSeasonalSlot(ist('2026-11-30', '23:59'))?.id, 'exams');
  assert.deepEqual(homeSeasonalSlot(ist('2026-12-01', '00:00')), { id: 'next_sem_room', title: 'Next sem room?', href: '/housing' });
  assert.equal(homeSeasonalSlot(ist('2027-01-31'))?.href, '/housing');
  assert.equal(homeSeasonalSlot(ist('2027-02-01')), null);
  assert.equal(homeSeasonalSlot(ist('2027-03-14')), null);
  assert.equal(homeSeasonalSlot(ist('2027-03-15'))?.href, '/upload');
  assert.equal(homeSeasonalSlot(ist('2027-03-31', '23:59'))?.href, '/upload');
  assert.equal(homeSeasonalSlot(ist('2027-04-01', '00:00'))?.href, '/marketplace/new?kind=bundle');
  assert.equal(homeSeasonalSlot(ist('2027-05-31'))?.id, 'moving_out');
  assert.equal(homeSeasonalSlot(ist('2027-06-01'))?.href, '/marketplace/all/near-you');
  assert.equal(homeSeasonalSlot(ist('2027-08-31'))?.id, 'set_up_room');
  assert.equal(homeSeasonalSlot(ist('2027-09-15')), null);
  assert.equal(isExamSeason(ist('2027-03-15')), true);
  assert.equal(isExamSeason(ist('2027-04-01')), false);
});

test('slot titles stay under 10 words', () => {
  for (const date of ['2026-11-07', '2026-12-10', '2027-04-10', '2027-07-10']) {
    const slot = homeSeasonalSlot(ist(date));
    assert.ok(slot);
    assert.ok(slot.title.split(/\s+/).length < 10, slot.title);
  }
});

test('peak housing season is April to August', () => {
  assert.equal(isPeakHousingSeason(ist('2026-03-31', '23:59')), false);
  assert.equal(isPeakHousingSeason(ist('2026-04-01', '00:00')), true);
  assert.equal(isPeakHousingSeason(ist('2026-08-31', '23:59')), true);
  assert.equal(isPeakHousingSeason(ist('2026-09-01', '00:00')), false);
});

test('next sem start rolls over the year', () => {
  assert.equal(nextSemStart(ist('2026-11-07')), '2026-11-15');
  assert.equal(nextSemStart(ist('2026-11-15')), '2026-11-15');
  assert.equal(nextSemStart(ist('2026-11-16')), '2027-06-01');
  assert.equal(nextSemStart(ist('2026-05-31')), '2026-06-01');
  assert.equal(nextSemStart(ist('2026-06-02')), '2026-11-15');
  assert.equal(nextSemStart(ist('2026-12-31'), ['01-05', '07-20']), '2027-01-05');
  assert.equal(nextSemStart(ist('2026-11-07'), ['bad', '06-01']), '2027-06-01');
  assert.throws(() => nextSemStart(ist('2026-11-07'), ['nope']));
});

test('resolve move-in', () => {
  const now = ist('2026-11-07');
  assert.equal(resolveMoveIn('now', now), '2026-11-07');
  assert.equal(resolveMoveIn(null, now), '2026-11-07');
  assert.equal(resolveMoveIn('next_sem', now), '2026-11-15');
  assert.equal(resolveMoveIn('2026-12-20', now), '2026-12-20');
  assert.equal(resolveMoveIn('2026-10-01', now), '2026-11-07');
  assert.equal(resolveMoveIn('2026-02-30', now), '2026-11-07');
});

test('move-in labels', () => {
  const now = ist('2026-11-07');
  assert.equal(moveInLabel('now', now), 'Move in now');
  assert.equal(moveInLabel('2026-11-01', now), 'Move in now');
  assert.equal(moveInLabel('2026-11-08', now), 'From tomorrow');
  assert.equal(moveInLabel('next_sem', now), 'From 15 Nov');
  assert.equal(moveInLabel('2027-06-01', now), 'From 1 Jun 2027');
});
