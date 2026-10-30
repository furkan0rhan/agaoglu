import type { Batch, Product } from '../../../shared/models/product.model';
import type { SupplierReturn } from '../../../shared/models/supplier-return.model';
import { daysUntilExpiry, isBatchExpired, roundQty } from '../../../shared/utils/batch.utils';
import { isPlantProtection } from '../../../shared/utils/regulatory.utils';

/**
 * Firmaya iade (11.13) saf yardımcıları.
 * Mevzuat (BKÜ satış yönetmeliği md. 21/ş): kullanma süresi geçmiş bitki koruma ürünü 30 gün içinde firmaya iade edilir.
 * Süre, partinin SKT gününden başlatılır (bayi SKT'yi o gün fark eder; daha erken başlatmak güvenli taraftır).
 */
export const RETURN_DEADLINE_DAYS = 30;

export interface ReturnCandidate {
  product: Product;
  /** SKT'si geçmiş, stoktaki partiler (en eski SKT önce). */
  batches: Batch[];
  expiredQty: number;
  /** En eski geçmiş SKT. */
  oldestExpiry: Date;
  /** İade son günü = en eski SKT + 30 gün. */
  deadline: Date;
  /** Son güne kalan gün (bugün = 0, geçtiyse negatif). */
  daysLeft: number;
}

const DAY_MS = 86_400_000;

/** SKT'si geçmiş bitki koruma ürünleri: iade adayları (son güne göre en acil önce). */
export function returnCandidates(products: readonly Product[], now: number = Date.now()): ReturnCandidate[] {
  const out: ReturnCandidate[] = [];
  for (const p of products) {
    if (p.isActive === false || !isPlantProtection(p)) continue;
    const expired = (p.batches ?? [])
      .filter(b => b.quantity > 0 && isBatchExpired(b, now))
      .sort((a, b) => a.expiryDate!.toMillis() - b.expiryDate!.toMillis());
    if (expired.length === 0) continue;
    const oldest = expired[0].expiryDate!.toDate();
    const oldestDay = new Date(oldest.getFullYear(), oldest.getMonth(), oldest.getDate());
    const deadline = new Date(oldestDay.getTime() + RETURN_DEADLINE_DAYS * DAY_MS);
    const daysLeft = (daysUntilExpiry(expired[0], now) ?? 0) + RETURN_DEADLINE_DAYS;
    out.push({
      product: p, batches: expired, expiredQty: roundQty(expired.reduce((s, b) => s + b.quantity, 0)),
      oldestExpiry: oldest, deadline, daysLeft,
    });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft || a.product.name.localeCompare(b.product.name, 'tr'));
}

export interface ReturnSummary { count: number; quantityLines: number; totalCost: number }

/** İade listesinin özeti (adet: kayıt sayısı; maliyet: kayıt anındaki net alış). */
export function summarizeReturns(list: readonly Pick<SupplierReturn, 'totalCost' | 'units'>[]): ReturnSummary {
  let totalCost = 0;
  let quantityLines = 0;
  for (const r of list) {
    totalCost += r.totalCost ?? 0;
    quantityLines += r.units?.length ?? 0;
  }
  return { count: list.length, quantityLines, totalCost: Math.round(totalCost * 100) / 100 };
}

/** Yeni → eski (iade tarihi, sonra kayıt zamanı). */
export function sortReturns<T extends Pick<SupplierReturn, 'returnDate' | 'createdAt'>>(list: readonly T[]): T[] {
  const ms = (x: { toMillis?: () => number } | null | undefined) => (x && typeof x.toMillis === 'function' ? x.toMillis() : 0);
  return [...list].sort((a, b) => ms(b.returnDate) - ms(a.returnDate) || ms(b.createdAt) - ms(a.createdAt));
}
