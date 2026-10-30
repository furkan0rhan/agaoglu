/**
 * Veresiye: taksit planı, tahsilat dağıtımı, gecikme, limit, ekstre ve hatırlatma için SAF fonksiyonlar.
 * Firestore'a bağımlı değildir (Timestamp yerine `toDate()`/`toMillis()` taşıyan her nesne kabul edilir);
 * çiftçi modülü ve dashboard da aynı hesapları kullanabilir.
 */
import type { CreditTransaction } from '../../../shared/models/credit.model';
import { renderReminderTemplate } from '../../../core/settings/reminder-template';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Kuruşa yuvarlar (kayan nokta artıklarını temizler). */
export function roundKurus(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

export type DateLike = Date | { toDate(): Date } | { toMillis(): number } | null | undefined;

/** Date / Firestore Timestamp / benzeri → Date (geçersizse null). */
export function toJsDate(d: DateLike): Date | null {
  if (!d) return null;
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
  if (typeof (d as { toDate?: unknown }).toDate === 'function') return (d as { toDate(): Date }).toDate();
  if (typeof (d as { toMillis?: unknown }).toMillis === 'function') return new Date((d as { toMillis(): number }).toMillis());
  return null;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Ay ekler; hedef ayda o gün yoksa ayın son gününe kırpar (31 Ocak + 1 ay = 28/29 Şubat).
 * Her taksit ilk vadeden hesaplanır (zincirleme kayma olmaz: 31 Oca → 28 Şub → 31 Mar).
 */
export function addMonthsClamped(d: Date, months: number): Date {
  const y = d.getFullYear();
  const m = d.getMonth() + months;
  const lastDay = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(d.getDate(), lastDay));
}

// ─────────────────────────────────────────────────────────────── Taksit planı

export interface PlannedInstallment {
  no: number;
  dueDate: Date;
  amount: number;
  paidAmount: number;
}

export interface InstallmentPlan {
  /** Peşinat dahil toplam (vade farkı dahil). */
  total: number;
  /** Peşinat (kırpılmış: 0 ≤ peşinat ≤ toplam). */
  downPayment: number;
  /** Veresiyeye yazılacak tutar = toplam − peşinat = taksitlerin toplamı. */
  financed: number;
  /** Vade = son taksitin tarihi (borç yoksa null). */
  dueDate: Date | null;
  installments: PlannedInstallment[];
}

/**
 * Veresiye taksit planı.
 * - Taksitler kuruşa eşit bölünür, kuruş farkı SON taksite yazılır (3 × 575,67 = 1.727,01 sorunu yok).
 * - Taksit tarihleri ilk vadeden `intervalMonths` ay arayla (ay sonu kırpmalı).
 * - Peşinat toplamdan düşülür; peşinat toplamı karşılıyorsa taksit yoktur.
 * "Hasatta öderim" = count 1, firstDueDate = hasat tarihi.
 */
export function buildInstallmentPlan(
  total: number,
  count: number,
  firstDueDate: Date,
  downPayment = 0,
  intervalMonths = 1,
): InstallmentPlan {
  const t = Math.max(0, roundKurus(Number(total) || 0));
  const down = Math.min(t, Math.max(0, roundKurus(Number(downPayment) || 0)));
  const financed = roundKurus(t - down);
  const n = Math.max(1, Math.floor(Number(count) || 1));
  const step = Math.max(1, Math.floor(Number(intervalMonths) || 1));
  if (financed <= 0) return { total: t, downPayment: down, financed: 0, dueDate: null, installments: [] };

  const first = startOfDay(firstDueDate);
  const cents = Math.round(financed * 100);
  const base = Math.floor(cents / n);
  const installments: PlannedInstallment[] = Array.from({ length: n }, (_, i) => ({
    no: i + 1,
    dueDate: addMonthsClamped(first, i * step),
    amount: (i === n - 1 ? cents - base * (n - 1) : base) / 100,
    paidAmount: 0,
  }));
  return { total: t, downPayment: down, financed, dueDate: installments[n - 1].dueDate, installments };
}

// ─────────────────────────────────────────────────────────────── Tahsilat dağıtımı

/** Hesaplanmış taksit (müşterinin tüm borçları tek takvimde). */
export interface ScheduleItem {
  txId: string;
  saleId: string | null;
  /** Taksit no (taksitsiz borçta 1). */
  no: number;
  /** Borçtaki taksit sayısı. */
  count: number;
  /** Vadesiz eski borçlarda (varsayılan vade de verilmediyse) null (gecikmeye düşmez). */
  dueDate: Date | null;
  createdAt: Date | null;
  amount: number;
  paidAmount: number;
  remaining: number;
  /**
   * Y7: vade kayıtta yoktu, türetildi — `default`: satış tarihi + Ayarlar → Veresiye "varsayılan vade";
   * `installments`: taksit planı kaydedilmemiş eski taksitli satış (taksit sayısı + satış tarihinden aylık).
   */
  dueDerived?: 'default' | 'installments';
}

type DebtLike = Pick<CreditTransaction, 'id' | 'type' | 'amount' | 'saleId'> & {
  createdAt?: DateLike;
  dueDate?: DateLike;
  installments?: { no: number; dueDate: DateLike; amount: number }[] | null;
  installmentCount?: number | null;
  isReversal?: boolean;
};

export interface ScheduleOptions {
  /**
   * Vadesi kaydedilmemiş borçlar için varsayılan vade (gün, satış tarihinden). 0 / yok = vadesiz kalır.
   * Kaynak: Ayarlar → Veresiye kuralları → varsayılan vade (`settings.credit.defaultDueDays`).
   */
  defaultDueDays?: number | null;
}

/** Y7: vadesi kaydedilmemiş borcun taksitleri (eski taksitli kayıt → aylık; değilse satış + varsayılan vade). */
function derivedPlan(tx: DebtLike, createdAt: Date | null, opts: ScheduleOptions):
  { no: number; dueDate: Date | null; amount: number; derived?: 'default' | 'installments' }[] {
  const total = roundKurus(tx.amount);
  const n = Math.floor(Number(tx.installmentCount) || 0);
  if (createdAt && n > 1 && n <= 36) {
    const base = roundKurus(Math.floor((total / n) * 100) / 100);
    return Array.from({ length: n }, (_, i) => ({
      no: i + 1,
      dueDate: addMonthsClamped(createdAt, i + 1),
      amount: i === n - 1 ? roundKurus(total - base * (n - 1)) : base,
      derived: 'installments' as const,
    }));
  }
  const days = Math.floor(Number(opts.defaultDueDays) || 0);
  if (createdAt && days > 0) {
    const due = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate() + days);
    return [{ no: 1, dueDate: due, amount: total, derived: 'default' }];
  }
  return [{ no: 1, dueDate: null, amount: total }];
}

