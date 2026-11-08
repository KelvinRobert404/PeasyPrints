// Print order progress in the demo: moves the visitor's orders along on the
// server clock, so the pickup screens play out. Called on each world access,
// at most every 2 s per world (see world.ts).
//
// Only orders paid in the demo move: their ids start with 'order_demo_' (the
// Razorpay stand-in's order ids, which /api/orders/create reuses). Seeded
// sample orders keep the state the seed gave them.
//
// Rules: work only inside this call (no timers), write through `world.db`, and
// never call `world.db.runTransaction` here, since the caller may already be
// inside one.
//
// Server only. Node tests import it, so runtime imports are relative.

import { Timestamp } from 'firebase-admin/firestore';
import type { DemoWorld } from './world.ts';

/** Razorpay stand-in order ids, and so the ids of orders paid in the demo. */
export const DEMO_ORDER_ID_PREFIX = 'order_demo_';
/** From payment to 'printing'. */
export const PRINTING_AFTER_MS = 15_000;
/** From payment to 'printed' (ready to collect). */
export const PRINTED_AFTER_MS = 45_000;

export type ProgressStatus = 'processing' | 'printing' | 'printed';

export interface OrderStep {
  status: 'printing' | 'printed';
  /** Epoch ms the order reached 'printing'. */
  printingAt: number;
  /** Epoch ms the order reached 'printed', when it has. */
  printedAt?: number;
}

export function isDemoOrderId(id: string): boolean {
  return id.startsWith(DEMO_ORDER_ID_PREFIX);
}

/** Epoch ms from a Firestore Timestamp, a Date, a number or an ISO string; null when unreadable. */
export function toMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === 'object' && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    const ms = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/** Where an order placed at `placedMs` should be at `nowMs`, or null when it stays put. */
export function nextOrderStep(status: string, placedMs: number, nowMs: number): OrderStep | null {
  const elapsed = nowMs - placedMs;
  const printingAt = placedMs + PRINTING_AFTER_MS;
  const printedAt = placedMs + PRINTED_AFTER_MS;
  if (status === 'processing') {
    if (elapsed >= PRINTED_AFTER_MS) return { status: 'printed', printingAt, printedAt };
    if (elapsed >= PRINTING_AFTER_MS) return { status: 'printing', printingAt };
    return null;
  }
  if (status === 'printing') {
    if (elapsed >= PRINTED_AFTER_MS) return { status: 'printed', printingAt, printedAt };
    return null;
  }
  return null;
}

export async function tickOrders(world: DemoWorld, nowMs: number): Promise<void> {
  const snapshot = await world.db.collection('orders').where('status', 'in', ['processing', 'printing']).get();
  for (const doc of snapshot.docs) {
    if (!isDemoOrderId(doc.id)) continue;
    const data = doc.data();
    const placedMs = toMillis(data.timestamp);
    if (placedMs === null) continue;
    const step = nextOrderStep(String(data.status), placedMs, nowMs);
    if (!step) continue;
    const fields: Record<string, unknown> = {
      status: step.status,
      updatedAt: Timestamp.fromMillis(nowMs),
    };
    // Keep a printingAt the shop already set; fill it in when the order skipped a tick.
    if (data.printingAt == null) fields.printingAt = Timestamp.fromMillis(Math.min(step.printingAt, nowMs));
    if (step.printedAt !== undefined) fields.printedAt = Timestamp.fromMillis(Math.min(step.printedAt, nowMs));
    await doc.ref.update(fields);
  }
}
