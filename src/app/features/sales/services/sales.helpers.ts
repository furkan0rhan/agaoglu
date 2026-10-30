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

export function methodLabel(t: Translations, m: PaymentMethod): string {
  return m === 'cash' ? t.sales.methodCash
    : m === 'card' ? t.sales.methodCard
    : m === 'credit' ? t.sales.methodCredit
    : t.sales.methodMixed;
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
