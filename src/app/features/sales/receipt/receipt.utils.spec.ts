import { paymentToReceipt, receiptVatBreakdown, saleInstallments, saleToReceipt } from './receipt.utils';
import { Sale, SaleReceipt } from '../../../shared/models/sale.model';

type Item = SaleReceipt['items'][number];
const it2 = (totalPrice: number, vatRate?: number | null): Item => ({
  productName: 'X', quantity: 1, unit: 'adet', unitPrice: totalPrice, discount: 0, discountType: 'amount', totalPrice,
  ...(vatRate !== undefined ? { vatRate } : {}),
});

describe('receiptVatBreakdown (Y12)', () => {
  it('oran bazında matrah + KDV, toplam fiş tutarına eşit', () => {
    const rows = receiptVatBreakdown({ items: [it2(1200, 20), it2(101, 1), it2(600, 20)], totalAmount: 1901 });
    expect(rows).toEqual([
      { rate: 1, base: 100, vat: 1, gross: 101 },
      { rate: 20, base: 1500, vat: 300, gross: 1800 },
    ]);
  });

  it('genel indirim satırlara oransal dağıtılır', () => {
    // 1200 (%20) + 800 (%10), sepet indirimi %10 → 1080 + 720
    const rows = receiptVatBreakdown({ items: [it2(1200, 20), it2(800, 10)], totalAmount: 1800 });
    expect(rows.map(r => r.gross)).toEqual([720, 1080]);
    expect(rows[1]).toMatchObject({ rate: 20, base: 900, vat: 180 });
    expect(rows.reduce((s, r) => s + r.gross, 0)).toBe(1800);
  });

  it('oranı bilinmeyen (eski) kalemler ayrı satır; %0 matrahı brüt', () => {
    const rows = receiptVatBreakdown({ items: [it2(100), it2(50, 0)], totalAmount: 150 });
    expect(rows).toEqual([
      { rate: 0, base: 50, vat: 0, gross: 50 },
      { rate: null, base: 100, vat: 0, gross: 100 },
    ]);
  });

  it('boş / sıfır tutarlı fişte döküm yok', () => {
    expect(receiptVatBreakdown({ items: [], totalAmount: 0 })).toEqual([]);
  });
});

describe('saleInstallments / saleToReceipt (Y12)', () => {
  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
  it('3 taksit: son vadeden aylık geriye, kuruş farkı son taksitte', () => {
    const plan = saleInstallments({ creditAmount: 6587.25, totalWithInterest: 6916.61, installmentCount: 3 }, d(2027, 1, 30))!;
    expect(plan.map(i => i.dueDate)).toEqual([d(2026, 11, 30), d(2026, 12, 30), d(2027, 1, 30)]);
    expect(plan.map(i => i.amount)).toEqual([2305.53, 2305.53, 2305.55]);
  });

  it('vadesiz veya veresiyesiz satışta plan yok', () => {
    expect(saleInstallments({ creditAmount: 100, totalWithInterest: null, installmentCount: 1 }, null)).toBeNull();
    expect(saleInstallments({ creditAmount: 0, totalWithInterest: null, installmentCount: null }, d(2027, 1, 1))).toBeNull();
  });

  it('saleToReceipt taksitleri ve KDV oranını taşır', () => {
    const sale = {
      saleNumber: 'S-1', createdAt: { toDate: () => d(2026, 10, 30) }, customerName: 'Hüseyin',
      items: [{ productName: 'Üre', quantity: 1, unit: 'adet', unitPrice: 1450, discount: 0, discountType: 'amount', totalPrice: 1450, vatRate: 1 }],
      subtotal: 1450, totalDiscount: 0, totalAmount: 1450, paymentMethod: 'credit', cashPaid: 0, cardPaid: 0, creditAmount: 1450,
      change: 0, totalWithInterest: null, installmentCount: 1, creditDueDate: d(2027, 7, 15),
    } as unknown as Sale;
    const r = saleToReceipt(sale);
    expect(r.installments).toEqual([{ no: 1, dueDate: d(2027, 7, 15), amount: 1450 }]);
    expect(r.items[0].vatRate).toBe(1);
  });
});

describe('paymentToReceipt (Y11)', () => {
  it('havale tahsilatı: kalemsiz makbuz, nakit/kart alanları boş', () => {
    const r = paymentToReceipt({ amount: 500, method: 'transfer', previousBalance: 6916.61, newBalance: 6416.61 }, 'Hüseyin Kılıç', 'T-1');
    expect(r.kind).toBe('payment');
    expect(r.items).toEqual([]);
    expect(r.cashPaid).toBe(0);
    expect(r.cardPaid).toBe(0);
    expect(r.payment?.newBalance).toBe(6416.61);
  });
});
