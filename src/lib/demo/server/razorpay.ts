// Demo Razorpay: the store, signing and payment helpers behind the `razorpay`
// stand-in (src/lib/demo/shims/razorpay-server.ts) and /api/demo/razorpay/pay.
// Kept out of the shims folder so the pay route never pulls a stand-in into
// a production build.
//
//
// The real routes (/api/razorpay/order, /api/razorpay/verify) run unchanged:
// `new Razorpay({ key_id, key_secret })` gives orders.create, orders.fetch,
// payments.fetch and payments.capture, all kept in the visitor's own world
// (collections '_razorpay_orders' and '_razorpay_payments', which the browser
// cannot read). /api/demo/razorpay/pay plays Razorpay's servers with the
// helpers below: it records the payment, signs it and sends the webhook.
//
// Anything else on the SDK throws 'Not in the demo: razorpay.<name>'.
// Server only. Node tests import it, so runtime imports are relative.

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from '../../firebase/admin.ts';
import { isDemoMode } from '../mode.ts';
import { DEMO_ORDER_ID_PREFIX } from './orderProgress.ts';

export const DEMO_PAYMENT_ID_PREFIX = 'pay_demo_';
export const DEMO_EVENT_ID_PREFIX = 'evt_demo_';
export const RAZORPAY_ORDERS_COLLECTION = '_razorpay_orders';
export const RAZORPAY_PAYMENTS_COLLECTION = '_razorpay_payments';
/** Razorpay's smallest order: Rs 1, in paise. */
export const MIN_ORDER_AMOUNT = 100;
/** The UPI id on every demo payment. Sample data. */
export const DEMO_VPA = 'student@demo';

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 14;
const ID_PATTERN = /^[A-Za-z0-9_]{1,64}$/;

// ---------------------------------------------------------------------------
// Entities (the fields Razorpay returns that the app reads, plus the usual ones)

export type DemoOrderStatus = 'created' | 'attempted' | 'paid';
export type DemoPaymentStatus = 'authorized' | 'captured' | 'failed';
export type Notes = Record<string, string | number>;

export interface DemoRazorpayOrder {
  id: string;
  entity: 'order';
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string | null;
  offer_id: null;
  status: DemoOrderStatus;
  attempts: number;
  notes: Notes;
  created_at: number;
}

export interface DemoRazorpayPayment {
  id: string;
  entity: 'payment';
  amount: number;
  currency: string;
  status: DemoPaymentStatus;
  order_id: string;
  invoice_id: null;
  international: false;
  method: 'upi';
  amount_refunded: 0;
  refund_status: null;
  captured: boolean;
  description: string | null;
  card_id: null;
  bank: null;
  wallet: null;
  vpa: string;
  email: string;
  contact: string;
  notes: Notes;
  fee: number | null;
  tax: number | null;
  error_code: string | null;
  error_description: string | null;
  error_source: string | null;
  error_step: string | null;
  error_reason: string | null;
  acquirer_data: Record<string, string>;
  created_at: number;
}

export interface DemoOrderCreateParams {
  amount: number | string;
  currency?: string;
  receipt?: string;
  notes?: Notes;
}

/** The fields Checkout hands to `handler` after a successful payment. */
export interface DemoHandlerResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/** The `error` Checkout passes to `payment.failed` listeners. */
export interface DemoPaymentError {
  code: string;
  description: string;
  source: string;
  step: string;
  reason: string;
  metadata: { order_id: string; payment_id: string };
}

export interface DemoWebhookEvent {
  entity: 'event';
  account_id: string;
  event: 'payment.captured' | 'payment.failed';
  contains: ['payment'];
  payload: { payment: { entity: DemoRazorpayPayment } };
  created_at: number;
}

// ---------------------------------------------------------------------------
// Errors, shaped like the SDK's rejections ({ statusCode, error: { code, description } })

export class RazorpayDemoError extends Error {
  readonly statusCode: number;
  readonly error: { code: string; description: string; field?: string };

  constructor(statusCode: number, description: string, field?: string) {
    super(description);
    this.name = 'RazorpayDemoError';
    this.statusCode = statusCode;
    this.error = { code: 'BAD_REQUEST_ERROR', description, ...(field ? { field } : {}) };
  }
}

export function notInDemo(name: string): Error {
  return new Error(`Not in the demo: ${name}`);
}

// ---------------------------------------------------------------------------
// Ids and signatures

export function demoRazorpayId(prefix: string): string {
  let id = prefix;
  for (let index = 0; index < ID_LENGTH; index += 1) id += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
  return id;
}

function hmacHex(secret: string, text: string): string {
  return createHmac('sha256', secret).update(text).digest('hex');
}

