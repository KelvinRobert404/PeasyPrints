import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPUS_COLLECTIONS } from '../../src/lib/campus/constants.ts';
import { collectionForContentType, contactRequestIntent, intentFor } from '../../src/lib/campus/serial.ts';

describe('collectionForContentType', () => {
  it('maps marketplace to the v2 market collection', () => {
    assert.equal(collectionForContentType('marketplace'), CAMPUS_COLLECTIONS.market);
    assert.equal(collectionForContentType('marketplace'), 'market_listings');
  });

  it('maps housing to the v2 housing collection', () => {
    assert.equal(collectionForContentType('housing'), CAMPUS_COLLECTIONS.housing);
    assert.equal(collectionForContentType('housing'), 'housing_listings');
  });

  it('never returns a v1 collection name', () => {
    for (const type of ['marketplace', 'housing'] as const) {
      assert.ok(!['marketplace_listings', 'housing_posts'].includes(collectionForContentType(type)));
    }
  });
});

describe('intentFor', () => {
  it('is an offer for a wanted market post', () => {
    assert.equal(intentFor('marketplace', { kind: 'wanted' }), 'offer');
  });

  it('is an ask for other market kinds and for housing', () => {
    assert.equal(intentFor('marketplace', { kind: 'sell' }), 'ask');
    assert.equal(intentFor('marketplace', {}), 'ask');
    assert.equal(intentFor('housing', { kind: 'wanted' }), 'ask');
  });
});

describe('contactRequestIntent', () => {
  it('keeps a stored intent', () => {
    assert.equal(contactRequestIntent({ intent: 'offer', contentType: 'housing' }), 'offer');
    assert.equal(contactRequestIntent({ intent: 'ask', contentType: 'marketplace', listingKind: 'wanted' }), 'ask');
  });

  it('derives a missing intent from the listing kind', () => {
    assert.equal(contactRequestIntent({ contentType: 'marketplace', listingKind: 'wanted' }), 'offer');
    assert.equal(contactRequestIntent({ contentType: 'marketplace', listingKind: 'sell' }), 'ask');
    assert.equal(contactRequestIntent({ contentType: 'housing', listingKind: null }), 'ask');
  });

  it('ignores an unknown stored intent', () => {
    assert.equal(contactRequestIntent({ intent: 'other', contentType: 'marketplace', listingKind: 'wanted' }), 'offer');
    assert.equal(contactRequestIntent({ intent: 42 }), 'ask');
  });
});
