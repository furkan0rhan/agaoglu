import { Batch, Product } from '../../../shared/models/product.model';
import { batchTotal, consumeFEFO, duplicateValues, roundQty } from '../../../shared/utils/batch.utils';

/**
 * Ürün kartı / stok sayımı stok planları (2.2) — Firestore'dan bağımsız, saf.
 * ProductService bunları `runTransaction` içinde SUNUCUDAN okunan ürünle çağırır; böylece iki kasa
 * (ya da kasa + ürün kartı) aynı ürüne aynı anda dokunsa da stok ve partiler bayat önbellekten ezilmez.
 */

export type ProductStockErrorCode =
  | 'duplicate-gts' | 'batch-not-found' | 'invalid-quantity' | 'product-not-found'
  /** İşlem sunucudaki güncel stokla transaction gerektirir; çevrimdışında yapılamaz (3.8). */
  | 'offline';

export class ProductStockError extends Error {
  constructor(readonly code: ProductStockErrorCode, readonly detail: string | null = null) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'ProductStockError';
  }
}

export type StockSnapshot = Pick<Product, 'stock' | 'batches'>;

export interface StockPlan {
  /** Yazılacak stok (mutlak — transaction içinde okunan değerden) */
  stock: number;
  previousStock: number;
  batches: Batch[];
  /** Hareket kaydı miktarı (|değişim|) ve yönü; 0 ise hareket yazılmaz */
  quantity: number;
  direction: 'in' | 'out';
  /** FEFO düşümünde partilerin karşılayamadığı miktar (0 = stok ve partiler tutarlı düştü) */
  shortfall: number;
}

const stockOf = (p: StockSnapshot) => roundQty(Number(p.stock) || 0);

/** GTS listesini kırp, boşları at; ürün içi / liste içi tekrar varsa hata. */
export function checkNewGts(current: StockSnapshot, gtsList: readonly string[]): void {
  const existing = new Set((current.batches ?? []).filter(b => b.quantity > 0 && b.gtsNo).map(b => b.gtsNo!));
  const dupes = [...duplicateValues([...gtsList]), ...gtsList.filter(g => existing.has(g))];
  if (dupes.length) throw new ProductStockError('duplicate-gts', [...new Set(dupes)].join(', '));
}

/** Stok girişi: yeni partiler eklenir, stok = mevcut + Σ yeni. */
export function planStockIn(current: StockSnapshot, newBatches: readonly Batch[]): StockPlan {
  const delta = batchTotal(newBatches);
  if (!(delta > 0)) throw new ProductStockError('invalid-quantity');
  const previousStock = stockOf(current);
  return {
    stock: roundQty(previousStock + delta), previousStock,
    batches: [...(current.batches ?? []), ...newBatches],
    quantity: delta, direction: 'in', shortfall: 0,
  };
}

/**
 * Stok çıkışı (FEFO). Stok 0'ın altına inmez: mevcut stoktan fazlası istenirse `invalid-quantity`
 * (ürün kartında çıkış miktarı güncel stokla sınırlı; kurallar da stock >= 0 ister, 2.38).
 */
export function planStockOut(current: StockSnapshot, quantity: number, now: number = Date.now()): StockPlan {
  const qty = roundQty(quantity);
  const previousStock = stockOf(current);
  if (!(qty > 0) || qty > previousStock) throw new ProductStockError('invalid-quantity');
  const r = consumeFEFO(current.batches ?? [], qty, now);
  return { stock: roundQty(previousStock - qty), previousStock, batches: r.batches, quantity: qty, direction: 'out', shortfall: r.shortfall };
}

/**
 * Tek partiden çıkış: GTS'li birim / tamamı → parti silinir, kısmi → miktarı düşer.
 * Stok 0'a sabitlenir; `shortfall` > 0 ise stok partiden azdı.
 */
export function planRemoveBatch(current: StockSnapshot, batchId: string, quantity?: number): StockPlan & { batch: Batch } {
  const batches = current.batches ?? [];
  const target = batches.find(b => b.id === batchId);
  if (!target) throw new ProductStockError('batch-not-found');
  const removeQty = quantity == null ? target.quantity : roundQty(quantity);
  if (!(removeQty > 0) || removeQty > target.quantity) throw new ProductStockError('invalid-quantity');
  const remaining = removeQty === target.quantity
    ? batches.filter(b => b.id !== batchId)
    : batches.map(b => (b.id === batchId ? { ...b, quantity: roundQty(b.quantity - removeQty) } : b));
  const previousStock = stockOf(current);
  const raw = roundQty(previousStock - removeQty);
  const stock = Math.max(0, raw);
  return {
    stock, previousStock, batches: remaining, quantity: roundQty(previousStock - stock), direction: 'out',
    shortfall: raw < 0 ? -raw : 0, batch: target,
  };
}

/**
 * stock ≠ Σ parti uzlaştırması.
 * - 'stockToBatches': stok = Σ parti (tükenmiş partiler temizlenir), fark kadar hareket.
 * - 'addMissingBatch': stok > Σ parti ise fark kadar GTS'siz parti (`missingBatch`) eklenir; stok değişmez.
 * Fark yoksa null.
 */
export function planReconcile(current: StockSnapshot, mode: 'stockToBatches' | 'addMissingBatch', missingBatch: (qty: number) => Batch): StockPlan | null {
  const batches = current.batches ?? [];
  const total = batchTotal(batches);
  const previousStock = stockOf(current);
  const diff = roundQty(previousStock - total);
  if (diff === 0) return null;
  if (mode === 'addMissingBatch') {
    if (diff < 0) throw new ProductStockError('invalid-quantity');
    return { stock: previousStock, previousStock, batches: [...batches, missingBatch(diff)], quantity: 0, direction: 'in', shortfall: 0 };
  }
  return {
    stock: total, previousStock, batches: batches.filter(b => b.quantity > 0),
    quantity: Math.abs(diff), direction: diff < 0 ? 'in' : 'out', shortfall: 0,
  };
}

/**
 * Stok sayımı: sayılan değer MUTLAK hedeftir; fark sunucudaki güncel stoka göre hesaplanır.
 * Fazla → GTS'siz parti (`surplusBatch`) eklenir, eksik → FEFO ile düşülür. Fark yoksa null.
 */
export function planCount(current: StockSnapshot, counted: number, surplusBatch: (qty: number) => Batch, now: number = Date.now()): StockPlan | null {
  const target = roundQty(counted);
  if (!Number.isFinite(target) || target < 0) throw new ProductStockError('invalid-quantity');
  const delta = roundQty(target - stockOf(current));
  if (delta === 0) return null;
  return delta > 0 ? planStockIn(current, [surplusBatch(delta)]) : planStockOut(current, -delta, now);
}
