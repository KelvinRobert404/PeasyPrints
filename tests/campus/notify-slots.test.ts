import assert from 'node:assert/strict';
import test from 'node:test';
import { dedupeKey, isQuietHours, nextSlot } from '../../src/lib/campus/notifySlots.ts';

const ist = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`);
const istIso = (date: string, time: string) => ist(date, time).toISOString();

test('normal sends wait for the 12:30 or 19:30 slot', () => {
  assert.equal(nextSlot(ist('2026-11-07', '11:00')).toISOString(), istIso('2026-11-07', '12:30'));
  assert.equal(nextSlot(ist('2026-11-07', '13:00')).toISOString(), istIso('2026-11-07', '19:30'));
  assert.equal(nextSlot(ist('2026-11-07', '21:00')).toISOString(), istIso('2026-11-08', '12:30'));
});

test('slot edges', () => {
  assert.equal(nextSlot(ist('2026-11-07', '12:30')).toISOString(), istIso('2026-11-07', '12:30'));
  assert.equal(nextSlot(ist('2026-11-07', '12:31')).toISOString(), istIso('2026-11-07', '19:30'));
  assert.equal(nextSlot(ist('2026-11-07', '19:30')).toISOString(), istIso('2026-11-07', '19:30'));
  assert.equal(nextSlot(ist('2026-11-07', '00:00')).toISOString(), istIso('2026-11-07', '12:30'));
  assert.equal(nextSlot(ist('2026-11-07', '23:30')).toISOString(), istIso('2026-11-08', '12:30'));
  // Month and year roll-over.
  assert.equal(nextSlot(ist('2026-12-31', '20:00')).toISOString(), istIso('2027-01-01', '12:30'));
});

test('slots are computed in IST from any input form', () => {
  // 07:00 UTC is 12:30 IST.
  assert.equal(nextSlot('2026-11-07T06:00:00Z').toISOString(), '2026-11-07T07:00:00.000Z');
  assert.equal(nextSlot(Date.parse('2026-11-07T06:00:00Z')).toISOString(), '2026-11-07T07:00:00.000Z');
});

test('urgent goes now outside quiet hours', () => {
  const now = ist('2026-11-07', '13:00');
  assert.equal(nextSlot(now, { urgent: true }).toISOString(), now.toISOString());
  assert.equal(nextSlot(ist('2026-11-07', '07:00'), { urgent: true }).toISOString(), istIso('2026-11-07', '07:00'));
  assert.equal(nextSlot(ist('2026-11-07', '21:59'), { urgent: true }).toISOString(), istIso('2026-11-07', '21:59'));
});

test('urgent waits for 07:00 in quiet hours', () => {
  assert.equal(nextSlot(ist('2026-11-07', '23:30'), { urgent: true }).toISOString(), istIso('2026-11-08', '07:00'));
  assert.equal(nextSlot(ist('2026-11-07', '22:00'), { urgent: true }).toISOString(), istIso('2026-11-08', '07:00'));
  assert.equal(nextSlot(ist('2026-11-08', '03:00'), { urgent: true }).toISOString(), istIso('2026-11-08', '07:00'));
  assert.equal(nextSlot(ist('2026-11-08', '06:59'), { urgent: true }).toISOString(), istIso('2026-11-08', '07:00'));
});

test('nothing is ever scheduled in quiet hours', () => {
  const start = ist('2026-11-07', '00:00').getTime();
  for (let minute = 0; minute < 24 * 60; minute += 7) {
    const now = new Date(start + minute * 60_000);
    for (const urgent of [false, true]) {
      const slot = nextSlot(now, { urgent });
      assert.equal(isQuietHours(slot), false, `${now.toISOString()} urgent=${urgent}`);
      assert.ok(slot.getTime() >= now.getTime());
    }
  }
});

test('quiet hours are 22:00 to 07:00 IST', () => {
  assert.equal(isQuietHours(ist('2026-11-07', '21:59')), false);
  assert.equal(isQuietHours(ist('2026-11-07', '22:00')), true);
  assert.equal(isQuietHours(ist('2026-11-08', '06:59')), true);
  assert.equal(isQuietHours(ist('2026-11-08', '07:00')), false);
});

test('dedupe keys', () => {
  const slot = ist('2026-11-07', '12:30');
  assert.equal(dedupeKey({ userId: 'u1', type: 'still_available', targetId: 'KJU-M0042' }), 'still_available:u1:KJU-M0042');
  assert.equal(dedupeKey({ userId: 'u1', type: 'saved_drop', targetId: 'l1', slot }), 'saved_drop:u1:l1:2026-11-07T12:30');
  assert.equal(dedupeKey({ userId: 'u1', type: 'digest', slot }), 'digest:u1:-:2026-11-07T12:30');
  assert.equal(
    dedupeKey({ userId: 'u1', type: 'saved_drop', targetId: 'l1', slot }),
    dedupeKey({ userId: 'u1', type: 'saved_drop', targetId: 'l1', slot: slot.toISOString() }),
  );
  assert.equal(dedupeKey({ userId: 'a:b', type: 't' }), 't:a%3Ab:-');
  assert.throws(() => dedupeKey({ userId: ' ', type: 't' }));
});
