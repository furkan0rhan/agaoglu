import { Timestamp } from '@angular/fire/firestore';
import { Translations } from '../../../core/i18n/translations';
import { PaymentMethod, SaleStatus, SaleUnit } from '../../../shared/models/sale.model';

export type TagSeverity = 'success' | 'danger' | 'warn' | 'info' | 'secondary';
export type StatusTone = 'success' | 'danger' | 'warning';

export function statusLabel(t: Translations, s: SaleStatus): string {
  return s === 'completed' ? t.sales.statusCompleted
    : s === 'cancelled' ? t.sales.statusCancelled
    : t.sales.statusRefunded;
}

/** Y4: iptal reddi / hata metni (yetki, neden, zaten iptal). */
export function cancelErrorText(t: Translations, reason: string | null | undefined): string {
  switch (reason) {
    case 'not-own': return t.sales.cancelDeniedOwn;
    case 'not-today': return t.sales.cancelDeniedToday;
    case 'role': return t.sales.cancelDeniedRole;
    case 'reason-required': return t.sales.cancelReasonRequired;
    case 'not-completed': return t.sales.alreadyCancelled;
    default: return t.sales.cancelFailed;
  }
}

export function statusSeverity(s: SaleStatus): TagSeverity {
  return s === 'completed' ? 'success' : s === 'cancelled' ? 'danger' : 'warn';
}

/** ui-status-badge tonu. */
export function statusTone(s: SaleStatus): StatusTone {
  return s === 'completed' ? 'success' : s === 'cancelled' ? 'danger' : 'warning';
}

/** Miktar: tam sayıda ondalık yok, kg/lt/metre'de en çok 2 hane (tr: 12,5). */
export function formatQty(q: number, lang: string): string {
  return new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', { maximumFractionDigits: 2 }).format(q ?? 0);
}

/** "12,5 kg" — birim yoksa adet. */
export function qtyWithUnit(t: Translations, q: number, unit: SaleUnit | null | undefined, lang: string): string {
  return `${formatQty(q, lang)} ${t.pos.units[unit ?? 'adet']}`;
}

/** Karma ödemenin tutarları (satış / fiş). */
export interface PaymentParts {
  cashPaid?: number | null;
  cardPaid?: number | null;
  creditAmount?: number | null;
}

/**
 * Ödeme adı. 'mixed' (karma) için `parts` verilirse bileşenler yazılır: "Nakit + Kart", "Nakit + Veresiye"
 * (5.4: nakit + kart bölünmüş ödeme, nakit + veresiye peşinatlı satış). Tutar yoksa "Karma".
 */
export function methodLabel(t: Translations, m: PaymentMethod, parts?: PaymentParts | null): string {
  if (m === 'cash') return t.sales.methodCash;
  if (m === 'card') return t.sales.methodCard;
  if (m === 'credit') return t.sales.methodCredit;
  if (!parts) return t.sales.methodMixed;
  const names = [
    (parts.cashPaid ?? 0) > 0 ? t.sales.methodCash : null,
    (parts.cardPaid ?? 0) > 0 ? t.sales.methodCard : null,
    (parts.creditAmount ?? 0) > 0 ? t.sales.methodCredit : null,
  ].filter((x): x is string => !!x);
  return names.length >= 2 ? names.join(' + ') : t.sales.methodMixed;
}

export function formatDateTime(ts: Timestamp | null | undefined, lang: string): string {
  const d = ts?.toDate?.();
  if (!d) return '—';
  return d.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** yyyy-MM-dd (input[type=date] için, yerel saat). */
export function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** input[type=date] değerini gün başı/sonu Date'e çevirir. */
export function fromDateInput(v: string, endOfDay: boolean): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

/** Ödeme pill tonu / ikonu (dashboard "Son satışlar" ile aynı). */
export function methodTone(m: PaymentMethod): 'success' | 'info' | 'accent' | 'neutral' {
  return m === 'cash' ? 'success' : m === 'card' ? 'info' : m === 'credit' ? 'accent' : 'neutral';
}

export function methodIcon(m: PaymentMethod): string {
  return m === 'cash' ? 'pi-money-bill' : m === 'card' ? 'pi-credit-card' : m === 'credit' ? 'pi-book' : 'pi-wallet';
}
