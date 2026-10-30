import { Sale, SaleItem } from '../../../shared/models/sale.model';
import { Product } from '../../../shared/models/product.model';
import { CreditTransaction } from '../../../shared/models/credit.model';
import { Expense } from '../../../shared/models/expense.model';
import { Period } from '../../../shared/utils/date-range.util';
import { productNetCost, vatRateOf } from '../../../shared/utils/pricing';

/**
 * Rapor hesaplama kuralları (tek yer):
 * - Sadece status == 'completed' satışlar sayılır; status alanı olmayan eski kayıtlar completed kabul edilir.
 * - Ciro (KDV dahil) = Σ sale.totalAmount (indirimler düşülmüş, vade farkı HARİÇ).
 * - Net satış (KDV hariç) = Σ satır toplamı / (1 + kdv). Genel (sepet) indirimi satırlara oransal dağıtılır
 *   (satır × totalAmount / Σ satır). KDV oranı satış anındaki `item.vatRate` snapshot'ıdır; eski satışlarda
 *   yoksa ürünün güncel vatRate'i kullanılır (tahmini). KDV = Ciro − Net satış.
 * - Vade farkı geliri = Σ max(0, totalWithInterest − creditAmount) (faizli veresiye satışlarında).
 * - Maliyet (KDV hariç) = Σ costPrice × qty; costPrice yoksa ürünün güncel net alış fiyatı (tahmini).
 * - Brüt kâr = Net satış − Maliyet. Net kâr = Brüt kâr − dönem giderleri.
 * - Nakit = Σ (cashPaid − change), Kart = Σ cardPaid, Veresiye = Σ creditAmount.
 */

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export function isCompletedSale(s: Pick<Sale, 'status'>): boolean {
  return !s.status || s.status === 'completed';
}

export function toDate(ts: unknown): Date | null {
  if (!ts) return null;
  const anyTs = ts as { toDate?: () => Date };
  if (typeof anyTs.toDate === 'function') return anyTs.toDate();
  if (ts instanceof Date) return ts;
  return null;
}

/** Kalem indirimi (TL). */
export function itemDiscount(i: SaleItem): number {
  const d = i.discount ?? 0;
  return i.discountType === 'percent' ? i.unitPrice * i.quantity * (d / 100) : d * i.quantity;
}

/** Kalem net tutarı: unitPrice × qty − kalem indirimi. */
export function itemNet(i: SaleItem): number {
  return i.unitPrice * i.quantity - itemDiscount(i);
}

export function saleInterest(s: Sale): number {
  if (s.totalWithInterest == null) return 0;
  return Math.max(0, s.totalWithInterest - (s.creditAmount ?? s.totalAmount));
}

export interface CostResult { cost: number; estimated: boolean }

export function saleCost(s: Sale, products: ReadonlyMap<string, Product>): CostResult {
  let cost = 0;
  let estimated = false;
  for (const i of s.items ?? []) {
    // costPrice satış anındaki alış fiyatı snapshot'ı; eski satışlarda yok → güncel alış fiyatı (tahmini)
    if (typeof i.costPrice === 'number') {
      cost += i.costPrice * i.quantity;
    } else {
      estimated = true;
      const p = products.get(i.productId);
      cost += (p ? productNetCost(p) : 0) * i.quantity;
    }
  }
  return { cost, estimated };
}

export interface VatResult {
  /** KDV hariç net satış. */
  net: number;
  /** Satıştaki KDV (= totalAmount − net). */
  vat: number;
  /** En az bir kalemde KDV oranı snapshot'ı yok (ürünün güncel oranı kullanıldı). */
  estimated: boolean;
}

/** Bir satışın KDV dökümü (genel indirim satırlara oransal dağıtılır). */
export function saleVat(s: Sale, products: ReadonlyMap<string, Product>): VatResult {
  const total = s.totalAmount ?? 0;
  const items = s.items ?? [];
  const lines = items.map(i => (typeof i.totalPrice === 'number' ? i.totalPrice : itemNet(i)));
  const linesSum = lines.reduce((a, b) => a + b, 0);
  if (!items.length || !(linesSum > 0) || !(total > 0)) return { net: round2(total), vat: 0, estimated: false };
  const factor = total / linesSum;
  let net = 0;
  let estimated = false;
  items.forEach((i, idx) => {
    let rate: number;
    if (i.vatRate === undefined) {
      estimated = true;
      rate = vatRateOf(products.get(i.productId)?.vatRate);
    } else {
      rate = vatRateOf(i.vatRate);
    }
    const gross = lines[idx] * factor;
    net += rate ? gross / (1 + rate / 100) : gross;
  });
  net = round2(net);
  return { net, vat: round2(total - net), estimated };
}

export interface SalesSummary {
  saleCount: number;
  /** Ciro (KDV dahil). */
  revenue: number;
  /** Net satış (KDV hariç). */
  netRevenue: number;
  /** Satışlardaki KDV. */
  vat: number;
  /** KDV oranı bazı eski satışlarda yok → ürünün güncel oranı kullanıldı. */
  vatEstimated: boolean;
  cost: number;
  grossProfit: number;
  costEstimated: boolean;
  interestIncome: number;
  cash: number;
  card: number;
  credit: number;
}

