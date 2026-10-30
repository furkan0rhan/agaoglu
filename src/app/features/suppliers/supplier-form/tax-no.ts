import { isValidTcNo } from '../../customers/services/customer.utils';

/** Vergi no durumu: boş, geçerli VKN (10 hane), geçerli TCKN (11 hane, şahıs firması), hane sayısı ya da kontrol hanesi hatalı. */
export type TaxNoStatus = 'empty' | 'vkn' | 'tckn' | 'length' | 'checksum';

/** GİB vergi kimlik no (VKN) kontrol hanesi algoritması. */
export function isValidVkn(vkn: string | null | undefined): boolean {
  const v = (vkn ?? '').trim();
  if (!/^\d{10}$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const tmp = (Number(v[i]) + 9 - i) % 10;
    let p = (tmp * 2 ** (9 - i)) % 9;
    if (tmp !== 0 && p === 0) p = 9;
    sum += p;
  }
  return (10 - (sum % 10)) % 10 === Number(v[9]);
}

/** Kaydı engellemez; yalnız formda bilgi rozeti için. Boşluklar yok sayılır. */
export function taxNoStatus(raw: string | null | undefined): TaxNoStatus {
  const v = (raw ?? '').replace(/\s+/g, '');
  if (!v) return 'empty';
  if (!/^\d+$/.test(v) || (v.length !== 10 && v.length !== 11)) return 'length';
  if (v.length === 10) return isValidVkn(v) ? 'vkn' : 'checksum';
  return isValidTcNo(v) ? 'tckn' : 'checksum';
}
