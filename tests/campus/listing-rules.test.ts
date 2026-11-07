import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canLowerPrice,
  computeExpiry,
  documentValidity,
  effectiveStatus,
  isDuplicateTitle,
  plateState,
  priceDropActive,
  reserveUntil,
  stillAvailableDue,
} from '../../src/lib/campus/listingRules.ts';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date('2026-11-07T06:30:00.000Z'); // 12:00 IST
const at = (ms: number) => new Date(NOW.getTime() + ms);
const iso = (ms: number) => at(ms).toISOString();

test('reservation lapses after 24 h', () => {
  const reservedUntil = reserveUntil(NOW);
  assert.equal(reservedUntil, iso(DAY));
  const listing = { status: 'reserved' as const, reservedUntil, availabilityExpiresAt: iso(7 * DAY) };
  assert.equal(effectiveStatus(listing, at(DAY - 1)), 'reserved');
  assert.equal(effectiveStatus(listing, at(DAY)), 'active');
  assert.equal(effectiveStatus(listing, at(DAY + HOUR)), 'active');
});

test('lapsed reservation past availability needs confirmation', () => {
  const listing = { status: 'reserved' as const, reservedUntil: iso(DAY), availabilityExpiresAt: iso(DAY / 2) };
  assert.equal(effectiveStatus(listing, at(DAY / 2)), 'reserved');
  assert.equal(effectiveStatus(listing, at(DAY)), 'needs_confirmation');
  assert.equal(effectiveStatus({ status: 'reserved', reservedUntil: null }, NOW), 'active');
});

test('hard expiry wins over every open status', () => {
  const hardExpiresAt = iso(2 * HOUR);
  assert.equal(effectiveStatus({ status: 'active', hardExpiresAt }, at(2 * HOUR - 1)), 'active');
  assert.equal(effectiveStatus({ status: 'active', hardExpiresAt }, at(2 * HOUR)), 'expired');
  assert.equal(effectiveStatus({ status: 'reserved', reservedUntil: iso(DAY), hardExpiresAt }, at(3 * HOUR)), 'expired');
  assert.equal(effectiveStatus({ status: 'needs_confirmation', hardExpiresAt }, at(3 * HOUR)), 'expired');
  assert.equal(effectiveStatus({ status: 'sold', hardExpiresAt }, at(3 * HOUR)), 'sold');
  assert.equal(effectiveStatus({ status: 'removed' }, NOW), 'removed');
});

test('active past availability needs confirmation', () => {
  const listing = { status: 'active' as const, availabilityExpiresAt: iso(7 * DAY) };
  assert.equal(effectiveStatus(listing, at(7 * DAY - 1)), 'active');
  assert.equal(effectiveStatus(listing, at(7 * DAY)), 'needs_confirmation');
});

test('expiry follows the kind and caps availability at 7 days', () => {
  assert.deepEqual(computeExpiry('item', {}, NOW), { hardExpiresAt: null, availabilityExpiresAt: iso(7 * DAY) });
  assert.deepEqual(computeExpiry('ride', { departure: iso(2 * DAY), showtime: iso(HOUR) }, NOW), {
    hardExpiresAt: iso(2 * DAY),
    availabilityExpiresAt: iso(2 * DAY),
  });
  assert.deepEqual(computeExpiry('ticket', { showtime: iso(10 * DAY) }, NOW), {
    hardExpiresAt: iso(10 * DAY),
    availabilityExpiresAt: iso(7 * DAY),
  });
  assert.equal(computeExpiry('pass', { validUntil: iso(3 * DAY) }, NOW).hardExpiresAt, iso(3 * DAY));
  assert.equal(computeExpiry('room', { availableUntil: iso(30 * DAY) }, NOW).hardExpiresAt, iso(30 * DAY));
  assert.equal(computeExpiry('ticket', { showtime: 'not a date' }, NOW).hardExpiresAt, null);
  // Date-only availableUntil lasts to the end of that IST day.
  assert.equal(computeExpiry('item', { availableUntil: '2026-11-09' }, NOW).hardExpiresAt, '2026-11-09T18:29:59.999Z');
});

