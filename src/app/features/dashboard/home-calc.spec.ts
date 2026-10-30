import type { Sale } from '../../shared/models/sale.model';
import { dailySeries, niceMax, percentChange, salesOfDay } from './home-calc';
import { quickCashAmounts } from '../../shared/ui/quick-cash.component';

function sale(date: Date, total: number, status: Sale['status'] = 'completed'): Sale {
  return { createdAt: { toDate: () => date }, totalAmount: total, status } as unknown as Sale;
}

describe('home-calc', () => {
  const now = new Date(2026, 9, 27, 15, 0);

  it('dailySeries: son N günü eskiden yeniye, iptalleri saymadan toplar', () => {
    const s = dailySeries([
      sale(new Date(2026, 9, 27, 10), 100),
      sale(new Date(2026, 9, 27, 11), 50),
      sale(new Date(2026, 9, 26, 9), 70),
      sale(new Date(2026, 9, 26, 9), 999, 'cancelled'),
      sale(new Date(2026, 9, 10, 9), 5), // aralık dışı
    ], 7, now);
    expect(s).toHaveLength(7);
    expect(s[6].isToday).toBe(true);
    expect(s[6].value).toBe(150);
    expect(s[5].value).toBe(70);
    expect(s[0].value).toBe(0);
    expect(s.some(p => p.isSunday)).toBe(true);
  });

  it('salesOfDay yalnız o günün tamamlanmış satışları', () => {
    const list = [sale(new Date(2026, 9, 27, 1), 1), sale(new Date(2026, 9, 26, 23), 2)];
    expect(salesOfDay(list, now)).toHaveLength(1);
  });

  it('percentChange', () => {
    expect(percentChange(112, 100)).toBe(12);
    expect(percentChange(50, 0)).toBeNull();
  });

  it('niceMax yuvarlak üst sınır', () => {
    expect(niceMax(18640)).toBe(20000);
    expect(niceMax(2600)).toBe(3000);
    expect(niceMax(50305)).toBe(60000);
    expect(niceMax(0)).toBe(1000);
  });

  it('quickCashAmounts: toplamın üstündeki ilk 3 yuvarlak tutar', () => {
    expect(quickCashAmounts(2370)).toEqual([2400, 2500, 3000]);
    expect(quickCashAmounts(45)).toEqual([50, 100, 200]);
    expect(quickCashAmounts(0)).toEqual([]);
  });
});
