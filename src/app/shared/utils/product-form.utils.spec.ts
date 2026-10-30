import { isDecimalUnit, productUnit } from '../models/product.model';
import { roundQty } from './batch.utils';
import {
  collectCategories, collectVatRates, DEFAULT_CATEGORIES, formatQty, parseVatRate, suggestCategories, suggestVatRates,
} from './product-form.utils';

describe('collectCategories', () => {
  it('yeni hesapta (ürün yok) varsayılan kategorileri önerir', () => {
    const list = collectCategories([]);
    for (const c of DEFAULT_CATEGORIES) expect(list).toContain(c);
  });

  it('ürün kategorilerini ekler, büyük/küçük harf farkıyla tekrar etmez', () => {
    const list = collectCategories([{ category: 'gübre' }, { category: 'Damla Sulama' }, { category: '  ' }]);
    expect(list.filter(c => c.toLocaleLowerCase('tr-TR') === 'gübre').length).toBe(1);
    expect(list).toContain('Damla Sulama');
    expect(list).not.toContain('');
  });
});

describe('collectVatRates', () => {
  it('güncel oranlar: 0, 1, 10, 20 (8 ve 18 yok)', () => {
    expect(collectVatRates([])).toEqual(['0', '1', '10', '20']);
  });

  it('eski %8 / %18 ürünlerden gelse de önerilmez, diğer oranlar eklenir', () => {
    expect(collectVatRates([{ vatRate: 18 }, { vatRate: 8 }, { vatRate: 5 }, { vatRate: null }])).toEqual(['0', '1', '5', '10', '20']);
  });
});

describe('suggestCategories / suggestVatRates', () => {
  it('Türkçe harfle içeren eşleşme + yazılan yeni değer', () => {
    expect(suggestCategories(['Zirai İlaç', 'Gübre'], 'ilaç')).toEqual(['Zirai İlaç', 'ilaç']);
    expect(suggestCategories(['Zirai İlaç', 'Gübre'], 'zirai ilaç')).toEqual(['Zirai İlaç']);
    expect(suggestCategories(['Gübre'], 'Fide')).toEqual(['Fide']);
  });

  it('KDV: başlayan eşleşmeler, geçerli yeni sayı başa', () => {
    expect(suggestVatRates(['0', '1', '10', '20'], '1')).toEqual(['1', '10']);
    expect(suggestVatRates(['0', '1', '10', '20'], '5')).toEqual(['5']);
    expect(parseVatRate('%8,5')).toEqual({ valid: true, value: 8.5 });
  });
});

describe('birim ve miktar', () => {
  it('birim alanı yoksa adet; kg/lt/metre ondalıklı', () => {
    expect(productUnit({})).toBe('adet');
    expect(productUnit({ unit: 'kg' })).toBe('kg');
    expect(isDecimalUnit('kg')).toBe(true);
    expect(isDecimalUnit('lt')).toBe(true);
    expect(isDecimalUnit('metre')).toBe(true);
    expect(isDecimalUnit('adet')).toBe(false);
    expect(isDecimalUnit('cuval')).toBe(false);
  });

  it('formatQty ve roundQty', () => {
    expect(formatQty(12.5)).toBe('12,5');
    expect(formatQty(3)).toBe('3');
    expect(roundQty(0.1 + 0.2)).toBe(0.3);
    expect(roundQty(5)).toBe(5);
  });
});
