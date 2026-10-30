import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CustomerService } from '../../customers/services/customer.service';
import { Customer } from '../../../shared/models/customer.model';
import { CreditTransaction } from '../../../shared/models/credit.model';
import { LangService } from '../../../core/i18n/lang.service';
import { CreditService, OverpaymentError, roundKurus } from '../services/credit.service';
import {
  EmptyStateComponent, MoneyComponent, PageHeaderComponent, SegmentedComponent, UiSegmentOption,
} from '../../../shared/ui';
import { CartStore } from '../../pos/store/cart.store';
import { CustomerAccountHeaderComponent } from '../components/customer-account-header.component';
import { CreditTimelineComponent } from '../components/credit-timeline.component';
import { InstallmentScheduleComponent } from '../components/installment-schedule.component';
import { buildSchedule, creditStatus } from '../services/credit.utils';

type PayMethod = 'cash' | 'card';

@Component({
  selector: 'app-credit-detail',
  standalone: true,
  imports: [
    RouterLink, FormsModule, ButtonModule, DialogModule, InputTextModule, ToastModule,
    PageHeaderComponent, EmptyStateComponent, MoneyComponent, SegmentedComponent,
    CustomerAccountHeaderComponent, InstallmentScheduleComponent, CreditTimelineComponent,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p-toast position="top-right" />

    <!-- Tahsilat dialog -->
    <p-dialog
      [header]="a().collect"
      [visible]="showPaymentDialog()"
      (visibleChange)="showPaymentDialog.set($event)"
      [modal]="true"
      [closable]="true"
      [draggable]="false"
      appendTo="body"
      styleClass="w-[400px] max-w-[95vw]"
    >
      <form class="flex flex-col gap-4 py-1" (ngSubmit)="savePayment()" novalidate>
        <div class="rounded-token-lg border border-danger-line bg-danger-soft px-4 py-3">
          <p class="m-0 text-12.5 font-semibold text-danger-text">{{ t().credit.currentDebt }}</p>
          <p class="num-xl m-0 mt-0.5 text-26 text-danger-text"><ui-money [value]="customer()?.balance ?? 0" /></p>
        </div>
        <div class="flex flex-col gap-1.5">
          <span id="pay-method-label" class="text-sm font-semibold text-fg-secondary">{{ a().paymentMethod }}</span>
          <ui-segmented class="w-full" [block]="true" [options]="methodOptions()" [value]="paymentMethod()" (valueChange)="paymentMethod.set($event ?? 'cash')"
            [ariaLabel]="a().paymentMethod" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="pay-amount" class="text-sm font-semibold text-fg-secondary">{{ t().credit.collectionAmount }}</label>
          <input pInputText id="pay-amount" name="amount" type="number" inputmode="decimal" class="num w-full text-lg"
            [(ngModel)]="paymentAmount" placeholder="0,00" min="0.01" step="0.01" [attr.max]="customer()?.balance ?? 0"
            [attr.aria-invalid]="amountError() ? true : null" [attr.aria-describedby]="amountError() ? 'pay-amount-err' : null" />
          @if (amountError(); as err) {
            <p id="pay-amount-err" class="m-0 text-xs font-medium text-danger-text" role="alert">{{ err }}</p>
          }
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="pay-note" class="text-sm font-semibold text-fg-secondary">
            {{ t().credit.note }} <span class="font-normal text-fg-muted">({{ t().common.optional }})</span>
          </label>
          <input pInputText id="pay-note" name="note" class="w-full" [(ngModel)]="paymentNote" [placeholder]="t().credit.notePlaceholder" />
        </div>
      </form>
      <ng-template pTemplate="footer">
        <p-button [label]="t().common.cancel" severity="secondary" (onClick)="showPaymentDialog.set(false)" />
        <p-button
          [label]="t().common.save"
          icon="pi pi-check"
          [loading]="saving()"
          [disabled]="!!amountError() || !paymentAmount"
          (onClick)="savePayment()"
        />
      </ng-template>
    </p-dialog>

    <ui-page-header backLink="/credit" [backLabel]="t().common.back"
      [title]="customer() ? customer()!.firstName + ' ' + customer()!.lastName : t().credit.title"
      [subtitle]="t().credit.title" />

    <div class="page-body">
      @if (customer(); as c) {
        <app-customer-account-header [customer]="c" [schedule]="schedule()" [transactions]="transactions()">
          @if (c.isActive) {
            <p-button [label]="a().sale" icon="pi pi-shopping-cart" severity="warn" styleClass="w-full" (onClick)="newSale(c)" />
          }
          <p-button [label]="a().collect" icon="pi pi-wallet" styleClass="w-full"
            [disabled]="c.balance <= 0" (onClick)="openPayment('cash')" />
          <p-button icon="pi pi-user" [label]="a().customerCard" severity="secondary" styleClass="w-full"
            [routerLink]="['/customers', customerId]" />
        </app-customer-account-header>

        <div class="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-4">
          <app-installment-schedule [schedule]="schedule()" [status]="status()" [note]="c.notes" />
          <app-credit-timeline [transactions]="transactions()" [loading]="txLoading()" />
        </div>
      } @else if (loadFailed()) {
        <ui-empty-state icon="pi-exclamation-triangle" tone="danger" [title]="t().customers.loadError">
          <p-button [label]="t().common.back" icon="pi pi-arrow-left" severity="secondary" routerLink="/credit" />
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
export class CreditDetailPage implements OnInit {
  private readonly customerSvc = inject(CustomerService);
  private readonly creditSvc = inject(CreditService);
  private readonly cart = inject(CartStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lang = inject(LangService);
  readonly t = this.lang.t;
  readonly a = computed(() => this.t().acc);

  readonly customer = signal<Customer | null>(null);
  readonly transactions = signal<CreditTransaction[]>([]);
  readonly saving = signal(false);
  readonly txLoading = signal(true);
  readonly loadFailed = signal(false);
  readonly showPaymentDialog = signal(false);
  /** Tahsilatlar en eski vadeden dağıtılmış taksit takvimi. */
  readonly schedule = computed(() => buildSchedule(this.transactions(), this.customer()?.balance ?? 0));
  readonly status = computed(() => creditStatus(this.schedule()));

  readonly paymentMethod = signal<PayMethod>('cash');
  readonly methodOptions = computed<UiSegmentOption<PayMethod>[]>(() => [
    { value: 'cash', label: this.t().credit.cash, icon: 'pi-wallet' },
    { value: 'card', label: this.t().credit.card, icon: 'pi-credit-card' },
  ]);

  customerId = '';
  paymentAmount = 0;
  paymentNote = '';

  ngOnInit(): void {
    this.customerId = this.route.snapshot.paramMap.get('customerId') ?? this.route.snapshot.paramMap.get('id') ?? '';
    // Müşteri sayfasındaki "Tahsilat Al" kısayolu: ?collect=cash|card → ilk yüklemede dialog açılır.
    const collect = this.route.snapshot.queryParamMap.get('collect');
    let autoOpen: PayMethod | null = collect === 'cash' || collect === 'card' ? collect : null;
    this.customerSvc.watch$(this.customerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: c => {
          this.customer.set(c);
          if (!c) this.loadFailed.set(true);
          if (c && autoOpen) {
            const method = autoOpen;
            autoOpen = null;
            if (roundKurus(c.balance ?? 0) > 0) this.openPayment(method);
          }
        },
        error: () => { this.customer.set(null); this.loadFailed.set(true); },
      });
    this.creditSvc.getByCustomer$(this.customerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: txs => { this.transactions.set(txs); this.txLoading.set(false); },
        error: () => { this.transactions.set([]); this.txLoading.set(false); },
      });
  }

  /** Tutar alanı doğrulama mesajı (yoksa boş). */
  amountError(): string {
    if (this.paymentAmount === null || this.paymentAmount === undefined) return '';
    if (!(Number(this.paymentAmount) > 0)) return this.t().credit.amountPositive;
    if (this.isOverpayment()) return this.t().credit.overpayment;
    return '';
  }

  isOverpayment(): boolean {
    return roundKurus(this.paymentAmount || 0) > roundKurus(this.customer()?.balance ?? 0);
  }

  newSale(c: Customer): void {
    this.cart.setCustomer(c.id, `${c.firstName} ${c.lastName}`);
    void this.router.navigate(['/pos']);
  }

  openPayment(method: PayMethod): void {
    const balance = roundKurus(this.customer()?.balance ?? 0);
    if (balance <= 0) {
      this.toast.add({ severity: 'info', summary: '', detail: this.t().credit.noDebtToCollect, life: 3000 });
      return;
    }
    this.paymentMethod.set(method);
    this.paymentAmount = balance;
    this.paymentNote = '';
    this.showPaymentDialog.set(true);
  }

  async savePayment(): Promise<void> {
    const c = this.customer();
    const amount = roundKurus(this.paymentAmount || 0);
    if (!c || amount <= 0 || this.saving()) return;
    if (this.isOverpayment()) {
      this.toast.add({ severity: 'warn', summary: '', detail: this.t().credit.overpayment, life: 3000 });
      return;
    }
    const method = this.paymentMethod();
    this.saving.set(true);
    try {
      const res = await this.creditSvc.recordPayment(c, {
        amount,
        method,
        description: this.paymentNote.trim() || (method === 'cash' ? this.t().credit.cashPayDesc : this.t().credit.cardPayDesc),
      });
      this.customer.update(cur => cur ? { ...cur, balance: res.balance, totalPaid: roundKurus((cur.totalPaid ?? 0) + amount) } : null);
      this.toast.add({
        severity: 'success', summary: '',
        detail: res.offline ? this.t().credit.savedOffline : this.t().credit.collected,
        life: 3000,
      });
      this.showPaymentDialog.set(false);
    } catch (err) {
      if (err instanceof OverpaymentError) {
        this.toast.add({ severity: 'warn', summary: '', detail: this.t().credit.overpayment, life: 4000 });
      } else {
        console.error(err);
        this.toast.add({ severity: 'error', summary: '', detail: this.t().credit.collectFailed, life: 3000 });
      }
    } finally {
      this.saving.set(false);
    }
  }
}
