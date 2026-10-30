import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { as, BASE_USERS, createEnv, seed } from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await createEnv(); });
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    ...BASE_USERS,
    'purchases/PU1': { tenantId: 'OWNER', supplierId: 'S1', grandTotal: 1180, discount: 0, status: 'active', items: [] },
    'purchases/PU2': { tenantId: 'OWNER', supplierId: 'S1', grandTotal: 50, discount: 0, status: 'cancelled', items: [] },
    'supplierTransactions/ST1': { tenantId: 'OWNER', supplierId: 'S1', type: 'purchase', amount: 1180, balance: 1180 },
  });
});

const purchase = (extra: Record<string, unknown> = {}) => ({
  tenantId: 'OWNER', supplierId: 'S1', grandTotal: 100, discount: 0, status: 'active', items: [], ...extra,
});

describe('purchases', () => {
  it.each(['OWNER', 'CASH'])('tenant üyesi okur ve oluşturur (%s)', async uid => {
    const db = as(env, uid);
    await assertSucceeds(getDoc(doc(db, 'purchases', 'PU1')));
    await assertSucceeds(addDoc(collection(db, 'purchases'), purchase()));
  });

  it('başka işletme okuyamaz / oluşturamaz', async () => {
    const db = as(env, 'OTHER');
    await assertFails(getDoc(doc(db, 'purchases', 'PU1')));
    await assertFails(addDoc(collection(db, 'purchases'), purchase()));
  });

  it('pasif kullanıcı oluşturamaz', async () => {
    await assertFails(addDoc(collection(as(env, 'OFF'), 'purchases'), purchase()));
  });

  it('negatif toplam / iskonto reddedilir', async () => {
    const db = as(env, 'OWNER');
    await assertFails(addDoc(collection(db, 'purchases'), purchase({ grandTotal: -1 })));
    await assertFails(addDoc(collection(db, 'purchases'), purchase({ discount: -5 })));
  });

  it('yalnız iptal güncellemesi yapılabilir', async () => {
    const db = as(env, 'OWNER');
    await assertSucceeds(updateDoc(doc(db, 'purchases', 'PU1'), {
      status: 'cancelled', cancelledAt: new Date(), cancelledBy: 'OWNER', cancelReason: 'yanlış giriş',
    }));
  });

  it('tutar değiştirilemez, iptal geri alınamaz, silinemez', async () => {
    const db = as(env, 'OWNER');
    await assertFails(updateDoc(doc(db, 'purchases', 'PU1'), { grandTotal: 1 }));
    await assertFails(updateDoc(doc(db, 'purchases', 'PU1'), { status: 'cancelled', grandTotal: 1 }));
    await assertFails(updateDoc(doc(db, 'purchases', 'PU2'), { status: 'active' }));
    await assertFails(updateDoc(doc(db, 'purchases', 'PU2'), { status: 'cancelled', cancelReason: 'x' }));
    await assertFails(deleteDoc(doc(db, 'purchases', 'PU1')));
  });

  it('başka işletme iptal edemez', async () => {
    await assertFails(updateDoc(doc(as(env, 'OTHER'), 'purchases', 'PU1'), { status: 'cancelled' }));
  });
});

describe('supplierTransactions — değişmez defter', () => {
  it('pozitif alış / ödeme eklenir', async () => {
    const db = as(env, 'OWNER');
    await assertSucceeds(addDoc(collection(db, 'supplierTransactions'), { tenantId: 'OWNER', supplierId: 'S1', type: 'payment', amount: 500, balance: 680 }));
    await assertSucceeds(addDoc(collection(db, 'supplierTransactions'), { tenantId: 'OWNER', supplierId: 'S1', type: 'purchase', amount: 0, balance: 680 }));
  });

  it('negatif tutar yalnız ters kayıtta', async () => {
    const db = as(env, 'OWNER');
    await assertFails(addDoc(collection(db, 'supplierTransactions'), { tenantId: 'OWNER', supplierId: 'S1', type: 'payment', amount: -5 }));
    await assertSucceeds(addDoc(collection(db, 'supplierTransactions'), {
      tenantId: 'OWNER', supplierId: 'S1', type: 'purchase', amount: -1180, isReversal: true, purchaseId: 'PU1',
    }));
  });

  it('geçersiz tip / sayı olmayan tutar reddedilir', async () => {
    const db = as(env, 'OWNER');
    await assertFails(addDoc(collection(db, 'supplierTransactions'), { tenantId: 'OWNER', supplierId: 'S1', type: 'gift', amount: 5 }));
    await assertFails(addDoc(collection(db, 'supplierTransactions'), { tenantId: 'OWNER', supplierId: 'S1', type: 'payment', amount: '5' }));
  });

  it('güncellenemez / silinemez / üzerine yazılamaz', async () => {
    const db = as(env, 'OWNER');
    await assertFails(updateDoc(doc(db, 'supplierTransactions', 'ST1'), { amount: 1 }));
    await assertFails(setDoc(doc(db, 'supplierTransactions', 'ST1'), { tenantId: 'OWNER', supplierId: 'S1', type: 'purchase', amount: 1 }));
    await assertFails(deleteDoc(doc(db, 'supplierTransactions', 'ST1')));
  });

  it('başka işletme okuyamaz / yazamaz', async () => {
    const db = as(env, 'OTHER');
    await assertFails(getDoc(doc(db, 'supplierTransactions', 'ST1')));
    await assertFails(addDoc(collection(db, 'supplierTransactions'), { tenantId: 'OWNER', supplierId: 'S1', type: 'payment', amount: 5 }));
  });
});
