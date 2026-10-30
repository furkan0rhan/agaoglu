import {
  activePhiWarnings, addDays, daysUntil, earliestHarvestDate, isHarvestBeforePhi, latestHarvestBlock, resolvePhi,
} from './phi.util';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe('phi.util', () => {
  it('aynı ürün farklı bitkide farklı PHI (bitkiye özel değer önceliklidir)', () => {
    const input = { phiDays: 14, phiByCrop: { tomato: 3, grape: 21 } };
    expect(resolvePhi(input, 'tomato')).toEqual({ days: 3, source: 'dealer' });
    expect(resolvePhi(input, 'grape')).toEqual({ days: 21, source: 'dealer' });
    expect(resolvePhi(input, 'wheat')).toEqual({ days: 14, source: 'dealer' });
  });

  it('PHI verisi yoksa / geçersizse null (tahmin yapılmaz)', () => {
    expect(resolvePhi(null, 'tomato')).toBeNull();
    expect(resolvePhi({ phiDays: null }, 'tomato')).toBeNull();
    expect(resolvePhi({ phiDays: -1 }, null)).toBeNull();
    expect(resolvePhi({ phiDays: 2.5 }, null)).toBeNull();
    expect(resolvePhi({ phiDays: 9999 }, null)).toBeNull();
    expect(earliestHarvestDate(d(2026, 10, 20), null)).toBeNull();
    expect(earliestHarvestDate(null, 7)).toBeNull();
  });

  it('kaynak etiketi korunur (öneri / elle)', () => {
    expect(resolvePhi({ phiDays: 7 }, null, 'recommendation')?.source).toBe('recommendation');
    expect(resolvePhi({ phiDays: 0 }, null, 'manual')).toEqual({ days: 0, source: 'manual' });
  });

  it('en erken hasat = uygulama + PHI gün (ay sonu geçişi dahil)', () => {
    expect(earliestHarvestDate(d(2026, 10, 20), 7)).toEqual(d(2026, 10, 27));
    expect(earliestHarvestDate(d(2026, 10, 28), 7)).toEqual(d(2026, 11, 4));
    expect(earliestHarvestDate(new Date(2026, 9, 20, 23, 30), 1)).toEqual(d(2026, 10, 21));
    expect(addDays(d(2026, 12, 30), 3)).toEqual(d(2027, 1, 2));
  });

  it('birden çok ilaçta en geç tarih esas alınır', () => {
    expect(latestHarvestBlock([d(2026, 11, 1), null, d(2026, 11, 12), d(2026, 11, 5)])).toEqual(d(2026, 11, 12));
    expect(latestHarvestBlock([])).toBeNull();
  });

  it('beklenen hasat PHI bitişinden önceyse çakışma', () => {
    expect(isHarvestBeforePhi(d(2026, 11, 10), d(2026, 11, 12))).toBe(true);
    expect(isHarvestBeforePhi(d(2026, 11, 12), d(2026, 11, 12))).toBe(false);
    expect(isHarvestBeforePhi(null, d(2026, 11, 12))).toBe(false);
  });

  it('aktif uyarılar: tarla başına en geç bekleme, bitmişler hariç, çakışanlar önde', () => {
    const today = d(2026, 10, 27);
    const logs = [
      { fieldId: 'f1', seasonId: 's1', earliestHarvestDate: d(2026, 11, 1), productName: 'A', phiDays: 7 },
      { fieldId: 'f1', seasonId: 's1', earliestHarvestDate: d(2026, 11, 10), productName: 'B', phiDays: 14 },
      { fieldId: 'f2', seasonId: 's2', earliestHarvestDate: d(2026, 11, 3), productName: 'C', phiDays: 7 },
      { fieldId: 'f3', seasonId: null, earliestHarvestDate: d(2026, 10, 20), productName: 'D', phiDays: 3 },
      { fieldId: 'f4', seasonId: null, earliestHarvestDate: null, productName: 'E', phiDays: null },
    ];
    const w = activePhiWarnings(logs, { s1: d(2026, 12, 1), s2: d(2026, 11, 1) }, today);
    expect(w.map(x => x.fieldId)).toEqual(['f2', 'f1']);
    expect(w[0].conflict).toBe(true);
    expect(w[1].productName).toBe('B');
    expect(w[1].daysLeft).toBe(daysUntil(d(2026, 11, 10), today));
  });
});
