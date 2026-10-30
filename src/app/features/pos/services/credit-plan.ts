import { CreditService } from '../../credit/services/credit.service';
import { InstallmentPlan } from '../../credit/services/credit.utils';
import { round2 } from './sale.utils';

/** POS veresiye dialogu girdileri. */
export interface CreditPlanInput {
  /** Sepet toplamı (indirimler düşülmüş). */
  total: number;
  /** Vade farkı (%); yalnız veresiyeye kalan kısma uygulanır. */
  rate: number;
  /** Peşinat (nakit tahsil edilir). */
  downPayment: number;
  /** Taksit sayısı ("Hasatta öde" = 1). */
  count: number;
  firstDueDate: Date;
  /** Taksit aralığı (ay). */
  intervalMonths: number;
}

export interface CreditPlanResult {
  /** 0 ≤ peşinat ≤ toplam. */
  downPayment: number;
  /** Veresiyeye kalan, vade farkı hariç (= sale.creditAmount). */
  base: number;
  interest: number;
  /** Borç kaydına yazılacak tutar = base + interest = taksitlerin toplamı. */
  financed: number;
  plan: InstallmentPlan;
}

/**
 * Peşinat düşülür, vade farkı kalan tutara uygulanır, taksitler `CreditService.buildInstallmentPlan`
 * ile (kuruş farkı son taksitte) çıkarılır.
 */
export function buildCreditPlan(i: CreditPlanInput): CreditPlanResult {
  const total = Math.max(0, round2(Number(i.total) || 0));
  const downPayment = Math.min(total, Math.max(0, round2(Number(i.downPayment) || 0)));
  const base = round2(total - downPayment);
  const interest = round2(base * (Math.max(0, Number(i.rate) || 0) / 100));
  const plan = CreditService.buildInstallmentPlan(round2(total + interest), i.count, i.firstDueDate, downPayment, i.intervalMonths);
  return { downPayment, base, interest, financed: plan.financed, plan };
}

/** Bugünden `months` ay sonrası (gün başı). */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

/** Satışa bağlı veresiye planı (sale.service → borç kaydı). */
export interface SaleCreditPlan {
  financed: number;
  dueDate: Date | null;
  installments: { no: number; dueDate: Date; amount: number; paidAmount: number }[];
  downPayment: number;
}

export interface CreditDebtOptions {
  interestRate: number | null;
  installmentCount: number | null;
  installmentAmount: number | null;
  totalWithInterest: number | null;
  plan?: SaleCreditPlan | null;
}

/**
 * Borç kaydının tutar / vade alanları. Plan varsa `amount = plan.financed` (peşinat düşülmüş, vade farkı dahil);
 * yoksa vade farklı toplam ya da sepetteki veresiye (kısmi nakit → veresiye).
 */
export function creditDebtFields(cartCredit: number, o?: CreditDebtOptions | null) {
  const plan = o?.plan ?? null;
  const amount = plan ? round2(plan.financed) : o?.totalWithInterest != null ? round2(o.totalWithInterest) : round2(cartCredit);
  return {
    amount,
    originalAmount: o?.totalWithInterest != null ? round2(cartCredit) : null,
    interestRate: o?.interestRate ?? null,
    installmentCount: o?.installmentCount ?? null,
    installmentAmount: o?.installmentAmount ?? null,
    dueDate: plan?.dueDate ?? null,
    installments: plan?.installments.length ? plan.installments.map(i => ({ ...i })) : null,
    downPayment: plan && plan.downPayment > 0 ? round2(plan.downPayment) : null,
  };
}
