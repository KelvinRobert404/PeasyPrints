import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HIDDEN,
  claimOf,
  claimQuestion,
  contactHref,
  genericTitle,
  normalizeContact,
  redactForViewer,
  scrubText,
  verifyClaimAnswer,
  type LostFoundRecord,
} from '../../src/lib/campus/lostFound.ts';
import { buildLostFound } from '../../src/lib/campus/fixtures/utilities.ts';

const time = (iso: string) => ({ toDate: () => new Date(iso), toMillis: () => Date.parse(iso) });

const place = {
  landmarkId: 'kju-main-library',
  label: 'Main Library',
  area: 'Kothanur',
  lat: 13.05,
  lng: 77.64,
  campusId: 'kju-main',
  roughDistanceM: 150,
};

function idCard(overrides: Partial<LostFoundRecord> = {}): LostFoundRecord & { id: string } {
  return {
    id: 'lf-1',
    authorId: 'poster',
    campusId: 'kju-main',
    kind: 'found',
    category: 'id_card',
    status: 'open',
    title: 'Found Siyon Roy ID 23BCAA12',
    description: 'Name: Siyon Roy, reg no 23BCAA12. Call 98765 43210 or siyon@kristujayanti.com. Card 4455667.',
    images: ['/api/campus/media/abc'],
    place,
    happenedAt: time('2026-11-06T10:00:00.000Z'),
    keptAt: 'Security desk',
    posterDisplayName: 'Farhan',
    claimQuestion: 'What name is on the card?',
    claimAnswer: 'Siyon Roy',
    contact: { kind: 'whatsapp', value: '9876543210' },
    claims: {},
    createdAt: time('2026-11-06T10:00:00.000Z'),
    updatedAt: time('2026-11-06T10:00:00.000Z'),
    ...overrides,
  };
}

test('a non-owner gets the generic title, no photos and no ID digits on an ID card', () => {
  const view = redactForViewer(idCard(), 'someone-else');
  assert.equal(view.isOwner, false);
  assert.equal(view.title, 'ID card near Main Library');
  assert.deepEqual(view.images, []);
  assert.equal(view.photoCount, 1);
  assert.equal(view.redacted, true);
  assert.doesNotMatch(view.description, /23BCAA12/i);
  assert.doesNotMatch(view.description, /\d{5,}/);
  assert.doesNotMatch(view.description, /98765/);
  assert.doesNotMatch(view.description, /siyon/i);
  assert.doesNotMatch(view.description, /@/);
  assert.match(view.description, /\[hidden\]/);
  assert.equal(view.claimAnswer, null);
  assert.equal(view.contact, null);
  assert.equal(view.claims, null);
  assert.equal(view.claimQuestion, 'What name is on the card?');
  assert.equal(view.keptAt, 'Security desk');
  assert.equal(view.poster.displayName, 'Farhan');
  assert.equal('authorId' in view, false);
  assert.equal(JSON.stringify(view).includes('23BCAA12'), false);
  assert.equal(JSON.stringify(view).includes('9876543210'), false);
  assert.equal(JSON.stringify(view).includes('Siyon'), false);
});

test('the owner sees everything on their own post', () => {
  const item = idCard({
    claims: {
      c1: {
        claimantId: 'claimer',
        claimantName: 'Sana',
        answer: 'siyon roy',
        matches: true,
        status: 'pending',
        createdAt: time('2026-11-06T11:00:00.000Z'),
        decidedAt: null,
      },
    },
  });
  const view = redactForViewer(item, 'poster');
  assert.equal(view.isOwner, true);
  assert.equal(view.redacted, false);
  assert.equal(view.title, item.title);
  assert.equal(view.description, item.description);
  assert.deepEqual(view.images, ['/api/campus/media/abc']);
  assert.equal(view.claimAnswer, 'Siyon Roy');
  assert.deepEqual(view.contact, { kind: 'whatsapp', value: '9876543210' });
  assert.equal(view.claims?.length, 1);
  assert.equal(view.claims?.[0]?.answer, 'siyon roy');
  assert.equal(view.claims?.[0]?.matches, true);
  assert.equal(view.createdAt, '2026-11-06T10:00:00.000Z');
});

test('wallets get the generic title too; no place means just the label', () => {
  const view = redactForViewer(idCard({ category: 'wallet', title: 'Brown wallet with Rs 500', place: null }), 'x');
  assert.equal(view.title, 'Wallet');
  assert.equal(genericTitle('id_card', null), 'ID card');
});

test('other categories keep their title, scrubbed, and still hide photos', () => {
  const view = redactForViewer(
    idCard({ category: 'keys', title: 'Red keychain, call 9876543210', description: 'Three keys.' }),
    'someone',
  );
  assert.equal(view.title, `Red keychain, call ${HIDDEN}`);
  assert.equal(view.description, 'Three keys.');
  assert.deepEqual(view.images, []);
});

test('a signed-out or empty viewer is never the owner', () => {
  const view = redactForViewer(idCard({ authorId: '' }), '');
  assert.equal(view.isOwner, false);
  assert.deepEqual(view.images, []);
});