export function summarizeSales(sales: Sale[], products: ReadonlyMap<string, Product>): SalesSummary {
  const r: SalesSummary = {
    saleCount: 0, revenue: 0, netRevenue: 0, vat: 0, vatEstimated: false, cost: 0, grossProfit: 0, costEstimated: false,
    interestIncome: 0, cash: 0, card: 0, credit: 0,
  };
  for (const s of sales) {
    if (!isCompletedSale(s)) continue;
    r.saleCount++;
    r.revenue += s.totalAmount ?? 0;
    const v = saleVat(s, products);
    r.netRevenue += v.net;
    r.vat += v.vat;
    if (v.estimated) r.vatEstimated = true;
    const c = saleCost(s, products);
    r.cost += c.cost;
    if (c.estimated) r.costEstimated = true;
    r.interestIncome += saleInterest(s);
    r.cash += Math.max(0, (s.cashPaid ?? 0) - (s.change ?? 0));
    r.card += s.cardPaid ?? 0;
    r.credit += s.creditAmount ?? 0;
  }
  r.grossProfit = r.netRevenue - r.cost;
  for (const k of ['revenue', 'netRevenue', 'vat', 'cost', 'grossProfit', 'interestIncome', 'cash', 'card', 'credit'] as const) {
    r[k] = round2(r[k]);
  }
  return r;
}

/** Tahsilatlar. Havale/EFT (Y11) kasaya girmez: `transfer` ayrı tutulur, `cash` yalnız elden nakit. */
export interface CollectionSummary { total: number; cash: number; card: number; transfer: number; count: number }

export function summarizeCollections(tx: CreditTransaction[]): CollectionSummary {
  const r: CollectionSummary = { total: 0, cash: 0, card: 0, transfer: 0, count: 0 };
  for (const t of tx) {
    if (t.type !== 'payment') continue;
    r.count++;
    r.total += t.amount ?? 0;
    if (t.paymentMethod === 'card') r.card += t.amount ?? 0;
    else if (t.paymentMethod === 'transfer') r.transfer += t.amount ?? 0;
    else r.cash += t.amount ?? 0;
  }
  r.total = round2(r.total); r.cash = round2(r.cash); r.card = round2(r.card); r.transfer = round2(r.transfer);
  return r;
}

export function sumExpenses(list: Expense[]): number {
  return round2(list.reduce((s, e) => s + (e.amount ?? 0), 0));
}

export interface ProductRow { productId: string; name: string; quantity: number; revenue: number }

export function topProducts(sales: Sale[], n = 10): ProductRow[] {
  const map = new Map<string, ProductRow>();
  for (const s of sales) {
    if (!isCompletedSale(s)) continue;
    for (const i of s.items ?? []) {
      const key = i.productId || i.productName;
      const row = map.get(key) ?? { productId: i.productId, name: i.productName, quantity: 0, revenue: 0 };
      row.quantity += i.quantity;
      row.revenue += itemNet(i);
      map.set(key, row);
    }
  }
  return [...map.values()]
    .map(r => ({ ...r, revenue: round2(r.revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, n);
}

export interface CategoryRow { category: string; quantity: number; revenue: number }

export function salesByCategory(sales: Sale[], products: ReadonlyMap<string, Product>, fallback: string): CategoryRow[] {
  const map = new Map<string, CategoryRow>();
  for (const s of sales) {
    if (!isCompletedSale(s)) continue;
    for (const i of s.items ?? []) {
      const cat = products.get(i.productId)?.category || fallback;
      const row = map.get(cat) ?? { category: cat, quantity: 0, revenue: 0 };
      row.quantity += i.quantity;
      row.revenue += itemNet(i);
      map.set(cat, row);
    }
  }
  return [...map.values()].map(r => ({ ...r, revenue: round2(r.revenue) })).sort((a, b) => b.revenue - a.revenue);
}

/** Satış trendi kovaları: today → 24 saat, week → 7 gün (Pzt..Paz), month → ayın günleri, year → 12 ay. */
export function trendBuckets(sales: Sale[], period: Period, start: Date): number[] {
  let size: number;
  switch (period) {
    case 'today': size = 24; break;
    case 'week': size = 7; break;
    case 'month': size = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate(); break;
    case 'year': size = 12; break;
  }
  const values = Array<number>(size).fill(0);
  for (const s of sales) {
    if (!isCompletedSale(s)) continue;
    const d = toDate(s.createdAt);
    if (!d) continue;
    let idx: number;
    switch (period) {
      case 'today': idx = d.getHours(); break;
      case 'week': idx = (d.getDay() + 6) % 7; break;
      case 'month': idx = d.getDate() - 1; break;
      case 'year': idx = d.getMonth(); break;
    }
    if (idx >= 0 && idx < size) values[idx] += s.totalAmount ?? 0;
  }
  return values.map(round2);
}

export function productMap(products: Product[]): Map<string, Product> {
  return new Map(products.map(p => [p.id, p]));
}

/** Grafik renkleri CSS değişkenlerinden (koyu tema uyumlu). `--chart-N` tanımlı değilse yedek palet. */
export interface ChartColors { text: string; grid: string; series: string[] }

export function readChartColors(): ChartColors {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fb: string) => css.getPropertyValue(name).trim() || fb;
  const fallback = ['#7fae86', '#86a6c9', '#e09486', '#e3a979', '#b4a0cf', '#c9b46a'];
  return {
    text: v('--text-secondary', '#64748b'),
    grid: v('--border-mid', '#e2e8f0'),
    series: fallback.map((c, i) => v(`--chart-${i + 1}`, c)),
  };
}
