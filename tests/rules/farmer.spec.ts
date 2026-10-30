/**
 * Çiftçi modülü kuralları (docs/CIFTCI-MODULU.md §5.3, TASKS 8.2 kabul kriterleri).
 * Çalıştırma: npm run test:rules
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch, type Firestore,
} from 'firebase/firestore';
import { anon, as, BASE_USERS, createEnv, seed } from './helpers';

const DOMAIN = 'ciftci.tarimmarket.app';
const PHONE = '905551234567';
const F_EMAIL = `${PHONE}@${DOMAIN}`;
const CODE = 'ABCDEFGHJK';
const CODE2 = 'KMNPQRSTUV';
const day = 24 * 3600 * 1000;
const future = () => Timestamp.fromMillis(Date.now() + 5 * day);
const consent = (fields = true, logs = true) => ({
  purchases: true, fields, logs, notifications: false, textVersion: 'v1', grantedAt: Timestamp.now(), updatedAt: Timestamp.now(),
});

const inviteDoc = (over: Record<string, unknown> = {}) => ({
  tenantId: 'OWNER', tenantName: 'Ağaoğlu Tarım', customerId: 'C1', customerName: 'Ali Yılmaz', phoneLast4: '4567',
  farmerId: null, expiresAt: future(), used: false, usedBy: null, usedFarmerId: null, revoked: false, createdBy: 'CASH',
  createdAt: Timestamp.now(), ...over,
});

const farmerToken = (email = F_EMAIL) => ({ email });

/** Uygulamadaki FirestoreFarmerAccountRepository.acceptInvite ile aynı batch (yeni çiftçi). */
function acceptBatch(db: Firestore, uid: string, fid: string, code = CODE, opts: { phone?: string; tenantId?: string; customerId?: string } = {}) {
  const b = writeBatch(db);
  b.set(doc(db, 'farmers', fid), {
    ownerUids: [uid], inviteCode: code, displayName: 'Ali Yılmaz', phone: opts.phone ?? PHONE, city: null, district: null,
    village: null, cksNo: null, deletionRequestedAt: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  b.set(doc(db, 'users', uid), {
    accountType: 'farmer', tenantId: null, role: null, canPrescribe: false, isActive: true, farmerId: fid,
    email: F_EMAIL, displayName: 'Ali Yılmaz', createdAt: serverTimestamp(),
  });
  b.set(doc(db, 'farmerLinks', `${opts.tenantId ?? 'OWNER'}_${fid}`), {
    tenantId: opts.tenantId ?? 'OWNER', farmerId: fid, customerId: opts.customerId ?? 'C1', inviteCode: code, status: 'active',
    consent: consent(), tenantName: 'Ağaoğlu Tarım', farmerName: 'Ali Yılmaz', balance: null, balanceUpdatedAt: null, createdAt: serverTimestamp(),
  });
  b.update(doc(db, 'farmerInvites', code), { used: true, usedBy: uid, usedFarmerId: fid, usedAt: serverTimestamp() });
  return b.commit();
}

/** Bağlı çiftçi FA (OWNER'a bağlı, tarla + defter paylaşıyor) ve bağlı olmayan çiftçi FB. */
const LINKED = {
  'customers/C1': { tenantId: 'OWNER', firstName: 'Ali', lastName: 'Yılmaz', phone: '05551234567', balance: 1250 },
  'customers/C2': { tenantId: 'OWNER', firstName: 'Veli', lastName: 'Kaya', phone: '05559998877', balance: 0 },
  'users/FA': { accountType: 'farmer', tenantId: null, role: null, canPrescribe: false, isActive: true, farmerId: 'farmerA', email: F_EMAIL },
  'users/FB': { accountType: 'farmer', tenantId: null, role: null, canPrescribe: false, isActive: true, farmerId: 'farmerB', email: `905559998877@${DOMAIN}` },
  'farmers/farmerA': { ownerUids: ['FA'], phone: PHONE, displayName: 'Ali Yılmaz' },
  'farmers/farmerB': { ownerUids: ['FB'], phone: '905559998877', displayName: 'Veli Kaya' },
  'farmerLinks/OWNER_farmerA': {
    tenantId: 'OWNER', farmerId: 'farmerA', customerId: 'C1', inviteCode: 'OLDCODE', status: 'active', consent: consent(), tenantName: 'Ağaoğlu Tarım', balance: null,
  },
  'fields/fA': { farmerId: 'farmerA', name: 'Kuzey', areaDecare: 12, irrigation: 'dry', sharedTenantIds: ['OWNER'], isActive: true },
  'fields/fA2': { farmerId: 'farmerA', name: 'Güney', areaDecare: 30, irrigation: 'dry', sharedTenantIds: [], isActive: true },
  'fields/fB': { farmerId: 'farmerB', name: 'B tarlası', areaDecare: 5, irrigation: 'dry', sharedTenantIds: [], isActive: true },
  'applicationLogs/lA': { farmerId: 'farmerA', fieldId: 'fA', type: 'pesticide', date: Timestamp.now(), sharedTenantIds: ['OWNER'] },
  'sales/S1': { tenantId: 'OWNER', customerId: 'C1', totalAmount: 500, items: [] },
  'sales/S2': { tenantId: 'OWNER', customerId: 'C2', totalAmount: 100, items: [] },
  'products/P1': { tenantId: 'OWNER', name: 'Abamectin', requiresPrescription: true, isActive: true },
  'products/P2': { tenantId: 'OWNER', name: '20.20.0', requiresPrescription: false, isActive: true },
  'creditTransactions/T1': { tenantId: 'OWNER', customerId: 'C1', amount: 500 },
  'farmerPurchases/S1': {
    farmerId: 'farmerA', tenantId: 'OWNER', saleId: 'S1', status: 'completed', items: [{ productName: '20.20.0', quantity: 5 }], totalAmount: 500,
  },
};

let env: RulesTestEnvironment;
beforeAll(async () => { env = await createEnv(); });
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, { ...BASE_USERS, ...LINKED });
});

