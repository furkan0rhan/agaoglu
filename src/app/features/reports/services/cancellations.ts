import { Sale } from '../../../shared/models/sale.model';
import { round2, toDate } from './report-calc';

/** auditLogs/sale_cancel_{saleId} (sale.service → cancelSale) — rapor için gereken alanlar. */
export interface SaleCancelLog {
  id: string;
  action: string;
  saleId?: string | null;
  saleNumber?: string | null;
  amount?: number | null;
  actorUid?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  saleCreatedBy?: string | null;
  detail?: string | null;
  createdAt?: unknown;
}

/** "İptaller" raporu satırı. */
export interface CancellationRow {
  saleId: string;
  saleNumber: string;
  /** İptal zamanı (bilinmiyorsa satış zamanı). */
  date: Date | null;
  /** Satışı yapan (kasiyer). */
  soldBy: string;
  /** İptal eden. */
  cancelledBy: string;
  amount: number;
  reason: string;
  /** Denetim kaydı yok (Y4 öncesi eski iptal). */
  legacy: boolean;
}

/** Denetim kaydı detayı "S-1 · 1450 ₺ · neden" → "neden" (neden içinde " · " olabilir). */
export function reasonFromDetail(detail: string | null | undefined): string {
  const parts = (detail ?? '').split(' · ');
  return parts.length >= 3 ? parts.slice(2).join(' · ').trim() : '';
}

/**
 * Y4 / İptaller raporu: denetim kayıtları (iptal anı, iptal eden, tutar, neden) + dönemdeki iptal edilmiş satışlar.
 * Aynı satış ikisinde de varsa tek satır (kayıt öncelikli; neden satış dokümanından tamamlanır).
 * Denetim kaydı olmayan eski iptaller de listelenir (`legacy`). En yeni önce.
 */
export function buildCancellationRows(
  logs: readonly SaleCancelLog[],
  cancelledSales: readonly Sale[],
  names: ReadonlyMap<string, string>,
): CancellationRow[] {
  const name = (uid: string | null | undefined, fallback = ''): string => (uid ? names.get(uid) || fallback : fallback) || '—';
  const salesById = new Map(cancelledSales.map(s => [s.id, s]));
  const rows: CancellationRow[] = [];
  const seen = new Set<string>();
  for (const l of logs) {
    if (l.action !== 'sale_cancel' || !l.saleId || seen.has(l.saleId)) continue;
    seen.add(l.saleId);
    const s = salesById.get(l.saleId);
    rows.push({
      saleId: l.saleId,
      saleNumber: l.saleNumber || s?.saleNumber || l.saleId,
      date: toDate(l.createdAt) ?? toDate(s?.cancelledAt),
      soldBy: name(l.saleCreatedBy ?? s?.createdBy),
      cancelledBy: l.actorName?.trim() || name(l.actorUid, l.actorEmail ?? ''),
      amount: round2(l.amount ?? s?.totalAmount ?? 0),
      reason: s?.cancelReason?.trim() || reasonFromDetail(l.detail) || '—',
      legacy: false,
    });
  }
  for (const s of cancelledSales) {
    if (s.status !== 'cancelled' || seen.has(s.id)) continue;
    seen.add(s.id);
    rows.push({
      saleId: s.id,
      saleNumber: s.saleNumber,
      date: toDate(s.cancelledAt) ?? toDate(s.createdAt),
      soldBy: name(s.createdBy),
      cancelledBy: name(s.cancelledBy),
      amount: round2(s.totalAmount ?? 0),
      reason: s.cancelReason?.trim() || '—',
      legacy: true,
    });
  }
  return rows.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
}
