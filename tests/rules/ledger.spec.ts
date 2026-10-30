import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { as, BASE_USERS, createEnv, seed } from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await createEnv(); });
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    ...BASE_USERS,
    'creditTransactions/T1': { tenantId: 'OWNER', customerId: 'C1', type: 'debt', amount: 500, balance: 500 },
    'stockMovements/M1': { tenantId: 'OWNER', productId: 'P1', type: 'out', quantity: 2, previousStock: 10, newStock: 8 },
    'sales/S1': { tenantId: 'OWNER', totalAmount: 100, status: 'completed' },
  });
});

describe('değişmez defterler', () => {
  it.each(['OWNER', 'CASH'])('creditTransactions güncellenemez / silinemez (%s)', async uid => {
    const db = as(env, uid);
    await assertFails(updateDoc(doc(db, 'creditTransactions', 'T1'), { amount: 1 }));
    await assertFails(setDoc(doc(db, 'creditTransactions', 'T1'), { tenantId: 'OWNER', amount: 1 }));
    await assertFails(deleteDoc(doc(db, 'creditTransactions', 'T1')));
  });

  it.each(['OWNER', 'CASH'])('stockMovements güncellenemez / silinemez (%s)', async uid => {
    const db = as(env, uid);
    await assertFails(updateDoc(doc(db, 'stockMovements', 'M1'), { quantity: 1 }));
    await assertFails(deleteDoc(doc(db, 'stockMovements', 'M1')));
  });

  it('stockMovements yeni kayıt eklenebilir', async () => {
    await assertSucceeds(addDoc(collection(as(env, 'CASH'), 'stockMovements'), { tenantId: 'OWNER', productId: 'P1', type: 'in', quantity: 5 }));
  });

  it('satış silinemez, iptal (update) edilebilir', async () => {
    const db = as(env, 'CASH');
    await assertFails(deleteDoc(doc(db, 'sales', 'S1')));
    await assertSucceeds(updateDoc(doc(db, 'sales', 'S1'), { status: 'cancelled' }));
  });
});

describe('tutar doğrulaması', () => {
  it('veresiye: pozitif tutar kabul, negatif tutar red', async () => {
    const db = as(env, 'CASH');
    await assertSucceeds(addDoc(collection(db, 'creditTransactions'), { tenantId: 'OWNER', type: 'payment', amount: 250 }));
    await assertFails(addDoc(collection(db, 'creditTransactions'), { tenantId: 'OWNER', type: 'payment', amount: -5 }));
  });

  it('veresiye: tutar sayı olmalı', async () => {
    await assertFails(addDoc(collection(as(env, 'CASH'), 'creditTransactions'), { tenantId: 'OWNER', type: 'debt', amount: '500' }));
    await assertFails(addDoc(collection(as(env, 'CASH'), 'creditTransactions'), { tenantId: 'OWNER', type: 'debt' }));
  });

  it('veresiye: satış iptali ters kaydı (isReversal) negatif olabilir', async () => {
    await assertSucceeds(addDoc(collection(as(env, 'CASH'), 'creditTransactions'), {
      tenantId: 'OWNER', type: 'debt', amount: -500, isReversal: true, saleId: 'S1',
    }));
  });

  it('veresiye: isReversal false ise negatif red', async () => {
    await assertFails(addDoc(collection(as(env, 'CASH'), 'creditTransactions'), { tenantId: 'OWNER', type: 'debt', amount: -500, isReversal: false }));
  });

  it('veresiye: ters kayıt da başka işletmeye yazılamaz', async () => {
    await assertFails(addDoc(collection(as(env, 'OTHER'), 'creditTransactions'), { tenantId: 'OWNER', amount: -500, isReversal: true }));
  });

  it('gider: negatif tutar red (oluşturma ve güncelleme)', async () => {
    const db = as(env, 'OWNER');
    await assertFails(addDoc(collection(db, 'expenses'), { tenantId: 'OWNER', title: 'Kira', amount: -100 }));
    const ref = await assertSucceeds(addDoc(collection(db, 'expenses'), { tenantId: 'OWNER', title: 'Kira', amount: 100 }));
    await assertFails(updateDoc(ref, { amount: -1 }));
  });

  it('satış: negatif toplam red', async () => {
    const db = as(env, 'CASH');
    await assertFails(addDoc(collection(db, 'sales'), { tenantId: 'OWNER', totalAmount: -10 }));
    await assertSucceeds(addDoc(collection(db, 'sales'), { tenantId: 'OWNER', totalAmount: 0 }));
    await assertFails(updateDoc(doc(db, 'sales', 'S1'), { totalAmount: -1 }));
  });
});
