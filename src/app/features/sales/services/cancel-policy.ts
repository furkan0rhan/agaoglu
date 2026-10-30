import { UserRole } from '../../../shared/models/user.model';

/**
 * Satış iptali kuralı (Y4) — firestore.rules `validSaleCancel()` ile aynı:
 *  - Neden zorunlu (herkes için, 3–200 karakter); iptal `auditLogs/sale_cancel_{saleId}` kaydıyla birlikte yazılır.
 *  - Yönetici (admin) ve destek modu: her tamamlanmış satışı iptal edebilir.
 *  - Kasiyer: yalnız KENDİ yaptığı ve AYNI GÜN (Türkiye saati) içindeki satışı iptal edebilir.
 *    Geçmiş günün ya da başkasının satışı için yöneticiye başvurur (nakdi iptal edip cebe koyma kapısı kapanır).
 *  - Kasiyere yönetici "her satışı iptal eder" yetkisi verdiyse (users/{uid}.permissions.cancelAnySale): her satış.
 *  - Personel (staff): iptal edemez.
 */
export const CANCEL_REASON_MIN = 3;
export const CANCEL_REASON_MAX = 200;

/** Türkiye saati sabit UTC+3 (2016'dan beri yaz saati yok) — kurallar da aynı kaydırmayı kullanır. */
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CancelDenial = 'not-completed' | 'role' | 'not-own' | 'not-today';

export interface CancelSubject {
  status: string;
  createdBy?: string | null;
  /** Firestore Timestamp, Date ya da ms. */
  createdAt?: { toDate(): Date } | Date | number | null;
}

export function businessDay(d: Date): number {
  return Math.floor((d.getTime() + TR_OFFSET_MS) / DAY_MS);
}

function toDate(v: CancelSubject['createdAt']): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  return typeof v.toDate === 'function' ? v.toDate() : null;
}

/** null = izinli; değilse neden. */
export function cancelDenial(
  sale: CancelSubject, user: { id: string; role: UserRole; cancelAnySale?: boolean } | null, now: Date = new Date(),
): CancelDenial | null {
  if (sale.status !== 'completed') return 'not-completed';
  if (!user) return 'role';
  if (user.role === 'admin') return null;
  if (user.role !== 'cashier') return 'role';
  if (user.cancelAnySale === true) return null;
  if (!sale.createdBy || sale.createdBy !== user.id) return 'not-own';
  const created = toDate(sale.createdAt);
  if (!created || businessDay(created) !== businessDay(now)) return 'not-today';
  return null;
}

export function isValidCancelReason(reason: string | null | undefined): boolean {
  const r = (reason ?? '').trim();
  return r.length >= CANCEL_REASON_MIN && r.length <= CANCEL_REASON_MAX;
}
