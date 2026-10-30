import { recItemApplication } from './rec-item.util';

describe('recItemApplication (öneri → defter türü / birimi)', () => {
  it('gübre önerisi gübre / kg olarak düşer', () => {
    expect(recItemApplication({ productType: 'gubre', unit: 'kg' })).toEqual({ type: 'fertilizer', unit: 'kg' });
  });
  it('ilaç, tohum, fide, diğer eşlenir', () => {
    expect(recItemApplication({ productType: 'bitki_koruma', unit: 'lt' })).toEqual({ type: 'pesticide', unit: 'lt' });
    expect(recItemApplication({ productType: 'tohum', unit: 'paket' }).type).toBe('sowing');
    expect(recItemApplication({ productType: 'fide', unit: 'adet' }).type).toBe('sowing');
    expect(recItemApplication({ productType: 'diger', unit: 'adet' }).type).toBe('other');
  });
  it('eski öneride (alan yok) ya da bilinmeyen değerde varsayılan yok', () => {
    expect(recItemApplication({})).toEqual({ type: null, unit: null });
    expect(recItemApplication(null)).toEqual({ type: null, unit: null });
    expect(recItemApplication({ productType: 'toString', unit: 'litre' })).toEqual({ type: null, unit: null });
  });
});