function sortKey(i: Pick<ScheduleItem, 'dueDate' | 'createdAt' | 'no'>): number {
  // Vadesiz borç, oluşturulduğu tarihte vadesi gelmiş gibi sıralanır (en eski önce ödenir)
  return (i.dueDate ?? i.createdAt)?.getTime() ?? 0;
}

/** Taksitleri en eski vadeden yeniye sıralar (eşitlikte taksit no). */
export function sortSchedule<T extends Pick<ScheduleItem, 'dueDate' | 'createdAt' | 'no'>>(items: T[]): T[] {
  return [...items].sort((a, b) => sortKey(a) - sortKey(b) || a.no - b.no);
}

/**
 * Borç kayıtlarından taksit listesi (ödenmemiş hâli). İptal edilen satışın (isReversal, aynı saleId)
 * tutarı o satışın taksitlerinden SONDAN başlayarak düşülür. Tahsilat kayıtları yok sayılır.
 */
export function debtInstallments(txs: DebtLike[], opts: ScheduleOptions = {}): ScheduleItem[] {
  const reversed = new Map<string, number>();
  for (const tx of txs) {
    if (tx.type !== 'debt' || !(tx.isReversal === true || tx.amount < 0)) continue;
    if (tx.saleId) reversed.set(tx.saleId, roundKurus((reversed.get(tx.saleId) ?? 0) + Math.abs(tx.amount)));
  }
  const out: ScheduleItem[] = [];
  for (const tx of txs) {
    if (tx.type !== 'debt' || tx.isReversal === true || !(tx.amount > 0)) continue;
    const createdAt = toJsDate(tx.createdAt);
    const explicitDue = toJsDate(tx.dueDate);
    const plan: { no: number; dueDate: Date | null; amount: number; derived?: 'default' | 'installments' }[] = tx.installments?.length
      ? tx.installments.map(i => ({ no: i.no, dueDate: toJsDate(i.dueDate), amount: roundKurus(i.amount) }))
      : explicitDue
        ? [{ no: 1, dueDate: explicitDue, amount: roundKurus(tx.amount) }]
        : derivedPlan(tx, createdAt, opts);
    // İptal tutarını son taksitlerden düş
    let rev = tx.saleId ? reversed.get(tx.saleId) ?? 0 : 0;
    for (let k = plan.length - 1; k >= 0 && rev > 0; k--) {
      const cut = Math.min(rev, plan[k].amount);
      plan[k].amount = roundKurus(plan[k].amount - cut);
      rev = roundKurus(rev - cut);
    }
    if (tx.saleId) reversed.set(tx.saleId, rev);
    for (const p of plan) {
      if (p.amount <= 0) continue;
      out.push({
        txId: tx.id, saleId: tx.saleId ?? null, no: p.no, count: plan.length,
        dueDate: p.dueDate ? startOfDay(p.dueDate) : null, createdAt,
        amount: p.amount, paidAmount: 0, remaining: p.amount,
        ...(p.derived ? { dueDerived: p.derived } : {}),
      });
    }
  }
  return sortSchedule(out);
}

