/**
 * firestore.rules — superadmin, destek erişimi (supportAccess) ve lisans testleri.
 *
 * Çalıştırma (Java + Firebase emulator gerekir):  npm run test:rules
 * (emulators:exec, FIRESTORE_EMULATOR_HOST ortam değişkenini kendisi ayarlar.)
 */
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where,
  type Firestore,
} from 'firebase/firestore';
import { as as asUser, createEnv } from './helpers';

const DAY = 86_400_000;
const future = (d: number) => Timestamp.fromMillis(Date.now() + d * DAY);

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createEnv();
});

afterAll(async () => {
  await env?.cleanup();
});

/**
 * OPEN: supportAccess açık, pro lisans.  CLOSED: supportAccess=false.  EXPIRED: deneme süresi dolmuş.
 * SUSP: askıda.  LEGACY: plan alanı yok (lisans öncesi).
 * SUPER: platformAdmins kaydı var, users dokümanı YOK.
 */
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore() as unknown as Firestore;
    const tenant = (id: string, extra: Record<string, unknown>) =>
      setDoc(doc(db, 'tenants', id), { name: id, ownerId: id, createdAt: Timestamp.now(), ...extra });
    const user = (uid: string, tenantId: string, role = 'admin') =>
      setDoc(doc(db, 'users', uid), { tenantId, role, isActive: true, email: `${uid}@t.local`, displayName: uid });

    await tenant('OPEN', { plan: 'pro', status: 'active', licenseExpiresAt: future(300), maxUsers: 10, supportAccess: true });
    await tenant('CLOSED', { plan: 'basic', status: 'active', licenseExpiresAt: future(300), maxUsers: 3, supportAccess: false });
    await tenant('EXPIRED', { plan: 'trial', status: 'active', trialEndsAt: future(-1), maxUsers: 3 });
    await tenant('SUSP', { plan: 'pro', status: 'suspended', licenseExpiresAt: future(300), maxUsers: 10 });
    await tenant('LEGACY', {});

    await user('OPEN', 'OPEN');
    await user('CLOSED', 'CLOSED');
    await user('EXPIRED', 'EXPIRED');
    await user('SUSP', 'SUSP');
    await user('LEGACY', 'LEGACY');
    await user('OPEN_CASH', 'OPEN', 'cashier');

    await setDoc(doc(db, 'platformAdmins', 'SUPER'), { email: 'super@test.local' });

    for (const t of ['OPEN', 'CLOSED', 'EXPIRED']) {
      await setDoc(doc(db, 'products', `P_${t}`), { tenantId: t, name: 'Ürün' });
    }
    await setDoc(doc(db, 'auditLogs', 'L1'), {
      tenantId: 'OPEN', actorUid: 'SUPER', actorEmail: 'super@test.local', action: 'support_start', detail: 'x',
      createdAt: Timestamp.now(),
    });
  });
});

const as = (uid: string) => asUser(env, uid, { email: `${uid}@t.local`, email_verified: true });

describe('superadmin: okuma', () => {
  it('her işletmenin tenants dokümanını okur ve listeler (supportAccess kapalı olsa da)', async () => {
    const db = as('SUPER');
    await assertSucceeds(getDoc(doc(db, 'tenants', 'OPEN')));
    await assertSucceeds(getDoc(doc(db, 'tenants', 'CLOSED')));
    await assertSucceeds(getDocs(collection(db, 'tenants')));
  });

  it('supportAccess açık işletmenin verisini okur', async () => {
    const db = as('SUPER');
    await assertSucceeds(getDoc(doc(db, 'products', 'P_OPEN')));
    await assertSucceeds(getDocs(query(collection(db, 'products'), where('tenantId', '==', 'OPEN'))));
  });

  it('supportAccess=false iken işletme verisini OKUYAMAZ', async () => {
    const db = as('SUPER');
    await assertFails(getDoc(doc(db, 'products', 'P_CLOSED')));
    await assertFails(getDocs(query(collection(db, 'products'), where('tenantId', '==', 'CLOSED'))));
  });

  it('tüm kullanıcıları listeler', async () => {
    await assertSucceeds(getDocs(collection(as('SUPER'), 'users')));
  });

  it('normal admin başka işletmeyi ve tenants listesini okuyamaz', async () => {
    const db = as('OPEN');
    await assertFails(getDoc(doc(db, 'products', 'P_CLOSED')));
    await assertFails(getDoc(doc(db, 'tenants', 'CLOSED')));
    await assertFails(getDocs(collection(db, 'tenants')));
  });
});

