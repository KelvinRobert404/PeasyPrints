import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { Timestamp } from 'firebase-admin/firestore';
import { DEMO_VISITOR_COOKIE } from '../../src/lib/demo/contract.ts';
import Razorpay, {
  RAZORPAY_ORDERS_COLLECTION,
  RAZORPAY_PAYMENTS_COLLECTION,
  RazorpayDemoError,
  handlerResponseFor,
  payDemoOrder,
  paymentErrorFor,
  signPayment,
  signWebhookBody,
  validateWebhookSignature,
  webhookEventFor,
} from '../../src/lib/demo/shims/razorpay-server.ts';
import {
  DEMO_ORDER_ID_PREFIX,
  PRINTED_AFTER_MS,
  PRINTING_AFTER_MS,
  nextOrderStep,
  tickOrders,
} from '../../src/lib/demo/server/orderProgress.ts';
import { getWorld, resetWorldsForTests, setDemoCookieSourceForTests, setWorldHooksForTests } from '../../src/lib/demo/server/world.ts';
import { getAdminDb } from '../../src/lib/firebase/admin.ts';

type Env = Record<string, string | undefined>;

const DEMO_ENV: Env = { NEXT_PUBLIC_SWOOP_DEMO: '1', NEXT_PUBLIC_SWOOP_FIXTURES: undefined, NODE_ENV: 'development' };
const KEY_ID = 'demo_razorpay_key_id';
const KEY_SECRET = 'swoop-demo-razorpay-secret';
const SANA = 'verified-kju-main';

async function withEnv<T>(values: Env, run: () => Promise<T>): Promise<T> {
  const env = process.env as Env;
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  }
}

/** A fresh world for `visitor`, with the order ticks off so tests drive them. */
function freshVisitor(visitor: string): () => void {
  resetWorldsForTests();
  setDemoCookieSourceForTests(async () => ({ get: (name: string) => (name === DEMO_VISITOR_COOKIE ? { value: visitor } : undefined) }));
  const restore = setWorldHooksForTests({ tickOrders: () => {}, tickLife: () => {} });
  return () => {
    restore();
    setDemoCookieSourceForTests(null);
    resetWorldsForTests();
  };
}

test('orders.create stores a demo order in the visitor world', async () => {
  const done = freshVisitor('rzp-create');
  try {
    await withEnv(DEMO_ENV, async () => {
      const razorpay = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
      const order = await razorpay.orders.create({ amount: 1250, currency: 'INR', receipt: 'pp_test', notes: { userId: SANA, shopId: 'shop-main-block' } });
      assert.match(order.id, /^order_demo_[A-Za-z0-9]{14}$/);
      assert.equal(order.entity, 'order');
      assert.equal(order.amount, 1250);
      assert.equal(order.amount_due, 1250);
      assert.equal(order.currency, 'INR');
      assert.equal(order.status, 'created');
      assert.deepEqual(order.notes, { userId: SANA, shopId: 'shop-main-block' });

      // Kept in this visitor's world, where the browser cannot read it.
      const stored = await getWorld('rzp-create').db.collection(RAZORPAY_ORDERS_COLLECTION).doc(order.id).get();
      assert.equal(stored.exists, true);
      assert.equal(stored.data()?.amount, 1250);
      assert.deepEqual(await razorpay.orders.fetch(order.id), order);

      await assert.rejects(razorpay.orders.create({ amount: 50 }), (error: unknown) => error instanceof RazorpayDemoError && error.statusCode === 400);
      await assert.rejects(razorpay.orders.create({ amount: 1000, currency: 'USD' }), RazorpayDemoError);
    });
  } finally {
    done();
  }
});

