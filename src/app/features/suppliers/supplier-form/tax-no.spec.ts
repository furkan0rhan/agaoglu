import { isValidVkn, taxNoStatus } from './tax-no';

describe('tax-no', () => {
  it('VKN kontrol hanesini doğrular', () => {
    expect(isValidVkn('1234567890')).toBe(true);
    expect(isValidVkn('1234567891')).toBe(false);
    expect(isValidVkn('123')).toBe(false);
    // Kontrol hanesi tutan örnek: ilk 9 hanenin üzerinden hesaplanan son hane
    const base = '123456789';
    const ok = [...Array(10).keys()].map(d => base + d).find(v => isValidVkn(v));
    expect(ok).toBeDefined();
    expect([...Array(10).keys()].map(d => base + d).filter(v => isValidVkn(v)).length).toBe(1);
  });

  it('durumu sınıflandırır', () => {
    expect(taxNoStatus('')).toBe('empty');
    expect(taxNoStatus(null)).toBe('empty');
    expect(taxNoStatus('12ab')).toBe('length');
    expect(taxNoStatus('123 456 7890')).toBe('vkn');
    expect(taxNoStatus('1234567891')).toBe('checksum');
    expect(taxNoStatus('123456')).toBe('length');
    expect(taxNoStatus('10000000146')).toBe('tckn');
    expect(taxNoStatus('10000000147')).toBe('checksum');
  });
});
