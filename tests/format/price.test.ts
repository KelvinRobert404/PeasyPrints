import assert from 'node:assert/strict';
import test from 'node:test';
import { fairPassPrice, formatPrice, formatPrintPrice, isPriceDrop, parsePriceInput, parsePriceQuery } from '../../src/lib/format/price.ts';

test('formatPrice shows rupees under 1,000', () => {
  assert.equal(formatPrice(650), 'Rs 650');
  assert.equal(formatPrice(1), 'Rs 1');
  assert.equal(formatPrice(999), 'Rs 999');
  assert.equal(formatPrice(649.6), 'Rs 650');
});

test('formatPrice shows k with one decimal and no trailing .0', () => {
  assert.equal(formatPrice(1000), 'Rs 1k');
  assert.equal(formatPrice(1500), 'Rs 1.5k');
  assert.equal(formatPrice(12000), 'Rs 12k');
  assert.equal(formatPrice(12345), 'Rs 12.3k');
  assert.equal(formatPrice(8500), 'Rs 8.5k');
  assert.equal(formatPrice(99_999), 'Rs 1L');
});

test('formatPrice shows L from 1,00,000', () => {
  assert.equal(formatPrice(1_00_000), 'Rs 1L');
  assert.equal(formatPrice(1_20_000), 'Rs 1.2L');
  assert.equal(formatPrice(2_50_000), 'Rs 2.5L');
});

test('formatPrice puts the suffix after a space', () => {
  assert.equal(formatPrice(8500, 'pp'), 'Rs 8.5k pp');
  assert.equal(formatPrice(1_20_000, 'dep'), 'Rs 1.2L dep');
  assert.equal(formatPrice(6000, '/mo'), 'Rs 6k /mo');
});

test('formatPrice gives Free for 0 and bad input', () => {
  assert.equal(formatPrice(0), 'Free');
  assert.equal(formatPrice(0, 'pp'), 'Free');
  assert.equal(formatPrice(-5), 'Free');
  assert.equal(formatPrice(Number.NaN), 'Free');
});

test('formatPrice never uses the rupee sign', () => {
  for (const n of [5, 650, 1500, 99_999, 1_20_000]) assert.ok(!formatPrice(n).includes('₹'));
});

test('parsePriceInput reads every brief example', () => {
  assert.equal(parsePriceInput('1.5k'), 1500);
  assert.equal(parsePriceInput('1L'), 1_00_000);
  assert.equal(parsePriceInput('1.2 lakh'), 1_20_000);
  assert.equal(parsePriceInput('12,000'), 12_000);
  assert.equal(parsePriceInput('Rs 8.5k'), 8500);
  assert.equal(parsePriceInput('₹900'), 900);
});

test('parsePriceInput reads common variants', () => {
  assert.equal(parsePriceInput('650'), 650);
  assert.equal(parsePriceInput(' 1,20,000 '), 1_20_000);
  assert.equal(parsePriceInput('rs. 500/-'), 500);
  assert.equal(parsePriceInput('2 lakhs'), 2_00_000);
  assert.equal(parsePriceInput('1.5K'), 1500);
  assert.equal(parsePriceInput('0'), 0);
});

test('parsePriceInput rejects anything else', () => {
  for (const bad of ['', '   ', 'abc', 'k', 'Rs', '-500', '1.5m', '12 k pp', '1..5k', 'Rs 5k and more']) {
    assert.equal(parsePriceInput(bad), null, bad);
  }
});

test('parsePriceQuery takes a max price', () => {
  assert.deepEqual(parsePriceQuery('cycle under 12k'), { max: 12_000, rest: 'cycle' });
  assert.deepEqual(parsePriceQuery('fan below 800'), { max: 800, rest: 'fan' });
  assert.deepEqual(parsePriceQuery('room upto 8.5k'), { max: 8500, rest: 'room' });
  assert.deepEqual(parsePriceQuery('room up to 8.5k'), { max: 8500, rest: 'room' });
  assert.deepEqual(parsePriceQuery('pg within 1.2 lakh'), { max: 1_20_000, rest: 'pg' });
  assert.deepEqual(parsePriceQuery('books < 500'), { max: 500, rest: 'books' });
  assert.deepEqual(parsePriceQuery('books <500'), { max: 500, rest: 'books' });
  assert.deepEqual(parsePriceQuery('laptop max Rs 30k'), { max: 30_000, rest: 'laptop' });
  assert.deepEqual(parsePriceQuery('Under ₹900 lamp'), { max: 900, rest: 'lamp' });
});

test('parsePriceQuery takes a min price', () => {
  assert.deepEqual(parsePriceQuery('room above 5k'), { min: 5000, rest: 'room' });
  assert.deepEqual(parsePriceQuery('guitar over 2,000'), { min: 2000, rest: 'guitar' });
});

test('parsePriceQuery takes both limits', () => {
  assert.deepEqual(parsePriceQuery('room above 5k under 9k near gate'), { min: 5000, max: 9000, rest: 'room near gate' });
});

