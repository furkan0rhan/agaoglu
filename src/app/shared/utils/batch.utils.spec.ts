import type { Timestamp } from '@angular/fire/firestore';
import type { Batch } from '../models/product.model';
import {
  applyFEFO, batchTotal, checkStockVsBatches, consumeFEFO, daysUntilExpiry, duplicateValues,
  expiryInfo, findBarcodeConflict, findGtsConflict, firstFEFO, isBatchExpired, nearestExpiry, sortFEFO,
} from './batch.utils';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 27, 12, 0, 0).getTime();

/** Firestore Timestamp'ın kullanılan kısmını taklit eder (toMillis / toDate) */
function ts(ms: number): Timestamp {
  return { toMillis: () => ms, toDate: () => new Date(ms) } as unknown as Timestamp;
}

function day(offset: number): Timestamp {
  const d = new Date(NOW);
  d.setHours(0, 0, 0, 0);
  return ts(d.getTime() + offset * DAY);
}

let seq = 0;
function batch(quantity: number, expiry: Timestamp | null, gtsNo: string | null = null): Batch {
  return { id: `b${++seq}`, quantity, expiryDate: expiry, gtsNo, addedAt: ts(NOW), supplierId: null };
}

describe('sortFEFO / firstFEFO', () => {
  it('SKT en yakın önce, SKT\'siz en sonda', () => {
    const a = batch(1, day(10)); const b = batch(1, null); const c = batch(1, day(2));
    expect(sortFEFO([a, b, c]).map(x => x.id)).toEqual([c.id, a.id, b.id]);
  });

  it('firstFEFO tükenmiş partiyi atlar', () => {
    const empty = batch(0, day(1)); const next = batch(3, day(5));
    expect(firstFEFO([empty, next])?.id).toBe(next.id);
    expect(firstFEFO([])).toBeNull();
  });
});