test('a paid order gives a valid signature and a captured UPI payment', async () => {
  const done = freshVisitor('rzp-pay');
  try {
    await withEnv(DEMO_ENV, async () => {
      const razorpay = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
      const order = await razorpay.orders.create({ amount: 900, notes: { userId: SANA } });
      const db = getAdminDb();

      // Only the order's own student can pay it.
      await assert.rejects(payDemoOrder(db, { orderId: order.id, userId: 'verified-kju-airport' }), /does not exist/);

      const { payment, order: paid } = await payDemoOrder(db, { orderId: order.id, userId: SANA });
      assert.match(payment.id, /^pay_demo_[A-Za-z0-9]{14}$/);
      assert.equal(paid.status, 'paid');
      assert.equal(paid.amount_paid, 900);
      assert.equal(paid.attempts, 1);

      // The handler fields pass the same check /api/razorpay/verify makes.
      const handler = handlerResponseFor(payment, KEY_SECRET);
      assert.equal(handler.razorpay_order_id, order.id);
      assert.equal(handler.razorpay_payment_id, payment.id);
      const expected = createHmac('sha256', KEY_SECRET).update(`${order.id}|${payment.id}`).digest('hex');
      assert.equal(handler.razorpay_signature, expected);
      assert.equal(signPayment(order.id, payment.id, KEY_SECRET), expected);
      assert.notEqual(signPayment(order.id, payment.id, 'another-secret'), expected);

      const fetched = await razorpay.payments.fetch(payment.id);
      assert.equal(fetched.status, 'captured');
      assert.equal(fetched.captured, true);
      assert.equal(fetched.method, 'upi');
      assert.equal(fetched.order_id, order.id);
      assert.equal(fetched.amount, 900);
      assert.equal(fetched.currency, 'INR');
      assert.equal((await razorpay.orders.fetchPayments(order.id)).count, 1);

      // Captured already: capture refuses, as Razorpay does.
      await assert.rejects(razorpay.payments.capture(payment.id, 900, 'INR'), /already been captured/);
      // Paying twice is refused.
      await assert.rejects(payDemoOrder(db, { orderId: order.id, userId: SANA }), /already paid/);
      await assert.rejects(razorpay.payments.fetch('pay_demo_missing0000000'), /does not exist/);
      await assert.rejects(razorpay.payments.fetch('pay_real_123'), /does not exist/);

      // The webhook body is signed with the webhook secret and names the payment.
      const event = webhookEventFor(payment);
      assert.equal(event.event, 'payment.captured');
      assert.equal(event.payload.payment.entity.order_id, order.id);
      const body = JSON.stringify(event);
      const signature = signWebhookBody(body, 'swoop-demo-webhook-secret');
      assert.equal(signature, createHmac('sha256', 'swoop-demo-webhook-secret').update(body).digest('hex'));
      assert.equal(validateWebhookSignature(body, signature, 'swoop-demo-webhook-secret'), true);
      assert.equal(Razorpay.validateWebhookSignature(body, signature, 'wrong'), false);
    });
  } finally {
    done();
  }
});

test('a failed payment leaves the order open and is reported as payment.failed', async () => {
  const done = freshVisitor('rzp-fail');
  try {
    await withEnv(DEMO_ENV, async () => {
      const razorpay = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
      const order = await razorpay.orders.create({ amount: 400, notes: { userId: SANA } });
      const db = getAdminDb();
      const { payment, order: attempted } = await payDemoOrder(db, { orderId: order.id, userId: SANA, fail: true });
      assert.equal(payment.status, 'failed');
      assert.equal(payment.captured, false);
      assert.equal(attempted.status, 'attempted');
      assert.equal(attempted.amount_paid, 0);
      assert.equal(webhookEventFor(payment).event, 'payment.failed');
      const error = paymentErrorFor(payment);
      assert.equal(error.metadata.order_id, order.id);
      assert.equal(error.metadata.payment_id, payment.id);
      assert.equal((await razorpay.payments.fetch(payment.id)).status, 'failed');

      // A retry on the same order can still succeed.
      const retry = await payDemoOrder(db, { orderId: order.id, userId: SANA });
      assert.equal(retry.payment.status, 'captured');
      const payments = await getWorld('rzp-fail').db.collection(RAZORPAY_PAYMENTS_COLLECTION).where('order_id', '==', order.id).get();
      assert.equal(payments.size, 2);
    });
  } finally {
    done();
  }
});

