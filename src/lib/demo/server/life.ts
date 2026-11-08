// Demo life: the sample students on the other side answer the visitor
// (approve asks, ask on new posts, join games). Called on each world access,
// at most every 2 s per world (see world.ts).
//
// Stub from WORLD; LIFE fills it. Rules for the filled version: work only
// inside this call (no timers), write through `world.db`, never act on docs
// older than `world.createdAt`, and never call `world.db.runTransaction` here,
// since the caller may already be inside one.

import type { DemoWorld } from './world.ts';

export function tickLife(world: DemoWorld, nowMs: number): void | Promise<void> {
  void world;
  void nowMs;
}
