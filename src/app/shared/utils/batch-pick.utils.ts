import type { Batch } from '../models/product.model';
import { nearestExpiry, roundQty } from './batch.utils';

/**
 * Belirli partilerden / GTS birimlerinden elle seçilen çıkış (firmaya iade 11.13, FEFO değil).
 * Saf: Firestore'a bağımlı değildir.
 */
export interface BatchPick {
  batchId: string;
  /** Çıkarılacak miktar. GTS'li birimde 1 (tamamı). */
  quantity: number;
}

export interface PickedBatch {
  batchId: string;
  quantity: number;
  gtsNo: string | null;
  lotNo: string | null;
  expiryDate: Batch['expiryDate'];
}

export type BatchPickErrorCode = 'batch-not-found' | 'invalid-quantity' | 'no-picks';

export class BatchPickError extends Error {
  constructor(readonly code: BatchPickErrorCode, readonly detail: string | null = null) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'BatchPickError';
  }
}

export interface BatchPickResult {
  /** Kalan partiler (tükenenler çıkarılır). */
  batches: Batch[];
  removed: PickedBatch[];
  /** Toplam çıkarılan miktar. */
  quantity: number;
  /** Ürünün yeni stoğu (0'ın altına inmez). */
  newStock: number;
  /** Stoğun karşılayamadığı miktar (stok < Σ parti ise > 0). */
  shortfall: number;
  expiryDate: Batch['expiryDate'];
}

/**
 * Seçilen partilerden çıkış. Aynı parti birden çok seçilirse miktarlar toplanır.
 * GTS'li tek birim (quantity 1) bölünemez; toplu partide (GTS'li eski toplu partiler dahil) kısmi çıkış olabilir.
 */
export function pickFromBatches(stock: number, batches: readonly Batch[], picks: readonly BatchPick[]): BatchPickResult {
  const want = new Map<string, number>();
  for (const p of picks) {
    const q = roundQty(p.quantity);
    if (!(q > 0)) throw new BatchPickError('invalid-quantity', p.batchId);
    want.set(p.batchId, roundQty((want.get(p.batchId) ?? 0) + q));
  }
  if (want.size === 0) throw new BatchPickError('no-picks');

  const removed: PickedBatch[] = [];
  const remaining: Batch[] = [];
  for (const b of batches) {
    const q = want.get(b.id);
    if (q == null) { if (b.quantity > 0) remaining.push(b); continue; }
    want.delete(b.id);
    if (q > b.quantity || (b.gtsNo && b.quantity === 1 && q !== 1)) throw new BatchPickError('invalid-quantity', b.gtsNo ?? b.id);
    removed.push({ batchId: b.id, quantity: q, gtsNo: b.gtsNo ?? null, lotNo: b.lotNo ?? null, expiryDate: b.expiryDate ?? null });
    const left = roundQty(b.quantity - q);
    if (left > 0) remaining.push({ ...b, quantity: left });
  }
  if (want.size > 0) throw new BatchPickError('batch-not-found', [...want.keys()].join(', '));

  const quantity = roundQty(removed.reduce((s, r) => s + r.quantity, 0));
  const raw = roundQty((Number(stock) || 0) - quantity);
  return {
    batches: remaining, removed, quantity,
    newStock: Math.max(0, raw), shortfall: raw < 0 ? -raw : 0,
    expiryDate: nearestExpiry(remaining),
  };
}
