import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, of, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { LangService } from '../../../core/i18n/lang.service';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { Purchase } from '../../../shared/models/purchase.model';
import { Supplier, SupplierPaymentMethod, SupplierTransaction } from '../../../shared/models/supplier.model';
import { EmptyStateComponent, GlassCardComponent, MoneyComponent, StatusBadgeComponent, initialsOf } from '../../../shared/ui';
import { PurchaseService } from '../../purchases/services/purchase.service';
import { PurchaseError, roundKurus } from '../../purchases/services/purchase.utils';

/**
 * Tedarikçi cari hesabı: bakiye, ödeme yap, cari hareketler, alış belgeleri.
 * Bakiye canlı hareket listesinden okunur (son hareketin `balance` alanı) → ödeme sonrası anında güncellenir.
 * Toast için üst sayfanın MessageService'ini kullanır.
 */
@Component({
  selector: 'app-supplier-account',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DatePipe, CurrencyTrPipe, ButtonModule, DialogModule, InputTextModule, SelectModule,
    GlassCardComponent, MoneyComponent, StatusBadgeComponent, EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3 lg:gap-4' },
  template: `
    <!-- Cari kartı (C müşteri başlığı + borç şeridi) -->
    <section class="ui-card overflow-hidden" [attr.aria-label]="t().acc.supplierCount">
      <div class="flex flex-wrap items-center gap-4 p-4">
        <span class="font-display grid h-[60px] w-[60px] shrink-0 place-items-center rounded-token-2xl bg-info-soft text-20 font-extrabold text-info-text"
          aria-hidden="true">{{ initials() }}</span>
        <div class="min-w-0 flex-[1_1_220px]">
          <h2 class="font-display m-0 break-words text-22 font-extrabold leading-tight text-fg">{{ supplier().name }}</h2>
          <div class="mt-1 flex flex-wrap gap-x-3.5 gap-y-1 text-13.5 text-fg-secondary">
            @if (supplier().contactPerson) {
              <span class="inline-flex items-center gap-1.5"><i class="pi pi-user text-13 text-fg-muted" aria-hidden="true"></i>{{ supplier().contactPerson }}</span>
            }
            @if (supplier().phone) {
              <a class="num inline-flex items-center gap-1.5 text-fg-secondary no-underline hover:text-brand-text hover:underline"
                [href]="'tel:' + supplier().phone"><i class="pi pi-phone text-13 text-fg-muted" aria-hidden="true"></i>{{ supplier().phone }}</a>
            }
            @if (supplier().taxNo) {
              <span class="inline-flex items-center gap-1.5"><i class="pi pi-id-card text-13 text-fg-muted" aria-hidden="true"></i><span class="num font-mono">{{ supplier().taxNo }}</span></span>
            }
          </div>
        </div>
        <div class="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
          <p-button [label]="t().purchases.makePayment" icon="pi pi-money-bill" styleClass="w-full" (onClick)="openPayment()" />
          <p-button [label]="t().purchases.newPurchaseForSupplier" icon="pi pi-plus" severity="secondary" styleClass="w-full"
            routerLink="/purchases/new" [queryParams]="{ supplierId: supplier().id }" />
        </div>
      </div>

      <dl class="m-0 grid grid-cols-2 border-t border-line lg:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
        <div class="min-w-0 border-b border-r border-line px-4 py-3.5 lg:border-b-0"
          [class]="balance() > 0 ? 'bg-danger-soft' : ''">
          <dt class="flex items-center gap-1.5 text-12.5 font-semibold" [class]="balance() > 0 ? 'text-danger-text' : 'text-fg-muted'">
            <i class="pi pi-wallet text-12" aria-hidden="true"></i>{{ balance() >= 0 ? t().purchases.weOwe : t().purchases.weAreOwed }}</dt>
          <dd class="m-0">
            <span class="num-xl mt-1 block truncate text-24 leading-tight sm:text-[2rem]"
              [class]="balance() > 0 ? 'text-danger-text' : balance() < 0 ? 'text-success-text' : 'text-fg'">{{ absBalance() | currencyTr }}</span>
            @if (balance() === 0) { <span class="mt-0.5 block text-12.5 text-fg-muted">{{ t().purchases.settled }}</span> }
          </dd>
        </div>
        <div class="min-w-0 border-b border-line px-4 py-3.5 lg:border-b-0 lg:border-r">
          <dt class="flex items-center gap-1.5 text-12.5 font-semibold text-fg-muted">
            <i class="pi pi-download text-12" aria-hidden="true"></i>{{ t().purchases.totalPurchased }}</dt>
          <dd class="num-xl m-0 mt-1 truncate text-22 leading-tight sm:text-26">{{ totalPurchased() | currencyTr }}</dd>
        </div>
        <div class="min-w-0 border-r border-line px-4 py-3.5">
          <dt class="flex items-center gap-1.5 text-12.5 font-semibold text-fg-muted">
            <i class="pi pi-check-circle text-12" aria-hidden="true"></i>{{ t().purchases.totalPaid }}</dt>
          <dd class="num-xl m-0 mt-1 truncate text-22 leading-tight text-success-text sm:text-26">{{ totalPaid() | currencyTr }}</dd>
        </div>
        <div class="min-w-0 px-4 py-3.5">
          <dt class="flex items-center gap-1.5 text-12.5 font-semibold text-fg-muted">
            <i class="pi pi-history text-12" aria-hidden="true"></i>{{ t().acc.lastMove }}</dt>
          <dd class="m-0">
            @if (transactions()[0]; as last) {
              <span class="num-xl mt-1 block truncate text-22 leading-tight sm:text-26">{{ last.createdAt?.toDate() | date:'dd.MM.yyyy' }}</span>
              <span class="mt-0.5 block truncate text-12.5 text-fg-muted">
                {{ last.type === 'purchase' ? t().purchases.txPurchase : t().purchases.txPayment }} · {{ last.amount | currencyTr }}</span>
            } @else {
              <span class="num-xl mt-1 block text-22 leading-tight text-fg-muted sm:text-26">–</span>
              <span class="mt-0.5 block text-12.5 text-fg-muted">{{ t().acc.noMove }}</span>
            }
          </dd>
        </div>
      </dl>
    </section>

    <div class="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-4">
      <ui-glass-card [title]="t().purchases.transactions" icon="pi-history" tone="accent" padding="none" clip
        [subtitle]="transactions().length ? transactions().length + ' ' + t().credit.records : ''">
        @if (transactions().length === 0) {
          <ui-empty-state compact icon="pi-list" [title]="t().purchases.noTransactions" />
        } @else {
          <ol class="m-0 list-none px-4 py-2">
            @for (tx of transactions(); track tx.id; let last = $last) {
              <li class="relative grid grid-cols-[40px_minmax(0,1fr)_auto] gap-3 py-2.5">
                @if (!last) {
                  <span class="absolute -bottom-2.5 left-[19px] top-[52px] w-0.5 bg-line" aria-hidden="true"></span>
                }
                <span class="relative z-[1] grid h-10 w-10 place-items-center rounded-token-lg" aria-hidden="true"
                  [class]="tx.isReversal ? 'bg-neutral-soft text-neutral-text' : tx.type === 'purchase' ? 'bg-accent-soft text-accent-text' : 'bg-success-soft text-success-text'">
                  <i class="pi text-16" [class]="tx.isReversal ? 'pi-replay' : tx.type === 'purchase' ? 'pi-download' : 'pi-money-bill'"></i>
                </span>
                <div class="min-w-0">
                  <p class="m-0 flex flex-wrap items-center gap-1.5 text-14.5 font-semibold text-fg">
                    {{ tx.type === 'purchase' ? t().purchases.txPurchase : t().purchases.txPayment }}
                    @if (tx.isReversal) { <ui-status-badge tone="neutral" size="sm">{{ t().purchases.reversal }}</ui-status-badge> }
                  </p>
                  <p class="num m-0 text-12.5 text-fg-muted">{{ tx.createdAt?.toDate() | date: 'dd.MM.yyyy HH:mm' }}</p>
                  @if (tx.description) { <p class="m-0 mt-1 break-words text-13 text-fg-secondary">{{ tx.description }}</p> }
                </div>
                <div class="text-right">
                  <p class="font-display m-0 whitespace-nowrap text-16 font-extrabold"
                    [class]="tx.type === 'purchase' ? 'text-fg' : 'text-brand-text'">
                    <ui-money [value]="tx.type === 'purchase' ? tx.amount : -tx.amount" signed [symbol]="false" />
                  </p>
                  <p class="num m-0 whitespace-nowrap text-12 text-fg-muted">{{ t().purchases.balanceAfter }} {{ tx.balance | currencyTr }}</p>
                </div>
              </li>
            }
          </ol>
        }
      </ui-glass-card>

      <ui-glass-card [title]="t().purchases.supplierPurchases" icon="pi-file" padding="none" clip
        [subtitle]="purchases().length ? purchases().length + ' ' + t().credit.records : ''">
        @if (purchases().length === 0) {
          <ui-empty-state compact icon="pi-file" [title]="t().purchases.noSupplierPurchases" />
        } @else {
          <ul class="m-0 list-none p-0">
            @for (p of purchases(); track p.id) {
              <li class="border-b border-line last:border-b-0">
                <a [routerLink]="['/purchases', p.id]" class="list-row flex min-h-[56px] items-center gap-3 px-4 py-2.5 no-underline"
                  [class.opacity-60]="p.status === 'cancelled'">
                  <span class="grid h-9 w-9 shrink-0 place-items-center rounded-token-md bg-surface-muted text-fg-secondary" aria-hidden="true">
                    <i class="pi pi-file text-14"></i>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="num block truncate text-14.5 font-semibold text-fg">{{ p.documentNo || '-' }}</span>
                    <span class="num block truncate text-12.5 text-fg-muted">{{ p.documentDate.toDate() | date: 'dd.MM.yyyy' }} · {{ p.items.length }} {{ t().purchases.itemCount }}</span>
                  </span>
                  @if (p.status === 'cancelled') {
                    <ui-status-badge tone="danger" size="sm">{{ t().purchases.statusCancelled }}</ui-status-badge>
                  } @else if (p.paymentType === 'credit') {
                    <ui-status-badge tone="warning" size="sm">{{ t().purchases.paymentCredit }}</ui-status-badge>
                  }
                  <ui-money [value]="p.grandTotal" class="font-display shrink-0 text-15 font-extrabold text-fg" />
                </a>
              </li>
            }
          </ul>
        }
      </ui-glass-card>
    </div>

    <p-dialog [visible]="paymentOpen()" (visibleChange)="paymentOpen.set($event)" [header]="t().purchases.makePayment" [modal]="true"
      [draggable]="false" appendTo="body" styleClass="w-[440px] max-w-[95vw]">
      <div class="flex flex-col gap-4 py-1">
        <div class="flex flex-col gap-1.5">
          <label for="sp-amount" class="text-sm font-semibold text-fg-secondary">{{ t().purchases.amount }}</label>
          <input pInputText id="sp-amount" type="number" inputmode="decimal" min="0" step="any" class="num w-full"
            [ngModel]="amount()" (ngModelChange)="amount.set(+$event || 0)" />
          @if (amount() > balance() && balance() >= 0) {
            <p class="m-0 text-xs text-warning-text">{{ t().purchases.overpayNote }}</p>
          }
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="sp-method" class="text-sm font-semibold text-fg-secondary">{{ t().purchases.paymentMethod }}</label>
          <p-select inputId="sp-method" [options]="methodOptions()" optionLabel="label" optionValue="value" appendTo="body"
            [ngModel]="method()" (ngModelChange)="method.set($event)" styleClass="w-full" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="sp-desc" class="text-sm font-semibold text-fg-secondary">{{ t().purchases.description }}</label>
          <input pInputText id="sp-desc" class="w-full" [ngModel]="description()" (ngModelChange)="description.set($event)" />
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button [label]="t().common.cancel" severity="secondary" (onClick)="paymentOpen.set(false)" />
        <p-button [label]="t().common.save" icon="pi pi-check" [loading]="paying()" (onClick)="pay()" />
      </ng-template>
    </p-dialog>
  `,
})
export class SupplierAccountComponent {
  private readonly svc = inject(PurchaseService);
  private readonly toast = inject(MessageService);
  readonly t = inject(LangService).t;

