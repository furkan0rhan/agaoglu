import { PaymentReceiptInfo, Sale, SaleReceipt } from '../../../shared/models/sale.model';
import { addMonthsClamped, buildInstallmentPlan } from '../../credit/services/credit.utils';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Fiş yeniden basımında kullanılan saklı plan (veresiye borç kaydındaki `installments`). */
export interface StoredInstallment { no: number; dueDate: unknown; amount: number }

/**
 * Firestore satış dokümanından fiş verisi.
 * `storedPlan`: satışın veresiye borç kaydındaki taksit planı (varsa tarihler/tutarlar aynen kullanılır).
 */
export function saleToReceipt(sale: Sale, storedPlan?: readonly StoredInstallment[] | null): SaleReceipt {
  const dueDate = toDate(sale.creditDueDate);
  return {
    saleNumber: sale.saleNumber,
    date: sale.createdAt?.toDate?.() ?? new Date(),
    customerName: sale.customerName,
    items: sale.items ?? [],
    subtotal: sale.subtotal ?? 0,
    totalDiscount: sale.totalDiscount ?? 0,
    totalAmount: sale.totalAmount ?? 0,
    paymentMethod: sale.paymentMethod,
    cashPaid: sale.cashPaid ?? 0,
    cardPaid: sale.cardPaid ?? 0,
    creditAmount: sale.creditAmount ?? 0,
    change: sale.change ?? 0,
    totalWithInterest: sale.totalWithInterest ?? null,
    installmentCount: sale.installmentCount ?? null,
    prescriptionNo: sale.prescriptionNo ?? null,
    dueDate,
    downPayment: sale.downPayment ?? null,
    installments: storedInstallments(storedPlan) ?? saleInstallments(sale, dueDate),
  };
}

/** Saklı plan → fiş taksitleri (tarih Timestamp/Date). Geçersiz ya da boşsa null. */
export function storedInstallments(
  plan: readonly StoredInstallment[] | null | undefined,
): { no: number; dueDate: Date; amount: number }[] | null {
  if (!plan?.length) return null;
  const rows = plan.map(i => ({ no: Number(i.no), dueDate: toDate(i.dueDate), amount: r2(Number(i.amount) || 0) }));
  if (rows.some(r => !r.dueDate)) return null;
  return rows.sort((a, b) => a.no - b.no) as { no: number; dueDate: Date; amount: number }[];
}

/**
 * Y12: saklı plan yoksa satışın taksit planı (fişte tarih + tutar) POS ile aynı hesapla
 * (`buildInstallmentPlan`, kuruş farkı son taksitte) borç tutarı + taksit sayısı + son vadeden
 * `installmentIntervalMonths` (eski satışta yok → 1 ay) aralıkla geriye doğru türetilir.
 * Vadesi olmayan (eski) veresiyede null.
 */
export function saleInstallments(
  sale: Pick<Sale, 'creditAmount' | 'totalWithInterest' | 'installmentCount' | 'installmentIntervalMonths'>, lastDue: Date | null,
): { no: number; dueDate: Date; amount: number }[] | null {
  const financed = r2(sale.totalWithInterest ?? sale.creditAmount ?? 0);
  if (!(financed > 0) || !lastDue) return null;
  const n = Math.min(36, Math.max(1, Math.floor(Number(sale.installmentCount) || 1)));
  const step = Math.min(12, Math.max(1, Math.floor(Number(sale.installmentIntervalMonths) || 1)));
  const first = addMonthsClamped(lastDue, -(n - 1) * step);
  const plan = buildInstallmentPlan(financed, n, first, 0, step);
  return plan.installments.map(i => ({ no: i.no, dueDate: i.dueDate, amount: i.amount }));
}

export interface VatRow {
  /** % oran; null = satışta oran kaydı yok (eski satış). */
  rate: number | null;
  /** KDV hariç tutar (matrah). */
  base: number;
  vat: number;
  /** KDV dahil. */
  gross: number;
}

