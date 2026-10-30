import type { Product, ProductUnit } from '../../../shared/models/product.model';
import { productUnit } from '../../../shared/models/product.model';
import { isBatchExpired, roundQty } from '../../../shared/utils/batch.utils';
import { netSalePrice, productNetCost, roundKurus } from '../../../shared/utils/pricing';

/**
 * 5.11 Stok değer raporu (saf). KDV kuralı `shared/utils/pricing.ts` ile aynı:
 * - Alış değeri = stok × NET (KDV hariç) alış fiyatı (`productNetCost`; "alış KDV dahil" ürünlerde KDV düşülür).
 * - Satış değeri (KDV hariç) = stok × net satış fiyatı; Satış değeri (KDV dahil) = stok × satış fiyatı.
 * - Potansiyel brüt kâr = satış (KDV hariç) − alış (KDV hariç).
 * - SKT yakın: SKT'si bugün ile bugün + `nearDays` arasında olan partiler; SKT geçmiş: ayrı (BKÜ satılamaz).
 *   Parti miktarı stoktan büyükse stokla sınırlanır. Negatif stok 0 sayılır.
 */
export interface StockValueLine {
  productId: string;
  name: string;
  category: string;
  unit: ProductUnit;
  stock: number;
  unitCost: number;
  unitSaleNet: number;
  unitSaleGross: number;
  costValue: number;
  saleValueNet: number;
  saleValueGross: number;
  potentialProfit: number;
  nearExpiryQty: number;
  nearExpiryCost: number;
  nearExpirySaleNet: number;
  expiredQty: number;
  expiredCost: number;
  /** Alış fiyatı 0 / yok (alış değeri eksik). */
  noCost: boolean;
}

export interface StockValueTotals {
  productCount: number;
  costValue: number;
  saleValueNet: number;
  saleValueGross: number;
  potentialProfit: number;
  nearExpiryCost: number;
  nearExpirySaleNet: number;
  expiredCost: number;
  noCostCount: number;
}

export interface StockValueCategory extends StockValueTotals { category: string }

export interface StockValueReport {
  lines: StockValueLine[];
  categories: StockValueCategory[];
  totals: StockValueTotals;
}

const DAY_MS = 86_400_000;

function emptyTotals(): StockValueTotals {
  return {
    productCount: 0, costValue: 0, saleValueNet: 0, saleValueGross: 0, potentialProfit: 0,
    nearExpiryCost: 0, nearExpirySaleNet: 0, expiredCost: 0, noCostCount: 0,
  };
}

function add(t: StockValueTotals, l: StockValueLine): void {
  t.productCount++;
  t.costValue += l.costValue;
  t.saleValueNet += l.saleValueNet;
  t.saleValueGross += l.saleValueGross;
  t.potentialProfit += l.potentialProfit;
  t.nearExpiryCost += l.nearExpiryCost;
  t.nearExpirySaleNet += l.nearExpirySaleNet;
  t.expiredCost += l.expiredCost;
  if (l.noCost) t.noCostCount++;
}

function round(t: StockValueTotals): void {
  for (const k of ['costValue', 'saleValueNet', 'saleValueGross', 'potentialProfit', 'nearExpiryCost', 'nearExpirySaleNet', 'expiredCost'] as const) {
    t[k] = roundKurus(t[k]);
  }
}

export function stockValueLine(p: Product, nearDays: number, now: number = Date.now()): StockValueLine {
  const stock = Math.max(0, roundQty(Number(p.stock) || 0));
  const unitCost = productNetCost(p);
  const unitSaleGross = roundKurus(Number(p.salePrice) || 0);
  const unitSaleNet = netSalePrice(unitSaleGross, p.vatRate);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const limit = today.getTime() + (Math.max(0, nearDays) + 1) * DAY_MS; // bugün + N günün sonu
  let near = 0;
  let expired = 0;
  for (const b of p.batches ?? []) {
    if (!(b.quantity > 0) || !b.expiryDate) continue;
    if (isBatchExpired(b, now)) expired += b.quantity;
    else if (b.expiryDate.toMillis() < limit) near += b.quantity;
  }
  expired = roundQty(Math.min(expired, stock));
  near = roundQty(Math.min(near, Math.max(0, stock - expired)));
  const costValue = roundKurus(stock * unitCost);
  const saleValueNet = roundKurus(stock * unitSaleNet);
  return {
    productId: p.id, name: p.name, category: p.category || '—', unit: productUnit(p), stock,
    unitCost, unitSaleNet, unitSaleGross,
    costValue, saleValueNet, saleValueGross: roundKurus(stock * unitSaleGross),
    potentialProfit: roundKurus(saleValueNet - costValue),
    nearExpiryQty: near, nearExpiryCost: roundKurus(near * unitCost), nearExpirySaleNet: roundKurus(near * unitSaleNet),
    expiredQty: expired, expiredCost: roundKurus(expired * unitCost),
    noCost: !(unitCost > 0),
  };
}

/** Aktif ürünlerin stok değeri: ürün satırları (alış değeri büyükten küçüğe), kategori özetleri ve genel toplam. */
export function buildStockValue(products: readonly Product[], nearDays: number, now: number = Date.now()): StockValueReport {
  const lines = products
    .filter(p => p.isActive !== false)
    .map(p => stockValueLine(p, nearDays, now))
    .filter(l => l.stock > 0)
    .sort((a, b) => b.costValue - a.costValue || a.name.localeCompare(b.name, 'tr'));
  const totals = emptyTotals();
  const byCat = new Map<string, StockValueCategory>();
  for (const l of lines) {
    add(totals, l);
    let c = byCat.get(l.category);
    if (!c) { c = { category: l.category, ...emptyTotals() }; byCat.set(l.category, c); }
    add(c, l);
  }
  round(totals);
  const categories = [...byCat.values()];
  categories.forEach(round);
  categories.sort((a, b) => b.costValue - a.costValue || a.category.localeCompare(b.category, 'tr'));
  return { lines, categories, totals };
}
