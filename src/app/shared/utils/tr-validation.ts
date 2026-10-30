import { taxNoStatus } from '../../features/suppliers/supplier-form/tax-no';

/**
 * Y14: işletme / tedarikçi iletişim ve vergi bilgisi doğrulamaları (SAF fonksiyonlar).
 * Boş değer "girilmemiş" sayılır ve geçerlidir; zorunluluk çağıran tarafta.
 */

/** Telefonu rakamlara indirger; +90 / 90 önekini 0'a çevirir. */
function phoneDigits(phone: string | null | undefined): string {
  let d = (phone ?? '').replace(/[\s\-().]/g, '');
  if (d.startsWith('+90')) d = '0' + d.slice(3);
  else if (d.startsWith('90') && d.length === 12) d = '0' + d.slice(2);
  else if (/^[2-5]\d{9}$/.test(d)) d = '0' + d; // sıfırsız yazılmış 10 hane
  return d;
}

/** Türkiye sabit / cep telefonu (0XXX XXX XX XX) ya da 444 XX XX. Boş = geçerli. */
export function isValidTrPhone(phone: string | null | undefined): boolean {
  const raw = (phone ?? '').trim();
  if (!raw) return true;
  const d = phoneDigits(raw);
  return /^0[2-5]\d{9}$/.test(d) || /^444\d{4}$/.test(d);
}

/** "3324441122" → "0332 444 11 22"; "4441234" → "444 12 34". Geçersizse olduğu gibi (kırpılmış). */
export function formatTrPhone(phone: string | null | undefined): string {
  const raw = (phone ?? '').trim();
  const d = phoneDigits(raw);
  if (/^0[2-5]\d{9}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`;
  if (/^444\d{4}$/.test(d)) return `444 ${d.slice(3, 5)} ${d.slice(5, 7)}`;
  return raw;
}

/**
 * Vergi no: 10 hane (VKN) ya da 11 hane (şahıs firmasında T.C. kimlik no). Boş = geçerli.
 * Hane sayısı kaydı engeller; kontrol hanesi tutmazsa yalnız uyarı (`taxNoChecksumWarn`) — tedarikçi formuyla aynı.
 */
export function isValidTaxNo(v: string | null | undefined): boolean {
  return taxNoStatus(v) !== 'length';
}

export function taxNoChecksumWarn(v: string | null | undefined): boolean {
  return taxNoStatus(v) === 'checksum';
}