/**
 * Bir tahsilatı taksitlere EN ESKİ VADEDEN başlayarak dağıtır (saf; girdiyi değiştirmez).
 * Artan tutar `unallocated` olarak döner (fazla ödeme / vadesiz alacak).
 */
export function allocatePayment<T extends ScheduleItem>(items: T[], amount: number): { items: T[]; unallocated: number } {
  let left = Math.max(0, roundKurus(amount));
  const out = sortSchedule(items).map(i => ({ ...i }));
  for (const i of out) {
    if (left <= 0) break;
    const pay = Math.min(left, i.remaining);
    if (pay <= 0) continue;
    i.paidAmount = roundKurus(i.paidAmount + pay);
    i.remaining = roundKurus(i.amount - i.paidAmount);
    left = roundKurus(left - pay);
  }
  return { items: out, unallocated: left };
}

/**
 * Müşterinin güncel taksit takvimi. Ödenen toplam = taksitlerin toplamı − güncel bakiye
 * (bakiye tek doğru kaynak; tahsilatlar FIFO dağıtıldığı için bu, tüm tahsilatları tek tek
 * dağıtmakla aynı sonucu verir ve eski/eksik kayıtlara karşı sağlamdır).
 */
export function buildSchedule(txs: DebtLike[], balance: number, opts: ScheduleOptions = {}): ScheduleItem[] {
  const items = debtInstallments(txs, opts);
  const total = roundKurus(items.reduce((s, i) => s + i.amount, 0));
  const paid = Math.max(0, roundKurus(total - Math.max(0, balance || 0)));
  return allocatePayment(items, paid).items;
}

// ─────────────────────────────────────────────────────────────── Gecikme

/** Vadeden bu yana geçen tam gün (vadesi bugün veya ileride ise 0). */
export function daysOverdue(dueDate: Date | null, today: Date = new Date()): number {
  if (!dueDate) return 0;
  const diff = startOfDay(today).getTime() - startOfDay(dueDate).getTime();
  return diff > 0 ? Math.round(diff / DAY_MS) : 0;
}

export interface CreditStatus {
  /** Vadesi geçmiş, ödenmemiş toplam. */
  overdueAmount: number;
  overdueCount: number;
  /** En eski gecikmiş taksitin gecikme günü. */
  maxDaysOverdue: number;
  /** Bugünden itibaren 7 gün içinde (bugün dahil) vadesi gelen ödenmemiş toplam. */
  dueThisWeekAmount: number;
  /** Sıradaki (gecikmemiş) ödenmemiş taksit. */
  nextDue: { date: Date; amount: number } | null;
  /** En eski ödenmemiş vadeli taksit (gecikmiş olabilir). */
  oldestDue: { date: Date; amount: number } | null;
}

export const EMPTY_CREDIT_STATUS: CreditStatus = {
  overdueAmount: 0, overdueCount: 0, maxDaysOverdue: 0, dueThisWeekAmount: 0, nextDue: null, oldestDue: null,
};

