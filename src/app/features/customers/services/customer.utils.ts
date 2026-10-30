/** Müşteri: TC/telefon doğrulama, TC maskeleme ve KVKK anonimleştirme için SAF fonksiyonlar. */

/** Aydınlatma metni / açık rıza metni sürümü. Metin değişince artırılır (src/assets/legal/aydinlatma-metni.md). */
export const KVKK_TEXT_VERSION = 'v1-2026-10';

/** "12345678901" → "12*******01". 11 haneden kısa/uzun değerlerde de ilk 2 + son 2 dışında yıldız. */
export function maskTcNo(tc: string | null | undefined): string {
  const v = (tc ?? '').replace(/\s/g, '');
  if (!v) return '';
  if (v.length <= 4) return '*'.repeat(v.length);
  return v.slice(0, 2) + '*'.repeat(v.length - 4) + v.slice(-2);
}

/** T.C. kimlik no algoritma kontrolü (11 hane, ilk hane 0 değil, 10. ve 11. hane kontrol basamakları). */
export function isValidTcNo(tc: string | null | undefined): boolean {
  const v = (tc ?? '').trim();
  if (!/^[1-9]\d{10}$/.test(v)) return false;
  const d = v.split('').map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const d10 = (((odd * 7 - even) % 10) + 10) % 10;
  const d11 = (d.slice(0, 10).reduce((s, x) => s + x, 0)) % 10;
  return d[9] === d10 && d[10] === d11;
}

/** Türkiye cep telefonu: 05XX XXX XX XX (boşluk/tire/parantez serbest, +90/90 öneki kabul). */
export function isValidTrMobile(phone: string | null | undefined): boolean {
  let d = (phone ?? '').replace(/[\s\-().]/g, '');
  if (d.startsWith('+90')) d = '0' + d.slice(3);
  else if (d.startsWith('90') && d.length === 12) d = '0' + d.slice(2);
  return /^05\d{9}$/.test(d);
}

/** Telefonu "05XX XXX XX XX" biçimine getirir (geçersizse olduğu gibi döner). */
export function formatTrMobile(phone: string): string {
  let d = phone.replace(/[\s\-().]/g, '');
  if (d.startsWith('+90')) d = '0' + d.slice(3);
  else if (d.startsWith('90') && d.length === 12) d = '0' + d.slice(2);
  if (!/^05\d{9}$/.test(d)) return phone.trim();
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`;
}

/** Anonimleştirilmiş müşteri görünen adı: "Silinmiş Müşteri #A1B2" (belge kimliğinin son 4 karakteri). */
export function anonymizedName(customerId: string): { firstName: string; lastName: string } {
  return { firstName: 'Silinmiş Müşteri', lastName: '#' + customerId.slice(-4).toUpperCase() };
}

/**
 * Anonimleştirmede müşteri belgesine yazılacak alanlar. Bakiye/ciro alanları ve satış kayıtları
 * (muhasebe ve vergi mevzuatı gereği saklama) korunur; kişisel veriler silinir.
 */
export function anonymizePatch(customerId: string): Record<string, unknown> {
  return {
    ...anonymizedName(customerId),
    tcNo: null,
    phone: null,
    email: null,
    address: null,
    village: null,
    cksNo: null,
    birthDate: null,
    notes: null,
    consents: null,
    isActive: false,
  };
}
