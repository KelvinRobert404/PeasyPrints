import assert from 'node:assert/strict';
import test from 'node:test';
import { canExposeApprovedContact, canPromote, canReadAudience, formatCampusSerial, orderCampusItems } from '../../src/lib/campus/policy.ts';

test('KJU serial namespaces contain all 10,000 unique four-digit values', () => {
  const marketplace = new Set(Array.from({ length: 10_000 }, (_, value) => formatCampusSerial('KJU', 'M', value)));
  const housing = new Set(Array.from({ length: 10_000 }, (_, value) => formatCampusSerial('KJU', 'H', value)));
  assert.equal(marketplace.size, 10_000);
  assert.equal(housing.size, 10_000);
  assert.ok(marketplace.has('KJU-M0000'));
  assert.ok(marketplace.has('KJU-M4827'));
  assert.ok(housing.has('KJU-H6152'));
});

test('Girls’ Space audience cannot leak into campus requests or promotion', () => {
  assert.equal(canReadAudience('girls', 'campus', true), false);
  assert.equal(canReadAudience('girls', 'girls', false), false);
  assert.equal(canReadAudience('girls', 'girls', true), true);
  assert.equal(canPromote({ audience: 'girls', promotionEligible: true, status: 'active', availabilityExpiresAt: '2099-01-01T00:00:00.000Z' }), false);
});

test('own-college ordering is deterministic with serial and UUID tie-breakers', () => {
  const items = [
    { id: 'b', serial: 'ABC-M0002', collegeId: 'abc', createdAt: '2026-08-30T00:00:00.000Z' },
    { id: 'a', serial: 'KJU-M0002', collegeId: 'kju', createdAt: '2026-08-30T00:00:00.000Z' },
    { id: 'c', serial: 'KJU-M0001', collegeId: 'kju', createdAt: '2026-08-30T00:00:00.000Z' },
  ];
  assert.deepEqual(orderCampusItems(items, 'kju').map((item) => item.id), ['c', 'a', 'b']);
});

test('approved contact is exposed only to its buyer while both request and post remain active', () => {
  const request = { status: 'approved', buyerId: 'buyer-a', expiresAt: '2099-01-01T00:00:00.000Z' };
  assert.equal(canExposeApprovedContact(request, 'buyer-a', true), true);
  assert.equal(canExposeApprovedContact(request, 'buyer-b', true), false);
  assert.equal(canExposeApprovedContact(request, 'buyer-a', false), false);
  assert.equal(canExposeApprovedContact({ ...request, expiresAt: '2020-01-01T00:00:00.000Z' }, 'buyer-a', true), false);
});
