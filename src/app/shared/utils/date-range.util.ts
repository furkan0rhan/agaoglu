export type Period = 'today' | 'week' | 'month' | 'year';

export interface DateRange {
  start: Date;
  end: Date;
}

/** Bir günün başlangıcı (00:00:00.000, yerel saat). */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/** Bir günün sonu (23:59:59.999, yerel saat). */
export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Ayın son günü (1-31). `month` 0 tabanlı. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Verilen dönem için [start, end] aralığı (her iki uç dahil, yerel saat).
 * - today: bugün 00:00 – 23:59:59.999
 * - week:  Pazartesi 00:00 – Pazar 23:59:59.999
 * - month: ayın 1'i 00:00 – ayın son günü 23:59:59.999
 * - year:  1 Ocak 00:00 – 31 Aralık 23:59:59.999
 */
export function getPeriodRange(period: Period, now: Date = new Date()): DateRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'week': {
      const dow = now.getDay(); // 0 = Pazar
      const diff = dow === 0 ? 6 : dow - 1;
      const start = new Date(y, m, now.getDate() - diff, 0, 0, 0, 0);
      const end = new Date(y, m, now.getDate() - diff + 6, 23, 59, 59, 999);
      return { start, end };
    }
    case 'month':
      return {
        start: new Date(y, m, 1, 0, 0, 0, 0),
        end: new Date(y, m + 1, 0, 23, 59, 59, 999),
      };
    case 'year':
      return {
        start: new Date(y, 0, 1, 0, 0, 0, 0),
        end: new Date(y, 11, 31, 23, 59, 59, 999),
      };
  }
}

/** Tarih aralık içinde mi (uçlar dahil). */
export function isInRange(d: Date, range: DateRange): boolean {
  const t = d.getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

/**
 * `base` tarihinden `offset` ay sonrası; gün, hedef ayın son gününe kırpılır
 * (31 Ocak + 1 ay = 28/29 Şubat, Mart'a taşmaz).
 */
export function addMonthsClamped(base: Date, offset: number, day: number = base.getDate()): Date {
  const y = base.getFullYear();
  const m = base.getMonth() + offset;
  const target = new Date(y, m, 1, base.getHours(), base.getMinutes(), base.getSeconds(), base.getMilliseconds());
  const last = daysInMonth(target.getFullYear(), target.getMonth());
  target.setDate(Math.min(day, last));
  return target;
}