describe('davet (bayi tarafı)', () => {
  it('admin ve kasiyer davet üretir; personel ve başka işletme üretemez', async () => {
    await assertSucceeds(setDoc(doc(as(env, 'CASH'), 'farmerInvites', CODE), inviteDoc()));
    await assertSucceeds(setDoc(doc(as(env, 'OWNER'), 'farmerInvites', CODE2), inviteDoc({ createdBy: 'OWNER' })));
    await assertFails(setDoc(doc(as(env, 'STAFF'), 'farmerInvites', 'STAFFCXYZ2'), inviteDoc({ createdBy: 'STAFF' })));
    await assertFails(setDoc(doc(as(env, 'OTHER'), 'farmerInvites', 'THERCXYZ22'), inviteDoc({ tenantId: 'OTHER', createdBy: 'OTHER' })));
  });

  it('kod biçimi, süre (≤ 8 gün) ve müşterinin işletmesi doğrulanır', async () => {
    const db = as(env, 'CASH');
    await assertFails(setDoc(doc(db, 'farmerInvites', 'short'), inviteDoc()));
    await assertFails(setDoc(doc(db, 'farmerInvites', CODE), inviteDoc({ expiresAt: Timestamp.fromMillis(Date.now() + 30 * day) })));
    await seed(env, { 'customers/CX': { tenantId: 'OTHER', firstName: 'X', lastName: 'Y', phone: '1' } });
    await assertFails(setDoc(doc(db, 'farmerInvites', CODE), inviteDoc({ customerId: 'CX' })));
  });

  it('davet tek dokümanı herkes okuyabilir ama listelenemez', async () => {
    await seed(env, { [`farmerInvites/${CODE}`]: inviteDoc() });
    await assertSucceeds(getDoc(doc(anon(env), 'farmerInvites', CODE)));
    await assertFails(getDocs(collection(anon(env), 'farmerInvites')));
    await assertFails(getDocs(query(collection(as(env, 'FB', farmerToken()), 'farmerInvites'), where('tenantId', '==', 'OWNER'))));
    await assertSucceeds(getDocs(query(collection(as(env, 'CASH'), 'farmerInvites'), where('tenantId', '==', 'OWNER'))));
  });
});

