import test from 'node:test';
import assert from 'node:assert/strict';
import { canApplyOrderAction, isOrderActionAlreadyApplied } from '../../src/lib/orders/lifecycle.ts';

test('order lifecycle accepts only explicit forward and recovery transitions', () => {
  assert.equal(canApplyOrderAction('processing', 'printing'), true);
  assert.equal(canApplyOrderAction('printing', 'printed'), true);
  assert.equal(canApplyOrderAction('printed', 'complete'), true);
  assert.equal(canApplyOrderAction('processing', 'complete'), false);
  assert.equal(canApplyOrderAction('cancelled', 'undo_cancel'), true);
  assert.equal(canApplyOrderAction('completed', 'undo_complete'), true);
});

test('completion and cancellation retries are idempotent', () => {
  assert.equal(isOrderActionAlreadyApplied('completed', 'complete'), true);
  assert.equal(isOrderActionAlreadyApplied('cancelled', 'cancel'), true);
  assert.equal(isOrderActionAlreadyApplied('completed', 'cancel'), false);
});

