import type { Timestamp } from '@angular/fire/firestore';
import type { Batch } from '../../../shared/models/product.model';
import { checkNewGts, planCount, planReconcile, planRemoveBatch, planStockIn, planStockOut, ProductStockError } from './stock-plan';

const ts = (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms) }) as unknown as Timestamp;
const NOW = Date.UTC(2026, 9, 30);
const b = (id: string, quantity: number, expDays: number | null, gtsNo: string | null = null): Batch =>
  ({ id, quantity, expiryDate: expDays == null ? null : ts(NOW + expDays * 86_400_000), gtsNo, addedAt: ts(0), supplierId: null });
const code = (fn: () => unknown) => { try { fn(); return null; } catch (e) { return (e as ProductStockError).code; } };

describe('stock-plan (2.2: sunucudaki güncel ürünle stok planı)', () => {
  it('giriş: partiler eklenir, stok = mevcut + Σ yeni', () => {
    const p = planStockIn({ stock: 2, batches: [b('a', 2, 10)] }, [b('n1', 1, 20, 'G1'), b('n2', 1, 20, 'G2')]);
    expect(p).toMatchObject({ stock: 4, previousStock: 2, quantity: 2, direction: 'in', shortfall: 0 });
    expect(p.batches.map(x => x.id)).toEqual(['a', 'n1', 'n2']);
  });

  it('GTS tekrarı: listede ya da üründeki stokta olan birimde reddedilir', () => {
    const cur = { stock: 1, batches: [b('a', 1, 10, 'G1'), b('z', 0, 10, 'G9')] };
    expect(code(() => checkNewGts(cur, ['G1']))).toBe('duplicate-gts');
    expect(code(() => checkNewGts(cur, ['G2', 'G2']))).toBe('duplicate-gts');
    expect(code(() => checkNewGts(cur, ['G9', 'G3']))).toBeNull(); // tükenmiş birimin GTS'si yeniden girilebilir
  });

  it('çıkış: FEFO (SKT yakın önce), stoktan fazlası reddedilir', () => {
    const cur = { stock: 5, batches: [b('late', 3, 90), b('soon', 2, 5)] };
    const p = planStockOut(cur, 3, NOW);
    expect(p).toMatchObject({ stock: 2, previousStock: 5, quantity: 3, direction: 'out', shortfall: 0 });
    expect(p.batches.map(x => [x.id, x.quantity])).toEqual([['late', 2]]);
    expect(code(() => planStockOut(cur, 6, NOW))).toBe('invalid-quantity');
    expect(code(() => planStockOut(cur, 0, NOW))).toBe('invalid-quantity');
  });

  it('çıkış: parti kaydı yetersizse shortfall döner (stok yine düşer)', () => {
    const p = planStockOut({ stock: 5, batches: [b('a', 2, 10)] }, 4, NOW);
    expect(p.stock).toBe(1);
    expect(p.shortfall).toBe(2);
    expect(p.batches).toEqual([]);
  });

  it('parti çıkarma: GTS birimi silinir, toplu partide kısmi düşüm, stok 0 altına inmez', () => {
    const cur = { stock: 3, batches: [b('u1', 1, 10, 'G1'), b('bulk', 2, 20)] };
    const g = planRemoveBatch(cur, 'u1');
    expect(g.batches.map(x => x.id)).toEqual(['bulk']);
    expect(g).toMatchObject({ stock: 2, quantity: 1, shortfall: 0 });
    expect(g.batch.gtsNo).toBe('G1');
    const part = planRemoveBatch(cur, 'bulk', 1);
    expect(part.batches.find(x => x.id === 'bulk')?.quantity).toBe(1);
    const low = planRemoveBatch({ stock: 1, batches: [b('bulk', 3, null)] }, 'bulk');
    expect(low).toMatchObject({ stock: 0, quantity: 1, shortfall: 2 });
    expect(code(() => planRemoveBatch(cur, 'yok'))).toBe('batch-not-found');
    expect(code(() => planRemoveBatch(cur, 'bulk', 3))).toBe('invalid-quantity');
  });

  it('uzlaştırma: stok = Σ parti ya da eksik parti eklenir; fark yoksa null', () => {
    const missing = (q: number) => b('m', q, null);
    expect(planReconcile({ stock: 2, batches: [b('a', 2, 1)] }, 'stockToBatches', missing)).toBeNull();
    const s = planReconcile({ stock: 5, batches: [b('a', 2, 1), b('z', 0, 1)] }, 'stockToBatches', missing)!;
    expect(s).toMatchObject({ stock: 2, previousStock: 5, quantity: 3, direction: 'out' });
    expect(s.batches.map(x => x.id)).toEqual(['a']);
    const add = planReconcile({ stock: 5, batches: [b('a', 2, 1)] }, 'addMissingBatch', missing)!;
    expect(add).toMatchObject({ stock: 5, quantity: 0 });
    expect(add.batches.map(x => [x.id, x.quantity])).toEqual([['a', 2], ['m', 3]]);
    expect(code(() => planReconcile({ stock: 1, batches: [b('a', 2, 1)] }, 'addMissingBatch', missing))).toBe('invalid-quantity');
  });

  it('sayım: hedef mutlak — fark GÜNCEL stoka göre (sayım sırasında satış olduysa ezilmez)', () => {
    const surplus = (q: number) => b('s', q, null);
    // Sayımda 8 sayıldı; bu arada başka kasa 2 sattı → sunucuda 8 kaldı → değişiklik yok
    expect(planCount({ stock: 8, batches: [b('a', 8, 10)] }, 8, surplus, NOW)).toBeNull();
    const up = planCount({ stock: 8, batches: [b('a', 8, 10)] }, 10, surplus, NOW)!;
    expect(up).toMatchObject({ stock: 10, direction: 'in', quantity: 2 });
    const down = planCount({ stock: 8, batches: [b('a', 8, 10)] }, 5, surplus, NOW)!;
    expect(down).toMatchObject({ stock: 5, direction: 'out', quantity: 3 });
    expect(code(() => planCount({ stock: 1, batches: [] }, -1, surplus, NOW))).toBe('invalid-quantity');
  });
});
