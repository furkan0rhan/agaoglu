import { ChangeDetectionStrategy, Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { LangService } from '../../../core/i18n/lang.service';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { SaleReceipt } from '../../../shared/models/sale.model';
import { methodLabel, qtyWithUnit } from '../services/sales.helpers';
import { receiptVatBreakdown } from './receipt.utils';
import { DEFAULT_RECEIPT_SETTINGS, ReceiptSettings } from '../../../core/settings/tenant-settings.model';
import { injectSettingsTexts } from '../../settings/settings.i18n';
import { RECEIPT_FALLBACK_NAME, ReceiptBusiness } from './receipt-business.service';

/**
 * 80 mm (yazdırılabilir ~72 mm) veya 58 mm (~48 mm) termal fiş — `options` = Ayarlar → Fiş (`settings.receipt`). Siyah-beyaz, eşit genişlikli yazı.
 * Yazdırma: ReceiptPrinterService body'ye ekleyip `window.print()` ile basar (`.tm-receipt-host` ekranda gizli).
 * Ayarlar'daki canlı önizleme aynı bileşeni ekranda çizer: test fişi ile gerçek fiş birebir aynıdır.
 * Stiller kapsüllenmemiştir (ViewEncapsulation.None): `@media print` kuralları yalnızca
 * `html.tm-printing-receipt` sınıfı varken sayfanın geri kalanını gizler.
 */
@Component({
  selector: 'app-receipt',
  standalone: true,
  imports: [CurrencyTrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="tm-receipt" [class.tm-receipt-58]="opts().paperWidth === 58">
      @if (opts().logo) {
        <div class="tm-r-center tm-r-logo"><img [src]="opts().logo" alt="" /></div>
      }
      <div class="tm-r-center tm-r-title">{{ business()?.name || fallbackName }}</div>
      @if (opts().headerNote) { <div class="tm-r-center">{{ opts().headerNote }}</div> }
      @if (business()?.address) { <div class="tm-r-center">{{ business()?.address }}</div> }
      @if (business()?.phone) { <div class="tm-r-center">{{ business()?.phone }}</div> }
      @if (business()?.taxNo) {
        <div class="tm-r-center">{{ business()?.taxOffice }} {{ business()?.taxNo }}</div>
      }
      @if (opts().showDealerLicense && business()?.dealerLicenseNo) {
        <div class="tm-r-center">{{ st().dealerLicenseNo }}: {{ business()?.dealerLicenseNo }}</div>
      }
      <div class="tm-r-sep"></div>
      @if (isPayment()) {
        <div class="tm-r-center tm-r-strong">{{ t().sales.paymentReceipt }}</div>
      }
      <div class="tm-r-row"><span>{{ t().sales.date }}</span><span>{{ dateText() }}</span></div>
      <div class="tm-r-row"><span>{{ t().sales.saleNo }}</span><span class="tm-r-break">{{ receipt().saleNumber }}</span></div>
      @if (receipt().customerName) {
        <div class="tm-r-row"><span>{{ t().sales.customer }}</span><span>{{ receipt().customerName }}</span></div>
      }
      <div class="tm-r-sep"></div>

      @if (receipt().payment; as p) {
        <!-- Y11: veresiye tahsilat makbuzu -->
        <div class="tm-r-row"><span>{{ t().sales.prevBalance }}</span><span>{{ p.previousBalance | currencyTr }}</span></div>
        <div class="tm-r-row tm-r-total"><span>{{ t().sales.paymentAmount }}</span><span>{{ p.amount | currencyTr }}</span></div>
        <div class="tm-r-row"><span>{{ t().sales.paymentMethod }}</span><span>{{ paymentMethodText() }}</span></div>
        <div class="tm-r-row tm-r-strong"><span>{{ t().sales.newBalance }}</span><span>{{ p.newBalance | currencyTr }}</span></div>
        @if (p.note) { <div class="tm-r-small tm-r-break">{{ p.note }}</div> }
        <div class="tm-r-sep"></div>
        <div class="tm-r-sign">{{ t().sales.debtorSignature }}: ______________</div>
        <div class="tm-r-sep"></div>
        <div class="tm-r-center tm-r-strong">{{ business()?.receiptFooter || t().sales.thankYou }}</div>
      } @else {

      @for (i of receipt().items; track $index) {
        <div class="tm-r-item">
          <div class="tm-r-name">{{ i.productName }}</div>
          <div class="tm-r-row">
            <span>{{ qty(i.quantity, i.unit) }} x {{ i.unitPrice | currencyTr: false }}</span>
            <span class="tm-r-strong">{{ i.totalPrice | currencyTr: false }}</span>
          </div>
          @if (i.discount > 0) {
            <div class="tm-r-row tm-r-small">
              <span>{{ t().pos.discount }} {{ i.discountType === 'percent' ? '%' + i.discount : (i.discount | currencyTr: false) }}</span>
            </div>
          }
          @if (opts().showLicenseNo && i.licenseNo) {
            <div class="tm-r-small">{{ t().compliance.licenseNo }}: {{ i.licenseNo }}</div>
          }
          @if (opts().showGts && i.gtsNos?.length) {
            <div class="tm-r-small tm-r-break">GTS: {{ i.gtsNos!.join(', ') }}</div>
          }
          @if (opts().showGts && i.lotNos?.length) {
            <div class="tm-r-small tm-r-break">{{ t().inventory.lotNo }}: {{ i.lotNos!.join(', ') }}</div>
          }
        </div>
      }

      <div class="tm-r-sep"></div>
      @if (receipt().totalDiscount > 0) {
        <div class="tm-r-row"><span>{{ t().pos.subtotal }}</span><span>{{ receipt().subtotal | currencyTr }}</span></div>
        <div class="tm-r-row"><span>{{ t().pos.discount }}</span><span>-{{ receipt().totalDiscount | currencyTr }}</span></div>
      }
      <div class="tm-r-row tm-r-total"><span>{{ t().sales.receiptTotal }}</span><span>{{ receipt().totalAmount | currencyTr }}</span></div>
      @if (receipt().prescriptionNo) {
        <div class="tm-r-row"><span>{{ t().compliance.rxNo }}</span><span class="tm-r-break">{{ receipt().prescriptionNo }}</span></div>
      }
      <div class="tm-r-sep"></div>

      <div class="tm-r-row"><span>{{ t().sales.paymentMethod }}</span>
<span>{{ method() }}</span></div>
      @if (receipt().cashPaid > 0) {
        <div class="tm-r-row"><span>{{ t().sales.cashPaid }}</span><span>{{ receipt().cashPaid | currencyTr }}</span></div>
      }
      @if (receipt().cardPaid > 0) {
        <div class="tm-r-row"><span>{{ t().sales.cardPaid }}</span><span>{{ receipt().cardPaid | currencyTr }}</span></div>
      }
      @if (receipt().creditAmount > 0) {
        <div class="tm-r-row"><span>{{ t().sales.creditAmount }}</span><span>{{ receipt().creditAmount | currencyTr }}</span></div>
      }
      @if (receipt().totalWithInterest) {
        <div class="tm-r-row tm-r-small">
          <span>{{ t().pos.creditDebtWithInterest }}{{ receipt().installmentCount ? ' (' + receipt().installmentCount + 'x)' : '' }}</span>
          <span>{{ receipt().totalWithInterest | currencyTr }}</span>
        </div>
      }
      @if (receipt().change > 0) {
        <div class="tm-r-row tm-r-strong"><span>{{ t().sales.change }}</span><span>{{ receipt().change | currencyTr }}</span></div>
      }
      @if (receipt().downPayment) {
        <div class="tm-r-row"><span>{{ t().pos2.downPaymentLabel }}</span><span>{{ receipt().downPayment | currencyTr }}</span></div>
      }
      @if (receipt().installments?.length) {
        <div class="tm-r-sep"></div>
        <div class="tm-r-strong">{{ t().pos2.planLabel }}</div>
        @for (i of receipt().installments; track i.no) {
          <div class="tm-r-row tm-r-small"><span>{{ i.no }}. {{ day(i.dueDate) }}</span><span>{{ i.amount | currencyTr }}</span></div>
        }
      } @else if (receipt().dueDate) {
        <div class="tm-r-row"><span>{{ t().pos2.dueLabel }}</span><span>{{ day(receipt().dueDate!) }}</span></div>
      }

      @if (vatRows().length) {
        <!-- Y12: oran bazında KDV dökümü (fiyatlar KDV dahil) -->
        <div class="tm-r-sep"></div>
        <div class="tm-r-strong">{{ t().sales.vatBreakdown }}</div>
        @for (v of vatRows(); track v.rate) {
          @if (v.rate === null) {
            <div class="tm-r-row tm-r-small"><span>{{ t().sales.vatUnknown }}</span><span>{{ v.gross | currencyTr: false }}</span></div>
          } @else {
            <div class="tm-r-row tm-r-small">
              <span>%{{ v.rate }} {{ t().sales.vatBase }} {{ v.base | currencyTr: false }}</span>
              <span>KDV {{ v.vat | currencyTr: false }}</span>
            </div>
          }
        }
      }

      @if (receipt().creditAmount > 0) {
        <!-- Y12: veresiye fişinde borçlu imzası -->
        <div class="tm-r-sep"></div>
        <div class="tm-r-sign">{{ t().sales.debtorSignature }}: ______________</div>
      }

      <div class="tm-r-sep"></div>
      <div class="tm-r-center">{{ receipt().items.length }} {{ t().sales.items }}</div>
      <div class="tm-r-center tm-r-strong">{{ business()?.receiptFooter || t().sales.thankYou }}</div>
      }
    </div>
  `,
  styles: `
    @media screen {
      .tm-receipt-host { display: none !important; }
    }
    @media print {
      @page { margin: 0; }
      html.tm-printing-receipt,
      html.tm-printing-receipt body {
        height: auto !important;
        overflow: visible !important;
        background: white !important;
      }
      html.tm-printing-receipt body > :not(.tm-receipt-host) { display: none !important; }
      html.tm-printing-receipt .tm-receipt-host { display: block !important; }
    }
    .tm-receipt {
      width: 72mm;
      padding: 3mm 2mm 6mm;
      color: black;
      background: white;
      font: 12px/1.35 'Courier New', ui-monospace, monospace;
    }
    .tm-receipt.tm-receipt-58 { width: 48mm; padding: 2mm 1mm 5mm; font-size: 10.5px; }
    .tm-receipt.tm-receipt-58 .tm-r-title { font-size: 13px; }
    .tm-receipt.tm-receipt-58 .tm-r-total { font-size: 14px; }
    .tm-receipt.tm-receipt-58 .tm-r-small { font-size: 9.5px; }
    .tm-receipt .tm-r-logo { margin-bottom: 1mm; }
    .tm-receipt .tm-r-logo img { max-width: 70%; max-height: 18mm; object-fit: contain; filter: grayscale(1) contrast(1.2); }
    .tm-receipt .tm-r-center { text-align: center; }
    .tm-receipt .tm-r-title { font-size: 15px; font-weight: 700; margin-bottom: 1mm; }
    .tm-receipt .tm-r-sep { border-top: 1px dashed black; margin: 2mm 0; }
    .tm-receipt .tm-r-row { display: flex; justify-content: space-between; gap: 2mm; }
    .tm-receipt .tm-r-row > span:last-child { text-align: right; }
    .tm-receipt .tm-r-break { word-break: break-all; }
    .tm-receipt .tm-r-item { margin-bottom: 1.2mm; }
    .tm-receipt .tm-r-name { font-weight: 700; word-break: break-word; }
    .tm-receipt .tm-r-small { font-size: 11px; }
    .tm-receipt .tm-r-strong { font-weight: 700; }
    .tm-receipt .tm-r-total { font-size: 16px; font-weight: 700; }
    .tm-receipt .tm-r-sign { margin-top: 6mm; }
  `,
})
export class ReceiptComponent {
  private readonly lang = inject(LangService);
  readonly t = this.lang.t;
  readonly fallbackName = RECEIPT_FALLBACK_NAME;

  readonly receipt = input.required<SaleReceipt>();
  readonly business = input<ReceiptBusiness | null>(null);
  /** Fiş ayarları (kâğıt genişliği, logo, başlık notu, ruhsat/GTS/bayi izin gösterimi). */
  readonly options = input<ReceiptSettings | null>(null);
  readonly opts = computed(() => this.options() ?? DEFAULT_RECEIPT_SETTINGS);
  readonly st = injectSettingsTexts();

  readonly dateText = computed(() =>
    this.receipt().date.toLocaleString(this.lang.lang() === 'tr' ? 'tr-TR' : 'en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
  );
  readonly method = computed(() => methodLabel(this.t(), this.receipt().paymentMethod, this.receipt()));
  readonly isPayment = computed(() => this.receipt().kind === 'payment');
  readonly vatRows = computed(() => (this.isPayment() ? [] : receiptVatBreakdown(this.receipt())));
  readonly paymentMethodText = computed(() => {
    const m = this.receipt().payment?.method;
    return m === 'transfer' ? this.t().sales.methodTransfer : m === 'card' ? this.t().sales.methodCard : this.t().sales.methodCash;
  });

  day(d: Date): string {
    return d.toLocaleDateString(this.lang.lang() === 'tr' ? 'tr-TR' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  qty(q: number, unit: SaleReceipt['items'][number]['unit']): string {
    return qtyWithUnit(this.t(), q, unit, this.lang.lang());
  }
}
