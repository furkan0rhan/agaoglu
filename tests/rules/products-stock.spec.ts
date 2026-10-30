import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  arrayRemove, arrayUnion, collection, doc, getDoc, increment, runTransaction, serverTimestamp, setDoc, Timestamp,
  updateDoc, writeBatch, type Firestore,
} from 'firebase/firestore';
import { as, BASE_USERS, createEnv, seed } from './helpers';
import { planSaleStock } from '../../src/app/features/pos/services/sale-stock';
import { diffBatches } from '../../src/app/shared/utils/batch.utils';
import type { Batch, Product } from '../../src/app/shared/models/product.model';

/**
 * 2.38: products.stock >= 0 ve parti miktarı >= 0 güvenlik ağı (istisna: aynı yazımda oluşturulan satış —
 * çevrimdışı fazla satış kaydı kaybolmasın). 2.2: iki kasa aynı ürünün farklı GTS birimlerini aynı anda satar.
 */
let env: RulesTestEnvironment;

const t0 = Timestamp.fromMillis(Date.UTC(2026, 0, 1));
const exp = Timestamp.fromMillis(Date.UTC(2030, 0, 1));
const unit = (id: string, gts: string): Batch => ({ id, quantity: 1, expiryDate: exp, gtsNo: gts, addedAt: t0, supplierId: null });

beforeAll(async () => { env = await createEnv(); });
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    ...BASE_USERS,
    'products/P1': { tenantId: 'OWNER', name: 'Üre', purchasePrice: 900, salePrice: 1450, stock: 10, batches: [] },
    'products/NEG': { tenantId: 'OWNER', name: 'Eksi', purchasePrice: 1, salePrice: 2, stock: -2, batches: [] },
    'products/GTS': {
      tenantId: 'OWNER', name: 'İlaç', purchasePrice: 1, salePrice: 2, stock: 3, isActive: true, productType: 'gubre',
      batches: [unit('u1', 'G1'), unit('u2', 'G2'), unit('u3', 'G3')],
    },
    'sales/OLD': { tenantId: 'OWNER', totalAmount: 1, status: 'completed', createdBy: 'CASH', createdAt: t0 },
  });
});

const sale = (uid = 'CASH') => ({ tenantId: 'OWNER', totalAmount: 10, status: 'completed', createdBy: uid, createdAt: serverTimestamp(), items: [] });

