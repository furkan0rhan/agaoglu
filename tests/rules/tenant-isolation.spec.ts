import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { anon, as, BASE_USERS, createEnv, seed } from './helpers';

const DATA_COLLECTIONS = ['products', 'customers', 'sales', 'expenses', 'suppliers', 'stockMovements', 'creditTransactions'];
/** Y5: maliyet / kâr içeren koleksiyonlar yalnız yöneticide */
const ADMIN_ONLY = ['expenses', 'suppliers'];
const MEMBER_READABLE = DATA_COLLECTIONS.filter(c => !ADMIN_ONLY.includes(c));

let env: RulesTestEnvironment;

beforeAll(async () => { env = await createEnv(); });
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  const docs: Record<string, Record<string, unknown>> = { ...BASE_USERS };
  for (const c of DATA_COLLECTIONS) docs[`${c}/A1`] = { tenantId: 'OWNER', name: 'Ağaoğlu kaydı', amount: 10, totalAmount: 10 };
  docs['products/B1'] = { tenantId: 'OTHER', name: 'Yeşil Vadi ürünü' };
  await seed(env, docs);
});

describe('tenant izolasyonu', () => {
  it.each(MEMBER_READABLE)('%s: aynı işletmenin kasiyeri okuyabilir', async c => {
    await assertSucceeds(getDoc(doc(as(env, 'CASH'), c, 'A1')));
  });

  it.each(ADMIN_ONLY)('%s: yalnız yönetici okur, kasiyer okuyamaz (Y5)', async c => {
    await assertSucceeds(getDoc(doc(as(env, 'OWNER'), c, 'A1')));
    await assertFails(getDoc(doc(as(env, 'CASH'), c, 'A1')));
  });

  it.each(DATA_COLLECTIONS)('%s: başka işletmenin admini okuyamaz', async c => {
    await assertFails(getDoc(doc(as(env, 'OTHER'), c, 'A1')));
  });

  it('başka işletmenin admini tenantId filtresiyle listeleyemez', async () => {
    const db = as(env, 'OTHER');
    await assertFails(getDocs(query(collection(db, 'products'), where('tenantId', '==', 'OWNER'))));
  });

  it('kendi işletmesini tenantId filtresiyle listeleyebilir, filtresiz listeleyemez', async () => {
    const db = as(env, 'CASH');
    await assertSucceeds(getDocs(query(collection(db, 'products'), where('tenantId', '==', 'OWNER'))));
    await assertFails(getDocs(collection(db, 'products')));
  });

  it('pasif kullanıcı veriye erişemez', async () => {
    await assertFails(getDoc(doc(as(env, 'OFF'), 'products', 'A1')));
  });

  it('oturumsuz istek reddedilir', async () => {
    await assertFails(getDoc(doc(anon(env), 'products', 'A1')));
  });

  it('users dokümanı olmayan kullanıcı veriye erişemez', async () => {
    await assertFails(getDoc(doc(as(env, 'NOBODY'), 'products', 'A1')));
  });

  it('başka işletme adına kayıt oluşturulamaz', async () => {
    await assertFails(setDoc(doc(as(env, 'OTHER'), 'products', 'X'), { tenantId: 'OWNER', name: 'sızma' }));
    await assertSucceeds(setDoc(doc(as(env, 'OTHER'), 'products', 'X'), { tenantId: 'OTHER', name: 'kendi ürünü' }));
  });

  it('kaydın tenantId alanı değiştirilemez', async () => {
    await assertFails(updateDoc(doc(as(env, 'CASH'), 'products', 'A1'), { tenantId: 'OTHER' }));
    await assertFails(updateDoc(doc(as(env, 'OWNER'), 'products', 'A1'), { tenantId: 'OTHER' }));
    await assertSucceeds(updateDoc(doc(as(env, 'OWNER'), 'products', 'A1'), { name: 'Yeni ad' }));
  });

  it('başka işletmenin kaydı güncellenemez / silinemez', async () => {
    await assertFails(updateDoc(doc(as(env, 'CASH'), 'products', 'B1'), { name: 'x' }));
    await assertFails(deleteDoc(doc(as(env, 'CASH'), 'products', 'B1')));
  });

  it('tenants: üye kendi işletmesini okur, başkasınınkini okuyamaz, liste yok', async () => {
    await assertSucceeds(getDoc(doc(as(env, 'CASH'), 'tenants', 'OWNER')));
    await assertFails(getDoc(doc(as(env, 'OTHER'), 'tenants', 'OWNER')));
    await assertFails(getDocs(collection(as(env, 'OWNER'), 'tenants')));
  });

  it('tenants: kasiyer işletme bilgisini değiştiremez, sahibi değiştirebilir', async () => {
    await assertFails(updateDoc(doc(as(env, 'CASH'), 'tenants', 'OWNER'), { name: 'Ele geçirildi' }));
    await assertSucceeds(updateDoc(doc(as(env, 'OWNER'), 'tenants', 'OWNER'), { name: 'Ağaoğlu Tarım Ltd.' }));
  });

  it('tenants: ownerId değiştirilemez', async () => {
    await assertFails(updateDoc(doc(as(env, 'OWNER'), 'tenants', 'OWNER'), { ownerId: 'OTHER' }));
  });
});
