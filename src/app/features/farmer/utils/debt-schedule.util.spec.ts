import { farmerDebtSummary, FARMER_SCHEDULE_MAX } from './debt-schedule.util';

const D = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe('farmerDebtSummary (çiftçi Borcum vade özeti)', () => {
  const sale = {
    id: 'tx1', type: 'debt' as const, amount: 6430, saleId: 's1', createdAt: D(2026, 10, 30),
    installments: [
      { no: 1, dueDate: D(2026, 11, 29), amount: 2143.33 },
      { no: 2, dueDate: D(2026, 12, 29), amount: 2143.33 },
      { no: 3, dueDate: D(2027, 1, 29), amount: 2143.34 },
    ],
  };

  it('3 taksitli veresiyede sıradaki ödeme ve takvim çıkar', () => {
    const s = farmerDebtSummary([sale], 6430, new Map([['s1', 'S-1']]), D(2026, 10, 30));
    expect(s.nextDue).toEqual({ date: D(2026, 11, 29), amount: 2143.33 });
    expect(s.overdueAmount).toBe(0);
    expect(s.schedule.map(i => [i.no, i.count, i.remaining, i.saleNumber])).toEqual([
      [1, 3, 2143.33, 'S-1'], [2, 3, 2143.33, 'S-1'], [3, 3, 2143.34, 'S-1'],
    ]);
  });

  it('tahsilat en eski vadeden düşer; gecikme hesaplanır', () => {
    // 2.500 ödendi → 1. taksit kapandı, 2.'den 356,67 düştü; bugün 2. taksitin vadesi geçti
    const s = farmerDebtSummary([sale], 3930, new Map(), D(2027, 1, 5));
    expect(s.schedule[0].remaining).toBe(0);
    expect(s.schedule[1].remaining).toBe(1786.66);
    expect(s.overdueAmount).toBe(1786.66);
    expect(s.nextDue).toEqual({ date: D(2027, 1, 29), amount: 2143.34 });
  });

  it('borç yoksa takvim ödenmiş görünür, sıradaki ödeme yok', () => {
    const s = farmerDebtSummary([sale], 0, new Map(), D(2026, 11, 1));
    expect(s.nextDue).toBeNull();
    expect(s.schedule.every(i => i.remaining === 0)).toBe(true);
  });

  it('takvim sınırı aşılmaz; ödenmemişler önceliklidir', () => {
    const many = Array.from({ length: 30 }, (_, k) => ({
      id: 't' + k, type: 'debt' as const, amount: 100, saleId: null, createdAt: D(2026, 1, 1), dueDate: D(2026, 1, 1 + k),
    }));
    const s = farmerDebtSummary(many, 500, new Map(), D(2025, 12, 1));
    expect(s.schedule.length).toBe(FARMER_SCHEDULE_MAX);
    expect(s.schedule.filter(i => i.remaining > 0).length).toBe(5);
  });
});
