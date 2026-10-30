import { PaymentMethod } from '../../../shared/models/sale.model';

/** Nakit dialogunda eksik kalan tutarın gideceği yer (5.4). */
export type CashRemainder = 'card' | 'credit';

export interface SplitPayment {
  method: PaymentMethod;
  /** Satışa yazılan nakit (alınan; para üstü dahil). */
  cash: number;
  card: number;
  /** Veresiyeye kalan. */
  credit: number;
  change: number;
}

const r2 = (n: number): number => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

/**
 * Nakit + kart / nakit + veresiye bölünmüş ödeme (5.4). Saf; CartStore aynı sonucu `setPayment(method, cash, card)`
 * ile üretir (değişim = ödenen − toplam, veresiye = toplam − ödenen).
 * - Alınan nakit toplamı karşılıyorsa: tek ödeme nakit, fark para üstü (kart / veresiye yok).
 * - Eksikse: kalan `remainder`'a (kart ya da veresiye); nakit > 0 ise yöntem 'mixed'. Bölünmüş ödemede para üstü 0.
 */
export function splitPayment(total: number, cashReceived: number, remainder: CashRemainder): SplitPayment {
  const t = Math.max(0, r2(total));
  const cash = Math.max(0, r2(cashReceived));
  if (cash >= t) return { method: 'cash', cash, card: 0, credit: 0, change: r2(cash - t) };
  const rest = r2(t - cash);
  const method: PaymentMethod = cash > 0 ? 'mixed' : remainder;
  return remainder === 'card'
    ? { method, cash, card: rest, credit: 0, change: 0 }
    : { method, cash, card: 0, credit: rest, change: 0 };
}
