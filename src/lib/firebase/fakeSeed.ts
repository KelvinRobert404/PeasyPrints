import type { FakeFirestore } from './fakeAdmin.ts';

/**
 * Fills the fixture database once, when fixture mode first creates it.
 * Empty for now: fixture packages add their documents here with
 * `db.seedDoc('collection/id', data)`, which writes synchronously.
 */
export function seedFakeDb(db: FakeFirestore): void {
  void db;
}