describe('davetle hesap + bağlantı (çiftçi tarafı)', () => {
  beforeEach(async () => { await seed(env, { [`farmerInvites/${CODE}`]: inviteDoc() }); });

  it('yeni çiftçi tek batch ile profil + kullanıcı + bağlantı oluşturur', async () => {
    await assertSucceeds(acceptBatch(as(env, 'NEWF', farmerToken()), 'NEWF', 'farmerNew'));
  });

  it('kullanılmış davet ikinci kez kullanılamaz', async () => {
    await assertSucceeds(acceptBatch(as(env, 'NEWF', farmerToken()), 'NEWF', 'farmerNew'));
    await assertFails(acceptBatch(as(env, 'NEWF2', farmerToken(`${PHONE}.1@${DOMAIN}`)), 'NEWF2', 'farmerNew2'));
  });

  it('süresi geçmiş veya iptal edilmiş davet reddedilir', async () => {
    await seed(env, { [`farmerInvites/${CODE}`]: inviteDoc({ expiresAt: Timestamp.fromMillis(Date.now() - day) }) });
    await assertFails(acceptBatch(as(env, 'NEWF', farmerToken()), 'NEWF', 'farmerNew'));
    await seed(env, { [`farmerInvites/${CODE}`]: inviteDoc({ revoked: true }) });
    await assertFails(acceptBatch(as(env, 'NEWF', farmerToken()), 'NEWF', 'farmerNew'));
  });

  it('telefon son 4 hanesi davetle eşleşmezse reddedilir', async () => {
    const other = `905550000000@${DOMAIN}`;
    await assertFails(acceptBatch(as(env, 'NEWF', farmerToken(other)), 'NEWF', 'farmerNew', CODE, { phone: '905550000000' }));
  });

  it('bağlantı davetteki müşteri/işletme dışına kurulamaz', async () => {
    await assertFails(acceptBatch(as(env, 'NEWF', farmerToken()), 'NEWF', 'farmerNew', CODE, { customerId: 'C2' }));
    await assertFails(acceptBatch(as(env, 'NEWF', farmerToken()), 'NEWF', 'farmerNew', CODE, { tenantId: 'OTHER' }));
  });

  it('çiftçi hesabı davetsiz oluşturulamaz, tenantId/rol/öneri yetkisi alamaz', async () => {
    const db = as(env, 'LONE', farmerToken());
    await assertFails(setDoc(doc(db, 'users', 'LONE'), {
      accountType: 'farmer', tenantId: null, role: null, canPrescribe: false, isActive: true, farmerId: 'farmerA', email: F_EMAIL,
    }));
    await assertFails(setDoc(doc(db, 'farmers', 'farmerZ'), { ownerUids: ['LONE'], phone: PHONE, inviteCode: CODE }));
  });

  it('PIN sıfırlama daveti: yeni uid profili devralır, eski uid erişemez', async () => {
    await seed(env, { [`farmerInvites/${CODE2}`]: inviteDoc({ farmerId: 'farmerA' }) });
    const newUid = 'FA2';
    const db = as(env, newUid, farmerToken(`${PHONE}.1@${DOMAIN}`));
    const b = writeBatch(db);
    b.update(doc(db, 'farmers', 'farmerA'), { ownerUids: [newUid], inviteCode: CODE2, updatedAt: serverTimestamp() });
    b.set(doc(db, 'users', newUid), {
      accountType: 'farmer', tenantId: null, role: null, canPrescribe: false, isActive: true, farmerId: 'farmerA',
      email: `${PHONE}.1@${DOMAIN}`, displayName: 'Ali', createdAt: serverTimestamp(),
    });
    b.set(doc(db, 'farmerLinks', 'OWNER_farmerA'), {
      tenantId: 'OWNER', farmerId: 'farmerA', customerId: 'C1', inviteCode: CODE2, status: 'active', consent: consent(),
      tenantName: 'Ağaoğlu Tarım', farmerName: 'Ali', balance: null, balanceUpdatedAt: null, createdAt: serverTimestamp(),
    });
    b.update(doc(db, 'farmerInvites', CODE2), { used: true, usedBy: newUid, usedFarmerId: 'farmerA', usedAt: serverTimestamp() });
    await assertSucceeds(b.commit());
    await assertSucceeds(getDoc(doc(as(env, newUid, farmerToken(`${PHONE}.1@${DOMAIN}`)), 'fields', 'fA')));
    await assertFails(getDoc(doc(as(env, 'FA', farmerToken()), 'fields', 'fA')));
  });

  it('başka çiftçinin profilini PIN sıfırlama davetsiz devralamaz', async () => {
    const db = as(env, 'FB', farmerToken(`905559998877@${DOMAIN}`));
    await assertFails(updateDoc(doc(db, 'farmers', 'farmerA'), { ownerUids: ['FB'], inviteCode: CODE, updatedAt: serverTimestamp() }));
  });
});

