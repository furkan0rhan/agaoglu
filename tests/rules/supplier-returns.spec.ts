import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { as, BASE_USERS, createEnv, seed } from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await createEnv(); });
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    ...BASE_USERS,
    'supplierReturns/R1': { tenantId: 'OWNER', supplierId: 'S1', productId: 'P1', quantity: 1, reason: 'expired', units: [{ batchId: 'b1', quantity: 1 }] },
  });
});

const ret = (uid: string, extra: Record<string, unknown> = {}) => ({
  tenantId: 'OWNER', supplierId: 'S1', supplierName: 'Firma', productId: 'P1', productName: 'İlaç', quantity: 2,
  reason: 'expired', units: [{ batchId: 'b1', quantity: 1, gtsNo: 'G1' }, { batchId: 'b2', quantity: 1, gtsNo: 'G2' }],
  returnDate: Timestamp.now(), documentNo: 'IRS-1', createdBy: uid, ...extra,
});

describe('supplierReturns (11.13 firmaya iade)', () => {
  it('işletme yöneticisi okur ve oluşturur', async () => {
    const db = as(env, 'OWNER');
    await assertSucceeds(getDoc(doc(db, 'supplierReturns', 'R1')));
    await assertSucceeds(addDoc(collection(db, 'supplierReturns'), ret('OWNER')));
  });

  it.each(['CASH', 'STAFF'])('%s okuyamaz / oluşturamaz (yalnız yönetici)', async uid => {
    const db = as(env, uid);
    await assertFails(getDoc(doc(db, 'supplierReturns', 'R1')));
    await assertFails(addDoc(collection(db, 'supplierReturns'), ret(uid)));
  });

  it('başka işletme okuyamaz / oluşturamaz', async () => {
    const db = as(env, 'OTHER');
    await assertFails(getDoc(doc(db, 'supplierReturns', 'R1')));
    await assertFails(addDoc(collection(db, 'supplierReturns'), ret('OTHER')));
  });

  it('geçersiz miktar / neden / birim listesi / başkası adına kayıt reddedilir', async () => {
    const db = as(env, 'OWNER');
    await assertFails(addDoc(collection(db, 'supplierReturns'), ret('OWNER', { quantity: 0 })));
    await assertFails(addDoc(collection(db, 'supplierReturns'), ret('OWNER', { reason: 'sold' })));
    await assertFails(addDoc(collection(db, 'supplierReturns'), ret('OWNER', { units: [] })));
    await assertFails(addDoc(collection(db, 'supplierReturns'), ret('OWNER', { supplierId: '' })));
    await assertFails(addDoc(collection(db, 'supplierReturns'), ret('OWNER', { createdBy: 'CASH' })));
  });

  it('değişmez: güncelleme ve silme yok', async () => {
    const db = as(env, 'OWNER');
    await assertFails(updateDoc(doc(db, 'supplierReturns', 'R1'), { quantity: 5 }));
    await assertFails(deleteDoc(doc(db, 'supplierReturns', 'R1')));
  });
});
