import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, map, of, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { LoggerService } from '../../../core/logging/logger.service';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { Sale, SaleItem } from '../../../shared/models/sale.model';
import {
  EmptyStateComponent, GlassCardComponent, MoneyComponent, PageHeaderComponent, StatusBadgeComponent,
} from '../../../shared/ui';
import { SaleService, SaleAlreadyCancelledError } from '../../pos/services/sale.service';
import { SalesQueryService } from '../services/sales-query.service';
import {
  formatDateTime, methodIcon, methodLabel, methodTone, qtyWithUnit, statusLabel, statusTone, StatusTone,
} from '../services/sales.helpers';
import { ReceiptPrinterService } from '../receipt/receipt-printer.service';
import { saleToReceipt } from '../receipt/receipt.utils';

type LoadState = { status: 'loading' } | { status: 'ready'; sale: Sale | null } | { status: 'error' };

@Component({
  selector: 'app-sale-detail',
  standalone: true,
  imports: [
    RouterLink, FormsModule, CurrencyTrPipe, ButtonModule, DialogModule, InputTextModule, ToastModule,
    PageHeaderComponent, GlassCardComponent, EmptyStateComponent, StatusBadgeComponent, MoneyComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p-toast position="top-right" />

    <!-- İptal onayı -->
    <p-dialog [header]="t().sales.cancelConfirmTitle" [(visible)]="showCancel" [modal]="true" [draggable]="false"
      appendTo="body" styleClass="w-[400px] max-w-[calc(100vw-2rem)]">
      <div class="flex flex-col gap-3">
        <div class="flex gap-3 rounded-token-lg border border-danger-line bg-danger-soft px-3 py-2.5 text-sm text-danger-text">
          <i class="pi pi-exclamation-triangle mt-0.5" aria-hidden="true"></i>
          <p class="m-0">{{ t().sales.cancelConfirmDesc }}</p>
        </div>
        <label class="text-sm font-semibold text-fg-secondary" for="cancel-reason">{{ t().sales.cancelReason }}</label>
        <input pInputText id="cancel-reason" class="h-11 w-full text-sm" [ngModel]="cancelReason()" (ngModelChange)="cancelReason.set($event)" maxlength="200" />
      </div>
      <ng-template #footer>
        <div class="flex w-full justify-end gap-2">
          <p-button [label]="t().common.close" severity="secondary" (onClick)="showCancel.set(false)" [disabled]="cancelling()" />
          <p-button [label]="t().sales.cancelSale" icon="pi pi-undo" severity="danger"
            (onClick)="confirmCancel()" [loading]="cancelling()" [disabled]="cancelling()" />
        </div>
      </ng-template>
    </p-dialog>

    <ui-page-header [title]="t().sales.detail" [subtitle]="sale()?.saleNumber ?? ''" icon="pi-receipt" iconTone="accent"
      backLink="/sales" [backLabel]="t().common.back">
      @if (sale(); as s) {
        @if (s.status === 'completed') {
          <p-button [label]="t().sales.cancelSale" icon="pi pi-undo" severity="danger" [outlined]="true"
            (onClick)="openCancel()" [disabled]="cancelling()" />
        }
        <p-button [label]="t().sales.printReceipt" icon="pi pi-print" (onClick)="print(s)" />
      }
    </ui-page-header>

    <div class="page-body">
      @switch (state().status) {
        @case ('loading') {
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-hidden="true">
            <div class="h-64 animate-pulse rounded-token-xl bg-surface-muted lg:col-span-2"></div>
            <div class="h-64 animate-pulse rounded-token-xl bg-surface-muted"></div>
          </div>
        }
        @case ('error') {
          <ui-glass-card>
            <ui-empty-state icon="pi-exclamation-triangle" tone="danger" [title]="t().sales.loadError" />
          </ui-glass-card>
        }
        @default {
          @if (sale(); as s) {
            @if (s.status !== 'completed') {
              <div class="flex items-center gap-3 rounded-token-lg border border-danger-line bg-danger-soft px-4 py-3" role="status">
                <span class="grid h-10 w-10 shrink-0 place-items-center rounded-token-md bg-danger text-fg-inverse" aria-hidden="true">
                  <i class="pi pi-undo"></i>
                </span>
                <div class="min-w-0 text-sm">
                  <p class="m-0 font-semibold text-danger-text">{{ statusText() }} · <span class="num">{{ fmt(s.cancelledAt) }}</span></p>
                  @if (s.cancelReason) { <p class="m-0 mt-0.5 text-fg-secondary">{{ s.cancelReason }}</p> }
                </div>
              </div>
            }

            <div class="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-4">
              <!-- Kalemler -->
              <ui-glass-card [title]="t().sales.products" icon="pi-box" tone="accent"
                [subtitle]="s.items.length + ' ' + t().sales.items" padding="none" clip>
                <ul class="m-0 flex list-none flex-col p-0">
                  @for (i of s.items; track $index) {
                    <li class="flex min-h-[56px] items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
                      <div class="min-w-0 flex-1">
                        <p class="m-0 truncate text-14.5 font-semibold text-fg">{{ i.productName }}</p>
                        <p class="num m-0 mt-0.5 text-xs text-fg-muted">
                          {{ qty(i) }} × {{ i.unitPrice | currencyTr }}
                          @if (i.discount > 0) {
                            · <span class="text-success-text">{{ t().pos.discount }} {{ i.discountType === 'percent' ? '%' + i.discount : (i.discount | currencyTr) }}</span>
                          }
                        </p>
                        @if (i.requiresPrescription || i.licenseNo) {
                          <p class="m-0 mt-1 flex flex-wrap items-center gap-1.5 text-xs text-fg-secondary">
                            @if (i.requiresPrescription) {
                              <ui-status-badge tone="warning" size="sm" icon="pi-file-check">{{ t().compliance.rxBadge }}</ui-status-badge>
                            }
                            @if (i.licenseNo) { <span>{{ t().compliance.licenseNo }}: <span class="num">{{ i.licenseNo }}</span></span> }
                          </p>
                        }
                        @if (i.gtsNos?.length) {
                          <ul class="m-0 mt-1 flex list-none flex-wrap gap-1 p-0" [attr.aria-label]="t().compliance.gtsList">
                            @for (g of i.gtsNos; track g) {
                              <li class="rounded-token-sm bg-info-soft px-1.5 py-0.5 font-mono text-11 text-info-text">{{ g }}</li>
                            }
                          </ul>
                        }
                      </div>
                      <ui-money class="num text-15 font-extrabold text-fg" [value]="i.totalPrice" />
                    </li>
                  }
                </ul>
              </ui-glass-card>

              <div class="flex flex-col gap-3 lg:gap-4">
                <!-- Bilgiler -->
                <ui-glass-card [title]="t().sales.detail" icon="pi-info-circle" tone="neutral">
                  <dl class="m-0 grid grid-cols-2 gap-x-4 gap-y-3 text-sm lg:grid-cols-1">
                    <div class="col-span-2 lg:col-span-1">
                      <dt class="text-xs text-fg-muted">{{ t().sales.saleNo }}</dt>
                      <dd class="num m-0 break-all font-semibold text-fg">{{ s.saleNumber }}</dd>
                    </div>
                    <div>
                      <dt class="text-xs text-fg-muted">{{ t().sales.status }}</dt>
                      <dd class="m-0 mt-0.5"><ui-status-badge [tone]="tone()" dot>{{ statusText() }}</ui-status-badge></dd>
                    </div>
                    <div>
                      <dt class="text-xs text-fg-muted">{{ t().sales.date }}</dt>
                      <dd class="num m-0 font-semibold text-fg">{{ fmt(s.createdAt) }}</dd>
                    </div>
                    <div>
                      <dt class="text-xs text-fg-muted">{{ t().sales.customer }}</dt>
                      <dd class="m-0 font-semibold">
                        @if (s.customerId) {
                          <a [routerLink]="['/customers', s.customerId]" class="text-brand-text no-underline hover:underline">{{ s.customerName }}</a>
                        } @else {
                          <span class="text-fg">{{ t().sales.walkIn }}</span>
                        }
                      </dd>
                    </div>
                    <div>
                      <dt class="text-xs text-fg-muted">{{ t().sales.paymentMethod }}</dt>
                      <dd class="m-0 mt-0.5"><ui-status-badge [tone]="mTone()" [icon]="mIcon()">{{ method() }}</ui-status-badge></dd>
                    </div>
                    @if (s.hasPrescriptionItems || s.prescriptionNo) {
                      <div class="col-span-2 lg:col-span-1">
                        <dt class="text-xs text-fg-muted">{{ t().compliance.rxNo }}</dt>
                        <dd class="num m-0 break-all font-semibold" [class]="s.prescriptionNo ? 'text-fg' : 'text-danger-text'">
                          {{ s.prescriptionNo || t().compliance.rxMissing }}
                        </dd>
                        @if (s.prescriberName) {
                          <dd class="m-0 text-xs text-fg-secondary">{{ t().compliance.rxPrescriber }}: {{ s.prescriberName }}</dd>
                        }
                      </div>
                    }

                  </dl>
                </ui-glass-card>

                <!-- Tutarlar -->
                <ui-glass-card [title]="t().pos.total" icon="pi-wallet" tone="success">
                  <div class="flex flex-col gap-2 text-sm">
                    <div class="flex justify-between gap-3"><span class="text-fg-secondary">{{ t().pos.subtotal }}</span><ui-money class="text-fg" [value]="s.subtotal" /></div>
                    @if (s.totalDiscount > 0) {
                      <div class="flex justify-between gap-3 text-success-text"><span>{{ t().pos.discount }}</span><span class="num">-{{ s.totalDiscount | currencyTr }}</span></div>
                    }
                    <div class="my-1 flex items-baseline justify-between gap-3 border-y border-dashed border-line-strong py-2">
                      <span class="font-display font-bold text-fg">{{ t().pos2.total }}</span>
                      <ui-money class="num-xl text-28" [value]="s.totalAmount"
                        [class]="s.status === 'completed' ? 'text-fg' : 'text-fg-muted line-through'" />
                    </div>
                    @if (s.cashPaid > 0) {
                      <div class="flex justify-between gap-3"><span class="text-fg-secondary">{{ t().sales.cashPaid }}</span><ui-money class="text-fg" [value]="s.cashPaid" /></div>
                    }
                    @if (s.cardPaid > 0) {
                      <div class="flex justify-between gap-3"><span class="text-fg-secondary">{{ t().sales.cardPaid }}</span><ui-money class="text-fg" [value]="s.cardPaid" /></div>
                    }
                    @if (s.creditAmount > 0) {
                      <div class="flex justify-between gap-3"><span class="text-fg-secondary">{{ t().sales.creditAmount }}</span><ui-money class="font-semibold text-accent-text" [value]="s.creditAmount" /></div>
                    }
                    @if (s.totalWithInterest) {
                      <div class="flex justify-between gap-3"><span class="text-fg-secondary">{{ t().pos.totalWithInterest }}</span><ui-money class="text-fg" [value]="s.totalWithInterest" /></div>
                    }
                    @if (s.installmentCount && s.installmentAmount) {
                      <div class="flex justify-between gap-3">
                        <span class="text-fg-secondary">{{ t().pos.installments }}</span>
                        <span class="num text-fg">{{ s.installmentCount }} × {{ s.installmentAmount | currencyTr }}</span>
                      </div>
                    }
                    @if (s.downPayment) {
                      <div class="flex justify-between gap-3"><span class="text-fg-secondary">{{ t().pos2.downPaymentLabel }}</span><ui-money class="text-fg" [value]="s.downPayment" /></div>
                    }
                    @if (dueText(); as due) {
                      <div class="flex justify-between gap-3"><span class="text-fg-secondary">{{ t().pos2.dueLabel }}</span><span class="num font-semibold text-fg">{{ due }}</span></div>
                    }
                    @if (s.change > 0) {
                      <div class="flex justify-between gap-3"><span class="text-fg-secondary">{{ t().sales.change }}</span><ui-money class="font-semibold text-success-text" [value]="s.change" /></div>
                    }
                  </div>
                </ui-glass-card>

              </div>
            </div>
          } @else {
            <ui-glass-card>
              <ui-empty-state icon="pi-receipt" [title]="t().sales.notFound">
                <a routerLink="/sales" class="text-sm font-semibold text-brand no-underline hover:underline">{{ t().common.back }}</a>
              </ui-empty-state>
            </ui-glass-card>
          }
        }
      }
    </div>
  `,
})
export class SaleDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly query = inject(SalesQueryService);
  private readonly saleSvc = inject(SaleService);
  private readonly toast = inject(MessageService);
  private readonly logger = inject(LoggerService);
  private readonly auth = inject(AuthService);
  private readonly printer = inject(ReceiptPrinterService);
  private readonly lang = inject(LangService);
  readonly t = this.lang.t;

  readonly cancelling = signal(false);
  readonly showCancel = signal(false);
  readonly cancelReason = signal('');

  readonly state = toSignal(
    this.route.paramMap.pipe(
      map(p => p.get('id') ?? ''),
      switchMap(id => !id
        ? of<LoadState>({ status: 'ready', sale: null })
        : this.query.getById$(id).pipe(
            map(sale => ({ status: 'ready', sale: sale && sale.tenantId === this.auth.currentTenantId() ? sale : null }) as LoadState),
            catchError(err => {
              this.logger.error('Sale load failed', err);
              return of<LoadState>({ status: 'error' });
            }),
          )),
    ),
    { initialValue: { status: 'loading' } as LoadState },
  );

  readonly sale = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.sale : null;
  });

  readonly statusText = computed(() => { const s = this.sale(); return s ? statusLabel(this.t(), s.status) : ''; });
  readonly tone = computed<StatusTone>(() => { const s = this.sale(); return s ? statusTone(s.status) : 'success'; });
  readonly method = computed(() => { const s = this.sale(); return s ? methodLabel(this.t(), s.paymentMethod) : ''; });
  readonly mTone = computed(() => methodTone(this.sale()?.paymentMethod ?? 'cash'));
  readonly mIcon = computed(() => methodIcon(this.sale()?.paymentMethod ?? 'cash'));
  /** Veresiye vadesi (Timestamp ya da Date). */
  readonly dueText = computed(() => {
    const v = this.sale()?.creditDueDate as { toDate?: () => Date } | Date | null | undefined;
    const d = v instanceof Date ? v : v?.toDate?.();
    return d ? d.toLocaleDateString(this.lang.lang() === 'tr' ? 'tr-TR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  });

  fmt(ts: Sale['createdAt'] | null | undefined): string {
    return formatDateTime(ts, this.lang.lang());
  }

  qty(i: SaleItem): string {
    return qtyWithUnit(this.t(), i.quantity, i.unit, this.lang.lang());
  }

  print(s: Sale): void {
    this.printer.print(saleToReceipt(s)).catch(err => this.logger.error('Receipt print failed', err));
  }

  openCancel(): void {
    this.cancelReason.set('');
    this.showCancel.set(true);
  }

  async confirmCancel(): Promise<void> {
    const s = this.sale();
    if (!s || this.cancelling()) return;
    this.cancelling.set(true);
    try {
      await this.saleSvc.cancelSale(s.id, this.cancelReason().trim() || null);
      this.showCancel.set(false);
      this.toast.add({ severity: 'success', summary: '', detail: this.t().sales.cancelSuccess, life: 3000 });
    } catch (err) {
      this.logger.error('cancelSale failed', err);
      const detail = err instanceof SaleAlreadyCancelledError ? this.t().sales.alreadyCancelled : this.t().sales.cancelFailed;
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail, life: 4000 });
    } finally {
      this.cancelling.set(false);
    }
  }
}
