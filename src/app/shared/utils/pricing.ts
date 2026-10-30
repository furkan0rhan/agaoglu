/**
 * Fiyat / KDV / kâr hesaplarının TEK kaynağı (saf fonksiyonlar).
 *
 * Kurallar:
 * - Ürünün satış fiyatı (`salePrice`) KDV DAHİL saklanır.
 * - Alış fiyatı (`purchasePrice`) varsayılan olarak KDV HARİÇ'tir; ürün `purchasePriceIncludesVat: true`
 *   ise KDV dahil kabul edilir ve net alış = alış / (1 + KDV).
 * - Kâr, KDV hariç tutarlardan hesaplanır: birim kâr = net satış − net alış.
 * - Kâr oranı (markup) maliyete göre: kâr / net alış. Kâr marjı (margin) net satışa göre: kâr / net satış.
 * - KDV oranı null / undefined / 0 / geçersiz (negatif, NaN) → %0 kabul edilir (net = brüt).
 * - Tutarlar kuruşa (2 hane) yuvarlanır; yüzdeler yuvarlanmadan döner (gösterimde biçimlenir).
 */

/** Kuruşa yuvarla (0.005 → 0.01; kayan nokta hatasına karşı EPSILON). */
export function roundKurus(n: number): number {
  const v = Number(n) || 0;
  return Math.sign(v) * Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100;
}

/** Geçerli KDV oranı (%): null / 0 / negatif / NaN → 0. */
export function vatRateOf(vatRate: number | null | undefined): number {
  const r = Number(vatRate);
  return Number.isFinite(r) && r > 0 ? r : 0;
}

/** KDV dahil tutardan KDV hariç (net) tutar. */
export function netFromGross(gross: number, vatRate: number | null | undefined): number {
  const r = vatRateOf(vatRate);
  const g = Number(gross) || 0;
  return roundKurus(r ? g / (1 + r / 100) : g);
}

/** KDV dahil tutarın içindeki KDV. */
export function vatFromGross(gross: number, vatRate: number | null | undefined): number {
  return roundKurus((Number(gross) || 0) - netFromGross(gross, vatRate));
}

/** KDV dahil satış fiyatından net (KDV hariç) satış fiyatı. */
export function netSalePrice(salePrice: number, vatRate: number | null | undefined): number {
  return netFromGross(salePrice, vatRate);
}

/** Net (KDV hariç) alış fiyatı. `includesVat` false (varsayılan) ise alış fiyatı zaten nettir. */
export function netPurchasePrice(purchasePrice: number, vatRate: number | null | undefined, includesVat = false): number {
  return includesVat ? netFromGross(purchasePrice, vatRate) : roundKurus(purchasePrice);
}

/** Birim kâr (KDV hariç): net satış − net alış. */
export function unitProfit(
  salePrice: number, purchasePrice: number, vatRate: number | null | undefined, purchaseIncludesVat = false,
): number {
  return roundKurus(netSalePrice(salePrice, vatRate) - netPurchasePrice(purchasePrice, vatRate, purchaseIncludesVat));
}

/** Kâr oranı (%) — maliyete göre (kâr / net alış). Net alış ≤ 0 ise null. */
export function markupPct(
  salePrice: number, purchasePrice: number, vatRate: number | null | undefined, purchaseIncludesVat = false,
): number | null {
  const cost = netPurchasePrice(purchasePrice, vatRate, purchaseIncludesVat);
  if (!(cost > 0)) return null;
  return (unitProfit(salePrice, purchasePrice, vatRate, purchaseIncludesVat) / cost) * 100;
}

/** Kâr marjı (%) — net satışa göre (kâr / net satış). Net satış ≤ 0 ise null. */
export function marginPct(
  salePrice: number, purchasePrice: number, vatRate: number | null | undefined, purchaseIncludesVat = false,
): number | null {
  const net = netSalePrice(salePrice, vatRate);
  if (!(net > 0)) return null;
  return (unitProfit(salePrice, purchasePrice, vatRate, purchaseIncludesVat) / net) * 100;
}

/** Ürün fiyat alanları (Product'ın alt kümesi). */
export interface PricedProduct {
  salePrice: number;
  purchasePrice: number;
  vatRate?: number | null;
  purchasePriceIncludesVat?: boolean | null;
}

export interface PriceBreakdown {
  /** KDV dahil satış fiyatı. */
  gross: number;
  /** KDV hariç satış fiyatı. */
  netSale: number;
  /** Satış fiyatındaki KDV. */
  vat: number;
  /** Uygulanan KDV oranı (%; yoksa 0). */
  vatRate: number;
  /** KDV hariç alış (maliyet). */
  netCost: number;
  profit: number;
  markup: number | null;
  margin: number | null;
}

/** Ürünün tüm fiyat dökümü (form önizlemesi, detay kartı, liste). */
export function priceBreakdown(p: PricedProduct): PriceBreakdown {
  const sale = Number(p.salePrice) || 0;
  const buy = Number(p.purchasePrice) || 0;
  const inc = !!p.purchasePriceIncludesVat;
  const netSale = netSalePrice(sale, p.vatRate);
  return {
    gross: roundKurus(sale),
    netSale,
    vat: roundKurus(sale - netSale),
    vatRate: vatRateOf(p.vatRate),
    netCost: netPurchasePrice(buy, p.vatRate, inc),
    profit: unitProfit(sale, buy, p.vatRate, inc),
    markup: markupPct(sale, buy, p.vatRate, inc),
    margin: marginPct(sale, buy, p.vatRate, inc),
  };
}

/** Ürünün net (KDV hariç) birim maliyeti — satış kalemine `costPrice` olarak yazılır. */
export function productNetCost(p: Pick<PricedProduct, 'purchasePrice' | 'vatRate' | 'purchasePriceIncludesVat'>): number {
  return netPurchasePrice(Number(p.purchasePrice) || 0, p.vatRate, !!p.purchasePriceIncludesVat);
}