export function creditStatus(schedule: ScheduleItem[], today: Date = new Date()): CreditStatus {
  const t0 = startOfDay(today).getTime();
  const weekEnd = t0 + 7 * DAY_MS;
  const s: CreditStatus = { ...EMPTY_CREDIT_STATUS };
  for (const i of sortSchedule(schedule)) {
    if (i.remaining <= 0 || !i.dueDate) continue;
    const due = i.dueDate.getTime();
    if (!s.oldestDue) s.oldestDue = { date: i.dueDate, amount: i.remaining };
    if (due < t0) {
      s.overdueAmount = roundKurus(s.overdueAmount + i.remaining);
      s.overdueCount++;
      s.maxDaysOverdue = Math.max(s.maxDaysOverdue, daysOverdue(i.dueDate, today));
    } else {
      if (due < weekEnd) s.dueThisWeekAmount = roundKurus(s.dueThisWeekAmount + i.remaining);
      if (!s.nextDue) s.nextDue = { date: i.dueDate, amount: i.remaining };
    }
  }
  return s;
}

export interface OverdueSummary {
  totalOverdue: number;
  customerCount: number;
}

export function summarizeOverdue(statuses: Iterable<CreditStatus>): OverdueSummary {
  let totalOverdue = 0;
  let customerCount = 0;
  for (const s of statuses) {
    if (s.overdueAmount > 0) { totalOverdue += s.overdueAmount; customerCount++; }
  }
  return { totalOverdue: roundKurus(totalOverdue), customerCount };
}

// ─────────────────────────────────────────────────────────────── Veresiye limiti

export interface CreditLimitCheck {
  /** Limit tanımlı ve yeni bakiye limiti aşıyor. */
  exceeded: boolean;
  limit: number | null;
  newBalance: number;
  /** Limiti aşan kısım (aşmıyorsa 0). */
  overBy: number;
  /** Limite kalan (limitsizse null). */
  available: number | null;
}

/** Müşteri limiti kontrolü. `limit` null/undefined/≤0 → limitsiz. Engellemez; uyarı kararını çağıran verir. */
export function checkCreditLimit(currentBalance: number, limit: number | null | undefined, additionalDebt: number): CreditLimitCheck {
  const newBalance = roundKurus((currentBalance || 0) + Math.max(0, additionalDebt || 0));
  if (limit == null || !(limit > 0)) return { exceeded: false, limit: null, newBalance, overBy: 0, available: null };
  const overBy = Math.max(0, roundKurus(newBalance - limit));
  return { exceeded: overBy > 0, limit, newBalance, overBy, available: Math.max(0, roundKurus(limit - (currentBalance || 0))) };
}

// ─────────────────────────────────────────────────────────────── Hesap ekstresi

export interface StatementRow {
  date: Date | null;
  description: string;
  /** Borç (artış). */
  debit: number;
  /** Alacak (tahsilat / iptal). */
  credit: number;
  balance: number;
}

export interface Statement {
  opening: number;
  rows: StatementRow[];
  totalDebit: number;
  totalCredit: number;
  closing: number;
}

type StatementTx = Pick<CreditTransaction, 'type' | 'amount' | 'description'> & { createdAt?: DateLike };

/** İşlemin bakiyeye etkisi: borç +, tahsilat −, iptal (negatif borç) −. */
export function signedAmount(tx: Pick<CreditTransaction, 'type' | 'amount'>): number {
  return tx.type === 'payment' ? -Math.abs(tx.amount) : tx.amount;
}

/**
 * Tarih aralıklı hesap ekstresi. Devreden bakiye = başlangıçtan önceki tüm işlemlerin toplamı.
 * Zamanı henüz yazılmamış (bekleyen) kayıtlar en sona, aralığa dahil sayılır.
 */
