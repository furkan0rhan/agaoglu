import type { CreditTransaction } from '../../../shared/models/credit.model';
import type { FarmerInstallment, FarmerLink } from '../../../shared/models/farmer.model';
import { buildSchedule, creditStatus, DateLike, roundKurus, sortSchedule } from '../../credit/services/credit.utils';

/** Bağlantıya yazılan en fazla taksit (doküman boyutu sınırlı kalsın). */
export const FARMER_SCHEDULE_MAX = 24;

export type DebtTxLike = Pick<CreditTransaction, 'id' | 'type' | 'amount' | 'saleId'> & {
  createdAt?: DateLike;
  dueDate?: DateLike;
  installments?: { no: number; dueDate: DateLike; amount: number }[] | null;
  isReversal?: boolean;
};

export interface FarmerDebtSummary {
  nextDue: FarmerLink['nextDue'];
  overdueAmount: number;
  schedule: FarmerInstallment[];
}

/**
 * Bayinin veresiye kayıtlarından çiftçiye gösterilecek vade özeti (bayi ekranıyla AYNI hesap: `buildSchedule` +
 * `creditStatus`). Takvimde önce ödenmemiş taksitler kalır; yer kalırsa en son ödenenler eklenir.
 */
export function farmerDebtSummary(
  txs: DebtTxLike[], balance: number | null | undefined, saleNumbers: ReadonlyMap<string, string> = new Map(), today = new Date(),
): FarmerDebtSummary {
  const items = buildSchedule(txs, Math.max(0, balance ?? 0));
  const st = creditStatus(items, today);
  const unpaid = items.filter(i => i.remaining > 0);
  const paid = items.filter(i => i.remaining <= 0);
  const room = Math.max(0, FARMER_SCHEDULE_MAX - unpaid.length);
  const kept = sortSchedule([...unpaid.slice(0, FARMER_SCHEDULE_MAX), ...(room ? paid.slice(-room) : [])]);
  return {
    nextDue: st.nextDue ? { date: st.nextDue.date, amount: roundKurus(st.nextDue.amount) } : null,
    overdueAmount: roundKurus(st.overdueAmount),
    schedule: kept.map(i => ({
      dueDate: i.dueDate, amount: i.amount, remaining: i.remaining, no: i.no, count: i.count,
      saleNumber: (i.saleId && saleNumbers.get(i.saleId)) || null,
    })),
  };
}
