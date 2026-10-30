import type { Timestamp } from '@angular/fire/firestore';
import type { Batch, Product } from '../../../shared/models/product.model';
import type { SupplierTransactionType } from '../../../shared/models/supplier.model';
import { consumeFEFO, duplicateValues, nearestExpiry, roundQty } from '../../../shared/utils/batch.utils';

/**
 * Alış belgesi saf hesapları (Firestore'a bağımlı değil → test edilebilir).
 * Parti kuralları ProductService.adjustStock ile aynıdır (memory/URUNLER-GTS.md):
 *  - GTS listesi doluysa her GTS = quantity:1 ayrı parti, miktar = GTS sayısı
 *  - GTS yoksa tek quantity:N parti (gtsNo:null)
 *  - Aynı üründe stokta olan bir GTS tekrar eklenemez
 */

export type PurchaseErrorCode =
  | 'duplicate-gts' | 'invalid-quantity' | 'invalid-price' | 'no-items' | 'no-supplier'
  | 'product-not-found' | 'supplier-not-found' | 'already-cancelled' | 'offline' | 'too-many-items'
  | 'invalid-amount';

export class PurchaseError extends Error {
  constructor(readonly code: PurchaseErrorCode, readonly detail: string | null = null) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'PurchaseError';
  }
}

export function roundKurus(x: number): number {
  return Math.round(((Number(x) || 0) + Number.EPSILON) * 100) / 100;
}

/** GTS listesini temizler (boşluk, boş satır). */
export function cleanGts(list: readonly string[] | null | undefined): string[] {
  return (list ?? []).map(g => g.trim()).filter(Boolean);
}

/** Virgül / satır sonu / boşlukla ayrılmış GTS metnini listeye çevirir. */
export function parseGtsText(text: string | null | undefined): string[] {
  return cleanGts((text ?? '').split(/[\s,;]+/));
}

export interface LineInput {
  quantity: number;
  unitCost: number;
  vatRate: number;
  gtsNumbers?: readonly string[] | null;
}

/** GTS varsa miktar = GTS sayısı */
export function effectiveQuantity(line: Pick<LineInput, 'quantity' | 'gtsNumbers'>): number {
  const gts = cleanGts(line.gtsNumbers);
  return gts.length > 0 ? gts.length : roundQty(line.quantity);
}

export function calcLine(line: LineInput): { quantity: number; lineSubtotal: number; lineVat: number } {
  const quantity = effectiveQuantity(line);
  const lineSubtotal = roundKurus(quantity * (Number(line.unitCost) || 0));
  const lineVat = roundKurus(lineSubtotal * (Number(line.vatRate) || 0) / 100);
  return { quantity, lineSubtotal, lineVat };
}

export interface PurchaseTotals {
  subtotal: number;
  discount: number;
  vatTotal: number;
  grandTotal: number;
}

/**
 * Belge toplamları. İskonto KDV hariç ara toplamdan düşülür, KDV iskonto oranında azalır
 * (faturadaki "iskonto sonrası KDV matrahı" mantığı). İskonto 0..subtotal aralığına sıkıştırılır.
 */
export function calcTotals(lines: readonly LineInput[], discount: number): PurchaseTotals {
  let subtotal = 0;
  let vatRaw = 0;
  for (const l of lines) {
    const c = calcLine(l);
    subtotal += c.lineSubtotal;
    vatRaw += c.lineVat;
  }
  subtotal = roundKurus(subtotal);
  const d = roundKurus(Math.min(Math.max(Number(discount) || 0, 0), subtotal));
  const ratio = subtotal > 0 ? (subtotal - d) / subtotal : 0;
  const vatTotal = roundKurus(vatRaw * ratio);
  return { subtotal, discount: d, vatTotal, grandTotal: roundKurus(subtotal - d + vatTotal) };
}

/** Kalem doğrulama (kaydetmeden önce). Hata yoksa null. */
export function validateLine(line: LineInput): PurchaseErrorCode | null {
  const gts = cleanGts(line.gtsNumbers);
  if (gts.length > 0 && duplicateValues(gts).length) return 'duplicate-gts';
  if (!(effectiveQuantity(line) > 0)) return 'invalid-quantity';
  if (!(Number(line.unitCost) >= 0) || !(Number(line.vatRate) >= 0)) return 'invalid-price';
  return null;
}

export interface StockApplyInput {
  quantity: number;
  expiryDate: Timestamp | null;
  gtsNumbers: readonly string[];
}

export interface StockState {
  stock: number;
  batches: Batch[];
  expiryDate: Timestamp | null;
}

/**
 * Ürüne alış kalemini uygular (stok artışı + parti(ler)).
 * @returns yeni stok durumu, eklenen parti kimlikleri ve eklenen miktar
 */
