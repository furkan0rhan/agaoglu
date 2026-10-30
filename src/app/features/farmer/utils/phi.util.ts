import { PhiSource } from '../../../shared/models/farmer.model';

/**
 * PHI (hasat öncesi bekleme süresi) hesapları.
 * Uygulama PHI ÜRETMEZ: değer ya bayinin ürün kartındaki etiket bilgisinden (Product.phiDays), ya bayideki
 * yetkili kişinin önerisinden, ya da çiftçinin etiketten okuyup girdiği değerden gelir. Veri yoksa hesap
 * yapılmaz (null) ve "etiketi kontrol edin" uyarısı gösterilir. Hesap = tarih + gün (aritmetik).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PhiInput {
  /** Bitkiye özel etiket değerleri (ürün kartında ileride `labelUses` olursa): crop → gün */
  phiByCrop?: Readonly<Record<string, number>> | null;
  /** Ürün kartındaki tek değer (Product.phiDays) */
  phiDays?: number | null;
}

export interface ResolvedPhi { days: number; source: PhiSource }

export function isValidPhiDays(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 365;
}

/**
 * Ürün + bitki için PHI. Bitkiye özel değer varsa o (aynı ilacın PHI'si bitkiye göre değişir),
 * yoksa ürünün genel değeri; hiçbiri yoksa null (tahmin YOK).
 */
export function resolvePhi(input: PhiInput | null | undefined, crop: string | null | undefined, source: PhiSource = 'dealer'): ResolvedPhi | null {
  if (!input) return null;
  const byCrop = crop && input.phiByCrop ? input.phiByCrop[crop] : undefined;
  if (isValidPhiDays(byCrop)) return { days: byCrop, source };
  if (isValidPhiDays(input.phiDays)) return { days: input.phiDays, source };
  return null;
}

/** Yerel takvimde gün başı (saat farkı hesapları kaydırmasın). */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  const s = startOfDay(d);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + days);
}

/** En erken hasat tarihi = uygulama tarihi + PHI gün. PHI yoksa null. */
export function earliestHarvestDate(applicationDate: Date | null | undefined, phiDays: number | null | undefined): Date | null {
  if (!applicationDate || !isValidPhiDays(phiDays)) return null;
  return addDays(applicationDate, phiDays);
}

/** Birden çok uygulamada esas alınan tarih: en geç olan. Hiç veri yoksa null. */
export function latestHarvestBlock(dates: readonly (Date | null | undefined)[]): Date | null {
  let max: Date | null = null;
  for (const d of dates) if (d && (!max || d.getTime() > max.getTime())) max = d;
  return max;
}

/** Beklenen hasat, PHI'nin izin verdiği en erken tarihten önce mi? (kırmızı uyarı) */
export function isHarvestBeforePhi(expectedHarvest: Date | null | undefined, earliest: Date | null | undefined): boolean {
  if (!expectedHarvest || !earliest) return false;
  return startOfDay(expectedHarvest).getTime() < startOfDay(earliest).getTime();
}

/** Bugünden itibaren kalan gün (0 = bugün). */
export function daysUntil(date: Date, today: Date = new Date()): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(today).getTime()) / DAY_MS);
}

export interface PhiLogLike {
  fieldId: string;
  seasonId: string | null;
  earliestHarvestDate: Date | null;
  productName: string | null;
  phiDays: number | null;
}

export interface PhiWarning {
  fieldId: string;
  seasonId: string | null;
  earliest: Date;
  /** Beklenen hasat tarihi PHI bitişinden önce mi (kırmızı) */
  conflict: boolean;
  daysLeft: number;
  productName: string | null;
  phiDays: number;
}

/**
 * Süren PHI uyarıları: her tarla(+sezon) için hâlâ devam eden EN GEÇ bekleme.
 * Bekleme bitmiş kayıtlar dahil edilmez. Çakışanlar (hasat < PHI bitişi) önce gelir.
 */
export function activePhiWarnings(
  logs: readonly PhiLogLike[],
  expectedHarvestBySeason: Readonly<Record<string, Date | null>>,
  today: Date = new Date(),
): PhiWarning[] {
  const byKey = new Map<string, PhiWarning>();
  for (const l of logs) {
    if (!l.earliestHarvestDate || l.phiDays == null) continue;
    const left = daysUntil(l.earliestHarvestDate, today);
    if (left <= 0) continue;
    const key = l.fieldId + '|' + (l.seasonId ?? '');
    const prev = byKey.get(key);
    if (prev && prev.earliest.getTime() >= l.earliestHarvestDate.getTime()) continue;
    const expected = l.seasonId ? expectedHarvestBySeason[l.seasonId] ?? null : null;
    byKey.set(key, {
      fieldId: l.fieldId, seasonId: l.seasonId, earliest: l.earliestHarvestDate,
      conflict: isHarvestBeforePhi(expected, l.earliestHarvestDate),
      daysLeft: left, productName: l.productName, phiDays: l.phiDays,
    });
  }
  return [...byKey.values()].sort((a, b) => Number(b.conflict) - Number(a.conflict) || a.earliest.getTime() - b.earliest.getTime());
}
