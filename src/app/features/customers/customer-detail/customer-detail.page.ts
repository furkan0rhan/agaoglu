import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LoggerService } from '../../../core/logging/logger.service';
import { CustomerService, CustomerHasBalanceError } from '../services/customer.service';
import { ConsentRecord, Customer } from '../../../shared/models/customer.model';
import { CreditTransaction } from '../../../shared/models/credit.model';
import { LangService } from '../../../core/i18n/lang.service';
import {
  EmptyStateComponent, GlassCardComponent, IconButtonComponent, PageHeaderComponent, StatusBadgeComponent,
} from '../../../shared/ui';
import { InstallmentScheduleComponent } from '../../credit/components/installment-schedule.component';
import { CustomerAccountHeaderComponent } from '../../credit/components/customer-account-header.component';
import { CreditTimelineComponent } from '../../credit/components/credit-timeline.component';
import { CreditService } from '../../credit/services/credit.service';
import { buildSchedule, creditStatus } from '../../credit/services/credit.utils';
import { CartStore } from '../../pos/store/cart.store';
import { maskTcNo } from '../services/customer.utils';
import { FarmerCustomerPanelComponent } from '../../farmer/dealer/farmer-customer-panel.component';

interface InfoRow { icon: string; label: string; value: string; href?: string; tc?: boolean }

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [
    RouterLink, ButtonModule, ToastModule, ConfirmDialogModule,
    PageHeaderComponent, GlassCardComponent, EmptyStateComponent, IconButtonComponent, StatusBadgeComponent,
    InstallmentScheduleComponent, CustomerAccountHeaderComponent, CreditTimelineComponent, FarmerCustomerPanelComponent,
  ],
  providers: [MessageService, ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p-toast position="top-right" />
    <p-confirmDialog />

    <ui-page-header backLink="/customers" [backLabel]="t().common.back"
      [title]="customer() ? customer()!.firstName + ' ' + customer()!.lastName : t().customers.customerInfo"
      [subtitle]="customer()?.village || t().customers.customerInfo">
      @if (customer(); as c) {
        @if (c.isActive) {
          <ui-icon-button icon="pi-pencil" variant="outline" [ariaLabel]="t().common.edit" (click)="edit()" />
          <ui-icon-button icon="pi-trash" tone="danger" variant="outline" [ariaLabel]="t().customers.deleteTitle"
            (click)="confirmDelete(c)" />
        } @else if (!c.anonymizedAt) {
          <p-button icon="pi pi-replay" [label]="t().customers.restore" severity="secondary"
            [loading]="busy()" (onClick)="restore()" />
        }
      }
    </ui-page-header>

    <div class="page-body">
      @if (customer(); as c) {
        <app-customer-account-header [customer]="c" [schedule]="schedule()" [transactions]="transactions()">
          @if (c.isActive) {
            <p-button [label]="t().acc.sale" icon="pi pi-shopping-cart" severity="warn" styleClass="w-full" (onClick)="newSale(c)" />
          }
          @if (c.isActive && c.balance > 0) {
            <p-button [label]="t().acc.collect" icon="pi pi-wallet" styleClass="w-full"
              [routerLink]="['/credit', customerId]" [queryParams]="{ collect: 'cash' }" />
          }
        </app-customer-account-header>

        <div class="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-4">
          <app-installment-schedule [schedule]="schedule()" [status]="status()" [note]="c.notes" />
          <app-credit-timeline [transactions]="transactions()" [loading]="txLoading()" [limit]="6"
            [moreLink]="['/credit', customerId]" />
        </div>

        <div class="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-4">
          <div class="flex min-w-0 flex-col gap-3 lg:gap-4">
            <!-- Müşteri bilgileri -->
            <ui-glass-card [title]="t().customers.customerInfo" icon="pi-id-card" padding="none" clip>
              @if (c.anonymizedAt) {
                <ui-status-badge card-actions tone="neutral" size="sm">{{ t().customers.anonymizedBadge }}</ui-status-badge>
              } @else if (!c.isActive) {
                <ui-status-badge card-actions tone="neutral" size="sm">{{ t().customers.archivedBadge }}</ui-status-badge>
              }
              <dl class="m-0 grid grid-cols-1 sm:grid-cols-2">
                @for (row of infoRows(c); track row.label) {
                  <div class="-mb-px flex min-h-[60px] items-center gap-3 border-b border-line px-4 py-2.5 sm:odd:border-r">
                    <span class="grid h-9 w-9 shrink-0 place-items-center rounded-token-md bg-surface-muted text-fg-secondary" aria-hidden="true">
                      <i class="pi text-sm" [class]="row.icon"></i>
                    </span>
                    <div class="min-w-0 flex-1">
                      <dt class="text-12 text-fg-muted">{{ row.label }}</dt>
                      <dd class="m-0 break-words text-14 font-medium text-fg">
                        @if (row.href) {
                          <a [href]="row.href" class="text-brand-text no-underline hover:underline">{{ row.value }}</a>
                        } @else {
                          <span [class.num]="row.tc">{{ row.value }}</span>
                        }
                      </dd>
                    </div>
                    @if (row.tc && isAdmin && c.tcNo) {
                      <p-button [label]="tcVisible() ? t().customers.hideTc : t().customers.showTc" size="small" [text]="true"
                        [icon]="tcVisible() ? 'pi pi-eye-slash' : 'pi pi-eye'" (onClick)="tcVisible.set(!tcVisible())" />
                    }
                  </div>
                }
              </dl>
            </ui-glass-card>

            <!-- KVKK -->
            <ui-glass-card [title]="t().customers.privacy" icon="pi-shield" tone="info">
              <a card-actions routerLink="/customers/kvkk"
                class="inline-flex min-h-[40px] items-center gap-1 px-1 text-13.5 font-semibold text-brand-text no-underline hover:underline">
                {{ t().customers.kvkkTitle }}<i class="pi pi-chevron-right text-10" aria-hidden="true"></i>
              </a>
              <ul class="m-0 flex list-none flex-col gap-2.5 p-0 text-sm">
                <li class="flex items-start gap-2.5">
                  <i class="pi mt-0.5 text-sm" [class]="c.consents?.processing ? 'pi-check-circle text-success-text' : 'pi-minus-circle text-fg-muted'" aria-hidden="true"></i>
                  <span class="text-fg-secondary">{{ t().customers.consentProcessing }}
                    <span class="num block text-xs text-fg-muted">{{ consentText(c.consents?.processing) }}</span></span>
                </li>
                <li class="flex items-start gap-2.5">
                  <i class="pi mt-0.5 text-sm" [class]="c.consents?.contact ? 'pi-check-circle text-success-text' : 'pi-minus-circle text-fg-muted'" aria-hidden="true"></i>
                  <span class="text-fg-secondary">{{ t().customers.consentContact }}
                    <span class="num block text-xs text-fg-muted">{{ consentText(c.consents?.contact) }}</span></span>
                </li>
              </ul>
              @if (isAdmin) {
                <div class="mt-4 flex flex-col gap-2 border-t border-line pt-3">
                  <p class="eyebrow m-0 text-fg-muted">{{ t().customers.exportData }}</p>
                  <div class="flex flex-wrap gap-2 [&>*]:flex-1">
                    <p-button [label]="t().customers.exportJson" icon="pi pi-download" size="small" severity="secondary"
                      styleClass="w-full" [loading]="exporting() === 'json'" (onClick)="exportData('json')" />
                    <p-button [label]="t().customers.exportExcel" icon="pi pi-file-excel" size="small" severity="secondary"
                      styleClass="w-full" [loading]="exporting() === 'xlsx'" (onClick)="exportData('xlsx')" />
                    @if (!c.anonymizedAt) {
                      <p-button [label]="t().customers.anonymize" icon="pi pi-user-minus" size="small" severity="danger"
                        [outlined]="true" styleClass="w-full" [loading]="busy()" (onClick)="confirmAnonymize(c)" />
                    }
                  </div>
                </div>
              }
            </ui-glass-card>
          </div>

          <!-- Çiftçi uygulaması paneli -->
          @if (c.isActive) { <app-farmer-customer-panel class="block min-w-0" [customer]="c" /> }
        </div>
      } @else if (loadFailed()) {
        <ui-empty-state icon="pi-exclamation-triangle" tone="danger" [title]="t().customers.loadError">
          <p-button [label]="t().common.back" icon="pi pi-arrow-left" severity="secondary" routerLink="/customers" />
        </ui-empty-state>
      } @else {
        <div class="h-48 animate-pulse rounded-token-xl bg-surface-muted" aria-hidden="true"></div>
        <div class="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4" aria-hidden="true">
          <div class="h-64 animate-pulse rounded-token-xl bg-surface-muted"></div>
          <div class="h-64 animate-pulse rounded-token-xl bg-surface-muted"></div>
        </div>
        <span class="sr-only" role="status">{{ t().common.loading }}</span>
      }
    </div>
  `,
})
export class CustomerDetailPage implements OnInit {
  private readonly svc = inject(CustomerService);
  private readonly creditSvc = inject(CreditService);
  private readonly cart = inject(CartStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly logger = inject(LoggerService);
  private readonly datePipe = new DatePipe('tr');
  readonly t = inject(LangService).t;
  readonly isAdmin = inject(AuthService).hasRole('admin');

  readonly customer = signal<Customer | null>(null);
  readonly transactions = signal<CreditTransaction[]>([]);
  readonly busy = signal(false);
  readonly loadFailed = signal(false);
  readonly txLoading = signal(true);
  readonly tcVisible = signal(false);
  readonly exporting = signal<'json' | 'xlsx' | null>(null);
  customerId = '';

  readonly schedule = computed(() => buildSchedule(this.transactions(), this.customer()?.balance ?? 0));
  readonly status = computed(() => creditStatus(this.schedule()));

  ngOnInit(): void {
    this.customerId = this.route.snapshot.paramMap.get('id') ?? '';
    this.svc.watch$(this.customerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: c => { this.customer.set(c); if (!c) this.loadFailed.set(true); },
        error: () => {
          this.loadFailed.set(true);
          this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().customers.loadError });
        },
      });
    this.creditSvc.getByCustomer$(this.customerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: txs => { this.transactions.set(txs); this.txLoading.set(false); },
        error: () => { this.transactions.set([]); this.txLoading.set(false); },
      });
  }

  newSale(c: Customer): void {
    this.cart.setCustomer(c.id, `${c.firstName} ${c.lastName}`);
    void this.router.navigate(['/pos']);
  }

  consentText(r: ConsentRecord | null | undefined): string {
    if (!r) return this.t().customers.consentNone;
    const at = (r.at as { toDate?: () => Date } | null)?.toDate?.();
    return `${this.t().customers.consentGivenAt}: ${at ? this.datePipe.transform(at, 'dd.MM.yyyy') : '…'} · ${r.version}`;
  }

  async exportData(kind: 'json' | 'xlsx'): Promise<void> {
    const c = this.customer();
    if (!c || this.exporting()) return;
    this.exporting.set(kind);
    try {
      const [data, exp] = await Promise.all([this.svc.collectData(c), import('../services/customer-export')]);
      const file = `musteri-verisi-${c.id.slice(-6)}-${new Date().toISOString().slice(0, 10)}`;
      if (kind === 'json') exp.downloadJson(data, file);
      else {
        const cu = this.t().customers;
        await exp.downloadExcel(data, file, { customer: cu.sheetCustomer, transactions: cu.sheetTransactions, sales: cu.sheetSales });
      }
    } catch (err) {
      this.logger.error('customer export failed', err);
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().customers.exportFailed });
    } finally {
      this.exporting.set(null);
    }
  }

  confirmAnonymize(c: Customer): void {
    if (Math.abs(c.balance ?? 0) > 0.004) {
      this.toast.add({ severity: 'warn', summary: '', detail: this.t().customers.anonymizeHasBalance, life: 4000 });
      return;
    }
    this.confirm.confirm({
      header: this.t().customers.anonymize,
      message: this.t().customers.anonymizeConfirm,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.t().customers.anonymize,
      rejectLabel: this.t().common.cancel,
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.doAnonymize(c),
    });
  }

  private async doAnonymize(c: Customer): Promise<void> {
    this.busy.set(true);
    try {
      await this.svc.anonymize(c);
      this.tcVisible.set(false);
      this.toast.add({ severity: 'success', summary: '', detail: this.t().customers.anonymized, life: 3000 });
    } catch (err) {
      const cu = this.t().customers;
      const detail = err instanceof CustomerHasBalanceError ? cu.anonymizeHasBalance
        : (err as Error)?.message === 'OFFLINE' ? cu.anonymizeOffline : cu.anonymizeFailed;
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail });
    } finally {
      this.busy.set(false);
    }
  }

  confirmDelete(c: Customer): void {
    if ((c.balance ?? 0) > 0) {
      this.toast.add({ severity: 'warn', summary: '', detail: this.t().customers.deleteHasBalance, life: 4000 });
      return;
    }
    this.confirm.confirm({
      header: this.t().customers.deleteTitle,
      message: this.t().customers.deleteConfirm,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.t().common.delete,
      rejectLabel: this.t().common.cancel,
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.doDelete(c),
    });
  }

  private async doDelete(c: Customer): Promise<void> {
    this.busy.set(true);
    try {
      await this.svc.delete(c);
      this.toast.add({ severity: 'success', summary: '', detail: this.t().customers.deleted, life: 2500 });
      await this.router.navigate(['/customers']);
    } catch (err) {
      const detail = err instanceof CustomerHasBalanceError ? this.t().customers.deleteHasBalance : this.t().customers.deleteFailed;
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail });
    } finally {
      this.busy.set(false);
    }
  }

  edit(): void {
    void this.router.navigate(['/customers', this.customerId, 'edit']);
  }

  async restore(): Promise<void> {
    this.busy.set(true);
    try {
      await this.svc.restore(this.customerId);
      this.toast.add({ severity: 'success', summary: '', detail: this.t().customers.restored, life: 2500 });
    } catch {
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().customers.saveFailed });
    } finally {
      this.busy.set(false);
    }
  }

  infoRows(c: Customer): InfoRow[] {
    const cu = this.t().customers;
    const rows: InfoRow[] = [
      { icon: 'pi-phone', label: cu.phone.replace(' *', ''), value: c.phone || '-', href: c.phone ? `tel:${c.phone.replace(/\s+/g, '')}` : undefined },
      { icon: 'pi-envelope', label: cu.email, value: c.email || '-', href: c.email ? `mailto:${c.email}` : undefined },
      // TC no her zaman maskeli; yalnızca yönetici "Göster" ile açar
      { icon: 'pi-id-card', label: cu.tcNo, value: (this.isAdmin && this.tcVisible() ? c.tcNo : maskTcNo(c.tcNo)) || '-', tc: true },
      { icon: 'pi-map', label: cu.village, value: c.village || '-' },
      { icon: 'pi-map-marker', label: cu.address, value: c.address || '-' },
    ];
    if (c.cksNo) rows.push({ icon: 'pi-verified', label: cu.cksNo, value: c.cksNo });
    return rows;
  }
}
