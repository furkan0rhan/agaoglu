import { computed, inject } from '@angular/core';
import { LangService } from '../../core/i18n/lang.service';
import type { Lang } from '../../core/i18n/translations';

/** Rapor sayfasının v2 ek metinleri (paylaşılan translations.ts'i büyütmemek için burada). */
const TR = {
  purchasesTitle: 'Alışlar & tedarikçi borcu',
  purchasesDesc: 'Seçili dönemdeki mal alımları ve tedarikçi ödemeleri',
  purchasesTotal: 'Alış toplamı',
  purchasesCount: (n: number) => `${n} alış belgesi`,
  supplierPaid: 'Tedarikçiye ödenen',
  supplierDebt: 'Güncel tedarikçi borcu',
  supplierDebtNote: 'Tüm tedarikçilerin bugünkü bakiyesi (dönemden bağımsız)',
  purchaseVsRevenue: 'Alış / ciro',
  purchasesFailed: 'Alış özeti yüklenemedi',
  allPurchases: 'Alışlar',
  allSuppliers: 'Tedarikçiler',
  netProfitHint: (exp: string) => `Gider: ${exp}`,
  avgHint: (n: number, avg: string) => `${n} satış · ort. ${avg}`,
  revenueGross: 'Ciro (KDV dahil)',
  netSales: 'Net satış (KDV hariç)',
  vat: 'KDV',
  vatHint: (vat: string) => `KDV: ${vat}`,
  vatEstimatedNote: 'Tahmini: bazı eski satışlarda KDV oranı kaydı yok, ürünün güncel KDV oranı kullanıldı.',
  cancelTitle: 'İptaller',
  cancelDesc: 'Dönemde iptal edilen satışlar: kim sattı, kim iptal etti, neden',
  cancelSummary: (n: number, total: string) => `${n} iptal · ${total}`,
  cancelEmpty: 'Bu dönemde iptal edilen satış yok',
  cancelFailed: 'İptal kayıtları yüklenemedi',
  cancelDate: 'İptal zamanı',
  cancelSaleNo: 'Satış no',
  cancelSoldBy: 'Satan',
  cancelBy: 'İptal eden',
  cancelReason: 'Neden',
  cancelAmount: 'Tutar',
  cancelLegacy: 'eski kayıt',
};

export type ReportTexts = typeof TR;

const EN: ReportTexts = {
  purchasesTitle: 'Purchases & supplier debt',
  purchasesDesc: 'Goods purchased and supplier payments in the selected period',
  purchasesTotal: 'Total purchases',
  purchasesCount: (n: number) => `${n} purchase document(s)`,
  supplierPaid: 'Paid to suppliers',
  supplierDebt: 'Current supplier debt',
  supplierDebtNote: 'Current balance of all suppliers (not period based)',
  purchaseVsRevenue: 'Purchases / revenue',
  purchasesFailed: 'Purchase summary could not be loaded',
  allPurchases: 'Purchases',
  allSuppliers: 'Suppliers',
  netProfitHint: (exp: string) => `Expenses: ${exp}`,
  avgHint: (n: number, avg: string) => `${n} sales · avg ${avg}`,
  revenueGross: 'Revenue (incl. VAT)',
  netSales: 'Net sales (excl. VAT)',
  vat: 'VAT',
  vatHint: (vat: string) => `VAT: ${vat}`,
  vatEstimatedNote: 'Estimated: some older sales have no VAT rate record; the current VAT rate was used.',
  cancelTitle: 'Cancellations',
  cancelDesc: 'Sales cancelled in the period: who sold, who cancelled, why',
  cancelSummary: (n: number, total: string) => `${n} cancellation(s) · ${total}`,
  cancelEmpty: 'No cancelled sales in this period',
  cancelFailed: 'Cancellation records could not be loaded',
  cancelDate: 'Cancelled at',
  cancelSaleNo: 'Sale no',
  cancelSoldBy: 'Sold by',
  cancelBy: 'Cancelled by',
  cancelReason: 'Reason',
  cancelAmount: 'Amount',
  cancelLegacy: 'legacy record',
};

export const REPORT_TEXTS: Record<Lang, ReportTexts> = { tr: TR, en: EN };

export function injectReportTexts() {
  const lang = inject(LangService);
  return computed(() => REPORT_TEXTS[lang.lang()]);
}
