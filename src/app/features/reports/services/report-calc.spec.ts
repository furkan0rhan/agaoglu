import { Product } from '../../../shared/models/product.model';
import { Sale, SaleItem } from '../../../shared/models/sale.model';
import { productMap, saleCost, saleVat, salesByCategory, summarizeCollections, summarizeSales, topProducts } from './report-calc';
import { CreditTransaction } from '../../../shared/models/credit.model';

const item = (over: Partial<SaleItem> = {}): SaleItem => ({
  productId: 'p1', productName: 'Ürün', barcode: '', quantity: 1, unitPrice: 120, discount: 0,
  discountType: 'percent', totalPrice: 120, costPrice: 80, vatRate: 20, ...over,
});

const sale = (items: SaleItem[], over: Partial<Sale> = {}): Sale => ({
  id: 's', tenantId: 't', saleNumber: 'S-1', customerId: null, customerName: null, items,
  subtotal: items.reduce((a, i) => a + i.totalPrice, 0), totalDiscount: 0,
  totalAmount: items.reduce((a, i) => a + i.totalPrice, 0),
  paymentMethod: 'cash', cashPaid: 0, cardPaid: 0, creditAmount: 0, change: 0, status: 'completed', notes: null,
  interestRate: null, installmentCount: null, installmentAmount: null, totalWithInterest: null,
  ...over,
} as Sale);

const prod = (over: Partial<Product> = {}): Product => ({
  id: 'p1', purchasePrice: 80, salePrice: 120, vatRate: 20, ...over,
} as Product);

describe('report-calc — KDV ayrımı ve brüt kâr', () => {
  it('saleVat: 120 KDV dahil %20 → net 100, KDV 20', () => {
    expect(saleVat(sale([item()]), new Map())).toEqual({ net: 100, vat: 20, estimated: false });
  });

  it('saleVat: farklı oranlı kalemler', () => {
    const s = sale([item(), item({ productId: 'p2', totalPrice: 110, unitPrice: 110, vatRate: 10 })]);
    expect(saleVat(s, new Map())).toEqual({ net: 200, vat: 30, estimated: false });
  });

  it('saleVat: KDV oranı null (ürünün KDV\'si yok) → net = brüt, tahmini değil', () => {
    expect(saleVat(sale([item({ vatRate: null })]), new Map())).toEqual({ net: 120, vat: 0, estimated: false });
  });

  it('saleVat: genel indirim satırlara oransal dağıtılır', () => {
    // 2 × 120 satır = 240, genel indirim sonrası 216 (KDV dahil) → net 180, KDV 36
    const s = sale([item(), item({ productId: 'p2' })], { totalAmount: 216 });
    expect(saleVat(s, new Map())).toEqual({ net: 180, vat: 36, estimated: false });
  });

  it('saleVat: eski satış (vatRate yok) → ürünün güncel oranı, tahmini', () => {
    const old = item();
    delete old.vatRate;
    const r = saleVat(sale([old]), productMap([prod({ vatRate: 20 })]));
    expect(r).toEqual({ net: 100, vat: 20, estimated: true });
  });

  it('saleVat: eski satış ve ürün silinmiş → KDV 0 kabul', () => {
    const old = item();
    delete old.vatRate;
    expect(saleVat(sale([old]), new Map())).toEqual({ net: 120, vat: 0, estimated: true });
  });

  it('saleCost: costPrice yoksa ürünün net alış fiyatı (KDV dahil işaretliyse KDV düşülür)', () => {
    const old = item({ costPrice: undefined, quantity: 2, totalPrice: 240 });
    const r = saleCost(sale([old]), productMap([prod({ purchasePrice: 96, purchasePriceIncludesVat: true })]));
    expect(r).toEqual({ cost: 160, estimated: true });
  });

  it('summarizeSales: ciro (KDV dahil), net satış, KDV ve brüt kâr = net satış − maliyet', () => {
    const r = summarizeSales([sale([item({ quantity: 2, totalPrice: 240 })])], new Map());
    expect(r.revenue).toBe(240);
    expect(r.netRevenue).toBe(200);
    expect(r.vat).toBe(40);
    expect(r.cost).toBe(160);
    expect(r.grossProfit).toBe(40);
    expect(r.vatEstimated).toBe(false);
    expect(r.costEstimated).toBe(false);
  });

  it('summarizeSales: iptal edilen satışlar sayılmaz', () => {
    const r = summarizeSales([sale([item()]), sale([item()], { status: 'cancelled' })], new Map());
    expect(r.saleCount).toBe(1);
    expect(r.netRevenue).toBe(100);
  });

  it('summarizeSales: tahmini KDV işareti taşınır', () => {
    const old = item();
    delete old.vatRate;
    const r = summarizeSales([sale([old])], productMap([prod()]));
    expect(r.vatEstimated).toBe(true);
    expect(r.grossProfit).toBe(20);
  });
});

describe('summarizeCollections (Y11: Havale/EFT kasaya girmez)', () => {
  const pay = (amount: number, paymentMethod: CreditTransaction['paymentMethod']) =>
    ({ type: 'payment', amount, paymentMethod } as CreditTransaction);
  it('nakit, kart ve havale ayrı toplanır; toplam hepsini içerir', () => {
    const r = summarizeCollections([pay(100, 'cash'), pay(50, 'card'), pay(70.5, 'transfer'), pay(30, null),
      { type: 'debt', amount: 999, paymentMethod: null } as CreditTransaction]);
    expect(r).toEqual({ total: 250.5, cash: 130, card: 50, transfer: 70.5, count: 4 });
  });
});

describe('report-calc — birim bazlı miktar (Y13)', () => {
  it('kategori ve en çok satanlarda kg ile çuval toplanmaz', () => {
    const pm = productMap([prod({ id: 'p1', category: 'Gübre' } as Partial<Product>), prod({ id: 'p2', category: 'Gübre' } as Partial<Product>)]);
    const s = sale([
      item({ productId: 'p1', quantity: 250.5, unit: 'kg', totalPrice: 1000 }),
      item({ productId: 'p2', quantity: 4, unit: 'cuval', totalPrice: 4000 }),
      item({ productId: 'p2', quantity: 1, unit: 'cuval', totalPrice: 1000 }),
    ]);
    expect(salesByCategory([s], pm, 'Diğer')[0].units).toEqual([{ unit: 'kg', quantity: 250.5 }, { unit: 'cuval', quantity: 5 }]);
    expect(topProducts([s]).find(p => p.productId === 'p2')?.units).toEqual([{ unit: 'cuval', quantity: 5 }]);
  });
});
