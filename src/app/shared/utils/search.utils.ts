/**
 * Türkçe duyarlı arama (2.22). Tek yardımcı: ürün listesi, pasif ürünler, stok sayımı.
 * - `toLocaleLowerCase('tr')`: İ → i, I → ı (JS'in varsayılan toLowerCase'i "İ"yi "i̇" yapar, "I"yı "i").
 * - Ardından ı → i katlanır ve birleşik nokta (U+0307) atılır: böylece İ / i / I / ı birbirini bulur
 *   ("İLAÇ" ↔ "ilaç", "ISITICI" ↔ "isitici", "ıspanak" ↔ "Ispanak"). Diğer harfler (ç, ş, ğ, ö, ü) olduğu gibi kalır.
 */
export function searchKey(value: string | null | undefined): string {
  return (value ?? '').toLocaleLowerCase('tr').replace(/̇/g, '').replace(/ı/g, 'i').trim();
}

/**
 * `query` (searchKey ile normalize edilmiş ya da ham) alanlardan birinde geçiyor mu?
 * Boş sorgu her şeyle eşleşir.
 */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = searchKey(query);
  if (!q) return true;
  return fields.some(f => searchKey(f).includes(q));
}
