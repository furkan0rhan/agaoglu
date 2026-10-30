import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LangService } from '../../../core/i18n/lang.service';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { Purchase } from '../../../shared/models/purchase.model';
import {
  GlassCardComponent, MoneyComponent, PageHeaderComponent, StatusBadgeComponent,
} from '../../../shared/ui';
import { SumStripComponent, SumStripItem } from '../../products/components/sum-strip.component';
import { PurchaseService } from '../services/purchase.service';
import { PurchaseError } from '../services/purchase.utils';

@Component({
  selector: 'app-purchase-detail',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DatePipe, CurrencyTrPipe, ButtonModule, DialogModule, InputTextModule, ToastModule,
    PageHeaderComponent, GlassCardComponent, StatusBadgeComponent, MoneyComponent, SumStripComponent,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p-toast />
    <ui-page-header backLink="/purchases" [backLabel]="t().common.back" [title]="t().purchases.detailTitle"
      [subtitle]="purchase() ? purchase()!.supplierName + ' · ' + (purchase()!.documentNo || '-') : ''" icon="pi-file" iconTone="info">
      @if (purchase()?.status === 'active') {
        <p-button [label]="t().purchases.cancel" icon="pi pi-times" severity="danger" [outlined]="true" (onClick)="cancelOpen.set(true)" />
      }
    </ui-page-header>

    <div class="page-body">
      @if (!purchase()) {
        <div class="h-56 animate-pulse rounded-token-xl bg-surface-muted" aria-hidden="true"></div>
      } @else {
        @let p = purchase()!;
        @if (p.status === 'cancelled') {
          <div class="flex flex-wrap items-center gap-3 rounded-token-lg border border-danger-line bg-danger-soft p-3" role="status">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-token-md bg-danger text-fg-inverse" aria-hidden="true">
              <i class="pi pi-times-circle"></i>
            </span>
            <div class="min-w-0 flex-1">
              <p class="m-0 text-sm font-semibold text-danger-text">{{ t().purchases.statusCancelled }}</p>
              <p class="num m-0 text-xs text-fg-secondary">{{ p.cancelledAt?.toDate() | date: 'dd.MM.yyyy HH:mm' }}{{ p.cancelReason ? ' · ' + p.cancelReason : '' }}</p>
            </div>
          </div>
        }
        <app-sum-strip [items]="summary(p)" [ariaLabel]="t().purchases.detailTitle" />
        <div class="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-4">
          <ui-glass-card class="lg:order-2" [title]="p.docType === 'invoice' ? t().purchases.docInvoice : t().purchases.docWaybill" icon="pi-file" tone="info">
            <dl class="m-0 flex flex-col text-sm">
              <div class="flex justify-between gap-3 py-1.5"><dt class="text-fg-muted">{{ t().purchases.supplier }}</dt>
                <dd class="m-0 text-right font-semibold"><a [routerLink]="['/suppliers', p.supplierId]" class="text-brand-text no-underline">{{ p.supplierName }}</a></dd></div>
              <div class="flex justify-between gap-3 py-1.5"><dt class="text-fg-muted">{{ t().purchases.docNo }}</dt><dd class="m-0 font-mono">{{ p.documentNo || '-' }}</dd></div>
              <div class="flex justify-between gap-3 py-1.5"><dt class="text-fg-muted">{{ t().purchases.documentDate }}</dt><dd class="num m-0">{{ p.documentDate.toDate() | date: 'dd.MM.yyyy' }}</dd></div>
              <div class="flex justify-between gap-3 py-1.5"><dt class="text-fg-muted">{{ t().purchases.payment }}</dt>
                <dd class="m-0">
                  @if (p.paymentType === 'credit') {
                    <ui-status-badge tone="warning" size="sm">{{ t().purchases.paymentCredit }}</ui-status-badge>
                  } @else {
                    <ui-status-badge tone="success" size="sm">{{ t().purchases.paymentCash }} · {{ methodLabel(p.paymentMethod) }}</ui-status-badge>
                  }
                </dd></div>
              @if (p.dueDate) {
                <div class="flex justify-between gap-3 py-1.5"><dt class="text-fg-muted">{{ t().purchases.dueDate }}</dt><dd class="num m-0">{{ p.dueDate.toDate() | date: 'dd.MM.yyyy' }}</dd></div>
              }
              <div class="flex justify-between gap-3 py-1.5"><dt class="text-fg-muted">{{ t().purchases.status }}</dt>
                <dd class="m-0">
                  @if (p.status === 'cancelled') {
                    <ui-status-badge tone="danger" size="sm">{{ t().purchases.statusCancelled }}</ui-status-badge>
                  } @else {
                    <ui-status-badge tone="success" size="sm" dot>{{ t().purchases.statusActive }}</ui-status-badge>
                  }
                </dd></div>
              @if (p.status === 'cancelled') {
                <div class="flex justify-between gap-3 py-1.5"><dt class="text-fg-muted">{{ t().purchases.cancelledAt }}</dt>
                  <dd class="num m-0">{{ p.cancelledAt?.toDate() | date: 'dd.MM.yyyy HH:mm' }}</dd></div>
                @if (p.cancelReason) {
                  <div class="flex justify-between gap-3 py-1.5"><dt class="text-fg-muted">{{ t().purchases.cancelReason }}</dt><dd class="m-0">{{ p.cancelReason }}</dd></div>
                }
              }
              @if (p.updatedPurchasePrice) {
                <div class="py-1.5 text-xs text-fg-muted"><i class="pi pi-check mr-1 text-xs" aria-hidden="true"></i>{{ t().purchases.purchasePriceUpdated }}</div>
              }
              @if (p.notes) {
                <div class="border-t border-line py-1.5 text-fg-secondary">{{ p.notes }}</div>
              }
            </dl>
          </ui-glass-card>

          <ui-glass-card class="lg:order-1" padding="none" clip [title]="t().purchases.items" icon="pi-box" tone="success" [subtitle]="inv().stockAdded">
            <div class="overflow-x-auto">
              <table class="w-full border-collapse text-sm">
                <thead>
                  <tr class="h-10 border-b border-line bg-surface-muted text-left text-12.5 uppercase tracking-wide text-fg-muted">
                    <th class="px-4 font-bold">{{ t().purchases.product }}</th>
                    <th class="px-3 text-right font-bold">{{ t().purchases.quantity }}</th>
                    <th class="px-3 text-right font-bold">{{ t().purchases.unitCost }}</th>
                    <th class="px-3 text-right font-bold">{{ t().purchases.vat }}</th>
                    <th class="px-4 text-right font-bold">{{ t().purchases.lineTotal }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (it of p.items; track $index) {
                    <tr class="list-row border-b border-line align-top">
                      <td class="px-4 py-3">
                        <a [routerLink]="['/products', it.productId]" class="font-semibold text-fg no-underline">{{ it.productName }}</a>
                        @if (it.expiryDate) { <span class="block text-xs text-fg-muted">{{ t().purchases.expiry }}: {{ it.expiryDate.toDate() | date: 'dd.MM.yyyy' }}</span> }
                        @if (it.gtsNumbers.length) { <span class="block break-all font-mono text-11 text-fg-muted">{{ it.gtsNumbers.join(', ') }}</span> }
                      </td>
                      <td class="num whitespace-nowrap px-3 py-3 text-right font-bold text-success-text">+{{ it.quantity }} <span class="font-sans text-xs font-medium text-fg-muted">{{ it.unit }}</span></td>
                      <td class="num whitespace-nowrap px-3 py-3 text-right text-fg-secondary">{{ it.unitCost | currencyTr }}</td>
                      <td class="num px-3 py-3 text-right text-fg-secondary">%{{ it.vatRate }}</td>
                      <td class="num whitespace-nowrap px-4 py-3 text-right font-extrabold text-fg">{{ it.lineSubtotal + it.lineVat | currencyTr }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <dl class="m-0 ml-auto flex max-w-xs flex-col gap-1.5 border-t border-line p-4 text-sm">
              <div class="flex justify-between"><dt class="text-fg-secondary">{{ t().purchases.subtotal }}</dt><dd class="num m-0">{{ p.subtotal | currencyTr }}</dd></div>
              @if (p.discount > 0) {
                <div class="flex justify-between"><dt class="text-fg-secondary">{{ t().purchases.discount }}</dt><dd class="num m-0">-{{ p.discount | currencyTr }}</dd></div>
              }
              <div class="flex justify-between"><dt class="text-fg-secondary">{{ t().purchases.vatTotal }}</dt><dd class="num m-0">{{ p.vatTotal | currencyTr }}</dd></div>
              <div class="flex items-baseline justify-between border-t border-line pt-2"><dt class="font-bold text-fg">{{ t().purchases.grandTotal }}</dt><dd class="m-0"><ui-money class="num-xl text-22 text-fg" [value]="p.grandTotal" /></dd></div>
            </dl>
          </ui-glass-card>
        </div>
      }
    </div>

    <p-dialog [visible]="cancelOpen()" (visibleChange)="cancelOpen.set($event)" [header]="t().purchases.cancel" [modal]="true"
      [draggable]="false" appendTo="body" styleClass="w-[440px] max-w-[95vw]">
      <p class="mt-0 text-sm text-fg-secondary">{{ t().purchases.cancelConfirm }}</p>
      <label for="pd-reason" class="mb-1.5 block text-sm font-semibold text-fg-secondary">{{ t().purchases.cancelReason }}</label>
      <input pInputText id="pd-reason" class="w-full" [placeholder]="t().purchases.cancelReasonPlaceholder"
        [ngModel]="reason()" (ngModelChange)="reason.set($event)" />
      <ng-template pTemplate="footer">
        <p-button [label]="t().common.close" severity="secondary" (onClick)="cancelOpen.set(false)" />
        <p-button [label]="t().purchases.cancel" icon="pi pi-times" severity="danger" [loading]="cancelling()" (onClick)="doCancel()" />
      </ng-template>
    </p-dialog>
  `,
})
export class PurchaseDetailPage {
  private readonly svc = inject(PurchaseService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(MessageService);
  readonly t = inject(LangService).t;
  readonly inv = computed(() => this.t().inventory);
  private readonly currency = new CurrencyTrPipe();

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly purchase = toSignal(this.svc.getById$(this.id).pipe(catchError(() => {
    this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().purchases.loadFailed });
    return of(null as Purchase | null);
  })), { initialValue: null as Purchase | null });

  readonly cancelOpen = signal(false);
  readonly cancelling = signal(false);
  readonly reason = signal('');

  /** C özet şeridi: genel toplam, kalem, KDV, ödeme */
  summary(p: Purchase): SumStripItem[] {
    const tp = this.t().purchases;
    const credit = p.paymentType === 'credit';
    return [
      { icon: 'pi-wallet', tone: 'info', label: tp.grandTotal, value: this.currency.transform(p.grandTotal) },
      { icon: 'pi-box', tone: 'success', label: tp.items, value: `${p.items.length} ${this.inv().lineCount}` },
      { icon: 'pi-percentage', tone: 'neutral', label: tp.vatTotal, value: this.currency.transform(p.vatTotal) },
      { icon: credit ? 'pi-book' : 'pi-check-circle', tone: credit ? 'warning' : 'success', label: tp.payment,
        value: credit ? tp.paymentCredit : `${tp.paymentCash} · ${this.methodLabel(p.paymentMethod)}` },
    ];
  }

  methodLabel(m: string | null): string {
    const tp = this.t().purchases;
    return m === 'card' ? tp.card : m === 'transfer' ? tp.transfer : tp.cash;
  }

  async doCancel(): Promise<void> {
    const p = this.purchase();
    if (!p) return;
    const tp = this.t().purchases;
    const docLabel = p.documentNo || '-';
    this.cancelling.set(true);
    try {
      const r = await this.svc.cancel(p.id, this.reason(), `${tp.stockCancelReason}: ${docLabel}`, tp.ledgerCancel.replace('{doc}', docLabel));
      this.cancelOpen.set(false);
      this.toast.add({ severity: 'success', summary: '', detail: tp.cancelled, life: 2500 });
      if (r.shortfall > 0) {
        this.toast.add({ severity: 'warn', summary: '', detail: tp.cancelShortfall.replace('{n}', String(r.shortfall)), life: 6000 });
      }
    } catch (err) {
      const detail = err instanceof PurchaseError
        ? (err.code === 'offline' ? tp.errOffline : err.code === 'already-cancelled' ? tp.alreadyCancelled : tp.cancelFailed)
        : tp.cancelFailed;
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail });
    } finally {
      this.cancelling.set(false);
    }
  }
}