function sameHex(a: string, b: string): boolean {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b)) return false;
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Checkout's razorpay_signature: HMAC-SHA256 of `order_id|payment_id` with the key secret. */
export function signPayment(orderId: string, paymentId: string, keySecret: string): string {
  return hmacHex(keySecret, `${orderId}|${paymentId}`);
}

/** The x-razorpay-signature header: HMAC-SHA256 of the raw body with the webhook secret. */
export function signWebhookBody(body: string, webhookSecret: string): string {
  return hmacHex(webhookSecret, body);
}

export function validateWebhookSignature(body: string, signature: string, secret: string): boolean {
  return sameHex(signature, signWebhookBody(body, secret));
}

// ---------------------------------------------------------------------------
// Store: the visitor's world

function nowSeconds(nowMs: number): number {
  return Math.floor(nowMs / 1000);
}

function checkId(id: unknown, prefix: string, field: string): string {
  if (typeof id !== 'string' || !ID_PATTERN.test(id) || !id.startsWith(prefix)) {
    throw new RazorpayDemoError(400, 'The id provided does not exist', field);
  }
  return id;
}

function cleanNotes(notes: unknown): Notes {
  if (!notes || typeof notes !== 'object' || Array.isArray(notes)) return {};
  const out: Notes = {};
  for (const [key, value] of Object.entries(notes as Record<string, unknown>).slice(0, 15)) {
    if (typeof value === 'string' || typeof value === 'number') out[key] = value;
  }
  return out;
}

export async function createDemoOrder(db: Firestore, params: DemoOrderCreateParams, nowMs: number = Date.now()): Promise<DemoRazorpayOrder> {
  if (!params || typeof params !== 'object') throw new RazorpayDemoError(400, 'The amount field is required.', 'amount');
  const amount = Number(params.amount);
  if (!Number.isInteger(amount) || amount < MIN_ORDER_AMOUNT) {
    throw new RazorpayDemoError(400, 'Order amount less than minimum amount allowed', 'amount');
  }
  const currency = params.currency ?? 'INR';
  if (currency !== 'INR') throw new RazorpayDemoError(400, 'The demo takes INR only.', 'currency');
  const order: DemoRazorpayOrder = {
    id: demoRazorpayId(DEMO_ORDER_ID_PREFIX),
    entity: 'order',
    amount,
    amount_paid: 0,
    amount_due: amount,
    currency,
    receipt: typeof params.receipt === 'string' ? params.receipt.slice(0, 40) : null,
    offer_id: null,
    status: 'created',
    attempts: 0,
    notes: cleanNotes(params.notes),
    created_at: nowSeconds(nowMs),
  };
  await db.collection(RAZORPAY_ORDERS_COLLECTION).doc(order.id).create({ ...order });
  return order;
}

export async function fetchDemoOrder(db: Firestore, orderId: string): Promise<DemoRazorpayOrder> {
  const id = checkId(orderId, DEMO_ORDER_ID_PREFIX, 'id');
  const snap = await db.collection(RAZORPAY_ORDERS_COLLECTION).doc(id).get();
  if (!snap.exists) throw new RazorpayDemoError(400, 'The id provided does not exist', 'id');
  return snap.data() as DemoRazorpayOrder;
}

export async function fetchDemoPayment(db: Firestore, paymentId: string): Promise<DemoRazorpayPayment> {
  const id = checkId(paymentId, DEMO_PAYMENT_ID_PREFIX, 'id');
  const snap = await db.collection(RAZORPAY_PAYMENTS_COLLECTION).doc(id).get();
  if (!snap.exists) throw new RazorpayDemoError(400, 'The id provided does not exist', 'id');
  return snap.data() as DemoRazorpayPayment;
}

export async function fetchDemoOrderPayments(db: Firestore, orderId: string): Promise<{ entity: 'collection'; count: number; items: DemoRazorpayPayment[] }> {
  const id = checkId(orderId, DEMO_ORDER_ID_PREFIX, 'id');
  const snap = await db.collection(RAZORPAY_PAYMENTS_COLLECTION).where('order_id', '==', id).get();
  const items = snap.docs.map((doc) => doc.data() as DemoRazorpayPayment).sort((a, b) => a.created_at - b.created_at);
  return { entity: 'collection', count: items.length, items };
}

export async function captureDemoPayment(db: Firestore, paymentId: string, amount: number | string, currency?: string): Promise<DemoRazorpayPayment> {
  const id = checkId(paymentId, DEMO_PAYMENT_ID_PREFIX, 'id');
  const ref = db.collection(RAZORPAY_PAYMENTS_COLLECTION).doc(id);
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new RazorpayDemoError(400, 'The id provided does not exist', 'id');
    const payment = snap.data() as DemoRazorpayPayment;
    if (payment.status === 'captured') throw new RazorpayDemoError(400, 'This payment has already been captured');
    if (payment.status !== 'authorized') throw new RazorpayDemoError(400, 'Only payments which have been authorized and not yet captured can be captured');
    if (Number(amount) !== payment.amount) throw new RazorpayDemoError(400, 'Capture amount must be equal to the amount authorized', 'amount');
    if (currency !== undefined && currency !== payment.currency) throw new RazorpayDemoError(400, 'Currency does not match the payment', 'currency');
    const captured: DemoRazorpayPayment = { ...payment, status: 'captured', captured: true };
    transaction.set(ref, { ...captured });
    return captured;
  });
}