describe('superadmin: yazma', () => {
  it('destek modunda ürün ekler/günceller; tenantId değiştiremez', async () => {
    const db = as('SUPER');
    await assertSucceeds(setDoc(doc(db, 'products', 'NEW1'), { tenantId: 'OPEN', name: 'X', createdBy: 'SUPER' }));
    await assertSucceeds(updateDoc(doc(db, 'products', 'P_OPEN'), { name: 'Y' }));
    await assertFails(updateDoc(doc(db, 'products', 'P_OPEN'), { tenantId: 'CLOSED' }));
  });

  it('supportAccess=false işletmeye yazamaz', async () => {
    await assertFails(setDoc(doc(as('SUPER'), 'products', 'NEW2'), { tenantId: 'CLOSED', name: 'X' }));
  });

  it('lisans alanlarını değiştirir (supportAccess kapalı olsa da)', async () => {
    const db = as('SUPER');
    await assertSucceeds(updateDoc(doc(db, 'tenants', 'CLOSED'), { plan: 'pro', licenseExpiresAt: future(365) }));
    await assertSucceeds(updateDoc(doc(db, 'tenants', 'EXPIRED'), { status: 'suspended' }));
  });

  it('kullanıcının rol/aktifliğini değiştirir ama tenantId değiştiremez', async () => {
    const db = as('SUPER');
    await assertSucceeds(updateDoc(doc(db, 'users', 'OPEN_CASH'), { role: 'staff', isActive: false }));
    await assertFails(updateDoc(doc(db, 'users', 'OPEN_CASH'), { tenantId: 'CLOSED' }));
  });

  it('lisansı dolmuş işletmede de yazabilir (destek)', async () => {
    await assertSucceeds(setDoc(doc(as('SUPER'), 'sales', 'S_SUP'), { tenantId: 'EXPIRED', totalAmount: 10 }));
  });
});

describe('platformAdmins', () => {
  it('istemciden yazılamaz (kimse kendini superadmin yapamaz)', async () => {
    await assertFails(setDoc(doc(as('OPEN'), 'platformAdmins', 'OPEN'), { email: 'x' }));
    await assertFails(setDoc(doc(as('SUPER'), 'platformAdmins', 'OTHER'), { email: 'x' }));
    await assertFails(updateDoc(doc(as('SUPER'), 'platformAdmins', 'SUPER'), { note: 'x' }));
    await assertFails(deleteDoc(doc(as('SUPER'), 'platformAdmins', 'SUPER')));
  });

  it('kişi yalnız kendi kaydını okur; listelenemez', async () => {
    await assertSucceeds(getDoc(doc(as('SUPER'), 'platformAdmins', 'SUPER')));
    await assertSucceeds(getDoc(doc(as('OPEN'), 'platformAdmins', 'OPEN'))); // yok → izinli okuma, boş sonuç
    await assertFails(getDoc(doc(as('OPEN'), 'platformAdmins', 'SUPER')));
    await assertFails(getDocs(collection(as('SUPER'), 'platformAdmins')));
  });
});

describe('işletme admini: lisans alanları', () => {
  it('işletme bilgisi ve supportAccess değiştirebilir', async () => {
    const db = as('OPEN');
    await assertSucceeds(updateDoc(doc(db, 'tenants', 'OPEN'), { name: 'Yeni Ad', phone: '123', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db, 'tenants', 'OPEN'), { supportAccess: false }));
    await assertSucceeds(updateDoc(doc(db, 'tenants', 'OPEN'), { 'settings.prescriptionMode': 'warn' }));
    await assertFails(updateDoc(doc(db, 'tenants', 'OPEN'), { 'settings.prescriptionMode': 'yok' }));
    await assertSucceeds(updateDoc(doc(db, 'tenants', 'OPEN'), { dealerLicenseNo: 'BKU-45-001', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db, 'tenants', 'OPEN'), { 'settings.receipt.paperWidth': 58, 'settings.credit.defaultDueDays': 30 }));
    await assertFails(updateDoc(doc(db, 'tenants', 'OPEN'), { supportAccess: 'evet' }));
  });

  it('plan / status / bitiş / maxUsers DEĞİŞTİREMEZ', async () => {
    const db = as('OPEN');
    await assertFails(updateDoc(doc(db, 'tenants', 'OPEN'), { plan: 'basic' }));
    await assertFails(updateDoc(doc(db, 'tenants', 'OPEN'), { licenseExpiresAt: future(9999) }));
    await assertFails(updateDoc(doc(db, 'tenants', 'OPEN'), { maxUsers: 99 }));
    await assertFails(updateDoc(doc(db, 'tenants', 'SUSP'), { status: 'active' }));
    await assertFails(updateDoc(doc(as('EXPIRED'), 'tenants', 'EXPIRED'), { trialEndsAt: future(30) }));
  });

  it('kasiyer yalnız lastActiveAt yazabilir', async () => {
    const db = as('OPEN_CASH');
    await assertSucceeds(updateDoc(doc(db, 'tenants', 'OPEN'), { lastActiveAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'tenants', 'OPEN'), { name: 'X' }));
  });

  it('yeni işletme yalnız ≤31 günlük deneme ile oluşturulur', async () => {
    const db = as('NEWBIE');
    await assertFails(setDoc(doc(db, 'tenants', 'NEWBIE'), { name: 'N', ownerId: 'NEWBIE', plan: 'pro', trialEndsAt: future(30) }));
    await assertFails(setDoc(doc(db, 'tenants', 'NEWBIE'), { name: 'N', ownerId: 'NEWBIE', plan: 'trial', trialEndsAt: future(400) }));
    await assertFails(setDoc(doc(db, 'tenants', 'NEWBIE'), { name: 'N', ownerId: 'NEWBIE' }));
    await assertSucceeds(setDoc(doc(db, 'tenants', 'NEWBIE'), {
      name: 'N', ownerId: 'NEWBIE', plan: 'trial', status: 'active', trialEndsAt: future(30), maxUsers: 3, supportAccess: true,
    }));
  });
});

