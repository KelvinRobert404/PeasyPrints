import test from 'node:test';
import assert from 'node:assert/strict';
import { CheckoutQuoteSchema, FinalizeOrderSchema } from '../../src/lib/checkout/schema.ts';

const validQuote = {
  shopId: 'shop_123',
  totalPages: 10,
  jobType: 'PDF',
  printSettings: { paperSize: 'A4', printFormat: 'Single-Sided', printColor: 'Black & White', orientation: 'Vertical', copies: 1 },
};

test('checkout quote rejects client values outside production bounds', () => {
  assert.equal(CheckoutQuoteSchema.safeParse(validQuote).success, true);
  assert.equal(CheckoutQuoteSchema.safeParse({ ...validQuote, totalPages: 5001 }).success, false);
  assert.equal(CheckoutQuoteSchema.safeParse({ ...validQuote, printSettings: { ...validQuote.printSettings, copies: 51 } }).success, false);
  assert.equal(CheckoutQuoteSchema.safeParse({ ...validQuote, printSettings: { ...validQuote.printSettings, extraColorPages: 11 } }).success, false);
});

test('order finalization requires payment identity and private upload paths', () => {
  assert.equal(FinalizeOrderSchema.safeParse({ razorpayOrderId: 'order_1', razorpayPaymentId: 'pay_1', filePath: 'uploads/user/file.pdf', fileName: 'file.pdf' }).success, true);
  assert.equal(FinalizeOrderSchema.safeParse({ filePath: 'https://attacker.example/file.pdf', fileName: 'file.pdf' }).success, false);
});

