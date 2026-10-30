import { matchesSearch, searchKey } from './search.utils';

describe('search.utils (2.22 Türkçe arama)', () => {
  it('İ / I Türkçe küçük harfe çevrilir, ı → i katlanır', () => {
    expect(searchKey('İLAÇ')).toBe('ilaç');
    expect(searchKey('ISITICI')).toBe('isitici');
    expect(searchKey('  Ispanak ')).toBe('ispanak');
    expect(searchKey(null)).toBe('');
  });

  it('"İLAÇ" adlı ürün "ilaç" ile, "ilaç" adlı ürün "İLAÇ" ile bulunur', () => {
    expect(matchesSearch('ilaç', 'ZİRAİ İLAÇ')).toBe(true);
    expect(matchesSearch('İLAÇ', 'zirai ilaç')).toBe(true);
    expect(matchesSearch('ISMAIL', 'İsmail')).toBe(true);
    expect(matchesSearch('ismail', 'ISMAIL')).toBe(true);
    expect(matchesSearch('ıspanak', 'Ispanak tohumu')).toBe(true);
  });

  it('diğer Türkçe harfler korunur; boş sorgu her şeyle eşleşir; null alanlar atlanır', () => {
    expect(matchesSearch('gubre', 'Gübre')).toBe(false);
    expect(matchesSearch('GÜBRE', 'gübre')).toBe(true);
    expect(matchesSearch('  ', 'x')).toBe(true);
    expect(matchesSearch('869', null, undefined, '8690001')).toBe(true);
    expect(matchesSearch('abc', null, 'xyz')).toBe(false);
  });
});
