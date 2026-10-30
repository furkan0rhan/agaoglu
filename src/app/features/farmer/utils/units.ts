/**
 * Birim dönüşümleri (yalnızca aritmetik). Hacim → litre, kütle → kg tabanına çevrilir.
 */
export type FarmUnit = 'ml' | 'lt' | 'g' | 'kg' | 'cuval' | 'adet' | 'paket' | 'metre';

export const FARM_UNITS: readonly FarmUnit[] = ['lt', 'ml', 'kg', 'g', 'cuval', 'adet', 'paket', 'metre'];

type Dimension = 'volume' | 'mass' | 'count' | 'length';

const UNIT_INFO: Record<FarmUnit, { dim: Dimension; toBase: number }> = {
  ml: { dim: 'volume', toBase: 0.001 },
  lt: { dim: 'volume', toBase: 1 },
  g: { dim: 'mass', toBase: 0.001 },
  kg: { dim: 'mass', toBase: 1 },
  cuval: { dim: 'count', toBase: 1 },
  adet: { dim: 'count', toBase: 1 },
  paket: { dim: 'count', toBase: 1 },
  metre: { dim: 'length', toBase: 1 },
};

/** Görünen birim adı (kod değeri `cuval` kalır; ekranda "çuval"). */
const UNIT_LABELS: Record<FarmUnit, { tr: string; en: string }> = {
  ml: { tr: 'ml', en: 'ml' }, lt: { tr: 'lt', en: 'L' }, g: { tr: 'g', en: 'g' }, kg: { tr: 'kg', en: 'kg' },
  cuval: { tr: 'çuval', en: 'sack' }, adet: { tr: 'adet', en: 'pcs' }, paket: { tr: 'paket', en: 'pack' }, metre: { tr: 'metre', en: 'm' },
};

/** Birimin ekrandaki adı; bilinmeyen birim olduğu gibi döner. */
export function unitLabel(u: string | null | undefined, lang = 'tr'): string {
  if (!u) return '';
  return isFarmUnit(u) ? UNIT_LABELS[u][lang === 'tr' ? 'tr' : 'en'] : u;
}

/** Sayılan birim mi (çuval, adet, paket)? Bunlarda "dekara 0,067 çuval" anlamsızdır. */
export function isCountUnit(u: FarmUnit): boolean {
  return UNIT_INFO[u].dim === 'count';
}

export function isFarmUnit(u: unknown): u is FarmUnit {
  return typeof u === 'string' && u in UNIT_INFO;
}

/** Satış birimini (adet/kg/lt/paket/cuval/metre) çiftçi birimine çevirir; bilinmiyorsa 'adet'. */
export function toFarmUnit(u: string | null | undefined): FarmUnit {
  return isFarmUnit(u) ? u : 'adet';
}

/** Aynı boyuttaki birimler arasında dönüşüm. Dönüştürülemiyorsa null (ör. kg → lt, çuval → adet). */
export function convertUnit(value: number, from: FarmUnit, to: FarmUnit): number | null {
  if (!Number.isFinite(value)) return null;
  if (from === to) return value;
  const a = UNIT_INFO[from];
  const b = UNIT_INFO[to];
  if (a.dim !== b.dim || a.dim === 'count') return null;
  return round(value * a.toBase / b.toBase, 6);
}

/** Küçük/büyük miktarı okunur birime çevirir: 0,125 lt → 125 ml; 1500 g → 1,5 kg. */
export function humanizeAmount(value: number, unit: FarmUnit): { value: number; unit: FarmUnit } {
  if (unit === 'lt' && Math.abs(value) < 1 && value !== 0) return { value: round(value * 1000, 1), unit: 'ml' };
  if (unit === 'kg' && Math.abs(value) < 1 && value !== 0) return { value: round(value * 1000, 1), unit: 'g' };
  if (unit === 'ml' && Math.abs(value) >= 1000) return { value: round(value / 1000, 3), unit: 'lt' };
  if (unit === 'g' && Math.abs(value) >= 1000) return { value: round(value / 1000, 3), unit: 'kg' };
  return { value: round(value, 3), unit };
}

export function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round((v + Number.EPSILON) * f) / f;
}
