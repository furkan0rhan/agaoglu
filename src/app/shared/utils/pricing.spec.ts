import {
  marginPct, markupPct, netFromGross, netPurchasePrice, netSalePrice, priceBreakdown, productNetCost,
  roundKurus, unitProfit, vatFromGross, vatRateOf,
} from './pricing';

describe('pricing', () => {
  describe('roundKurus', () => {
    it('kuruşa yuvarlar (kayan nokta hatası dahil)', () => {
      expect(roundKurus(1.005)).toBe(1.01);
      expect(roundKurus(0.1 + 0.2)).toBe(0.3);
      expect(roundKurus(-1.005)).toBe(-1.01);
      expect(roundKurus(NaN)).toBe(0);
    });
  });

  describe('vatRateOf', () => {
    it('null / undefined / 0 / negatif / NaN → 0', () => {
      expect(vatRateOf(null)).toBe(0);
      expect(vatRateOf(undefined)).toBe(0);
      expect(vatRateOf(0)).toBe(0);
      expect(vatRateOf(-5)).toBe(0);
      expect(vatRateOf(NaN)).toBe(0);
      expect(vatRateOf(20)).toBe(20);
    });
  });

  describe('netSalePrice / vatFromGross', () => {
    it('%20 KDV dahil 120 → net 100, KDV 20', () => {
      expect(netSalePrice(120, 20)).toBe(100);
      expect(vatFromGross(120, 20)).toBe(20);
    });
    it('%10 ve %1 oranları', () => {
      expect(netSalePrice(110, 10)).toBe(100);
      expect(netSalePrice(101, 1)).toBe(100);
    });
    it('KDV yok/0 → net = brüt', () => {
      expect(netSalePrice(120, null)).toBe(120);
      expect(netSalePrice(120, 0)).toBe(120);
      expect(vatFromGross(120, null)).toBe(0);
    });
    it('kuruş yuvarlama: 99,99 %20 → 83,33 + 16,66', () => {
      expect(netSalePrice(99.99, 20)).toBe(83.33);
      expect(vatFromGross(99.99, 20)).toBe(16.66);
      expect(roundKurus(netSalePrice(99.99, 20) + vatFromGross(99.99, 20))).toBe(99.99);
    });
    it('netFromGross 0 ve geçersiz girdi', () => {
      expect(netFromGross(0, 20)).toBe(0);
      expect(netFromGross(NaN, 20)).toBe(0);
    });
  });

  describe('netPurchasePrice', () => {
    it('varsayılan: alış KDV hariç (değişmez)', () => {
      expect(netPurchasePrice(80, 20)).toBe(80);
      expect(netPurchasePrice(80, 20, false)).toBe(80);
    });
    it('alış KDV dahil işaretliyse KDV düşülür', () => {
      expect(netPurchasePrice(96, 20, true)).toBe(80);
    });
    it('KDV dahil ama oran yok → aynen', () => {
      expect(netPurchasePrice(96, null, true)).toBe(96);
    });
  });

  describe('unitProfit / markupPct / marginPct', () => {
    it('örnek: 120 KDV dahil, %20, alış 80 (hariç) → kâr 20, oran %25, marj %20', () => {
      expect(unitProfit(120, 80, 20)).toBe(20);
      expect(markupPct(120, 80, 20)).toBeCloseTo(25, 10);
      expect(marginPct(120, 80, 20)).toBeCloseTo(20, 10);
    });
    it('KDV değişince kâr değişir', () => {
      expect(unitProfit(120, 80, 0)).toBe(40);
      expect(unitProfit(120, 80, 10)).toBe(29.09);
      expect(unitProfit(120, 80, 20)).toBe(20);
    });
    it('alış KDV dahil: 120 / 96 (dahil) %20 → kâr 20', () => {
      expect(unitProfit(120, 96, 20, true)).toBe(20);
      expect(markupPct(120, 96, 20, true)).toBeCloseTo(25, 10);
    });
    it('zarar negatif döner', () => {
      expect(unitProfit(60, 80, 20)).toBe(-30);
      expect(markupPct(60, 80, 20)).toBeCloseTo(-37.5, 10);
    });
    it('alış 0 → markup null; satış 0 → margin null', () => {
      expect(markupPct(120, 0, 20)).toBeNull();
      expect(marginPct(0, 80, 20)).toBeNull();
    });
  });

  describe('priceBreakdown', () => {
    it('tam döküm', () => {
      const b = priceBreakdown({ salePrice: 120, purchasePrice: 80, vatRate: 20 });
      expect(b).toEqual({
        gross: 120, netSale: 100, vat: 20, vatRate: 20, netCost: 80, profit: 20,
        markup: expect.closeTo(25, 10), margin: expect.closeTo(20, 10),
      });
    });
    it('vatRate null ve purchasePriceIncludesVat null tolere edilir', () => {
      const b = priceBreakdown({ salePrice: 50, purchasePrice: 40, vatRate: null, purchasePriceIncludesVat: null });
      expect(b.netSale).toBe(50);
      expect(b.vat).toBe(0);
      expect(b.profit).toBe(10);
    });
  });

  describe('productNetCost', () => {
    it('ürünün net maliyeti', () => {
      expect(productNetCost({ purchasePrice: 80, vatRate: 20 })).toBe(80);
      expect(productNetCost({ purchasePrice: 96, vatRate: 20, purchasePriceIncludesVat: true })).toBe(80);
    });
  });
});
