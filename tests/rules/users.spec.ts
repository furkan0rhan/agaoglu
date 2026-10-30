import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { as, BASE_USERS, createEnv, seed } from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await createEnv(); });
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, BASE_USERS);
});

describe('users: kendi profili', () => {
  it('kasiyer kendi rolünü yükseltemez', async () => {
    await assertFails(updateDoc(doc(as(env, 'CASH'), 'users', 'CASH'), { role: 'admin' }));
  });

  it('kasiyer kendi tenantId alanını değiştiremez', async () => {
    await assertFails(updateDoc(doc(as(env, 'CASH'), 'users', 'CASH'), { tenantId: 'OTHER' }));
    await assertFails(updateDoc(doc(as(env, 'CASH'), 'users', 'CASH'), { tenantId: 'CASH' }));
  });

  it('pasif kullanıcı kendini aktif yapamaz', async () => {
    await assertFails(updateDoc(doc(as(env, 'OFF'), 'users', 'OFF'), { isActive: true }));
  });

  it('kullanıcı yalnız görünen ad / e-posta / son giriş alanlarını değiştirebilir', async () => {
    await assertSucceeds(updateDoc(doc(as(env, 'CASH'), 'users', 'CASH'), { displayName: 'Ayşe D.' }));
    await assertSucceeds(updateDoc(doc(as(env, 'CASH'), 'users', 'CASH'), { lastLogin: new Date() }));
    await assertFails(updateDoc(doc(as(env, 'CASH'), 'users', 'CASH'), { displayName: 'X', role: 'admin' }));
  });

  it('kullanıcı kendi ürün turu durumunu (onboarding) yazabilir; başkasınınkini ve harita olmayan değeri yazamaz', async () => {
    const onboarding = { version: 1, completedTours: ['pos@1'], dismissed: false };
    await assertSucceeds(updateDoc(doc(as(env, 'CASH'), 'users', 'CASH'), { onboarding }));
    await assertFails(updateDoc(doc(as(env, 'CASH'), 'users', 'CASH'), { onboarding: 'x' }));
    await assertFails(updateDoc(doc(as(env, 'CASH'), 'users', 'CASH'), { onboarding, role: 'admin' }));
    await assertFails(updateDoc(doc(as(env, 'CASH'), 'users', 'STAFF'), { onboarding }));
  });

  it('kendi dokümanını okuyabilir, iş arkadaşınınkini (admin değilse) okuyamaz', async () => {
    await assertSucceeds(getDoc(doc(as(env, 'CASH'), 'users', 'CASH')));
    await assertFails(getDoc(doc(as(env, 'CASH'), 'users', 'STAFF')));
  });

  it('kullanıcı dokümanı silinemez', async () => {
    await assertFails(deleteDoc(doc(as(env, 'CASH'), 'users', 'CASH')));
    await assertFails(deleteDoc(doc(as(env, 'OWNER'), 'users', 'CASH')));
  });
});

describe('users: işletme admini', () => {
  it('admin personelin rolünü ve aktifliğini değiştirebilir', async () => {
    await assertSucceeds(updateDoc(doc(as(env, 'OWNER'), 'users', 'CASH'), { role: 'staff' }));
    await assertSucceeds(updateDoc(doc(as(env, 'OWNER'), 'users', 'CASH'), { isActive: false }));
  });

  it('admin geçersiz rol atayamaz', async () => {
    await assertFails(updateDoc(doc(as(env, 'OWNER'), 'users', 'CASH'), { role: 'superadmin' }));
  });

  it('admin personeli başka işletmeye taşıyamaz', async () => {
    await assertFails(updateDoc(doc(as(env, 'OWNER'), 'users', 'CASH'), { tenantId: 'OTHER' }));
  });

  it('admin kendi rolünü düşüremez (işletme sahipsiz kalmasın)', async () => {
    await assertFails(updateDoc(doc(as(env, 'OWNER'), 'users', 'OWNER'), { role: 'staff' }));
  });

  it('başka işletmenin admini personeli pasife alamaz / okuyamaz', async () => {
    await assertFails(updateDoc(doc(as(env, 'OTHER'), 'users', 'CASH'), { isActive: false }));
    await assertFails(getDoc(doc(as(env, 'OTHER'), 'users', 'CASH')));
  });

  it('admin kendi işletmesinin kullanıcılarını listeler; kasiyer ve başka admin listeleyemez', async () => {
    await assertSucceeds(getDocs(query(collection(as(env, 'OWNER'), 'users'), where('tenantId', '==', 'OWNER'))));
    await assertFails(getDocs(query(collection(as(env, 'CASH'), 'users'), where('tenantId', '==', 'OWNER'))));
    await assertFails(getDocs(query(collection(as(env, 'OTHER'), 'users'), where('tenantId', '==', 'OWNER'))));
  });
});

describe('users: oluşturma', () => {
  it('yeni kullanıcı kendi işletmesinin sahibi olarak kaydolabilir', async () => {
    const db = as(env, 'NEW', { email: 'new@test.local' });
    await assertSucceeds(setDoc(doc(db, 'users', 'NEW'), { tenantId: 'NEW', role: 'admin', isActive: true, email: 'new@test.local', displayName: 'Yeni' }));
  });

  it('başkasının dokümanını oluşturamaz', async () => {
    const db = as(env, 'NEW', { email: 'new@test.local' });
    await assertFails(setDoc(doc(db, 'users', 'NEW2'), { tenantId: 'NEW2', role: 'admin', isActive: true }));
  });

  it('davetsiz başka işletmeye katılamaz', async () => {
    const db = as(env, 'NEW', { email: 'new@test.local', email_verified: true });
    await assertFails(setDoc(doc(db, 'users', 'NEW'), { tenantId: 'OWNER', role: 'cashier', isActive: true }));
    await assertFails(setDoc(doc(db, 'users', 'NEW'), { tenantId: 'OWNER', role: 'admin', isActive: true }));
  });

  it('pasif ya da geçersiz rolle oluşturulamaz', async () => {
    const db = as(env, 'NEW', { email: 'new@test.local' });
    await assertFails(setDoc(doc(db, 'users', 'NEW'), { tenantId: 'NEW', role: 'admin', isActive: false }));
    await assertFails(setDoc(doc(db, 'users', 'NEW'), { tenantId: 'NEW', role: 'owner', isActive: true }));
  });
});
