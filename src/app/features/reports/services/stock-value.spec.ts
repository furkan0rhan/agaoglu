import type { Timestamp } from '@angular/fire/firestore';
import type { Batch, Product } from '../../../shared/models/product.model';
import { buildStockValue, stockValueLine } from './stock-value';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 30, 12, 0, 0).getTime();
const ts = (ms: number): Timestamp => ({ toMillis: () => ms, toDate: () => new Date(ms) } as unknown as Timestamp);
const dayTs = (offset: number) => { const d = new Date(NOW); d.setHours(0, 0, 0, 0); return ts(d.getTime() + offset * DAY); };
let seq = 0;
const batch = (q: number, exp: number | null): Batch =>
  ({ id: `b${++seq}`, quantity: q, gtsNo: null, expiryDate: exp == null ? null : dayTs(exp), addedAt: ts(0), supplierId: null });
const prod = (over: Partial<Product>): Product => ({
  id: 'p', name: 'Ürün', category: 'Gübre', stock: 10, purchasePrice: 100, salePrice: 120, vatRate: 20, isActive: true, batches: [], ...over,
} as Product);

describe('stock-value (5.11)', () => {
  it('alış KDV hariç, satış KDV hariç ve dahil; potansiyel kâr', () => {
    const l = stockValueLine(prod({}), 30, NOW);
    expect(l.costValue).toBe(1000);
    expect(l.saleValueNet).toBe(1000);
    expect(l.saleValueGross).toBe(1200);
    expect(l.potentialProfit).toBe(0);
  });

  it('alış fiyatı KDV dahil işaretli üründe KDV düşülür (pricing.ts)', () => {
    const l = stockValueLine(prod({ purchasePrice: 120, purchasePriceIncludesVat: true }), 30, NOW);
    expect(l.unitCost).toBe(100);
    expect(l.costValue).toBe(1000);
  });

  it('SKT yakın ve geçmiş miktarlar ayrılır, stokla sınırlanır', () => {
    const l = stockValueLine(prod({ stock: 6, batches: [batch(2, -3), batch(3, 10), batch(5, 31), batch(4, null)] }), 30, NOW);
    expect(l.expiredQty).toBe(2);
    expect(l.expiredCost).toBe(200);
    expect(l.nearExpiryQty).toBe(3);
    expect(l.nearExpiryCost).toBe(300);
    expect(l.nearExpirySaleNet).toBe(300);
    const capped = stockValueLine(prod({ stock: 1, batches: [batch(3, 5)] }), 30, NOW);
    expect(capped.nearExpiryQty).toBe(1);
  });

  it('kategori özetleri ve toplam; stoksuz / pasif / negatif stok hariç; alış fiyatı eksik sayılır', () => {
    const r = buildStockValue([
      prod({ id: 'a', name: 'A', category: 'Gübre', stock: 10 }),
      prod({ id: 'b', name: 'B', category: 'İlaç', stock: 2, purchasePrice: 0, salePrice: 50, vatRate: 0 }),
      prod({ id: 'c', name: 'C', category: 'Gübre', stock: 0 }),
      prod({ id: 'd', name: 'D', category: 'Gübre', stock: 5, isActive: false }),
      prod({ id: 'e', name: 'E', category: 'Gübre', stock: -3 }),
    ], 30, NOW);
    expect(r.lines.map(l => l.productId)).toEqual(['a', 'b']);
    expect(r.totals).toMatchObject({ productCount: 2, costValue: 1000, saleValueNet: 1100, saleValueGross: 1300, potentialProfit: 100, noCostCount: 1 });
    expect(r.categories.map(c => [c.category, c.costValue])).toEqual([['Gübre', 1000], ['İlaç', 0]]);
  });
});
