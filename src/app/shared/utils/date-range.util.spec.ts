import { addMonthsClamped, daysInMonth, getPeriodRange, isInRange } from './date-range.util';

describe('getPeriodRange', () => {
  it('today: gün başı ve sonu', () => {
    const r = getPeriodRange('today', new Date(2026, 9, 27, 15, 30));
    expect(r.start).toEqual(new Date(2026, 9, 27, 0, 0, 0, 0));
    expect(r.end).toEqual(new Date(2026, 9, 27, 23, 59, 59, 999));
  });

  it('week: Pazartesi başlar (Salı günü)', () => {
    const r = getPeriodRange('week', new Date(2026, 9, 27, 10)); // 27 Ekim 2026 Salı
    expect(r.start).toEqual(new Date(2026, 9, 26, 0, 0, 0, 0));
    expect(r.end).toEqual(new Date(2026, 10, 1, 23, 59, 59, 999));
  });

  it('week: Pazar günü önceki Pazartesi ile başlar', () => {
    const r = getPeriodRange('week', new Date(2026, 10, 1, 12)); // 1 Kasım 2026 Pazar
    expect(r.start).toEqual(new Date(2026, 9, 26, 0, 0, 0, 0));
    expect(r.end).toEqual(new Date(2026, 10, 1, 23, 59, 59, 999));
  });

  it('week: ay sınırını doğru geçer', () => {
    const r = getPeriodRange('week', new Date(2026, 0, 31, 9)); // 31 Ocak 2026 Cumartesi
    expect(r.start).toEqual(new Date(2026, 0, 26, 0, 0, 0, 0));
    expect(r.end).toEqual(new Date(2026, 1, 1, 23, 59, 59, 999));
  });

  it('month: 31 günlük ayın 31\'inde ay sonu taşmaz', () => {
    const r = getPeriodRange('month', new Date(2026, 0, 31, 9));
    expect(r.start).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0));
    expect(r.end).toEqual(new Date(2026, 0, 31, 23, 59, 59, 999));
  });

  it('month: Şubat (artık yıl)', () => {
    const r = getPeriodRange('month', new Date(2028, 1, 10));
    expect(r.end).toEqual(new Date(2028, 1, 29, 23, 59, 59, 999));
  });

  it('month: Aralık -> yıl sonu', () => {
    const r = getPeriodRange('month', new Date(2026, 11, 31, 23, 59));
    expect(r.start).toEqual(new Date(2026, 11, 1));
    expect(r.end).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999));
  });

  it('year', () => {
    const r = getPeriodRange('year', new Date(2026, 5, 15));
    expect(r.start).toEqual(new Date(2026, 0, 1));
    expect(r.end).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999));
  });

  it('isInRange uçları dahil eder', () => {
    const r = getPeriodRange('month', new Date(2026, 1, 10));
    expect(isInRange(new Date(2026, 1, 1, 0, 0, 0, 0), r)).toBe(true);
    expect(isInRange(new Date(2026, 1, 28, 23, 59, 59, 999), r)).toBe(true);
    expect(isInRange(new Date(2026, 2, 1), r)).toBe(false);
  });
});

describe('addMonthsClamped / daysInMonth', () => {
  it('daysInMonth', () => {
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(daysInMonth(2028, 1)).toBe(29);
    expect(daysInMonth(2026, 3)).toBe(30);
  });

  it('31 Ocak + 1 ay = 28 Şubat, sonra 31 Mart', () => {
    const base = new Date(2026, 0, 31);
    expect(addMonthsClamped(base, 1)).toEqual(new Date(2026, 1, 28));
    expect(addMonthsClamped(base, 2)).toEqual(new Date(2026, 2, 31));
    expect(addMonthsClamped(base, 3)).toEqual(new Date(2026, 3, 30));
  });

  it('yıl geçişi', () => {
    expect(addMonthsClamped(new Date(2026, 10, 30), 3)).toEqual(new Date(2027, 1, 28));
  });
});
