import { anonymizePatch, formatTrMobile, isValidTcNo, isValidTrMobile, maskTcNo } from './customer.utils';

describe('maskTcNo', () => {
  it('11 haneli TC no: ilk 2 ve son 2 hane görünür', () => {
    expect(maskTcNo('12345678934')).toBe('12*******34');
  });
  it('boş / null → boş', () => {
    expect(maskTcNo(null)).toBe('');
    expect(maskTcNo('')).toBe('');
  });
  it('kısa değerde hiçbir hane sızmaz', () => {
    expect(maskTcNo('1234')).toBe('****');
    expect(maskTcNo('12345')).toBe('12*45');
  });
});

describe('isValidTcNo', () => {
  it('geçerli TC no', () => expect(isValidTcNo('10000000146')).toBe(true));
  it('kontrol basamağı yanlış', () => expect(isValidTcNo('10000000147')).toBe(false));
  it('0 ile başlayamaz, 11 hane olmalı', () => {
    expect(isValidTcNo('01234567890')).toBe(false);
    expect(isValidTcNo('12345')).toBe(false);
  });
});

describe('isValidTrMobile / formatTrMobile', () => {
  it('05XX biçimleri kabul', () => {
    expect(isValidTrMobile('0532 123 45 67')).toBe(true);
    expect(isValidTrMobile('+90 532 123 45 67')).toBe(true);
    expect(isValidTrMobile('905321234567')).toBe(true);
  });
  it('sıfırsız 10 hane ve sabit hat reddedilir', () => {
    expect(isValidTrMobile('5321234567')).toBe(false);
    expect(isValidTrMobile('0312 123 45 67')).toBe(false);
  });
  it('biçimlendirir', () => expect(formatTrMobile('+905321234567')).toBe('0532 123 45 67'));
});

describe('anonymizePatch', () => {
  it('kişisel verileri siler, adı "Silinmiş Müşteri #xxxx" yapar, bakiyeye dokunmaz', () => {
    const p = anonymizePatch('abcdWXYZ');
    expect(p['firstName']).toBe('Silinmiş Müşteri');
    expect(p['lastName']).toBe('#WXYZ');
    expect(p['tcNo']).toBeNull();
    expect(p['phone']).toBeNull();
    expect(p['address']).toBeNull();
    expect('balance' in p).toBe(false);
  });
});