export interface PayDemoOrderInput {
  orderId: string;
  /** When set, only this user's orders (notes.userId) can be paid. */
  userId?: string;
  /** Simulate a declined payment. */
  fail?: boolean;
  nowMs?: number;
}

/**
 * Razorpay's side of Checkout: records a UPI payment on the order, captured at
 * once (auto-capture) or failed. A paid order cannot be paid again.
 */
export async function payDemoOrder(db: Firestore, input: PayDemoOrderInput): Promise<{ order: DemoRazorpayOrder; payment: DemoRazorpayPayment }> {
  const orderId = checkId(input.orderId, DEMO_ORDER_ID_PREFIX, 'order_id');
  const nowMs = input.nowMs ?? Date.now();
  const orderRef = db.collection(RAZORPAY_ORDERS_COLLECTION).doc(orderId);
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(orderRef);
    const order = snap.exists ? (snap.data() as DemoRazorpayOrder) : null;
    if (!order || (input.userId !== undefined && order.notes?.userId !== input.userId)) {
      throw new RazorpayDemoError(400, 'The id provided does not exist', 'order_id');
    }
    if (order.status === 'paid') throw new RazorpayDemoError(400, 'This order is already paid');

    const failed = Boolean(input.fail);
    const payment: DemoRazorpayPayment = {
      id: demoRazorpayId(DEMO_PAYMENT_ID_PREFIX),
      entity: 'payment',
      amount: order.amount,
      currency: order.currency,
      status: failed ? 'failed' : 'captured',
      order_id: order.id,
      invoice_id: null,
      international: false,
      method: 'upi',
      amount_refunded: 0,
      refund_status: null,
      captured: !failed,
      description: null,
      card_id: null,
      bank: null,
      wallet: null,
      vpa: DEMO_VPA,
      email: '',
      contact: '',
      notes: { ...order.notes },
      fee: failed ? null : 0,
      tax: failed ? null : 0,
      error_code: failed ? 'BAD_REQUEST_ERROR' : null,
      error_description: failed ? 'Payment failed. This was a demo failure.' : null,
      error_source: failed ? 'customer' : null,
      error_step: failed ? 'payment_authorization' : null,
      error_reason: failed ? 'payment_failed' : null,
      acquirer_data: failed ? {} : { rrn: String(randomInt(100_000_000, 999_999_999)) },
      created_at: nowSeconds(nowMs),
    };
    const nextOrder: DemoRazorpayOrder = {
      ...order,
      attempts: order.attempts + 1,
      status: failed ? 'attempted' : 'paid',
      amount_paid: failed ? order.amount_paid : order.amount,
      amount_due: failed ? order.amount_due : 0,
    };
    transaction.create(db.collection(RAZORPAY_PAYMENTS_COLLECTION).doc(payment.id), { ...payment });
    transaction.set(orderRef, { ...nextOrder });
    return { order: nextOrder, payment };
  });
}

/** The webhook Razorpay sends for this payment. */
export function webhookEventFor(payment: DemoRazorpayPayment, nowMs: number = Date.now()): DemoWebhookEvent {
  return {
    entity: 'event',
    account_id: 'acc_demo',
    event: payment.status === 'failed' ? 'payment.failed' : 'payment.captured',
    contains: ['payment'],
    payload: { payment: { entity: payment } },
    created_at: nowSeconds(nowMs),
  };
}

/** Checkout's handler fields for a captured payment. */
export function handlerResponseFor(payment: DemoRazorpayPayment, keySecret: string): DemoHandlerResponse {
  return {
    razorpay_payment_id: payment.id,
    razorpay_order_id: payment.order_id,
    razorpay_signature: signPayment(payment.order_id, payment.id, keySecret),
  };
}

/** The error Checkout passes to payment.failed listeners. */
export function paymentErrorFor(payment: DemoRazorpayPayment): DemoPaymentError {
  return {
    code: payment.error_code ?? 'BAD_REQUEST_ERROR',
    description: payment.error_description ?? 'Payment failed',
    source: payment.error_source ?? 'customer',
    step: payment.error_step ?? 'payment_authorization',
    reason: payment.error_reason ?? 'payment_failed',
    metadata: { order_id: payment.order_id, payment_id: payment.id },
  };
}