describe('lisans: salt okunur mod', () => {
  it('lisansı dolmuş işletmede satış oluşturulamaz', async () => {
    await assertFails(setDoc(doc(as('EXPIRED'), 'sales', 'S1'), { tenantId: 'EXPIRED', totalAmount: 10 }));
  });

  it('askıdaki işletmede ürün eklenemez/güncellenemez', async () => {
    await assertFails(setDoc(doc(as('SUSP'), 'products', 'PX'), { tenantId: 'SUSP', name: 'X' }));
  });

  it('lisansı dolmuş işletme verisini okuyabilir', async () => {
    await assertSucceeds(getDoc(doc(as('EXPIRED'), 'products', 'P_EXPIRED')));
    await assertFails(updateDoc(doc(as('EXPIRED'), 'products', 'P_EXPIRED'), { name: 'Y' }));
  });

  it('aktif ve eski (plan yok) işletmede satış oluşturulur', async () => {
    await assertSucceeds(setDoc(doc(as('OPEN'), 'sales', 'S2'), { tenantId: 'OPEN', totalAmount: 10 }));
    await assertSucceeds(setDoc(doc(as('LEGACY'), 'sales', 'S3'), { tenantId: 'LEGACY', totalAmount: 10 }));
  });
});

describe('auditLogs', () => {
  it('superadmin oluşturur; actorUid kendisi olmalı', async () => {
    const db = as('SUPER');
    await assertSucceeds(addDoc(collection(db, 'auditLogs'), {
      tenantId: 'OPEN', actorUid: 'SUPER', actorEmail: 'super@test.local', action: 'support_start', detail: 'x',
      createdAt: serverTimestamp(),
    }));
    await assertFails(addDoc(collection(db, 'auditLogs'), {
      tenantId: 'OPEN', actorUid: 'BASKA', actorEmail: '', action: 'support_start', detail: 'x', createdAt: serverTimestamp(),
    }));
  });

  it('işletme admini oluşturamaz, güncelleyemez, silemez; kendi kayıtlarını okur', async () => {
    const db = as('OPEN');
    await assertFails(addDoc(collection(db, 'auditLogs'), {
      tenantId: 'OPEN', actorUid: 'OPEN', actorEmail: '', action: 'support_end', detail: 'x', createdAt: serverTimestamp(),
    }));
    await assertSucceeds(getDocs(query(collection(db, 'auditLogs'), where('tenantId', '==', 'OPEN'))));
    await assertFails(updateDoc(doc(db, 'auditLogs', 'L1'), { detail: 'silindi' }));
    await assertFails(deleteDoc(doc(db, 'auditLogs', 'L1')));
    await assertFails(deleteDoc(doc(as('SUPER'), 'auditLogs', 'L1')));
  });

  it('başka işletmenin admini ve kasiyer okuyamaz', async () => {
    await assertFails(getDoc(doc(as('CLOSED'), 'auditLogs', 'L1')));
    await assertFails(getDoc(doc(as('OPEN_CASH'), 'auditLogs', 'L1')));
  });
});
