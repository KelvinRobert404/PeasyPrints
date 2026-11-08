// Seasonal sample packs: May move-out and July arrivals. Runs when a world is
// created (with the visitor's swoop_demo_date) and when the date changes.
// Pack doc ids start with 'season-', so they stay out of the change log.
//
// Stub from WORLD; DATE fills it. The filled version removes the other packs'
// docs, seeds this one, and is idempotent.

import type { DemoDateId } from '../contract.ts';
import type { DemoWorld } from './world.ts';

export function applySeason(world: DemoWorld, dateId: DemoDateId): void | Promise<void> {
  void world;
  void dateId;
}
