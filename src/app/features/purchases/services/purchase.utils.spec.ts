import type { Timestamp } from '@angular/fire/firestore';
import type { Batch } from '../../../shared/models/product.model';
import {
  PurchaseError, applyPurchaseItem, calcLine, calcTotals, effectiveQuantity, nextSupplierBalance, parseGtsText,
  revertPurchaseItem, summarize, validateLine,
} from './purchase.utils';

function ts(ms: number): Timestamp {
  return { toMillis: () => ms, toDate: () => new Date(ms) } as unknown as Timestamp;
}
const NOW = ts(Date.UTC(2026, 9, 27));
const SKT1 = ts(Date.UTC(2027, 0, 1));
const SKT2 = ts(Date.UTC(2027, 5, 1));

function seq(prefix = 'b') {
  let i = 0;
  return () => `${prefix}${++i}`;
}

function batch(id: string, quantity: number, gtsNo: string | null = null, expiryDate: Timestamp | null = null): Batch {
  return { id, quantity, gtsNo, expiryDate, addedAt: NOW, supplierId: null };
}

describe('purchase.utils — toplamlar', () => {
  it('kalem: miktar × birim fiyat ve KDV', () => {
    expect(calcLine({ quantity: 3, unitCost: 10.5, vatRate: 20 })).toEqual({ quantity: 3, lineSubtotal: 31.5, lineVat: 6.3 });
  });

  it('GTS varsa miktar = GTS sayısı', () => {
    expect(effectiveQuantity({ quantity: 99, gtsNumbers: ['A', ' B ', ''] })).toBe(2);
    expect(calcLine({ quantity: 99, unitCost: 5, vatRate: 0, gtsNumbers: ['A', 'B'] }).lineSubtotal).toBe(10);
  });

  it('iskonto KDV matrahından düşer, KDV orantılı azalır', () => {
    const t = calcTotals([{ quantity: 10, unitCost: 10, vatRate: 20 }], 10);
    expect(t).toEqual({ subtotal: 100, discount: 10, vatTotal: 18, grandTotal: 108 });
  });

  it('iskonto ara toplamı aşamaz, negatif olamaz', () => {
    expect(calcTotals([{ quantity: 1, unitCost: 50, vatRate: 10 }], 80).grandTotal).toBe(0);
    expect(calcTotals([{ quantity: 1, unitCost: 50, vatRate: 10 }], -5).discount).toBe(0);
  });

  it('karışık KDV oranları', () => {
    const t = calcTotals([
      { quantity: 2, unitCost: 100, vatRate: 20 },
      { quantity: 1, unitCost: 50, vatRate: 10 },
    ], 0);
    expect(t).toEqual({ subtotal: 250, discount: 0, vatTotal: 45, grandTotal: 295 });
  });

  it('doğrulama', () => {
    expect(validateLine({ quantity: 0, unitCost: 1, vatRate: 0 })).toBe('invalid-quantity');
    expect(validateLine({ quantity: 1, unitCost: -1, vatRate: 0 })).toBe('invalid-price');
    expect(validateLine({ quantity: 1, unitCost: 1, vatRate: 0, gtsNumbers: ['X', 'X'] })).toBe('duplicate-gts');
    expect(validateLine({ quantity: 2.5, unitCost: 1, vatRate: 20 })).toBeNull();
  });

  it('GTS metni ayrıştırma', () => {
    expect(parseGtsText('A1, A2\nA3;  A4 ')).toEqual(['A1', 'A2', 'A3', 'A4']);
    expect(parseGtsText('')).toEqual([]);
  });
});

