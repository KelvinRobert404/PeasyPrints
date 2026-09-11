import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesDeclaredFileType } from '../../src/lib/server/fileValidation.ts';

test('upload validation checks file signatures instead of trusting MIME', () => {
  assert.equal(matchesDeclaredFileType(Buffer.from('%PDF-1.7'), 'application/pdf'), true);
  assert.equal(matchesDeclaredFileType(Buffer.from('not a pdf'), 'application/pdf'), false);
  assert.equal(matchesDeclaredFileType(Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg'), true);
  assert.equal(matchesDeclaredFileType(Buffer.from('RIFFxxxxWEBP'), 'image/webp'), true);
});