describe('consumeFEFO / applyFEFO', () => {
  it('en yakın SKT\'li partiden düşer, kısmi partiyi azaltır', () => {
    const near = batch(2, day(3)); const far = batch(5, day(30));
    const r = consumeFEFO([far, near], 4, NOW);
    expect(r.shortfall).toBe(0);
    expect(r.batches).toHaveLength(1);
    expect(r.batches[0]).toMatchObject({ id: far.id, quantity: 3 });
  });

  it('GTS birimlerini (quantity:1) tek tek düşer', () => {
    const units = [batch(1, day(5), 'G1'), batch(1, day(1), 'G2'), batch(1, day(9), 'G3')];
    const r = consumeFEFO(units, 2, NOW);
    expect(r.batches.map(b => b.gtsNo)).toEqual(['G3']);
  });

  it('yetersiz partide shortfall döndürür (sessizce yutmaz)', () => {
    const r = consumeFEFO([batch(2, null)], 5, NOW);
    expect(r.batches).toEqual([]);
    expect(r.shortfall).toBe(3);
  });

  it('süresi geçmiş partiden düşülen adedi raporlar', () => {
    const r = consumeFEFO([batch(2, day(-3)), batch(4, day(10))], 3, NOW);
    expect(r.expiredUsed).toBe(2);
  });

  it('girdiyi değiştirmez', () => {
    const b = batch(5, day(3));
    consumeFEFO([b], 2, NOW);
    expect(b.quantity).toBe(5);
  });

  it('applyFEFO geriye uyumlu: kalan partileri döndürür, yetersizlikte uyarır', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(applyFEFO([batch(3, day(1))], 1)[0].quantity).toBe(2);
    expect(warn).not.toHaveBeenCalled();
    expect(applyFEFO([batch(1, day(1))], 4)).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('SKT yardımcıları', () => {
  it('isBatchExpired: SKT günü boyunca geçerli, ertesi gün geçmiş', () => {
    expect(isBatchExpired({ expiryDate: day(0) }, NOW)).toBe(false);
    expect(isBatchExpired({ expiryDate: day(-1) }, NOW)).toBe(true);
    expect(isBatchExpired({ expiryDate: null }, NOW)).toBe(false);
  });

  it('daysUntilExpiry gün farkını verir', () => {
    expect(daysUntilExpiry({ expiryDate: day(0) }, NOW)).toBe(0);
    expect(daysUntilExpiry({ expiryDate: day(7) }, NOW)).toBe(7);
    expect(daysUntilExpiry({ expiryDate: day(-2) }, NOW)).toBe(-2);
    expect(daysUntilExpiry({ expiryDate: null }, NOW)).toBeNull();
  });

  it('nearestExpiry stoktaki en yakın SKT\'yi verir (tükenmiş partiler hariç)', () => {
    const exhausted = batch(0, day(-10));
    const soon = batch(1, day(4));
    expect(nearestExpiry([exhausted, soon, batch(2, null)])?.toMillis()).toBe(soon.expiryDate!.toMillis());
    expect(nearestExpiry([batch(2, null)])).toBeNull();
  });

  it('expiryInfo geçmiş SKT\'leri ayrıca işaretler', () => {
    const expired = batch(3, day(-1));
    const valid = batch(2, day(6));
    const info = expiryInfo([valid, expired, batch(1, null)], NOW);
    expect(info.nearest?.toMillis()).toBe(expired.expiryDate!.toMillis());
    expect(info.nearestValid?.toMillis()).toBe(valid.expiryDate!.toMillis());
    expect(info.expiredQty).toBe(3);
    expect(info.expiredBatchCount).toBe(1);
  });
});

describe('uzlaştırma (stock ↔ Σ parti)', () => {
  it('batchTotal negatif/boş partileri saymaz', () => {
    expect(batchTotal([batch(2, null), batch(0, null), batch(-1, null)])).toBe(2);
    expect(batchTotal(undefined)).toBe(0);
  });

  it('tutarlı ürün', () => {
    expect(checkStockVsBatches({ stock: 3, batches: [batch(1, null, 'A'), batch(2, null)] }))
      .toEqual({ stock: 3, batchTotal: 3, diff: 0, ok: true });
  });

  it('stok partilerden fazla / az', () => {
    expect(checkStockVsBatches({ stock: 5, batches: [batch(2, null)] })).toMatchObject({ diff: 3, ok: false });
    expect(checkStockVsBatches({ stock: 1, batches: [batch(2, null)] })).toMatchObject({ diff: -1, ok: false });
    expect(checkStockVsBatches({ stock: 4, batches: undefined as unknown as Batch[] })).toMatchObject({ batchTotal: 0, diff: 4 });
  });
});

describe('benzersizlik', () => {
  const products = [
    { id: 'p1', name: 'Gübre', barcode: '869001', batches: [batch(1, null, 'GTS-1'), batch(0, null, 'GTS-OLD')] },
    { id: 'p2', name: 'İlaç', barcode: '869002', batches: [batch(1, null, 'GTS-2')] },
  ];

  it('findGtsConflict başka üründeki GTS\'yi bulur, düzenlenen satırı ve tükenmiş birimi yok sayar', () => {
    expect(findGtsConflict(products, 'GTS-2')?.product.id).toBe('p2');
    expect(findGtsConflict(products, ' GTS-1 ')?.product.id).toBe('p1');
    const ownBatch = products[0].batches[0];
    expect(findGtsConflict(products, 'GTS-1', { productId: 'p1', batchId: ownBatch.id })).toBeNull();
    expect(findGtsConflict(products, 'GTS-OLD')).toBeNull();
    expect(findGtsConflict(products, '')).toBeNull();
  });

  it('findBarcodeConflict barkod ve GTS çakışmasını bulur, kendi ürününü hariç tutar', () => {
    expect(findBarcodeConflict(products, '869002')?.id).toBe('p2');
    expect(findBarcodeConflict(products, '869002', 'p2')).toBeNull();
    expect(findBarcodeConflict(products, 'GTS-1', 'p2')?.id).toBe('p1');
    expect(findBarcodeConflict(products, '   ')).toBeNull();
  });

  it('duplicateValues', () => {
    expect(duplicateValues(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b']);
  });
});