describe('izolasyon ve izinler', () => {
  it('çiftçi A, çiftçi B\'nin tarlasını okuyamaz; kendininkini okur', async () => {
    const a = as(env, 'FA', farmerToken());
    await assertSucceeds(getDoc(doc(a, 'fields', 'fA')));
    await assertFails(getDoc(doc(a, 'fields', 'fB')));
    await assertSucceeds(getDocs(query(collection(a, 'fields'), where('farmerId', '==', 'farmerA'))));
    await assertFails(getDocs(query(collection(a, 'fields'), where('farmerId', '==', 'farmerB'))));
  });

  it('bayi paylaşılan tarlayı okur; paylaşılmayanı ve başka bayi okuyamaz; personel (staff) göremez', async () => {
    await assertSucceeds(getDoc(doc(as(env, 'OWNER'), 'fields', 'fA')));
    await assertSucceeds(getDoc(doc(as(env, 'CASH'), 'fields', 'fA')));
    await assertFails(getDoc(doc(as(env, 'OWNER'), 'fields', 'fA2')));
    await assertFails(getDoc(doc(as(env, 'OTHER'), 'fields', 'fA')));
    await assertFails(getDoc(doc(as(env, 'STAFF'), 'fields', 'fA')));
    await assertSucceeds(getDocs(query(collection(as(env, 'OWNER'), 'fields'),
      where('farmerId', '==', 'farmerA'), where('sharedTenantIds', 'array-contains', 'OWNER'))));
  });

  it('izin geri alınınca (sharedTenantIds boşaltılır) bayi okuyamaz', async () => {
    const a = as(env, 'FA', farmerToken());
    await assertSucceeds(updateDoc(doc(a, 'farmerLinks', 'OWNER_farmerA'), { consent: consent(false, false), updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(a, 'fields', 'fA'), { sharedTenantIds: [] }));
    await assertSucceeds(updateDoc(doc(a, 'applicationLogs', 'lA'), { sharedTenantIds: [] }));
    await assertFails(getDoc(doc(as(env, 'OWNER'), 'fields', 'fA')));
    await assertFails(getDoc(doc(as(env, 'OWNER'), 'applicationLogs', 'lA')));
  });

  it('çiftçi bağlantıyı koparabilir, kendi başına yeniden açamaz', async () => {
    const a = as(env, 'FA', farmerToken());
    await assertSucceeds(updateDoc(doc(a, 'farmerLinks', 'OWNER_farmerA'), { status: 'revoked', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(a, 'farmerLinks', 'OWNER_farmerA'), { status: 'active', updatedAt: serverTimestamp() }));
    // bayi koparılmış bağlantıya bakiye yazamaz
    await assertFails(updateDoc(doc(as(env, 'OWNER'), 'farmerLinks', 'OWNER_farmerA'), { balance: 10 }));
  });

  it('çiftçi hesabı tenant koleksiyonlarını okuyamaz (products, sales, customers, creditTransactions)', async () => {
    const a = as(env, 'FA', farmerToken());
    await assertFails(getDoc(doc(a, 'products', 'P1')));
    await assertFails(getDoc(doc(a, 'sales', 'S1')));
    await assertFails(getDoc(doc(a, 'customers', 'C1')));
    await assertFails(getDoc(doc(a, 'creditTransactions', 'T1')));
    await assertFails(getDocs(query(collection(a, 'products'), where('tenantId', '==', 'OWNER'))));
  });

  it('bayi bağlantıda yalnız bakiye alanlarını yazar; izinleri değiştiremez', async () => {
    const o = as(env, 'OWNER');
    await assertSucceeds(updateDoc(doc(o, 'farmerLinks', 'OWNER_farmerA'), { balance: 1250, balanceUpdatedAt: serverTimestamp(), tenantName: 'Ağaoğlu' }));
    await assertFails(updateDoc(doc(o, 'farmerLinks', 'OWNER_farmerA'), { consent: consent(true, true) }));
  });

  it('bayi vade özetini (sıradaki ödeme, gecikme, taksit takvimi) yazar; çiftçi yazamaz', async () => {
    const summary = {
      nextDue: { date: future(), amount: 2143.33 }, overdueAmount: 0,
      schedule: [{ dueDate: future(), amount: 2143.33, remaining: 2143.33, no: 1, count: 3, saleNumber: 'S-1' }],
    };
    await assertSucceeds(updateDoc(doc(as(env, 'CASH'), 'farmerLinks', 'OWNER_farmerA'), { balance: 6430, balanceUpdatedAt: serverTimestamp(), ...summary }));
    await assertFails(updateDoc(doc(as(env, 'FA', farmerToken()), 'farmerLinks', 'OWNER_farmerA'), { overdueAmount: 999, nextDue: null }));
    await assertFails(updateDoc(doc(as(env, 'OTHER'), 'farmerLinks', 'OWNER_farmerA'), summary));
  });

  it('bayi müşteri kartına bağlı çiftçiyi işaretler (customers.farmerId); çiftçi işaretleyemez', async () => {
    await assertSucceeds(updateDoc(doc(as(env, 'CASH'), 'customers', 'C1'), { farmerId: 'farmerA' }));
    await assertSucceeds(updateDoc(doc(as(env, 'CASH'), 'customers', 'C1'), { farmerId: null }));
    await assertFails(updateDoc(doc(as(env, 'FA', farmerToken()), 'customers', 'C1'), { farmerId: 'farmerA' }));
  });
});

describe('ambar (farmerPurchases)', () => {
  it('bayi yalnız bağlı müşterinin satışını çiftçinin ambarına yazar', async () => {
    const o = as(env, 'OWNER');
    await assertSucceeds(setDoc(doc(o, 'farmerPurchases', 'S1'), { farmerId: 'farmerA', tenantId: 'OWNER', saleId: 'S1', status: 'completed', items: [] }, { merge: true }));
    await assertFails(setDoc(doc(o, 'farmerPurchases', 'S2'), { farmerId: 'farmerA', tenantId: 'OWNER', saleId: 'S2', status: 'completed', items: [] }));
    await assertFails(setDoc(doc(as(env, 'OTHER'), 'farmerPurchases', 'S1'), { farmerId: 'farmerA', tenantId: 'OTHER', saleId: 'S1', items: [] }));
  });

  it('çiftçi yalnız kalan miktarı günceller', async () => {
    const a = as(env, 'FA', farmerToken());
    await assertSucceeds(getDoc(doc(a, 'farmerPurchases', 'S1')));
    await assertSucceeds(updateDoc(doc(a, 'farmerPurchases', 'S1'), { 'remaining.0': 3 }));
    await assertFails(updateDoc(doc(a, 'farmerPurchases', 'S1'), { totalAmount: 0 }));
    await assertFails(getDoc(doc(as(env, 'FB', farmerToken()), 'farmerPurchases', 'S1')));
  });
});

describe('öneri / reçete (recommendations)', () => {
  const rec = (over: Record<string, unknown> = {}) => ({
    tenantId: 'OWNER', tenantName: 'Ağaoğlu Tarım', farmerId: 'farmerA', fieldId: 'fA', seasonId: null, target: 'Külleme',
    items: [{ productId: 'P2', productName: '20.20.0', dose: '20 kg/da', phiDays: null, requiresPrescription: false }],
    prescriptionNo: null, windowStart: null, windowEnd: null, notes: null,
    authorUid: 'OWNER', authorName: 'Sahip', authorLicenseNo: 'LIC-123', status: 'active', createdAt: serverTimestamp(), ...over,
  });
  const rxItem = { productId: 'P1', productName: 'Abamectin', dose: '50 ml/100 lt', phiDays: 7, requiresPrescription: false };

  beforeEach(async () => {
    await seed(env, { 'users/OWNER': { ...BASE_USERS['users/OWNER'], canPrescribe: true, prescriberLicenseNo: 'LIC-123' } });
  });

  it('yetkisiz kişi öneri yazamaz', async () => {
    await assertFails(setDoc(doc(as(env, 'CASH'), 'recommendations', 'r1'), rec({ authorUid: 'CASH' })));
    await assertFails(setDoc(doc(as(env, 'FA', farmerToken()), 'recommendations', 'r1'), rec({ authorUid: 'FA' })));
  });

  it('yetkili kişi yazar; yetki no kullanıcı kaydıyla aynı olmalı', async () => {
    await assertSucceeds(setDoc(doc(as(env, 'OWNER'), 'recommendations', 'r1'), rec()));
    await assertFails(setDoc(doc(as(env, 'OWNER'), 'recommendations', 'r2'), rec({ authorLicenseNo: 'SAHTE' })));
  });

  it('reçeteli ürün (ürün kartından) varsa e-reçete no zorunlu', async () => {
    await assertFails(setDoc(doc(as(env, 'OWNER'), 'recommendations', 'r1'), rec({ items: [rxItem] })));
    await assertSucceeds(setDoc(doc(as(env, 'OWNER'), 'recommendations', 'r1'), rec({ items: [rxItem], prescriptionNo: 'ER-2026-0001' })));
  });

  it('öneri kaleminde ürün türü ve birim (14.12) yazılır, çiftçi okur', async () => {
    const items = [{ productId: 'P2', productName: '20.20.0', dose: '20 kg/da', phiDays: null, requiresPrescription: false,
      productType: 'gubre', unit: 'kg' }];
    await assertSucceeds(setDoc(doc(as(env, 'OWNER'), 'recommendations', 'r1'), rec({ items })));
    const snap = await assertSucceeds(getDoc(doc(as(env, 'FA', farmerToken()), 'recommendations', 'r1')));
    expect(snap.data()?.['items'][0]).toMatchObject({ productType: 'gubre', unit: 'kg' });
    // eski biçim (alan yok) de geçerli kalır
    await assertSucceeds(setDoc(doc(as(env, 'OWNER'), 'recommendations', 'r2'), rec()));
  });

  it('öneri içeriği değiştirilemez, yalnız geri çekilir, silinemez; çiftçi okur', async () => {
    await assertSucceeds(setDoc(doc(as(env, 'OWNER'), 'recommendations', 'r1'), rec()));
    const o = as(env, 'OWNER');
    await assertFails(updateDoc(doc(o, 'recommendations', 'r1'), { target: 'Başka' }));
    await assertSucceeds(updateDoc(doc(o, 'recommendations', 'r1'), { status: 'withdrawn', withdrawnAt: serverTimestamp(), withdrawnBy: 'OWNER' }));
    await assertSucceeds(getDoc(doc(as(env, 'FA', farmerToken()), 'recommendations', 'r1')));
    await assertFails(getDoc(doc(as(env, 'FB', farmerToken()), 'recommendations', 'r1')));
  });

  it('öneri yetkisini yalnız işletme admini verir', async () => {
    await assertSucceeds(updateDoc(doc(as(env, 'OWNER'), 'users', 'CASH'), { canPrescribe: true, prescriberLicenseNo: 'LIC-9' }));
    await assertFails(updateDoc(doc(as(env, 'CASH'), 'users', 'CASH'), { canPrescribe: true, prescriberLicenseNo: 'SELF-777' }));
    await assertFails(updateDoc(doc(as(env, 'OTHER'), 'users', 'STAFF'), { canPrescribe: true, prescriberLicenseNo: 'LIC-9' }));
  });
});

describe('bayi "Çiftçiler" sayfası (işletme geneli sorgular, TASKS 14.9)', () => {
  it('admin/kasiyer kendi işletmesinin bağlantılarını listeler; personel ve başka işletme listeleyemez', async () => {
    const q = (uid: string) => getDocs(query(collection(as(env, uid), 'farmerLinks'), where('tenantId', '==', 'OWNER')));
    await assertSucceeds(q('OWNER'));
    await assertSucceeds(q('CASH'));
    await assertFails(q('STAFF'));
    await assertFails(q('OTHER'));
    await assertFails(getDocs(query(collection(as(env, 'FB', farmerToken()), 'farmerLinks'), where('tenantId', '==', 'OWNER'))));
  });

  it('bekleyen davetler listelenir ve iptal edilir (kasiyer); başka işletme göremez', async () => {
    await seed(env, { [`farmerInvites/${CODE}`]: inviteDoc() });
    const q = (uid: string) => getDocs(query(collection(as(env, uid), 'farmerInvites'), where('tenantId', '==', 'OWNER'), where('used', '==', false)));
    await assertSucceeds(q('CASH'));
    await assertFails(q('STAFF'));
    await assertFails(q('OTHER'));
    await assertFails(updateDoc(doc(as(env, 'OTHER'), 'farmerInvites', CODE), { revoked: true }));
    await assertSucceeds(updateDoc(doc(as(env, 'CASH'), 'farmerInvites', CODE), { revoked: true }));
  });

  it('öneri geçmişi işletme geneli (tarihe göre) listelenir', async () => {
    const q = (uid: string) => getDocs(query(collection(as(env, uid), 'recommendations'), where('tenantId', '==', 'OWNER'), orderBy('createdAt', 'desc'), limit(50)));
    await assertSucceeds(q('CASH'));
    await assertFails(q('STAFF'));
    await assertFails(q('OTHER'));
  });

  it('paylaşılan tarla/sezon/defter işletme geneli okunur (array-contains); paylaşmayan çiftçinin verisi sızmaz', async () => {
    await seed(env, {
      'seasons/sA': { farmerId: 'farmerA', fieldId: 'fA', crop: 'wheat', status: 'active', sharedTenantIds: ['OWNER'] },
      'applicationLogs/lA2': {
        farmerId: 'farmerA', fieldId: 'fA', type: 'pesticide', date: Timestamp.now(), sharedTenantIds: ['OWNER'],
        earliestHarvestDate: Timestamp.fromMillis(Date.now() + 3 * day),
      },
    });
    const c = as(env, 'CASH');
    const fields = await assertSucceeds(getDocs(query(collection(c, 'fields'), where('sharedTenantIds', 'array-contains', 'OWNER'))));
    if (fields.docs.some(d => d.id !== 'fA')) throw new Error('paylaşılmayan tarla döndü');
    await assertSucceeds(getDocs(query(collection(c, 'seasons'), where('sharedTenantIds', 'array-contains', 'OWNER'))));
    await assertSucceeds(getDocs(query(
      collection(c, 'applicationLogs'), where('sharedTenantIds', 'array-contains', 'OWNER'),
      where('earliestHarvestDate', '>=', Timestamp.fromMillis(Date.now() - day)),
    )));
    await assertSucceeds(getDocs(query(collection(c, 'applicationLogs'), where('sharedTenantIds', 'array-contains', 'OWNER'), orderBy('date', 'desc'), limit(200))));
    // personel ve başka işletme; filtresiz liste
    await assertFails(getDocs(query(collection(as(env, 'STAFF'), 'fields'), where('sharedTenantIds', 'array-contains', 'OWNER'))));
    await assertFails(getDocs(query(collection(as(env, 'OTHER'), 'fields'), where('sharedTenantIds', 'array-contains', 'OWNER'))));
    await assertFails(getDocs(collection(c, 'fields')));
  });
});
