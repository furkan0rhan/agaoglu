import type { Product } from '../models/product.model';

/** Ürün formu ve ürün detayında ortak kategori / KDV autocomplete yardımcıları */

/** Yeni hesapta da dolu gelen kategori önerileri (zirai ilaç / gübre / tohum bayisi) */
export const DEFAULT_CATEGORIES: readonly string[] = [
  'Gübre', 'Zirai İlaç', 'Tohum', 'Fide', 'Fidan', 'Sulama', 'Hırdavat', 'Yem', 'Çiçek', 'Diğer',
];

/** Türkiye'de güncel KDV oranları (2023 Temmuz'dan beri; %8 ve %18 yok) */
export const DEFAULT_VAT_RATES: readonly number[] = [0, 1, 10, 20];

/** Artık uygulanmayan oranlar: eski ürünlerde kayıtlı olsa da öneri listesine girmez */
const OBSOLETE_VAT_RATES: readonly number[] = [8, 18];

/** Kategori önerileri: varsayılanlar + ürünlerde kullanılanlar (Türkçe sıralı, tekrarsız, büyük/küçük harf duyarsız) */
export function collectCategories(products: readonly Pick<Product, 'category'>[]): string[] {
  const seen = new Map<string, string>();
  for (const c of [...DEFAULT_CATEGORIES, ...products.map(p => (p.category ?? '').trim())]) {
    if (!c) continue;
    const key = c.toLocaleLowerCase('tr-TR');
    if (!seen.has(key)) seen.set(key, c);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'tr-TR'));
}

/** KDV önerileri: güncel oranlar + ürünlerde kullanılan diğer oranlar (eski %8 / %18 hariç) */
export function collectVatRates(products: readonly Pick<Product, 'vatRate'>[]): string[] {
  return [...new Set([
    ...DEFAULT_VAT_RATES,
    ...products
      .map(p => p.vatRate)
      .filter((v): v is number => v != null && Number.isFinite(v) && !OBSOLETE_VAT_RATES.includes(v)),
  ].map(String))].sort((a, b) => Number(a) - Number(b));
}

/**
 * Miktarı yerel biçimde yaz: tam sayılar ondalıksız, kg / lt / metre en fazla 3 ondalık ("12,5").
 * Birim metni çağıran taraftan (i18n) verilir.
 */
export function formatQty(n: number | null | undefined, locale = 'tr-TR'): string {
  const v = Math.round((Number(n) || 0) * 1000) / 1000;
  return v.toLocaleString(locale, { maximumFractionDigits: 3 });
}

/** Kategori önerileri: içeren eşleşmeler + yazılan yeni değer (listede yoksa sona) */
export function suggestCategories(all: readonly string[], query: string): string[] {
  const raw = query.trim();
  if (!raw) return [...all];
  const lq = raw.toLocaleLowerCase('tr-TR');
  const filtered = all.filter(v => v.toLocaleLowerCase('tr-TR').includes(lq));
  if (!filtered.some(v => v.toLocaleLowerCase('tr-TR') === lq)) filtered.push(raw);
  return filtered;
}

/** KDV önerileri: başlayan eşleşmeler + yazılan geçerli sayı (listede yoksa başa) */
export function suggestVatRates(all: readonly string[], query: string): string[] {
  const q = query.trim();
  if (!q) return [...all];
  const filtered = all.filter(v => v.startsWith(q));
  if (!filtered.includes(q) && parseVatRate(q).valid) filtered.unshift(q);
  return filtered;
}

/**
 * KDV metnini sayıya çevir. Boş → null (geçerli). Sayı değilse veya 0-100 dışındaysa geçersiz.
 * Virgüllü ondalık kabul edilir ("8,5").
 */
export function parseVatRate(input: string | number | null | undefined): { valid: boolean; value: number | null } {
  if (input == null) return { valid: true, value: null };
  const s = String(input).trim().replace('%', '').replace(',', '.');
  if (!s) return { valid: true, value: null };
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 100) return { valid: false, value: null };
  return { valid: true, value: n };
}
