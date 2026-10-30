import { formatTrPhone, isValidTaxNo, isValidTrPhone, taxNoChecksumWarn } from './tr-validation';

describe('tr-validation (Y14)', () => {
  it('telefon: sıfırsız 10 hane kabul edilip biçimlenir', () => {
    expect(isValidTrPhone('3324441122')).toBe(true);
    expect(formatTrPhone('3324441122')).toBe('0332 444 11 22');
    expect(formatTrPhone('+90 532 111 22 33')).toBe('0532 111 22 33');
    expect(formatTrPhone('4441234')).toBe('444 12 34');
  });

  it('telefon: eksik / anlamsız numara reddedilir, boş geçerli', () => {
    expect(isValidTrPhone('12345')).toBe(false);
    expect(isValidTrPhone('0132 444 11 22')).toBe(false);
    expect(isValidTrPhone('')).toBe(true);
  });

  it('vergi no: 10 / 11 hane; 5 hane reddedilir, kontrol hanesi yalnız uyarı', () => {
    expect(isValidTaxNo('12345')).toBe(false);
    expect(isValidTaxNo('12345abcde')).toBe(false);
    expect(isValidTaxNo('1234567890')).toBe(true);
    expect(isValidTaxNo('10000000146')).toBe(true);
    expect(isValidTaxNo('')).toBe(true);
    expect(taxNoChecksumWarn('10000000146')).toBe(false);
    expect(taxNoChecksumWarn('12345678901')).toBe(true);
  });
});
