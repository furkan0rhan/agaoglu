import { doseDisplay, dosePerDecare, dosePerDecareReadable, packSizeFromName, remainingAfterUse } from './dose.util';
import { convertUnit, humanizeAmount, toFarmUnit, unitLabel } from './units';

describe('dose.util / units', () => {
  it('doz = miktar / alan', () => {
    expect(dosePerDecare(1.5, 12)).toBe(0.125);
    expect(dosePerDecare(40, 20)).toBe(2);
    expect(dosePerDecare(1, 0)).toBeNull();
    expect(dosePerDecare(-1, 5)).toBeNull();
    expect(dosePerDecare(null, 5)).toBeNull();
  });

  it('okunur doz: 1,5 lt / 12 da → 125 ml / da', () => {
    expect(dosePerDecareReadable(1.5, 'lt', 12)).toEqual({ value: 125, unit: 'ml' });
    expect(dosePerDecareReadable(500, 'kg', 25)).toEqual({ value: 20, unit: 'kg' });
  });

  it('birim dönüşümleri ml↔lt, g↔kg; farklı boyut dönüştürülmez', () => {
    expect(convertUnit(250, 'ml', 'lt')).toBe(0.25);
    expect(convertUnit(2, 'lt', 'ml')).toBe(2000);
    expect(convertUnit(1500, 'g', 'kg')).toBe(1.5);
    expect(convertUnit(0.2, 'kg', 'g')).toBe(200);
    expect(convertUnit(1, 'kg', 'lt')).toBeNull();
    expect(convertUnit(1, 'cuval', 'adet')).toBeNull();
    expect(convertUnit(3, 'cuval', 'cuval')).toBe(3);
    expect(humanizeAmount(2500, 'ml')).toEqual({ value: 2.5, unit: 'lt' });
    expect(toFarmUnit('xyz')).toBe('adet');
  });

  it('ambardan düşüm: birim çevrilir, sıfırın altına inmez', () => {
    expect(remainingAfterUse(2, 500, 'ml', 'lt')).toBe(1.5);
    expect(remainingAfterUse(1, 5, 'lt', 'lt')).toBe(0);
    expect(remainingAfterUse(10, 1, 'kg', 'lt')).toBeNull();
  });
});

describe('doseDisplay (dekar hesabının okunur hâli)', () => {
  it('çuvalda ürün adında ağırlık varsa kg/dekar', () => {
    expect(doseDisplay(8, 'cuval', 120, 'Amonyum Sülfat 50 kg')).toEqual({ kind: 'per-decare', value: 3.333, unit: 'kg' });
  });
  it('ağırlık yoksa "1 çuval ile ~15 dekar"', () => {
    expect(doseDisplay(8, 'cuval', 120, 'Amonyum Sülfat')).toEqual({ kind: 'decare-per-unit', value: 15, unit: 'cuval' });
  });
  it('hacim/kütle birimlerinde dekar başı okunur birimde', () => {
    expect(doseDisplay(1.5, 'lt', 12)).toEqual({ kind: 'per-decare', value: 125, unit: 'ml' });
    expect(doseDisplay(null, 'lt', 12)).toBeNull();
  });
  it('ambalaj miktarı ürün adından okunur', () => {
    expect(packSizeFromName('Üre 25kg')).toEqual({ value: 25, unit: 'kg' });
    expect(packSizeFromName('Mankozeb 1 lt')).toEqual({ value: 1, unit: 'lt' });
    expect(packSizeFromName('Glifosat 0,5 L şişe')).toEqual({ value: 0.5, unit: 'lt' });
    expect(packSizeFromName('Kalsiyum nitrat')).toBeNull();
    expect(packSizeFromName('Gold 2 litre')).toBeNull();
  });
  it('görünen birim: cuval → çuval / sack', () => {
    expect(unitLabel('cuval')).toBe('çuval');
    expect(unitLabel('cuval', 'en')).toBe('sack');
    expect(unitLabel('kutu')).toBe('kutu');
  });
});
