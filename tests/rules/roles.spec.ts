import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch, type Firestore } from 'firebase/firestore';
import { as, BASE_USERS, createEnv, seed } from './helpers';

/**
 * Y4 (satış iptali: neden + denetim kaydı + kasiyer yalnız kendi / bugünkü satışı) ve
 * Y5 (ürün tanımı ve maliyet verisi yalnız yöneticide). Uygulama tarafı: cancel-policy.ts, permissions.ts.
 */
let env: RulesTestEnvironment;

const HOUR = 3600_000;
const now = () => Timestamp.fromMillis(Date.now());
const ago = (ms: number) => Timestamp.fromMillis(Date.now() - ms);
/** Türkiye saatine göre dünün öğlesi (UTC+3 iş günü) */
function yesterdayNoonTr(): Timestamp {
  const trNow = new Date(Date.now() + 3 * HOUR);
  const y = Date.UTC(trNow.getUTCFullYear(), trNow.getUTCMonth(), trNow.getUTCDate() - 1, 12) - 3 * HOUR;
  return Timestamp.fromMillis(y);
}

beforeAll(async () => { env = await createEnv(); });
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  // "Bugün" testleri gece yarısına çok yakınsa kaymasın: bugünkü satış = şimdi
  await seed(env, {
    ...BASE_USERS,
    'sales/OWN_TODAY': { tenantId: 'OWNER', totalAmount: 100, status: 'completed', createdBy: 'CASH', createdAt: now() },
    'sales/OWN_OLD': { tenantId: 'OWNER', totalAmount: 100, status: 'completed', createdBy: 'CASH', createdAt: yesterdayNoonTr() },
    'sales/OTHER_TODAY': { tenantId: 'OWNER', totalAmount: 100, status: 'completed', createdBy: 'OWNER', createdAt: ago(60_000) },
    'sales/DONE': { tenantId: 'OWNER', totalAmount: 100, status: 'cancelled', createdBy: 'CASH', createdAt: now() },
    'sales/B_SALE': { tenantId: 'OTHER', totalAmount: 100, status: 'completed', createdBy: 'OTHER', createdAt: now() },
    'products/P1': { tenantId: 'OWNER', name: 'Üre', purchasePrice: 900, salePrice: 1450, stock: 10, batches: [] },
  });
});

/** Uygulamanın yaptığı gibi: satış iptali + denetim kaydı tek yazımda. */
function cancelBatch(db: Firestore, saleId: string, uid: string, opts: { reason?: string | null; log?: boolean; logUid?: string; tenantId?: string } = {}) {
  const b = writeBatch(db);
  const reason = opts.reason === undefined ? 'Müşteri vazgeçti' : opts.reason;
  b.update(doc(db, 'sales', saleId), {
    status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: uid, cancelReason: reason,
  });
  if (opts.log !== false) {
    b.set(doc(db, 'auditLogs', `sale_cancel_${saleId}`), {
      tenantId: opts.tenantId ?? 'OWNER', actorUid: opts.logUid ?? uid, actorEmail: '', action: 'sale_cancel',
      saleId, detail: `${saleId} · ${reason}`, createdAt: serverTimestamp(),
    });
  }
  return b.commit();
}

