import type { Timestamp } from '@angular/fire/firestore';
import type { Batch } from '../models/product.model';
import { BatchPickError, pickFromBatches } from './batch-pick.utils';

const ts = (ms: number): Timestamp => ({ toMillis: () => ms, toDate: () => new Date(ms) } as unknown as Timestamp);
const b = (id: string, quantity: number, gtsNo: string | null = null, exp = 1000): Batch =>
  ({ id, quantity, gtsNo, lotNo: gtsNo ? 'L1' : null, expiryDate: ts(exp), addedAt: ts(0), supplierId: null });

describe('pickFromBatches (11.13 firmaya iade)', () => {
  it('seçilen GTS birimleri çıkarılır, stok düşer, diğer partiler kalır', () => {
    const r = pickFromBatches(5, [b('g1', 1, 'G1', 100), b('g2', 1, 'G2', 200), b('lot', 3, null, 300)], [{ batchId: 'g1', quantity: 1 }, { batchId: 'g2', quantity: 1 }]);
    expect(r.quantity).toBe(2);
    expect(r.newStock).toBe(3);
    expect(r.shortfall).toBe(0);
    expect(r.batches.map(x => x.id)).toEqual(['lot']);
    expect(r.removed.map(x => x.gtsNo)).toEqual(['G1', 'G2']);
    expect(r.expiryDate?.toMillis()).toBe(300);
  });

  it('toplu partide kısmi çıkış (ondalıklı)', () => {
    const r = pickFromBatches(10, [b('lot', 10)], [{ batchId: 'lot', quantity: 2.5 }]);
    expect(r.batches[0].quantity).toBe(7.5);
    expect(r.newStock).toBe(7.5);
  });

  it('GTS birimi bölünemez, parti miktarı aşılamaz, olmayan parti reddedilir', () => {
    expect(() => pickFromBatches(5, [b('g1', 1, 'G1')], [{ batchId: 'g1', quantity: 0.5 }])).toThrow(BatchPickError);
    expect(() => pickFromBatches(5, [b('lot', 2)], [{ batchId: 'lot', quantity: 3 }])).toThrow(BatchPickError);
    expect(() => pickFromBatches(5, [b('lot', 2)], [{ batchId: 'x', quantity: 1 }])).toThrow(/batch-not-found/);
    expect(() => pickFromBatches(5, [b('lot', 2)], [])).toThrow(/no-picks/);
    expect(() => pickFromBatches(5, [b('lot', 2)], [{ batchId: 'lot', quantity: 0 }])).toThrow(/invalid-quantity/);
  });

  it('GTS etiketli eski toplu partide (quantity > 1) kısmi çıkış olabilir', () => {
    const r = pickFromBatches(18, [b('lotg', 18, 'G9')], [{ batchId: 'lotg', quantity: 10 }]);
    expect(r.batches[0].quantity).toBe(8);
    expect(r.removed[0]).toMatchObject({ gtsNo: 'G9', quantity: 10 });
  });

  it('stok < parti ise stok 0\'da kalır, fark shortfall', () => {
    const r = pickFromBatches(1, [b('lot', 3)], [{ batchId: 'lot', quantity: 3 }]);
    expect(r.newStock).toBe(0);
    expect(r.shortfall).toBe(2);
  });
});