  readonly supplier = input.required<Supplier>();

  private readonly supplierId$ = toObservable(computed(() => this.supplier().id));

  readonly transactions = toSignal(
    this.supplierId$.pipe(switchMap(id => this.svc.getSupplierTransactions$(id).pipe(catchError(() => of([] as SupplierTransaction[]))))),
    { initialValue: [] as SupplierTransaction[] },
  );
  readonly purchases = toSignal(
    this.supplierId$.pipe(switchMap(id => this.svc.getBySupplier$(id).pipe(catchError(() => of([] as Purchase[]))))),
    { initialValue: [] as Purchase[] },
  );

  /** En yeni hareketin koşan bakiyesi; hareket yoksa tedarikçi belgesindeki bakiye */
  readonly balance = computed(() => this.transactions()[0]?.balance ?? this.supplier().balance ?? 0);
  readonly initials = computed(() => initialsOf(this.supplier().name));
  readonly absBalance = computed(() => Math.abs(this.balance()));
  readonly totalPurchased = computed(() =>
    roundKurus(this.transactions().filter(t => t.type === 'purchase').reduce((s, t) => s + t.amount, 0)));
  readonly totalPaid = computed(() =>
    roundKurus(this.transactions().filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0)));

  readonly paymentOpen = signal(false);
  readonly paying = signal(false);
  readonly amount = signal(0);
  readonly method = signal<SupplierPaymentMethod>('cash');
  readonly description = signal('');

  readonly methodOptions = computed(() => [
    { label: this.t().purchases.cash, value: 'cash' as SupplierPaymentMethod },
    { label: this.t().purchases.card, value: 'card' as SupplierPaymentMethod },
    { label: this.t().purchases.transfer, value: 'transfer' as SupplierPaymentMethod },
  ]);

  openPayment(): void {
    this.amount.set(Math.max(0, this.balance()));
    this.method.set('cash');
    this.description.set(this.t().purchases.paymentDefaultDesc);
    this.paymentOpen.set(true);
  }

  async pay(): Promise<void> {
    const tp = this.t().purchases;
    if (!(this.amount() > 0)) {
      this.toast.add({ severity: 'warn', summary: '', detail: tp.invalidAmount });
      return;
    }
    this.paying.set(true);
    try {
      await this.svc.recordPayment(this.supplier().id, {
        amount: this.amount(), method: this.method(), description: this.description() || tp.paymentDefaultDesc,
      });
      this.paymentOpen.set(false);
      this.toast.add({ severity: 'success', summary: '', detail: tp.paymentSaved, life: 2500 });
    } catch (err) {
      const detail = err instanceof PurchaseError && err.code === 'offline' ? tp.errOffline : tp.paymentFailed;
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail });
    } finally {
      this.paying.set(false);
    }
  }
}