test('an approved claimant sees the contact, a pending one does not', () => {
  const claims = {
    a: { claimantId: 'approved-one', claimantName: 'A', answer: 'x', matches: false, status: 'approved' as const, createdAt: time('2026-11-06T11:00:00Z'), decidedAt: time('2026-11-06T12:00:00Z') },
    b: { claimantId: 'pending-one', claimantName: 'B', answer: 'y', matches: null, status: 'pending' as const, createdAt: time('2026-11-06T11:30:00Z'), decidedAt: null },
  };
  const approved = redactForViewer(idCard({ claims }), 'approved-one');
  assert.deepEqual(approved.contact, { kind: 'whatsapp', value: '9876543210' });
  assert.deepEqual(approved.myClaim?.status, 'approved');
  assert.deepEqual(approved.images, []);
  assert.equal(approved.claims, null);
  const pending = redactForViewer(idCard({ claims }), 'pending-one');
  assert.equal(pending.contact, null);
  assert.equal(pending.myClaim?.id, 'b');
  assert.equal(redactForViewer(idCard({ claims }), 'stranger').myClaim, null);
  assert.equal(claimOf({ claims }, 'pending-one')?.id, 'b');
});

test('scrubText removes register numbers, digit runs, phones, emails and names', () => {
  assert.equal(scrubText('Reg 23BCAA12 here'), `Reg ${HIDDEN} here`);
  assert.equal(scrubText('Roll 1KJ21CS045'), `Roll ${HIDDEN}`);
  assert.equal(scrubText('Call +91 98765-43210 now'), `Call ${HIDDEN} now`);
  assert.equal(scrubText('ID 123456'), `ID ${HIDDEN}`);
  assert.equal(scrubText('Mail a.b@uni.edu.in'), `Mail ${HIDDEN}`);
  assert.equal(scrubText('name: Siyon Roy, BCA'), `name: ${HIDDEN}, BCA`);
  assert.equal(scrubText('Name is Siyon. Second year'), `Name is ${HIDDEN}. Second year`);
  // Short numbers and plain words stay.
  assert.equal(scrubText('Room 204, 2nd year BCom'), 'Room 204, 2nd year BCom');
  assert.equal(scrubText('Name starts with S.'), 'Name starts with S.');
  assert.equal(scrubText(''), '');
});

test('claimQuestion uses the poster question, else a default', () => {
  assert.equal(claimQuestion({ kind: 'found', category: 'keys', claimQuestion: ' Colour of the tag? ' }), 'Colour of the tag?');
  assert.equal(claimQuestion({ kind: 'found', category: 'id_card', claimQuestion: null }), 'What name is on the card?');
  assert.equal(claimQuestion({ kind: 'found', category: 'other' }), 'Name one detail only the owner knows.');
  assert.equal(claimQuestion({ kind: 'lost', category: 'id_card' }), 'Where did you find it?');
});

test('verifyClaimAnswer is case-insensitive and ignores spacing and punctuation', () => {
  assert.equal(verifyClaimAnswer('Siyon Roy', 'siyon roy'), true);
  assert.equal(verifyClaimAnswer('Siyon Roy', '  SIYON   ROY. '), true);
  assert.equal(verifyClaimAnswer('Siyon Roy', 'Siyon'), false);
  assert.equal(verifyClaimAnswer(null, 'anything'), false);
  assert.equal(verifyClaimAnswer('', ''), false);
});

test('normalizeContact tidies and checks the poster contact', () => {
  assert.deepEqual(normalizeContact('whatsapp', '+91 98765 43210'), { ok: true, contact: { kind: 'whatsapp', value: '9876543210' } });
  assert.deepEqual(normalizeContact('phone', '09876543210'), { ok: true, contact: { kind: 'phone', value: '9876543210' } });
  assert.equal(normalizeContact('phone', '12345').ok, false);
  assert.deepEqual(normalizeContact('email', ' Me@Uni.EDU '), { ok: true, contact: { kind: 'email', value: 'me@uni.edu' } });
  assert.equal(normalizeContact('email', 'nope').ok, false);
  assert.deepEqual(normalizeContact('instagram', '@Swoop.KJU'), { ok: true, contact: { kind: 'instagram', value: 'swoop.kju' } });
  assert.equal(contactHref({ kind: 'whatsapp', value: '9876543210' }), 'https://wa.me/919876543210');
  assert.equal(contactHref({ kind: 'phone', value: '9876543210' }), 'tel:+919876543210');
});

test('the seeded ID card is redacted for another student and whole for its poster', () => {
  const seeded = buildLostFound(new Date('2026-11-07T06:00:00.000Z')).find((doc) => doc.id === 'lf-id-card');
  assert.ok(seeded);
  const record = { ...seeded.data, id: seeded.id };
  const view = redactForViewer(record, 'verified-kju-main');
  assert.equal(view.category, 'id_card');
  assert.match(view.title, /^ID card near /);
  assert.deepEqual(view.images, []);
  assert.equal(view.claimQuestion, 'What name is on the card?');
  const own = redactForViewer(record, seeded.data.authorId);
  assert.equal(own.title, seeded.data.title);
});