describe('2.38: stok >= 0', () => {
  it('kasiyer stoğu negatife yazamaz; 0 yazabilir', async () => {
    const db = as(env, 'CASH');
    await assertFails(updateDoc(doc(db, 'products', 'P1'), { stock: -1 }));
    await assertFails(updateDoc(doc(db, 'products', 'P1'), { stock: increment(-11) }));
    await assertSucceeds(updateDoc(doc(db, 'products', 'P1'), { stock: 0 }));
  });

  it('yönetici de negatif stok yazamaz; stok sayı olmalı', async () => {
    const db = as(env, 'OWNER');
    await assertFails(updateDoc(doc(db, 'products', 'P1'), { stock: -0.5 }));
    await assertFails(updateDoc(doc(db, 'products', 'P1'), { stock: '5' }));
  });

  it('yeni ürün negatif stokla / negatif partiyle oluşturulamaz', async () => {
    const db = as(env, 'OWNER');
    const base = { tenantId: 'OWNER', name: 'X', salePrice: 1, purchasePrice: 1 };
    await assertFails(setDoc(doc(db, 'products', 'N1'), { ...base, stock: -1, batches: [] }));
    await assertFails(setDoc(doc(db, 'products', 'N2'), { ...base, stock: 1, batches: [{ ...unit('a', 'X'), quantity: -1 }] }));
    await assertSucceeds(setDoc(doc(db, 'products', 'N3'), { ...base, stock: 1, batches: [unit('a', 'X')] }));
  });

  it('negatif parti miktarı reddedilir (ilk partide de, ileride de)', async () => {
    const db = as(env, 'CASH');
    const ok = [unit('a', 'A'), unit('b', 'B')];
    await assertFails(updateDoc(doc(db, 'products', 'P1'), { batches: [{ ...ok[0], quantity: -1 }, ok[1]] }));
    await assertFails(updateDoc(doc(db, 'products', 'P1'), { batches: [...ok, { ...ok[0], id: 'c', quantity: -3 }] }));
    await assertSucceeds(updateDoc(doc(db, 'products', 'P1'), { batches: ok, stock: 2 }));
  });

  it('stok zaten negatifse: ad değişikliği ve stok artışı yazılabilir, azaltma yazılamaz', async () => {
    await assertSucceeds(updateDoc(doc(as(env, 'OWNER'), 'products', 'NEG'), { name: 'Eksi 2' }));
    await assertSucceeds(updateDoc(doc(as(env, 'CASH'), 'products', 'NEG'), { stock: increment(1) }));
    await assertFails(updateDoc(doc(as(env, 'CASH'), 'products', 'NEG'), { stock: increment(-1) }));
  });

  it('çevrimdışı satış: aynı yazımda oluşturulan satış (lastSaleId) stoğu negatife düşürebilir', async () => {
    const db = as(env, 'CASH');
    const b = writeBatch(db);
    const saleRef = doc(collection(db, 'sales'));
    b.set(saleRef, sale());
    b.update(doc(db, 'products', 'P1'), { stock: increment(-12), lastSaleId: saleRef.id, updatedAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });

  it('lastSaleId mevcut (bu yazımda oluşturulmayan) satışı gösteriyorsa negatif stok reddedilir', async () => {
    const db = as(env, 'CASH');
    await assertFails(updateDoc(doc(db, 'products', 'P1'), { stock: increment(-12), lastSaleId: 'OLD' }));
    await assertFails(updateDoc(doc(db, 'products', 'P1'), { stock: increment(-12), lastSaleId: 'YOK' }));
  });
});

describe('2.2: iki kasa aynı ürünün farklı GTS birimlerini satar', () => {
  /** Uygulamanın çevrimdışı yolu (sale.service writeProductStock): increment + arrayRemove / arrayUnion. */
  function offlineSale(db: Firestore, stale: Product, gts: string) {
    const r = planSaleStock([{ item: { quantity: 1, gtsNos: [gts] }, product: stale }]);
    if (!r.plan) throw new Error(r.problem.kind);
    const ch = r.plan.products.get(stale.id)!;
    const { removed, added } = diffBatches(stale.batches ?? [], ch.batches);
    const saleRef = doc(collection(db, 'sales'));
    const b = writeBatch(db);
    b.set(saleRef, sale());
    const ref = doc(db, 'products', stale.id);
    b.update(ref, { stock: increment(-1), batches: arrayRemove(...removed), lastSaleId: saleRef.id, updatedAt: serverTimestamp() });
    if (added.length) b.update(ref, { batches: arrayUnion(...added) });
    return b.commit();
  }

  /** Uygulamanın çevrimiçi yolu: transaction içinde sunucudaki ürünle plan. */
  function onlineSale(db: Firestore, gts: string) {
    return runTransaction(db, async tx => {
      const ref = doc(db, 'products', 'GTS');
      const snap = await tx.get(ref);
      const fresh = { id: snap.id, ...snap.data() } as Product;
      const r = planSaleStock([{ item: { quantity: 1, gtsNos: [gts] }, product: fresh }]);
      if (!r.plan) throw new Error(r.problem.kind);
      const ch = r.plan.products.get('GTS')!;
      const saleRef = doc(collection(db, 'sales'));
      tx.set(saleRef, sale());
      tx.update(ref, { stock: increment(-1), batches: ch.batches, lastSaleId: saleRef.id, updatedAt: serverTimestamp() });
    });
  }

  async function readGts(): Promise<Product> {
    let p: Product | null = null;
    await env.withSecurityRulesDisabled(async ctx => {
      const s = await getDoc(doc(ctx.firestore() as unknown as Firestore, 'products', 'GTS'));
      p = { id: s.id, ...s.data() } as Product;
    });
    return p!;
  }

  it('çevrimiçi: eşzamanlı iki transaction — birim çoğalmaz / kaybolmaz', async () => {
    const a = as(env, 'CASH');
    const b = as(env, 'OWNER');
    await Promise.all([onlineSale(a, 'G1'), onlineSale(b, 'G2')]);
    const p = await readGts();
    expect(p.stock).toBe(1);
    expect((p.batches ?? []).map(x => x.gtsNo)).toEqual(['G3']);
  });

  it('çevrimdışı (bayat önbellek): arrayRemove ile iki kasa birbirinin sattığı birimi geri getirmez', async () => {
    const stale = await readGts();
    await Promise.all([offlineSale(as(env, 'CASH'), stale, 'G1'), offlineSale(as(env, 'OWNER'), stale, 'G2')]);
    const p = await readGts();
    expect(p.stock).toBe(1);
    expect((p.batches ?? []).map(x => x.gtsNo)).toEqual(['G3']);
  });

  it('çevrimdışı toplu parti kısmi düşüm: iki güncelleme aynı yazımda (arrayRemove + arrayUnion) kurallardan geçer', async () => {
    await seed(env, {
      'products/BULK': {
        tenantId: 'OWNER', name: 'Gübre', purchasePrice: 1, salePrice: 2, stock: 10, isActive: true,
        batches: [{ id: 'b1', quantity: 10, expiryDate: null, gtsNo: null, addedAt: t0, supplierId: null }],
      },
    });
    let stale: Product | null = null;
    await env.withSecurityRulesDisabled(async ctx => {
      const s = await getDoc(doc(ctx.firestore() as unknown as Firestore, 'products', 'BULK'));
      stale = { id: s.id, ...s.data() } as Product;
    });
    const r = planSaleStock([{ item: { quantity: 3 }, product: stale! }]);
    const ch = r.plan!.products.get('BULK')!;
    const { removed, added } = diffBatches(stale!.batches ?? [], ch.batches);
    expect(removed).toHaveLength(1);
    expect(added).toHaveLength(1);
    const db = as(env, 'CASH');
    const saleRef = doc(collection(db, 'sales'));
    const b = writeBatch(db);
    b.set(saleRef, sale());
    b.update(doc(db, 'products', 'BULK'), { stock: increment(-3), batches: arrayRemove(...removed), lastSaleId: saleRef.id });
    b.update(doc(db, 'products', 'BULK'), { batches: arrayUnion(...added) });
    await assertSucceeds(b.commit());
    await env.withSecurityRulesDisabled(async ctx => {
      const s = await getDoc(doc(ctx.firestore() as unknown as Firestore, 'products', 'BULK'));
      expect(s.data()?.['stock']).toBe(7);
      expect((s.data()?.['batches'] as Batch[]).map(x => x.quantity)).toEqual([7]);
    });
  });
});