/**
 * Y12: fiş KDV dökümü (oran bazında). Fiyatlar KDV dahildir; genel (sepet) indirimi satırlara
 * oransal dağıtılır (rapor hesabı `saleVat` ile aynı kural). Oransız kalemler `rate: null` satırında.
 */
export function receiptVatBreakdown(r: Pick<SaleReceipt, 'items' | 'totalAmount'>): VatRow[] {
  const total = r.totalAmount ?? 0;
  const lines = r.items.map(i => i.totalPrice ?? 0);
  const sum = lines.reduce((a, b) => a + b, 0);
  if (!(sum > 0) || !(total > 0)) return [];
  const factor = total / sum;
  const map = new Map<number | null, number>();
  r.items.forEach((i, idx) => {
    const rate = typeof i.vatRate === 'number' && Number.isFinite(i.vatRate) && i.vatRate >= 0 ? i.vatRate : null;
    map.set(rate, (map.get(rate) ?? 0) + lines[idx] * factor);
  });
  const rows: VatRow[] = [...map.entries()].map(([rate, g]) => {
    const gross = r2(g);
    const base = rate ? r2(gross / (1 + rate / 100)) : gross;
    return { rate, base, vat: r2(gross - base), gross };
  });
  // Yuvarlama farkı brüt toplamı fiş toplamına eşitlesin (en büyük satıra)
  const diff = r2(total - rows.reduce((a, x) => a + x.gross, 0));
  if (diff !== 0 && rows.length) {
    const big = rows.reduce((m, x) => (x.gross > m.gross ? x : m), rows[0]);
    big.gross = r2(big.gross + diff);
    big.base = big.rate ? r2(big.gross / (1 + big.rate / 100)) : big.gross;
    big.vat = r2(big.gross - big.base);
  }
  return rows.sort((a, b) => (a.rate ?? 999) - (b.rate ?? 999));
}

/** Y11: veresiye tahsilat makbuzu (aynı termal fiş düzeni, kalemsiz). */
export function paymentToReceipt(
  info: PaymentReceiptInfo, customerName: string, receiptNo: string, date: Date = new Date(),
): SaleReceipt {
  return {
    kind: 'payment', payment: info,
    saleNumber: receiptNo, date, customerName, items: [],
    subtotal: info.amount, totalDiscount: 0, totalAmount: info.amount,
    paymentMethod: info.method === 'card' ? 'card' : 'cash',
    cashPaid: info.method === 'cash' ? info.amount : 0, cardPaid: info.method === 'card' ? info.amount : 0,
    creditAmount: 0, change: 0, totalWithInterest: null, installmentCount: null,
  };
}

function toDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  const t = v as { toDate?: () => Date } | null | undefined;
  return t?.toDate?.() ?? null;
}

/**
 * Ayarlar → Fiş önizlemesi ve "test fişi" için örnek fiş (ikisi aynı veriyi kullanır).
 * İlk kalemde ruhsat no ve GTS var: ilgili gösterim ayarları önizlemede görülebilsin.
 */
export function sampleReceipt(customerName: string, itemNames: readonly string[]): SaleReceipt {
  const [a, b] = itemNames;
  return {
    saleNumber: 'TEST-0001',
    date: new Date(),
    customerName,
    items: [
      { productName: a, quantity: 2, unit: 'adet', unitPrice: 485, discount: 0, discountType: 'amount', totalPrice: 970,
        licenseNo: '1452/2019', gtsNos: ['8690000123457-0041', '8690000123457-0042'], lotNos: ['L2405A'], vatRate: 20 },
      { productName: b, quantity: 4, unit: 'adet', unitPrice: 1150, discount: 0, discountType: 'amount', totalPrice: 4600, vatRate: 1 },
    ],
    subtotal: 5570, totalDiscount: 0, totalAmount: 5570,
    paymentMethod: 'cash', cashPaid: 5570, cardPaid: 0, creditAmount: 0, change: 0,
    totalWithInterest: null, installmentCount: null,
  };
}
