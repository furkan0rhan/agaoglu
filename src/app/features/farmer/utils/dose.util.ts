import { convertUnit, FarmUnit, humanizeAmount, round } from './units';

/**
 * Dekar başı miktar = toplam miktar / alan. Yalnızca ARİTMETİK — uygulama doz önermez.
 * Alan ≤ 0 veya miktar geçersizse null.
 */
export function dosePerDecare(quantity: number | null | undefined, areaDecare: number | null | undefined): number | null {
  if (quantity == null || areaDecare == null) return null;
  if (!Number.isFinite(quantity) || !Number.isFinite(areaDecare) || areaDecare <= 0 || quantity < 0) return null;
  return round(quantity / areaDecare, 4);
}

/** Dekar başı miktarı okunur birimde döndürür (1,5 lt / 12 da → 125 ml / da). */
export function dosePerDecareReadable(
  quantity: number | null | undefined, unit: FarmUnit, areaDecare: number | null | undefined,
): { value: number; unit: FarmUnit } | null {
  const d = dosePerDecare(quantity, areaDecare);
  return d == null ? null : humanizeAmount(d, unit);
}

/**
 * Ambardaki kalan miktardan düşülecek değer (kayıt birimi → ambar birimi). Dönüştürülemiyorsa null.
 * Sonuç kalan miktarı aşamaz, sıfırın altına inmez.
 */
export function remainingAfterUse(remaining: number, used: number, usedUnit: FarmUnit, stockUnit: FarmUnit): number | null {
  const inStock = convertUnit(used, usedUnit, stockUnit);
  if (inStock == null || inStock < 0) return null;
  return Math.max(0, round(remaining - inStock, 3));
}