export function buildStatement(txs: StatementTx[], from: Date, to: Date): Statement {
  const start = startOfDay(from).getTime();
  const end = startOfDay(to).getTime() + DAY_MS; // dahil
  const dated = txs
    .map(tx => ({ tx, d: toJsDate(tx.createdAt) }))
    .sort((a, b) => (a.d?.getTime() ?? Infinity) - (b.d?.getTime() ?? Infinity));
  let balance = 0;
  const rows: StatementRow[] = [];
  let opening = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  for (const { tx, d } of dated) {
    const amt = signedAmount(tx);
    const t = d?.getTime() ?? Infinity;
    if (t < start) { balance = roundKurus(balance + amt); opening = balance; continue; }
    if (d && t >= end) continue;
    balance = roundKurus(balance + amt);
    const debit = amt > 0 ? amt : 0;
    const credit = amt < 0 ? -amt : 0;
    totalDebit = roundKurus(totalDebit + debit);
    totalCredit = roundKurus(totalCredit + credit);
    rows.push({ date: d, description: tx.description ?? '', debit, credit, balance });
  }
  return { opening, rows, totalDebit, totalCredit, closing: roundKurus(opening + totalDebit - totalCredit) };
}

// ─────────────────────────────────────────────────────────────── Hatırlatma (WhatsApp / SMS)

/** Türkiye cep telefonu → uluslararası rakamlar ("0532 123 45 67" → "905321234567"). Geçersizse null. */
export function toIntlPhone(phone: string | null | undefined): string | null {
  let d = (phone ?? '').replace(/\D/g, '');
  if (d.startsWith('0090')) d = d.slice(2);
  if (d.startsWith('90') && d.length === 12) return d;
  if (d.startsWith('0') && d.length === 11) return '9' + d;
  if (d.length === 10 && d.startsWith('5')) return '90' + d;
  return null;
}

export interface ReminderInput {
  customerName: string;
  balance: number;
  businessName: string;
  /** Gecikmiş tutar (0 ise metinde yer almaz). */
  overdueAmount?: number;
  /** Sıradaki / en eski vade tarihi. */
  dueDate?: Date | null;
  /** Tutar biçimlendirici (varsayılan tr-TR). */
  formatMoney?: (n: number) => string;
}

function fmtMoneyTr(n: number): string {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' TL';
}

function fmtDateTr(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/** Türkçe borç hatırlatma metni (borç, vade, işletme adı). */
export function buildReminderText(i: ReminderInput): string {
  const money = i.formatMoney ?? fmtMoneyTr;
  const parts = [`Sayın ${i.customerName.trim()},`, `${i.businessName.trim() || 'işletmemiz'} nezdindeki güncel borç bakiyeniz ${money(i.balance)}.`];
  if (i.overdueAmount && i.overdueAmount > 0) {
    parts.push(`Bunun ${money(i.overdueAmount)} tutarındaki kısmının vadesi geçmiştir${i.dueDate ? ` (vade: ${fmtDateTr(i.dueDate)})` : ''}.`);
  } else if (i.dueDate) {
    parts.push(`Sıradaki ödeme tarihiniz ${fmtDateTr(i.dueDate)}.`);
  }
  parts.push('Ödemenizi bekler, iyi çalışmalar dileriz.');
  if (i.businessName.trim()) parts.push(i.businessName.trim());
  return parts.join(' ');
}

/**
 * Hatırlatma metni: Ayarlar → Veresiye şablonu (`settings.credit.reminderTemplate`) doluysa o şablon,
 * boşsa yerleşik `buildReminderText`.
 */
export function reminderMessage(template: string | null | undefined, i: ReminderInput & { businessPhone?: string }): string {
  if (!template?.trim()) return buildReminderText(i);
  const money = i.formatMoney ?? fmtMoneyTr;
  return renderReminderTemplate(template, {
    ad: i.customerName,
    borc: money(i.balance),
    gecikmis: i.overdueAmount && i.overdueAmount > 0 ? money(i.overdueAmount) : '',
    vade: i.dueDate ? fmtDateTr(i.dueDate) : '',
    isletme: i.businessName,
    telefon: i.businessPhone ?? '',
  });
}

/** wa.me bağlantısı (telefon geçersizse numarasız paylaşım bağlantısı). */
export function whatsappLink(phone: string | null | undefined, text: string): string {
  const p = toIntlPhone(phone);
  return `https://wa.me/${p ?? ''}?text=${encodeURIComponent(text)}`;
}

/** sms: bağlantısı (Android ve iOS'ta çalışan `?body=` biçimi). */
export function smsLink(phone: string | null | undefined, text: string): string {
  const p = toIntlPhone(phone);
  return `sms:${p ? '+' + p : ''}?body=${encodeURIComponent(text)}`;
}