describe('purchase.utils — alış stok artışı', () => {
  it('GTS yok: tek quantity:N parti, stok artar', () => {
    const r = applyPurchaseItem({ stock: 5, batches: [batch('old', 5)] }, { quantity: 10, expiryDate: SKT1, gtsNumbers: [] }, 'sup1', NOW, seq());
    expect(r.stock).toBe(15);
    expect(r.quantity).toBe(10);
    expect(r.batchIds).toEqual(['b1']);
    expect(r.batches).toHaveLength(2);
    expect(r.batches[1]).toMatchObject({ id: 'b1', quantity: 10, gtsNo: null, supplierId: 'sup1', expiryDate: SKT1 });
    expect(r.expiryDate).toBe(SKT1);
  });

  it('GTS listesi: her GTS quantity:1 ayrı parti, miktar = GTS sayısı', () => {
    const r = applyPurchaseItem({ stock: 0, batches: [] }, { quantity: 1, expiryDate: null, gtsNumbers: ['G1', 'G2', 'G3'] }, null, NOW, seq());
    expect(r.stock).toBe(3);
    expect(r.batches.map(b => [b.gtsNo, b.quantity])).toEqual([['G1', 1], ['G2', 1], ['G3', 1]]);
    expect(r.batchIds).toEqual(['b1', 'b2', 'b3']);
  });

  it('parti no (karekod AI 10) eklenen tüm partilere yazılır; yoksa alan yok', () => {
    const r = applyPurchaseItem({ stock: 0, batches: [] }, { quantity: 1, expiryDate: null, gtsNumbers: ['G1', 'G2'], lotNo: ' lot1 ' }, null, NOW, seq());
    expect(r.batches.map(b => b.lotNo)).toEqual(['LOT1', 'LOT1']);
    const q = applyPurchaseItem({ stock: 0, batches: [] }, { quantity: 4, expiryDate: null, gtsNumbers: [] }, null, NOW, seq());
    expect('lotNo' in q.batches[0]).toBe(false);
  });

  it('stokta olan GTS tekrar eklenemez', () => {
    expect(() => applyPurchaseItem({ stock: 1, batches: [batch('x', 1, 'G1')] }, { quantity: 1, expiryDate: null, gtsNumbers: ['G1'] }, null, NOW))
      .toThrow(PurchaseError);
  });

  it('ondalıklı miktar (kg) yuvarlanır', () => {
    const r = applyPurchaseItem({ stock: 0.1, batches: [] }, { quantity: 0.2, expiryDate: null, gtsNumbers: [] }, null, NOW, seq());
    expect(r.stock).toBe(0.3);
  });

  it('en yakın SKT güncellenir', () => {
    const r = applyPurchaseItem({ stock: 1, batches: [batch('o', 1, null, SKT2)] }, { quantity: 1, expiryDate: SKT1, gtsNumbers: [] }, null, NOW, seq());
    expect(r.expiryDate).toBe(SKT1);
  });
});

describe('purchase.utils — iptal (stok geri düşer)', () => {
  it('önce bu alışın partileri düşer', () => {
    const r = revertPurchaseItem(
      { stock: 15, batches: [batch('old', 5, null, SKT1), batch('p1', 10, null, SKT2)] },
      { quantity: 10, batchIds: ['p1'] },
    );
    expect(r.stock).toBe(5);
    expect(r.removed).toBe(10);
    expect(r.shortfall).toBe(0);
    expect(r.batches.map(b => b.id)).toEqual(['old']);
  });

  it('alış partisi kısmen satılmışsa kalan FEFO ile düşer', () => {
    const r = revertPurchaseItem(
      { stock: 12, batches: [batch('old', 5, null, SKT1), batch('p1', 7, null, SKT2)] },
      { quantity: 10, batchIds: ['p1'] },
    );
    expect(r.stock).toBe(2);
    expect(r.batches).toEqual([expect.objectContaining({ id: 'old', quantity: 2 })]);
    expect(r.shortfall).toBe(0);
  });

  it('mal satılmış ve stok yetmiyorsa stok 0, shortfall raporlanır', () => {
    const r = revertPurchaseItem({ stock: 3, batches: [batch('p1', 3)] }, { quantity: 10, batchIds: ['p1'] });
    expect(r.stock).toBe(0);
    expect(r.removed).toBe(3);
    expect(r.shortfall).toBe(7);
    expect(r.batches).toEqual([]);
  });

  it('GTS birimleri ID ile silinir', () => {
    const r = revertPurchaseItem(
      { stock: 3, batches: [batch('g1', 1, 'G1'), batch('g2', 1, 'G2'), batch('k', 1, 'K')] },
      { quantity: 2, batchIds: ['g1', 'g2'] },
    );
    expect(r.batches.map(b => b.gtsNo)).toEqual(['K']);
    expect(r.stock).toBe(1);
  });
});

describe('purchase.utils — tedarikçi cari bakiye', () => {
  it('alış borcu artırır, ödeme azaltır, ters kayıt geri alır', () => {
    let b = 0;
    b = nextSupplierBalance(b, 'purchase', 1180);
    expect(b).toBe(1180);
    b = nextSupplierBalance(b, 'payment', 500.1);
    expect(b).toBe(679.9);
    b = nextSupplierBalance(b, 'purchase', -1180); // iptal ters kaydı
    expect(b).toBe(-500.1); // tedarikçide alacak
    b = nextSupplierBalance(b, 'payment', -500.1); // ödeme ters kaydı
    expect(b).toBe(0);
  });

  it('peşin alış: alış + ödeme → bakiye değişmez', () => {
    const after = nextSupplierBalance(nextSupplierBalance(250, 'purchase', 100), 'payment', 100);
    expect(after).toBe(250);
  });

  it('özet: iptaller hariç alış, ödemeler (ters dahil), pozitif bakiyeler', () => {
    const s = summarize(
      [{ status: 'active', grandTotal: 100 }, { status: 'cancelled', grandTotal: 50 }, { status: 'active', grandTotal: 20.5 }],
      [{ type: 'payment', amount: 40 }, { type: 'purchase', amount: 100 }, { type: 'payment', amount: -10 }],
      [100, -20, null, 30.25],
    );
    expect(s).toEqual({ totalPurchases: 120.5, purchaseCount: 2, totalPaid: 30, supplierDebt: 130.25 });
  });
});
