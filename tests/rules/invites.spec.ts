import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { as, BASE_USERS, createEnv, seed } from './helpers';

const INVITED = 'yeni@test.local';
const invite = { email: INVITED, tenantId: 'OWNER', role: 'cashier', createdBy: 'OWNER' };
const member = { tenantId: 'OWNER', role: 'cashier', isActive: true, email: INVITED, displayName: 'Yeni Kasiyer' };

let env: RulesTestEnvironment;

beforeAll(async () => { env = await createEnv(); });
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, BASE_USERS);
});

describe('davet oluşturma', () => {
  it('admin kendi işletmesine davet oluşturur', async () => {
    await assertSucceeds(setDoc(doc(as(env, 'OWNER'), 'invites', INVITED), invite));
  });

  it('kasiyer davet oluşturamaz', async () => {
    await assertFails(setDoc(doc(as(env, 'CASH'), 'invites', INVITED), { ...invite, createdBy: 'CASH' }));
  });

  it('başka işletme adına davet oluşturulamaz', async () => {
    await assertFails(setDoc(doc(as(env, 'OTHER'), 'invites', INVITED), { ...invite, createdBy: 'OTHER' }));
  });

  it('createdBy başkası olamaz, anahtar küçük harf olmalı, rol geçerli olmalı', async () => {
    const db = as(env, 'OWNER');
    await assertFails(setDoc(doc(db, 'invites', INVITED), { ...invite, createdBy: 'CASH' }));
    await assertFails(setDoc(doc(db, 'invites', 'Yeni@Test.local'), invite));
    await assertFails(setDoc(doc(db, 'invites', INVITED), { ...invite, role: 'superadmin' }));
  });

  it('var olan davetin üzerine (başka işletme) yazılamaz', async () => {
    await seed(env, { [`invites/${INVITED}`]: invite });
    await assertFails(setDoc(doc(as(env, 'OTHER'), 'invites', INVITED), { ...invite, tenantId: 'OTHER', createdBy: 'OTHER' }));
  });

  it('başka işletmenin admini daveti okuyamaz / silemez; sahibi silebilir', async () => {
    await seed(env, { [`invites/${INVITED}`]: invite });
    await assertFails(getDoc(doc(as(env, 'OTHER'), 'invites', INVITED)));
    await assertFails(deleteDoc(doc(as(env, 'OTHER'), 'invites', INVITED)));
    await assertSucceeds(deleteDoc(doc(as(env, 'OWNER'), 'invites', INVITED)));
  });
});

describe('davetle katılım', () => {
  beforeEach(async () => { await seed(env, { [`invites/${INVITED}`]: invite }); });

  it('e-postası doğrulanmış davetli işletmeye katılır ve daveti siler (tek batch)', async () => {
    const db = as(env, 'NEW', { email: INVITED, email_verified: true });
    await assertSucceeds(getDoc(doc(db, 'invites', INVITED)));
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', 'NEW'), member);
    batch.delete(doc(db, 'invites', INVITED));
    await assertSucceeds(batch.commit());
  });

  it('e-posta doğrulanmamışsa katılamaz', async () => {
    const db = as(env, 'NEW', { email: INVITED, email_verified: false });
    await assertFails(setDoc(doc(db, 'users', 'NEW'), member));
  });

  it('davetteki rolden farklı (admin) rolle katılamaz', async () => {
    const db = as(env, 'NEW', { email: INVITED, email_verified: true });
    await assertFails(setDoc(doc(db, 'users', 'NEW'), { ...member, role: 'admin' }));
  });

  it('davetteki işletmeden farklı işletmeye katılamaz', async () => {
    const db = as(env, 'NEW', { email: INVITED, email_verified: true });
    await assertFails(setDoc(doc(db, 'users', 'NEW'), { ...member, tenantId: 'OTHER' }));
  });

  it('başka e-postayla giriş yapan biri daveti kullanamaz / okuyamaz', async () => {
    const db = as(env, 'EVIL', { email: 'kotu@test.local', email_verified: true });
    await assertFails(setDoc(doc(db, 'users', 'EVIL'), { ...member, email: 'kotu@test.local' }));
    await assertFails(getDoc(doc(db, 'invites', INVITED)));
  });

  it('büyük harfli e-posta claim\'i küçük harfli davetle eşleşir', async () => {
    const db = as(env, 'NEW', { email: 'Yeni@Test.Local', email_verified: true });
    await assertSucceeds(setDoc(doc(db, 'users', 'NEW'), member));
  });
});
