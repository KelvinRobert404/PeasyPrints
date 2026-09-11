import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadString } from 'firebase/storage';

const projectId = 'demo-peasyprints';
let environment;

before(async () => {
  const [firestoreRules, storageRules] = await Promise.all([
    readFile(new URL('../../firestore.rules', import.meta.url), 'utf8'),
    readFile(new URL('../../storage.rules', import.meta.url), 'utf8'),
  ]);
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: firestoreRules },
    storage: { rules: storageRules },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.clearStorage();
});

after(async () => {
  await environment?.cleanup();
});

test('shop reads are public but financial fields remain server-controlled', async () => {
  const owner = environment.authenticatedContext('shop-owner');
  const shopRef = doc(owner.firestore(), 'shops', 'shop-owner');
  await assertSucceeds(setDoc(shopRef, {
    name: 'Test Print Shop',
    address: 'Campus',
    phone: '0000000000',
    email: 'owner@example.test',
    timing: '09:00 to 18:00',
    receivableAmount: 0,
    reservedPayoutAmount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(getDoc(doc(environment.unauthenticatedContext().firestore(), 'shops', 'shop-owner')));
  await assertFails(updateDoc(shopRef, { receivableAmount: 500, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(owner.firestore(), 'shops', 'another-shop'), {
    name: 'Impersonated Shop',
    receivableAmount: 0,
    reservedPayoutAmount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
});

test('users can write only their own constrained profile', async () => {
  const user = environment.authenticatedContext('student-1');
  await assertSucceeds(setDoc(doc(user.firestore(), 'users', 'student-1'), {
    username: 'Student',
    email: 'student@example.test',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(user.firestore(), 'users', 'student-2'), {
    username: 'Other',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(user.firestore(), 'users', 'student-1'), {
    admin: true,
    updatedAt: serverTimestamp(),
  }));
});

test('orders and campus-private collections cannot be written by Firebase clients', async () => {
  const user = environment.authenticatedContext('student-1');
  const admin = environment.authenticatedContext('admin-1', { admin: true });
  await assertFails(setDoc(doc(user.firestore(), 'orders', 'order-1'), { userId: 'student-1', shopId: 'shop-1' }));
  await assertFails(setDoc(doc(admin.firestore(), 'orders', 'order-2'), { userId: 'student-1', shopId: 'shop-1' }));
  await assertFails(getDoc(doc(user.firestore(), 'campus_private_profiles', 'student-1')));
  await assertFails(setDoc(doc(user.firestore(), 'campus_memberships', 'student-1'), { collegeId: 'kju' }));
});

test('the server-minted admin claim gates legacy Godview collections', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'announcements', 'notice-1'), { active: true });
  });
  const regular = environment.authenticatedContext('student-1');
  const admin = environment.authenticatedContext('admin-1', { admin: true });
  await assertFails(getDoc(doc(regular.firestore(), 'announcements', 'notice-1')));
  const snapshot = await assertSucceeds(getDoc(doc(admin.firestore(), 'announcements', 'notice-1')));
  assert.equal(snapshot.exists(), true);
});

test('Storage denies direct client access to private and unmatched paths', async () => {
  const userStorage = environment.authenticatedContext('student-1').storage();
  await assertFails(uploadString(ref(userStorage, 'campus_media/student-1/image.png'), 'not-an-image'));
  await assertFails(uploadString(ref(userStorage, 'campus_verification/student-1/card.jpg'), 'private'));
  await assertFails(uploadString(ref(userStorage, 'uploads/student-1/document.pdf'), '%PDF-test'));
  await assertFails(uploadString(ref(userStorage, 'shop_logos/student-1/logo.jpg'), 'logo'));
});
