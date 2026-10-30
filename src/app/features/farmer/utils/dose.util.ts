import { convertUnit, FarmUnit, humanizeAmount, isCountUnit, round } from './units';

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

/** Ürün adındaki ambalaj miktarı ("Amonyum Sülfat 50 kg" → 50 kg, "… 1 lt" → 1 lt). Yoksa null. */
export function packSizeFromName(name: string | null | undefined): { value: number; unit: FarmUnit } | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(kg|gr|g|lt|l|ml)(?![a-zçğıöşü])/i.exec(name ?? '');
  if (!m) return null;
  const value = Number(m[1].replace(',', '.'));
  if (!(value > 0)) return null;
  const u = m[2].toLowerCase();
  const unit: FarmUnit = u === 'kg' ? 'kg' : u === 'g' || u === 'gr' ? 'g' : u === 'ml' ? 'ml' : 'lt';
  return { value, unit };
}

export type DoseDisplay =
  | { kind: 'per-decare'; value: number; unit: FarmUnit }
  /** Sayılan birimde (çuval/adet) dekar başı 1'in altındaysa: "1 çuval ile ~15 dekar" */
  | { kind: 'decare-per-unit'; value: number; unit: FarmUnit };

/**
 * Çiftçinin anlayacağı dekar hesabı (yalnız aritmetik). Çuval/adet gibi sayılan birimde ürün adında ambalaj
 * miktarı varsa (50 kg) kg/dekar; yoksa ve dekara 1'den az düşüyorsa "1 çuval ile ~N dekar".
 */
export function doseDisplay(
  quantity: number | null | undefined, unit: FarmUnit, areaDecare: number | null | undefined, productName?: string | null,
): DoseDisplay | null {
  const d = dosePerDecare(quantity, areaDecare);
  if (d == null || quantity == null || areaDecare == null) return null;
  if (isCountUnit(unit)) {
    const pack = packSizeFromName(productName);
    if (pack) return { kind: 'per-decare', ...humanizeAmount(round(quantity * pack.value / areaDecare, 4), pack.unit) };
    if (d > 0 && d < 1) return { kind: 'decare-per-unit', value: round(areaDecare / quantity, 1), unit };
  }
  return { kind: 'per-decare', ...humanizeAmount(d, unit) };
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