test('the stand-in refuses anything outside the demo', async () => {
  const done = freshVisitor('rzp-guard');
  try {
    await withEnv(DEMO_ENV, async () => {
      assert.throws(() => new Razorpay({ key_secret: KEY_SECRET }), /key_id/);
      assert.throws(() => new Razorpay({ key_id: KEY_ID }), /key_secret/);
      const razorpay = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET }) as unknown as Record<string, Record<string, () => unknown>>;
      assert.throws(() => razorpay.refunds.create(), /^Error: Not in the demo: razorpay\.refunds\.create$/);
      assert.throws(() => razorpay.orders.edit(), /Not in the demo: razorpay\.orders\.edit/);
      assert.throws(() => razorpay.payments.refund(), /Not in the demo: razorpay\.payments\.refund/);
    });
    await withEnv({ NEXT_PUBLIC_SWOOP_DEMO: undefined }, async () => {
      assert.throws(() => new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET }), /Not in the demo: razorpay/);
    });
  } finally {
    done();
  }
});

test('nextOrderStep: processing, printing at 15 s, printed at 45 s', () => {
  const placed = 1_000_000;
  assert.equal(nextOrderStep('processing', placed, placed + PRINTING_AFTER_MS - 1), null);
  assert.deepEqual(nextOrderStep('processing', placed, placed + PRINTING_AFTER_MS), { status: 'printing', printingAt: placed + 15_000 });
  assert.equal(nextOrderStep('printing', placed, placed + PRINTED_AFTER_MS - 1), null);
  assert.deepEqual(nextOrderStep('printing', placed, placed + PRINTED_AFTER_MS), { status: 'printed', printingAt: placed + 15_000, printedAt: placed + 45_000 });
  // A missed tick jumps straight to ready.
  assert.equal(nextOrderStep('processing', placed, placed + 60_000)?.status, 'printed');
  assert.equal(nextOrderStep('printed', placed, placed + 60_000), null);
  assert.equal(nextOrderStep('collected', placed, placed + 60_000), null);
});

test('tickOrders moves demo-paid orders only, with the timestamps the UI reads', async () => {
  const done = freshVisitor('rzp-tick');
  try {
    const world = getWorld('rzp-tick');
    await world.ready;
    const placed = Date.now();
    const id = `${DEMO_ORDER_ID_PREFIX}TickTest000001`;
    await world.db.collection('orders').doc(id).create({ userId: SANA, status: 'processing', timestamp: new Date(placed) });
    const seeded = (await world.db.collection('orders').doc('order-sana-printing').get()).data();
    assert.equal(seeded?.status, 'printing');

    await tickOrders(world, placed + 5_000);
    assert.equal((await world.db.collection('orders').doc(id).get()).data()?.status, 'processing');

    await tickOrders(world, placed + 16_000);
    const printing = (await world.db.collection('orders').doc(id).get()).data();
    assert.equal(printing?.status, 'printing');
    assert.ok(printing?.printingAt instanceof Timestamp);
    assert.equal((printing?.printingAt as Timestamp).toMillis(), placed + PRINTING_AFTER_MS);
    assert.equal((printing?.updatedAt as Timestamp).toMillis(), placed + 16_000);

    await tickOrders(world, placed + 46_000);
    const printed = (await world.db.collection('orders').doc(id).get()).data();
    assert.equal(printed?.status, 'printed');
    assert.equal((printed?.printedAt as Timestamp).toMillis(), placed + PRINTED_AFTER_MS);
    assert.equal((printed?.printingAt as Timestamp).toMillis(), placed + PRINTING_AFTER_MS);

    // The seeded sample order keeps its state.
    assert.equal((await world.db.collection('orders').doc('order-sana-printing').get()).data()?.status, 'printing');
  } finally {
    done();
  }
});