export function applyPurchaseItem(
  product: Pick<Product, 'stock' | 'batches'>,
  item: StockApplyInput,
  supplierId: string | null,
  addedAt: Timestamp,
  newId: () => string = () => crypto.randomUUID(),
): StockState & { batchIds: string[]; quantity: number } {
  const gts = cleanGts(item.gtsNumbers);
  const current = product.batches ?? [];
  if (gts.length > 0) {
    const existing = new Set(current.filter(b => b.quantity > 0 && b.gtsNo).map(b => b.gtsNo!));
    const dupes = [...duplicateValues(gts), ...gts.filter(g => existing.has(g))];
    if (dupes.length) throw new PurchaseError('duplicate-gts', [...new Set(dupes)].join(', '));
  }
  const quantity = gts.length > 0 ? gts.length : roundQty(item.quantity);
  if (!(quantity > 0)) throw new PurchaseError('invalid-quantity');

  const added: Batch[] = gts.length > 0
    ? gts.map(g => ({ id: newId(), quantity: 1, expiryDate: item.expiryDate, gtsNo: g, addedAt, supplierId }))
    : [{ id: newId(), quantity, expiryDate: item.expiryDate, gtsNo: null, addedAt, supplierId }];
  const batches = [...current, ...added];
  return {
    stock: roundQty((Number(product.stock) || 0) + quantity),
    batches,
    expiryDate: nearestExpiry(batches),
    batchIds: added.map(b => b.id),
    quantity,
  };
}

/**
 * Alış iptali: kalemin miktarı stoktan düşülür. Önce bu alışla eklenen partiler (hâlâ duruyorsa) düşülür,
 * satılmış/eksik kısım FEFO ile diğer partilerden alınır. Stok 0'ın altına inmez.
 * @returns `shortfall` > 0 → stok/partiler iptal miktarını karşılayamadı (mal satılmış)
 */
export function revertPurchaseItem(
  product: Pick<Product, 'stock' | 'batches'>,
  item: { quantity: number; batchIds: readonly string[] },
): StockState & { removed: number; shortfall: number } {
  let remaining = roundQty(item.quantity);
  const ids = new Set(item.batchIds ?? []);
  const kept: Batch[] = [];
  for (const b of product.batches ?? []) {
    if (remaining > 0 && ids.has(b.id) && b.quantity > 0) {
      const take = Math.min(b.quantity, remaining);
      remaining = roundQty(remaining - take);
      if (b.quantity > take) kept.push({ ...b, quantity: roundQty(b.quantity - take) });
      continue;
    }
    kept.push(b);
  }
  const fefo = remaining > 0 ? consumeFEFO(kept, remaining) : { batches: kept, shortfall: 0 };
  const currentStock = Number(product.stock) || 0;
  const target = roundQty(currentStock - item.quantity);
  const stock = Math.max(0, target);
  return {
    stock,
    batches: fefo.batches,
    expiryDate: nearestExpiry(fefo.batches),
    removed: roundQty(currentStock - stock),
    shortfall: Math.max(roundQty(-target), fefo.shortfall),
  };
}

/** Cari bakiye: alış borcu artırır, ödeme azaltır (ters kayıtlarda amount negatif gelir). */
export function nextSupplierBalance(current: number, type: SupplierTransactionType, amount: number): number {
  return roundKurus((Number(current) || 0) + (type === 'purchase' ? amount : -amount));
}

export interface PurchaseSummary {
  /** Aralıktaki aktif (iptal edilmemiş) alış belgelerinin genel toplamı */
  totalPurchases: number;
  /** Aralıktaki aktif alış sayısı */
  purchaseCount: number;
  /** Aralıktaki tedarikçi ödemeleri (ters kayıtlar düşülmüş) */
  totalPaid: number;
  /** Şu an tüm tedarikçilere toplam borç (pozitif bakiyeler) */
  supplierDebt: number;
}

export function summarize(
  purchases: readonly { status: string; grandTotal: number }[],
  transactions: readonly { type: SupplierTransactionType; amount: number }[],
  supplierBalances: readonly (number | null | undefined)[],
): PurchaseSummary {
  const active = purchases.filter(p => p.status !== 'cancelled');
  return {
    totalPurchases: roundKurus(active.reduce((s, p) => s + (Number(p.grandTotal) || 0), 0)),
    purchaseCount: active.length,
    totalPaid: roundKurus(transactions.filter(t => t.type === 'payment').reduce((s, t) => s + (Number(t.amount) || 0), 0)),
    supplierDebt: roundKurus(supplierBalances.reduce<number>((s, b) => s + Math.max(0, Number(b) || 0), 0)),
  };
}
