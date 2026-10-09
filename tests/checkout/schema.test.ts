import test from 'node:test';
import assert from 'node:assert/strict';
import { CheckoutQuoteSchema, FinalizeOrderSchema, normalizeQuoteInput } from '../../src/lib/checkout/schema.ts';

const validQuote = {
  shopId: 'shop_123',
  totalPages: 10,
  jobType: 'PDF',
  printSettings: { paperSize: 'A4', printFormat: 'Single-Sided', printColor: 'Black & White', orientation: 'Vertical', copies: 1 },
  files: { filePath: 'uploads/user/file.pdf', fileName: 'file.pdf' },
};

test('checkout quote rejects client values outside production bounds', () => {
  assert.equal(CheckoutQuoteSchema.safeParse(validQuote).success, true);
  assert.equal(CheckoutQuoteSchema.safeParse({ ...validQuote, totalPages: 5001 }).success, false);
  assert.equal(CheckoutQuoteSchema.safeParse({ ...validQuote, printSettings: { ...validQuote.printSettings, copies: 51 } }).success, false);
  assert.equal(CheckoutQuoteSchema.safeParse({ ...validQuote, printSettings: { ...validQuote.printSettings, extraColorPages: 11 } }).success, false);
});

test('checkout quote requires the uploaded files to be priced', () => {
  const { files, ...withoutFiles } = validQuote;
  assert.equal(CheckoutQuoteSchema.safeParse(withoutFiles).success, false);
});

test('order finalization requires payment identity and ignores client file paths', () => {
  assert.equal(FinalizeOrderSchema.safeParse({ razorpayOrderId: 'order_1', razorpayPaymentId: 'pay_1' }).success, true);
  assert.equal(FinalizeOrderSchema.safeParse({ filePath: 'https://attacker.example/file.pdf', fileName: 'file.pdf' }).success, false);
  const parsed = FinalizeOrderSchema.parse({ razorpayOrderId: 'order_1', razorpayPaymentId: 'pay_1', filePath: 'uploads/other/file.pdf' });
  assert.equal('filePath' in parsed, false);
});

test('colour surcharges are derived from assignment pages, not client counts', () => {
  const quote = CheckoutQuoteSchema.parse({ ...validQuote, printSettings: { ...validQuote.printSettings, extraColorPages: 9 } });
  assert.equal(normalizeQuoteInput(quote).printSettings.extraColorPages, 0);
  const assignment = CheckoutQuoteSchema.parse({ ...validQuote, jobType: 'Assignment', assignment: { colorPages: [2, 2, 5] }, printSettings: { ...validQuote.printSettings, extraColorPages: 0 } });
  const normalized = normalizeQuoteInput(assignment);
  assert.equal(normalized.printSettings.extraColorPages, 2);
  assert.deepEqual(normalized.assignment?.colorPages, [2, 5]);
});

