import type { Recommendation } from '../../../shared/models/farmer.model';

/**
 * Y18: POS'ta reçeteli ürün + müşteri seçilince, o müşterinin (bağlı çiftçi) geçerli önerisindeki e-reçete no.
 * Geçerli = aktif, e-reçete no'lu, uygulama penceresi bitmemiş. Sepetteki reçeteli ürünü içeren öneri önce;
 * eşitlikte en yeni öneri. Bulunamazsa null.
 */
export function suggestPrescriptionNo(
  recs: readonly Recommendation[], cartRxProductIds: readonly string[], now: Date = new Date(),
): { prescriptionNo: string; prescriber: string | null } | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const ids = new Set(cartRxProductIds.filter(Boolean));
  const valid = recs.filter(r =>
    r.status === 'active'
    && !!r.prescriptionNo?.trim()
    && (!r.windowEnd || r.windowEnd.getTime() >= today));
  if (!valid.length) return null;
  const score = (r: Recommendation) => r.items.some(i => i.productId && ids.has(i.productId)) ? 1 : 0;
  const best = [...valid].sort((a, b) =>
    score(b) - score(a) || (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))[0];
  return { prescriptionNo: best.prescriptionNo!.trim(), prescriber: best.authorName?.trim() || null };
}
