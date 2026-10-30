import type { Sale } from '../../shared/models/sale.model';
import { isCompletedSale, saleInterest, toDate } from '../reports/services/report-calc';

/** Grafikte bir gün. */
export interface DayPoint {
  date: Date;
  /** O günün cirosu (tamamlanmış satışların totalAmount toplamı). */
  value: number;
  isToday: boolean;
  /** Pazar (dükkânların çoğu kapalı/yarım gün) — daha soluk çizilir. */
  isSunday: boolean;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Son `days` günün günlük cirosu (bugün dahil, eskiden yeniye). */
export function dailySeries(sales: readonly Sale[], days: number, now: Date = new Date()): DayPoint[] {
  const sums = new Map<string, number>();
  for (const s of sales) {
    if (!isCompletedSale(s)) continue;
    const d = toDate(s.createdAt);
    if (!d) continue;
    const k = dayKey(d);
    sums.set(k, (sums.get(k) ?? 0) + (s.totalAmount ?? 0));
  }
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push({
      date: d,
      value: Math.round((sums.get(dayKey(d)) ?? 0) * 100) / 100,
      isToday: i === 0,
      isSunday: d.getDay() === 0,
    });
  }
  return out;
}

/** Bugünün tamamlanmış satışları. */
export function salesOfDay(sales: readonly Sale[], day: Date): Sale[] {
  const k = dayKey(day);
  return sales.filter(s => {
    const d = toDate(s.createdAt);
    return isCompletedSale(s) && !!d && dayKey(d) === k;
  });
}

/** Yüzde değişim (önceki 0 ise null: anlamsız). */
export function percentChange(current: number, previous: number): number | null {
  if (!(previous > 0)) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Bir satış listesinin vade farkı toplamı. */
export function interestOf(sales: readonly Sale[]): number {
  return Math.round(sales.reduce((a, s) => a + saleInterest(s), 0) * 100) / 100;
}

/** Eksen üst sınırı: en büyük değerin üstündeki "yuvarlak" sayı (1-1.5-2-2.5-3-4-5-6-8 × 10^n). */
export function niceMax(max: number): number {
  if (!(max > 0)) return 1000;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (m * exp >= max) return m * exp;
  }
  return 10 * exp;
}