test('parsePriceQuery leaves text without a price alone', () => {
  assert.deepEqual(parsePriceQuery('under bed storage'), { rest: 'under bed storage' });
  assert.deepEqual(parsePriceQuery('dumbbells under 12kg'), { rest: 'dumbbells under 12kg' });
  assert.deepEqual(parsePriceQuery('overcoat 500'), { rest: 'overcoat 500' });
  assert.deepEqual(parsePriceQuery('  desk   lamp '), { rest: 'desk lamp' });
  assert.deepEqual(parsePriceQuery(''), { rest: '' });
});

test('parsePriceQuery keeps the word after a bare number', () => {
  assert.deepEqual(parsePriceQuery('under 500 laptops'), { max: 500, rest: 'laptops' });
});

const NOV_1 = '2026-11-01T00:00:00.000Z';
const DEC_1 = '2026-12-01T00:00:00.000Z';

test('fairPassPrice: 12 of 30 days left at Rs 3000 is Rs 1200', () => {
  assert.equal(fairPassPrice({ paid: 3000, validFrom: NOV_1, validUntil: DEC_1, now: '2026-11-19T00:00:00.000Z' }), 1200);
});

test('fairPassPrice takes Date and number inputs', () => {
  assert.equal(
    fairPassPrice({ paid: 3000, validFrom: new Date(NOV_1), validUntil: Date.parse(DEC_1), now: new Date('2026-11-19T00:00:00.000Z') }),
    1200,
  );
});

test('fairPassPrice counts a part day left as a whole day', () => {
  assert.equal(fairPassPrice({ paid: 3000, validFrom: NOV_1, validUntil: DEC_1, now: '2026-11-19T15:00:00.000Z' }), 1200);
});

test('fairPassPrice is the full price before the pass starts', () => {
  assert.equal(fairPassPrice({ paid: 3000, validFrom: NOV_1, validUntil: DEC_1, now: '2026-10-20T00:00:00.000Z' }), 3000);
});

test('fairPassPrice goes down to Rs 10, not below', () => {
  assert.equal(fairPassPrice({ paid: 200, validFrom: NOV_1, validUntil: DEC_1, now: '2026-11-30T12:00:00.000Z' }), 10);
  assert.equal(fairPassPrice({ paid: 6, validFrom: NOV_1, validUntil: DEC_1, now: '2026-11-30T12:00:00.000Z' }), 6);
});

test('fairPassPrice is 0 for an expired or broken pass', () => {
  assert.equal(fairPassPrice({ paid: 3000, validFrom: NOV_1, validUntil: DEC_1, now: DEC_1 }), 0);
  assert.equal(fairPassPrice({ paid: 3000, validFrom: NOV_1, validUntil: DEC_1, now: '2027-01-01T00:00:00.000Z' }), 0);
  assert.equal(fairPassPrice({ paid: 3000, validFrom: DEC_1, validUntil: NOV_1, now: NOV_1 }), 0);
  assert.equal(fairPassPrice({ paid: 3000, validFrom: 'nope', validUntil: DEC_1, now: NOV_1 }), 0);
  assert.equal(fairPassPrice({ paid: 0, validFrom: NOV_1, validUntil: DEC_1, now: NOV_1 }), 0);
});

test('isPriceDrop is true only for a strictly lower price', () => {
  assert.equal(isPriceDrop(1500, 1200), true);
  assert.equal(isPriceDrop(1500, 1500), false);
  assert.equal(isPriceDrop(1200, 1500), false);
  assert.equal(isPriceDrop(undefined, 1200), false);
  assert.equal(isPriceDrop(null, 1200), false);
  assert.equal(isPriceDrop(1500, Number.NaN), false);
});

test('formatPrintPrice keeps paise and drops trailing zeros', () => {
  assert.equal(formatPrintPrice(1.5), 'Rs 1.5');
  assert.equal(formatPrintPrice(1.50), 'Rs 1.5');
  assert.equal(formatPrintPrice(12.25), 'Rs 12.25');
  assert.equal(formatPrintPrice(40), 'Rs 40');
  assert.equal(formatPrintPrice(0.1 + 0.2), 'Rs 0.3');
});

test('formatPrintPrice never shortens to k or L', () => {
  assert.equal(formatPrintPrice(1250), 'Rs 1250');
  assert.equal(formatPrintPrice(1_20_000.5), 'Rs 120000.5');
});

test('formatPrintPrice shows zero, discounts and bad input', () => {
  assert.equal(formatPrintPrice(0), 'Rs 0');
  assert.equal(formatPrintPrice(-0.001), 'Rs 0');
  assert.equal(formatPrintPrice(-5.5), '-Rs 5.5');
  assert.equal(formatPrintPrice(Number.NaN), 'Rs 0');
  assert.equal(formatPrintPrice(Number.POSITIVE_INFINITY), 'Rs 0');
});

test('formatPrintPrice never uses the rupee sign', () => {
  for (const n of [1.5, 40, 1250, -3]) assert.ok(!formatPrintPrice(n).includes('₹'));
});
