import type { Timestamp } from '@angular/fire/firestore';
import type { Batch, Product } from '../../../shared/models/product.model';
import { returnCandidates, sortReturns, summarizeReturns } from './supplier-return.utils';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 30, 12, 0, 0).getTime();
const ts = (ms: number): Timestamp => ({ toMillis: () => ms, toDate: () => new Date(ms) } as unknown as Timestamp);
const dayTs = (offset: number) => { const d = new Date(NOW); d.setHours(0, 0, 0, 0); return ts(d.getTime() + offset * DAY); };
const batch = (id: string, q: number, expOffset: number | null): Batch =>
  ({ id, quantity: q, gtsNo: null, expiryDate: expOffset == null ? null : dayTs(expOffset), addedAt: ts(0), supplierId: null });
const product = (id: string, batches: Batch[], extra: Partial<Product> = {}): Product =>
  ({ id, name: id, productType: 'bitki_koruma', category: 'İlaç', isActive: true, stock: 0, batches, ...extra } as Product);

describe('returnCandidates (11.13 iade edilmeli, 30 gün)', () => {
  it('yalnız SKT geçmiş bitki koruma partileri; son gün = en eski SKT + 30', () => {
    const list = returnCandidates([
      product('A', [batch('a1', 2, -5), batch('a2', 1, -12), batch('a3', 4, 20)]),
      product('B', [batch('b1', 3, 10)]),
      product('C', [batch('c1', 3, -40)], { productType: 'gubre' }),
      product('D', [batch('d1', 0, -3)]),
    ], NOW);
    expect(list.map(c => c.product.id)).toEqual(['A']);
    expect(list[0].expiredQty).toBe(3);
    expect(list[0].batches.map(b => b.id)).toEqual(['a2', 'a1']);
    expect(list[0].daysLeft).toBe(18);
  });

  it('süresi geçen (30 günü aşan) en üstte, negatif kalan gün', () => {
    const list = returnCandidates([product('X', [batch('x', 1, -2)]), product('Y', [batch('y', 1, -35)])], NOW);
    expect(list.map(c => c.product.id)).toEqual(['Y', 'X']);
    expect(list[0].daysLeft).toBe(-5);
  });

  it('SKT bugün olan parti henüz geçmiş sayılmaz', () => {
    expect(returnCandidates([product('T', [batch('t', 1, 0)])], NOW)).toEqual([]);
  });
});

describe('summarizeReturns / sortReturns', () => {
  it('toplam maliyet ve birim satırları', () => {
    expect(summarizeReturns([
      { totalCost: 100.1, units: [{} as never, {} as never] },
      { totalCost: 50, units: [{} as never] },
    ])).toEqual({ count: 2, quantityLines: 3, totalCost: 150.1 });
  });
  it('yeni → eski', () => {
    const r = sortReturns([
      { id: '1', returnDate: dayTs(-3), createdAt: dayTs(-3) },
      { id: '2', returnDate: dayTs(-1), createdAt: dayTs(-1) },
    ] as never[]) as { id: string }[];
    expect(r.map(x => x.id)).toEqual(['2', '1']);
  });
});
