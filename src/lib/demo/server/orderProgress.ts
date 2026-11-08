// Print order progress in the demo: moves the visitor's orders along on the
// server clock, so the pickup screens play out. Called on each world access,
// at most every 2 s per world (see world.ts).
//
// Stub from WORLD; PRINTPAY fills it. Rules for the filled version: work only
// inside this call (no timers), write through `world.db`, and never call
// `world.db.runTransaction` here, since the caller may already be inside one.

import type { DemoWorld } from './world.ts';

export function tickOrders(world: DemoWorld, nowMs: number): void | Promise<void> {
  void world;
  void nowMs;
}