describe('Y4: satış iptali', () => {
  it('kasiyer kendi bugünkü satışını nedenle iptal eder (denetim kaydıyla)', async () => {
    await assertSucceeds(cancelBatch(as(env, 'CASH'), 'OWN_TODAY', 'CASH'));
  });

  it('kasiyer dünkü satışını iptal edemez', async () => {
    await assertFails(cancelBatch(as(env, 'CASH'), 'OWN_OLD', 'CASH'));
  });

  it('kasiyer başkasının satışını iptal edemez', async () => {
    await assertFails(cancelBatch(as(env, 'CASH'), 'OTHER_TODAY', 'CASH'));
  });

  it('yönetici geçmiş günün ve başkasının satışını iptal eder', async () => {
    await assertSucceeds(cancelBatch(as(env, 'OWNER'), 'OWN_OLD', 'OWNER'));
    await assertSucceeds(cancelBatch(as(env, 'OWNER'), 'OTHER_TODAY', 'OWNER'));
  });

  it('personel iptal edemez', async () => {
    await assertFails(cancelBatch(as(env, 'STAFF'), 'OWN_TODAY', 'STAFF'));
  });

  it('neden zorunlu (yok / boş / 3 karakterden kısa)', async () => {
    const db = as(env, 'OWNER');
    await assertFails(cancelBatch(db, 'OTHER_TODAY', 'OWNER', { reason: null }));
    await assertFails(cancelBatch(db, 'OTHER_TODAY', 'OWNER', { reason: '' }));
    await assertFails(cancelBatch(db, 'OTHER_TODAY', 'OWNER', { reason: 'ab' }));
  });

  it('denetim kaydı olmadan iptal reddedilir', async () => {
    await assertFails(cancelBatch(as(env, 'OWNER'), 'OTHER_TODAY', 'OWNER', { log: false }));
  });

  it('iptal eden başkası gösterilemez; denetim kaydı başkası adına yazılamaz', async () => {
    await assertFails(cancelBatch(as(env, 'CASH'), 'OWN_TODAY', 'OWNER'));
    await assertFails(cancelBatch(as(env, 'CASH'), 'OWN_TODAY', 'CASH', { logUid: 'OWNER' }));
  });

  it('iptal sırasında tutar / kalem değiştirilemez; iptal geri alınamaz', async () => {
    const db = as(env, 'OWNER');
    const b = writeBatch(db);
    b.update(doc(db, 'sales', 'OTHER_TODAY'), { status: 'cancelled', cancelledBy: 'OWNER', cancelReason: 'Yanlış ürün', totalAmount: 1 });
    b.set(doc(db, 'auditLogs', 'sale_cancel_OTHER_TODAY'), {
      tenantId: 'OWNER', actorUid: 'OWNER', action: 'sale_cancel', saleId: 'OTHER_TODAY', detail: 'x', createdAt: serverTimestamp(),
    });
    await assertFails(b.commit());
    await assertFails(updateDoc(doc(db, 'sales', 'DONE'), { status: 'completed' }));
  });

  it('iptal olmadan tek başına denetim kaydı yazılamaz; başka işletmenin satışı için yazılamaz', async () => {
    await assertFails(setDoc(doc(as(env, 'CASH'), 'auditLogs', 'sale_cancel_OWN_TODAY'), {
      tenantId: 'OWNER', actorUid: 'CASH', action: 'sale_cancel', saleId: 'OWN_TODAY', detail: 'x', createdAt: serverTimestamp(),
    }));
    await assertFails(cancelBatch(as(env, 'CASH'), 'B_SALE', 'CASH', { tenantId: 'OTHER' }));
    await assertFails(cancelBatch(as(env, 'OWNER'), 'B_SALE', 'OWNER', { tenantId: 'OWNER' }));
  });

  it('iptal dışı satış güncellemesi (durum değişmeden) üye için açık kalır', async () => {
    await assertSucceeds(updateDoc(doc(as(env, 'CASH'), 'sales', 'OWN_TODAY'), { notes: 'not' }));
  });
});

describe('Y5: ürün tanımı yalnız yönetici', () => {
  it('kasiyer ürün ekleyemez, fiyat / ad değiştiremez, silemez', async () => {
    const db = as(env, 'CASH');
    await assertFails(setDoc(doc(db, 'products', 'NEW'), { tenantId: 'OWNER', name: 'X', salePrice: 1, purchasePrice: 1 }));
    await assertFails(updateDoc(doc(db, 'products', 'P1'), { salePrice: 1 }));
    await assertFails(updateDoc(doc(db, 'products', 'P1'), { purchasePrice: 1 }));
  });

  it('kasiyer / personel yalnız stok alanlarını günceller (satış, iptal, stok hareketi)', async () => {
    await assertSucceeds(updateDoc(doc(as(env, 'CASH'), 'products', 'P1'), { stock: 9, batches: [], expiryDate: null, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as(env, 'STAFF'), 'products', 'P1'), { stock: 8 }));
    await assertFails(updateDoc(doc(as(env, 'STAFF'), 'products', 'P1'), { stock: 7, salePrice: 2 }));
  });

  it('yönetici ürün ekler ve fiyat değiştirir', async () => {
    const db = as(env, 'OWNER');
    await assertSucceeds(setDoc(doc(db, 'products', 'NEW'), { tenantId: 'OWNER', name: 'X', salePrice: 1, purchasePrice: 1 }));
    await assertSucceeds(updateDoc(doc(db, 'products', 'P1'), { salePrice: 1500 }));
  });

  it('kasiyer gider yazamaz, tedarikçi ekleyemez', async () => {
    const db = as(env, 'CASH');
    await assertFails(setDoc(doc(db, 'expenses', 'E1'), { tenantId: 'OWNER', title: 'Kira', amount: 100 }));
    await assertFails(setDoc(doc(db, 'suppliers', 'S1'), { tenantId: 'OWNER', name: 'Toptancı' }));
    await assertSucceeds(setDoc(doc(as(env, 'OWNER'), 'suppliers', 'S1'), { tenantId: 'OWNER', name: 'Toptancı' }));
  });
});