test('still-available nudge is due at 72 h, once', () => {
  const listing = { status: 'active' as const, createdAt: NOW.toISOString(), availabilityExpiresAt: iso(7 * DAY) };
  assert.equal(stillAvailableDue(listing, at(72 * HOUR - 1)), false);
  assert.equal(stillAvailableDue(listing, at(72 * HOUR)), true);
  assert.equal(stillAvailableDue({ ...listing, stillAvailableNudgedAt: iso(72 * HOUR) }, at(96 * HOUR)), false);
  assert.equal(stillAvailableDue({ ...listing, stillAvailableNudgedAt: iso(72 * HOUR) }, at(30 * DAY)), false);
  assert.equal(stillAvailableDue({ ...listing, lastConfirmedAt: iso(2 * DAY) }, at(4 * DAY)), false);
  assert.equal(stillAvailableDue({ ...listing, lastConfirmedAt: iso(2 * DAY) }, at(5 * DAY)), true);
  assert.equal(stillAvailableDue({ ...listing, status: 'sold' }, at(4 * DAY)), false);
  assert.equal(stillAvailableDue({ ...listing, status: 'reserved', reservedUntil: iso(5 * DAY) }, at(4 * DAY)), false);
});

test('price can only be lowered', () => {
  assert.equal(canLowerPrice({ status: 'active', price: 1500 }, 1200), true);
  assert.equal(canLowerPrice({ status: 'needs_confirmation', price: 1500 }, 1499), true);
  assert.equal(canLowerPrice({ status: 'active', price: 1500 }, 1500), false);
  assert.equal(canLowerPrice({ status: 'active', price: 1500 }, 1800), false);
  assert.equal(canLowerPrice({ status: 'active', price: 1500 }, 0), false);
  assert.equal(canLowerPrice({ status: 'active', price: 1500 }, 999.5), false);
  assert.equal(canLowerPrice({ status: 'active', price: null }, 100), false);
  assert.equal(canLowerPrice({ status: 'sold', price: 1500 }, 1200), false);
});

test('price drop badge lasts 7 days', () => {
  const listing = { price: 1200, previousPrice: 1500, priceDroppedAt: NOW.toISOString() };
  assert.equal(priceDropActive(listing, NOW), true);
  assert.equal(priceDropActive(listing, at(7 * DAY - 1)), true);
  assert.equal(priceDropActive(listing, at(7 * DAY)), false);
  assert.equal(priceDropActive({ ...listing, previousPrice: 1000 }, NOW), false);
  assert.equal(priceDropActive({ ...listing, priceDroppedAt: null }, NOW), false);
});

test('duplicate titles ignore case, spacing and punctuation', () => {
  const mine = ['Study table, barely used', 'Cycle - Hero Sprint'];
  assert.equal(isDuplicateTitle('study table barely used', mine), true);
  assert.equal(isDuplicateTitle('  CYCLE   hero sprint!! ', mine), true);
  assert.equal(isDuplicateTitle('Study table and chair', mine), false);
  assert.equal(isDuplicateTitle('!!!', ['???']), false);
});

test('number plates', () => {
  assert.deepEqual(plateState('ka-01 ab 1234'), { status: 'valid', normalized: 'KA01AB1234', formatted: 'KA 01 AB 1234', region: 'KA' });
  assert.equal(plateState('MH12DE1433').status, 'valid');
  assert.deepEqual(plateState('22 BH 1234 AA'), { status: 'valid', normalized: '22BH1234AA', formatted: '22 BH 1234 AA', region: 'BH' });
  assert.deepEqual(plateState(''), { status: 'empty' });
  assert.deepEqual(plateState(null), { status: 'empty' });
  assert.deepEqual(plateState('hello'), { status: 'invalid' });
  assert.deepEqual(plateState('KA00AB1234'), { status: 'invalid' });
  assert.deepEqual(plateState('KA01AB0000'), { status: 'invalid' });
});

test('document validity', () => {
  assert.equal(documentValidity(iso(-1), NOW), 'expired');
  assert.equal(documentValidity(iso(0), NOW), 'expiring');
  assert.equal(documentValidity(iso(30 * DAY - 1), NOW), 'expiring');
  assert.equal(documentValidity(iso(30 * DAY), NOW), 'valid');
  // Date-only: valid through the end of that IST day.
  assert.equal(documentValidity('2026-11-07', NOW), 'expiring');
  assert.equal(documentValidity('2026-11-06', NOW), 'expired');
  assert.equal(documentValidity('2027-01-01', NOW), 'valid');
});
