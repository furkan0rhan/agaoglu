import {
  AfterViewInit, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, HostListener, inject,
  OnInit, signal, viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumber, InputNumberModule } from 'primeng/inputnumber';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { CartStore } from './store/cart.store';
import { ProductStore } from '../products/store/product.store';
import {
  SaleService, CompletedSale, CreditOptions, ProductNotFoundError, InsufficientStockError,
  SaleNeedsConfirmationError, SaleWarnings, PrescriptionRequiredError, ExpiredPlantProtectionError, GtsUnavailableError,
} from './services/sale.service';
import { cartItemFromProduct, findByCode } from './services/cart-item.utils';
import { addMonths, buildCreditPlan } from './services/credit-plan';
import { HeldCart, holdCart, loadHeldCarts, MAX_HELD_CARTS, removeHeldCart, takeHeldCart } from './store/held-carts';
import { TenantSettingsService } from '../../core/settings/tenant-settings.service';
import { AuthService } from '../../core/auth/services/auth.service';
import {
  checkPrescription, isPlantProtection, isValidPrescriptionNo, normalizePrescriptionNo, productTypeOf,
} from '../../shared/utils/regulatory.utils';
import { expiryInfo, isBatchExpired } from '../../shared/utils/batch.utils';
import { isDecimalUnit, productUnit, round2 } from './services/sale.utils';
import { LoggerService } from '../../core/logging/logger.service';
import { CustomerService } from '../customers/services/customer.service';
import { CreditService } from '../credit/services/credit.service';
import { whatsappLink } from '../credit/services/credit.utils';
import { CurrencyTrPipe } from '../../shared/pipes/currency-tr.pipe';
import { BarcodeInputDirective } from '../../shared/directives/barcode-input.directive';
import { Customer } from '../../shared/models/customer.model';
import { Product } from '../../shared/models/product.model';
import { CartItem, DiscountType, SaleUnit } from '../../shared/models/sale.model';
import { LangService } from '../../core/i18n/lang.service';
import {
  AvatarComponent, EmptyStateComponent, IconButtonComponent, KbdComponent, MoneyComponent, PageHeaderComponent,
  QuickCashComponent, SegmentedComponent, StatusBadgeComponent, UiSegmentOption, UiTone,
} from '../../shared/ui';
import { formatQty } from '../sales/services/sales.helpers';
import { SalesQueryService } from '../sales/services/sales-query.service';
import { ReceiptPrinterService } from '../sales/receipt/receipt-printer.service';
import { ReceiptBusinessService } from '../sales/receipt/receipt-business.service';

/** Arama sonucu en fazla bu kadar ürün çizilir (düşük seviye Android için). */
const RESULT_LIMIT = 40;
const FAVORITE_LIMIT = 12;
const INSTALLMENT_OPTIONS = [1, 2, 3, 6, 9, 12];
const DAY = 86_400_000;

type ProductKind = 'gubre' | 'bitki_koruma' | 'tohum' | 'fide' | 'diger';
type FavFilter = 'all' | ProductKind;
type CreditMode = 'installment' | 'harvest';
type CustomerWithLinks = Customer & { farmerId?: string | null };

interface IndexedProduct {
  p: Product;
  name: string;
  hay: string;
  codes: string[];
}

interface LinePill { tone: UiTone; text: string }

const KIND_ICON: Record<ProductKind, string> = {
  gubre: 'pi-shopping-bag', bitki_koruma: 'pi-shield', tohum: 'pi-circle', fide: 'pi-sun', diger: 'pi-box',
};

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromDateInput(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [
    RouterLink, FormsModule, CurrencyTrPipe, BarcodeInputDirective,
    ButtonModule, InputTextModule, InputNumberModule, DialogModule, ToastModule, ConfirmDialogModule,
    AvatarComponent, EmptyStateComponent, IconButtonComponent, KbdComponent, MoneyComponent, PageHeaderComponent,
    QuickCashComponent, SegmentedComponent, StatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 flex-col lg:min-h-0' },
  template: `
    <p-toast position="top-right" />
    <p-confirmdialog key="pos-sale-confirm" appendTo="body" styleClass="w-[400px] max-w-[calc(100vw-2rem)]" />
    <ui-page-header [title]="t().pos.pageTitle" />

    <!-- ============ Nakit ============ -->
    <p-dialog [header]="t().pos.cashPayment" [(visible)]="showCash" [modal]="true" [draggable]="false"
      appendTo="body" styleClass="w-[460px] max-w-[calc(100vw-2rem)]"
      (onShow)="focusById('cash-received', true)" (onHide)="focusSearch()">
      <div class="flex flex-col gap-4">
        <div class="flex items-baseline justify-between gap-3 rounded-token-lg bg-surface-muted px-4 py-3">
          <span class="text-sm font-semibold text-fg-secondary">{{ t().pos.totalAmount }}</span>
          <ui-money class="num-xl text-28 text-fg" [value]="payTotal()" />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="cash-received" class="text-sm font-semibold text-fg-secondary">{{ t().pos.receivedAmount }}</label>
          <p-inputNumber inputId="cash-received" [ngModel]="cashAmount()" (ngModelChange)="cashAmount.set($event)"
            mode="decimal" locale="tr-TR" [minFractionDigits]="0" [maxFractionDigits]="2" [min]="0" prefix="₺ "
            styleClass="w-full" inputStyleClass="num h-14 w-full text-2xl font-bold"
            (keydown.enter)="confirmCashPayment()" />
        </div>

        <ui-quick-cash [total]="payTotal()" [value]="cashAmount()" (valueChange)="setCash($event)"
          [label]="t().pos2.quickCashLabel" [exactLabel]="t().pos2.exact" [count]="4" />

        @if (cashShortfall() > 0) {
          @if (cart.customerId()) {
            <div class="flex items-center justify-between gap-3 rounded-token-lg border border-accent-line bg-accent-soft px-4 py-3">
              <span class="text-sm font-semibold text-accent-text">{{ t().pos.remainingToCredit }}</span>
              <ui-money class="num-xl text-xl text-accent-text" [value]="cashShortfall()" />
            </div>
          } @else {
            <div class="flex flex-col gap-2 rounded-token-lg border border-danger-line bg-danger-soft px-4 py-3">
              <span class="text-sm font-semibold text-danger-text">{{ t().pos.insufficientCash }} (<span class="num">{{ cashShortfall() | currencyTr }}</span>)</span>
              <span class="text-xs text-danger-text">{{ t().pos.creditNeedsCustomer }}</span>
              <p-button [label]="t().pos.selectCustomer" icon="pi pi-user" severity="secondary" size="small"
                (onClick)="openCustomerDialog(false)" />
            </div>
          }
        } @else {
          <div class="flex items-center justify-between gap-3 rounded-token-lg border border-brand-line bg-brand-soft px-4 py-3" aria-live="polite">
            <span class="eyebrow text-brand-text">{{ t().pos2.changeBig }}</span>
            <ui-money class="num-xl text-4xl text-brand-text" [value]="cashChange()" />
          </div>
        }
      </div>
      <ng-template #footer>
        <div class="flex w-full gap-2">
          <p-button [label]="t().pos.cancel" severity="secondary" styleClass="min-h-[48px]"
            (onClick)="showCash.set(false)" [disabled]="saving()" />
          <p-button class="flex-1" styleClass="w-full min-h-[48px]" [label]="t().pos.complete" icon="pi pi-check"
            (onClick)="confirmCashPayment()" [loading]="saving()"
            [disabled]="saving() || (cashShortfall() > 0 && !cart.customerId())" />
        </div>
      </ng-template>
    </p-dialog>

    <!-- ============ Kart onayı ============ -->
    <p-dialog [header]="t().pos.cardConfirmTitle" [(visible)]="showCard" [modal]="true" [draggable]="false"
      appendTo="body" styleClass="w-[400px] max-w-[calc(100vw-2rem)]"
      (onShow)="focusById('card-confirm-yes', false, 120)" (onHide)="focusSearch()">
      <div class="flex flex-col items-center gap-3 py-2 text-center">
        <span class="flex h-16 w-16 items-center justify-center rounded-token-xl bg-surface-strong text-fg">
          <i class="pi pi-credit-card text-3xl" aria-hidden="true"></i>
        </span>
        <ui-money class="num-xl text-3xl text-fg" [value]="payTotal()" />
        <p class="m-0 text-base font-semibold text-fg-secondary">{{ cardQuestion() }}</p>
      </div>
      <ng-template #footer>
        <div class="flex w-full gap-2">
          <p-button [label]="t().pos.cancel" severity="secondary" styleClass="min-h-[48px]"
            (onClick)="showCard.set(false)" [disabled]="saving()" />
          <button id="card-confirm-yes" type="button" (click)="confirmCardPayment()" [disabled]="saving()"
            class="flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-token-md border-0 bg-brand px-4 text-base font-bold text-brand-contrast transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
            <i class="pi" [class]="saving() ? 'pi-spin pi-spinner' : 'pi-check'" aria-hidden="true"></i>
            {{ t().pos.cardConfirmYes }}
          </button>
        </div>
      </ng-template>
    </p-dialog>

    <!-- ============ E-reçete (bitki koruma ürünü) ============ -->
    <p-dialog [header]="t().compliance.rxTitle" [(visible)]="showRx" [modal]="true" [draggable]="false"
      appendTo="body" styleClass="w-[460px] max-w-[calc(100vw-2rem)]"
      (onShow)="focusById('rx-no', true)" (onHide)="onRxHide()">
      <div class="flex flex-col gap-4">
        <div class="flex gap-3 rounded-token-lg border border-warning-line bg-warning-soft px-3 py-2.5 text-sm">
          <i class="pi pi-file-check mt-0.5 text-warning-text" aria-hidden="true"></i>
          <div class="min-w-0">
            <p class="m-0 font-semibold text-fg">{{ settings.prescriptionMode() === 'required' ? t().compliance.rxIntroRequired : t().compliance.rxIntroWarn }}</p>
            <p class="m-0 mt-1 text-xs text-fg-secondary">{{ rxProductNames().join(', ') }}</p>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold text-fg-secondary">{{ t().compliance.rxCustomer }} *</span>
          @if (cart.customerId()) {
            <div class="flex min-h-[48px] items-center gap-2 rounded-token-lg border border-brand-line bg-brand-soft py-1 pl-2 pr-1">
              <ui-avatar [name]="cart.customerName() ?? ''" size="sm" />
              <span class="min-w-0 flex-1 truncate text-sm font-semibold text-brand-text">{{ cart.customerName() }}</span>
              <button type="button" (click)="openCustomerDialog(false)"
                class="min-h-[40px] cursor-pointer rounded-token-md bg-transparent px-2 text-xs font-semibold text-brand-text hover:underline">{{ t().pos.changeCustomer }}</button>
            </div>
          } @else {
            <div class="flex flex-col gap-2 rounded-token-lg border border-danger-line bg-danger-soft px-3 py-2.5">
              <span class="text-xs text-danger-text">{{ t().compliance.rxNeedsCustomer }}</span>
              <p-button [label]="t().pos.selectCustomer" icon="pi pi-user" severity="secondary"
                size="small" (onClick)="openCustomerDialog(false)" />
            </div>
          }
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="rx-no" class="text-sm font-semibold text-fg-secondary">{{ t().compliance.rxNo }} *</label>
          <input pInputText id="rx-no" autocomplete="off" spellcheck="false" class="num h-12 w-full font-mono text-base"
            [placeholder]="t().compliance.rxNoPlaceholder" [ngModel]="rxNo()" (ngModelChange)="rxNo.set($event ?? '')"
            (keydown.enter)="confirmRx()" maxlength="40" />
          @if (rxNo().trim() && !rxNoValid()) {
            <p class="m-0 text-xs text-danger-text" role="alert">{{ t().compliance.rxNoInvalid }}</p>
          }
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="rx-prescriber" class="text-sm font-semibold text-fg-secondary">
            {{ t().compliance.rxPrescriber }} <span class="font-normal text-fg-muted">({{ t().common.optional }})</span>
          </label>
          <input pInputText id="rx-prescriber" autocomplete="off" class="h-11 w-full" maxlength="120"
            [ngModel]="rxPrescriber()" (ngModelChange)="rxPrescriber.set($event ?? '')" (keydown.enter)="confirmRx()" />
        </div>
      </div>
      <ng-template #footer>
        <div class="flex w-full flex-wrap gap-2">
          <p-button [label]="t().pos.cancel" severity="secondary" styleClass="min-h-[48px]" (onClick)="showRx.set(false)" />
          @if (settings.prescriptionMode() === 'warn') {
            <p-button [label]="t().compliance.rxSkip" severity="warn" [text]="true" styleClass="min-h-[48px]" (onClick)="skipRx()" />
          }
          <p-button class="flex-1" styleClass="w-full min-h-[48px]" [label]="t().compliance.rxContinue" icon="pi pi-arrow-right"
            [disabled]="!rxReady()" (onClick)="confirmRx()" />
        </div>
      </ng-template>
    </p-dialog>

    <!-- ============ Veresiye (vade, peşinat, taksit planı, limit) ============ -->
    <p-dialog [header]="t().pos.creditPayment" [(visible)]="showCredit" [modal]="true" [draggable]="false"
      appendTo="body" styleClass="w-[540px] max-w-[calc(100vw-1rem)]" (onHide)="focusSearch()">
      @let calc = creditCalc();
      @let lim = creditLimit();
      <div class="flex flex-col gap-4">
        <!-- Müşteri + tutar -->
        <div class="flex items-center gap-3 rounded-token-lg border border-accent-line bg-accent-soft px-3 py-2.5">
          <ui-avatar [name]="cart.customerName() ?? ''" size="sm" />
          <div class="min-w-0 flex-1">
            <p class="m-0 truncate text-sm font-bold text-fg">{{ cart.customerName() }}</p>
            <p class="num m-0 text-xs text-fg-secondary">
              {{ t().pos2.currentDebt }}: {{ (selectedCustomer()?.balance ?? 0) | currencyTr }}
              @if (selectedCustomer()?.creditLimit) { · {{ t().pos2.limit }} {{ selectedCustomer()?.creditLimit | currencyTr }} }
            </p>
          </div>
          <ui-money class="num-xl text-xl text-accent-text" [value]="payTotal()" />
        </div>

        <ui-segmented [options]="creditModes()" [value]="creditMode()" (valueChange)="setCreditMode($event)" [block]="true"
          [ariaLabel]="t().pos2.creditMode" />

        <div class="grid grid-cols-2 gap-3">
          <div class="flex min-w-0 flex-col gap-1.5">
            <label for="credit-down" class="text-sm font-semibold text-fg-secondary">{{ t().pos2.downPayment }}</label>
            <p-inputNumber inputId="credit-down" [ngModel]="creditDown()" (ngModelChange)="creditDown.set($event ?? 0)"
              mode="decimal" locale="tr-TR" [min]="0" [minFractionDigits]="0" [maxFractionDigits]="2" prefix="₺ "
              styleClass="w-full" inputStyleClass="num h-11 w-full" />
          </div>
          <div class="flex min-w-0 flex-col gap-1.5">
            <label for="credit-rate" class="text-sm font-semibold text-fg-secondary">{{ t().pos.interestRate }}</label>
            <p-inputNumber inputId="credit-rate" [ngModel]="creditRate()" (ngModelChange)="creditRate.set($event ?? 0)"
              locale="tr-TR" [min]="0" [max]="1000" [minFractionDigits]="0" [maxFractionDigits]="2" suffix=" %"
              styleClass="w-full" inputStyleClass="num h-11 w-full" />
          </div>
        </div>

        @if (creditMode() === 'installment') {
          <div class="flex flex-col gap-1.5">
            <span id="credit-count-label" class="text-sm font-semibold text-fg-secondary">{{ t().pos.installments }}</span>
            <div class="flex flex-wrap gap-2" role="group" aria-labelledby="credit-count-label">
              @for (n of installmentOptions; track n) {
                <button type="button" (click)="creditCount.set(n)" [attr.aria-pressed]="creditCount() === n"
                  class="num min-h-[44px] min-w-[44px] cursor-pointer rounded-token-md border px-3 text-sm font-bold transition-colors"
                  [class]="creditCount() === n
                    ? 'border-accent bg-accent text-accent-contrast'
                    : 'border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover'">{{ n }}</button>
              }
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex min-w-0 flex-col gap-1.5">
              <label for="credit-first-due" class="text-sm font-semibold text-fg-secondary">{{ t().pos2.firstDue }}</label>
              <input pInputText id="credit-first-due" type="date" class="h-11 w-full" [min]="todayInput"
                [ngModel]="creditFirstDue()" (ngModelChange)="creditFirstDue.set($event ?? '')" />
            </div>
            <div class="flex min-w-0 flex-col gap-1.5">
              <span id="credit-interval-label" class="text-sm font-semibold text-fg-secondary">{{ t().pos2.interval }}</span>
              <ui-segmented [options]="intervalOptions()" [value]="creditInterval()" (valueChange)="creditInterval.set($event ?? 1)"
                [block]="true" [ariaLabel]="t().pos2.interval" />
            </div>
          </div>
        } @else {
          <div class="flex flex-col gap-1.5">
            <label for="credit-harvest" class="text-sm font-semibold text-fg-secondary">{{ t().pos2.harvestDate }}</label>
            <input pInputText id="credit-harvest" type="date" class="h-11 w-full" [min]="todayInput"
              [ngModel]="creditHarvest()" (ngModelChange)="creditHarvest.set($event ?? '')" />
          </div>
        }

        @if (!creditDueValid()) {
          <p class="m-0 text-xs font-semibold text-danger-text" role="alert">{{ t().pos2.dueRequired }}</p>
        }

        <!-- Plan önizleme -->
        <div class="overflow-hidden rounded-token-lg border border-line">
          <div class="flex items-center justify-between gap-3 bg-surface-muted px-3 py-2">
            <span class="eyebrow text-fg-muted">{{ t().pos2.planTitle }}</span>
            <span class="text-xs text-fg-secondary">
              @if (calc.downPayment > 0) { {{ t().pos2.downPaymentLabel }} <b class="num">{{ calc.downPayment | currencyTr }}</b> · }
              @if (calc.interest > 0) { {{ t().pos.interestAmount }} <b class="num">+{{ calc.interest | currencyTr }}</b> }
            </span>
          </div>
          @if (calc.plan.installments.length) {
            <ul class="m-0 max-h-[180px] list-none overflow-y-auto p-0">
              @for (i of calc.plan.installments; track i.no) {
                <li class="flex items-center gap-3 border-t border-line px-3 py-2 text-sm first:border-t-0">
                  <span class="num w-14 text-fg-muted">{{ i.no }}/{{ calc.plan.installments.length }}</span>
                  <span class="num flex-1 text-fg-secondary">{{ dateText(i.dueDate) }}</span>
                  <ui-money class="font-bold text-fg" [value]="i.amount" />
                </li>
              }
            </ul>
          }
          <div class="flex items-baseline justify-between gap-3 border-t border-line px-3 py-2.5">
            <span class="text-sm font-semibold text-fg">{{ t().pos2.financed }}</span>
            <ui-money class="num-xl text-xl text-accent-text" [value]="calc.financed" />
          </div>
        </div>

        @if (lim) {
          @if (lim.exceeded) {
            <div class="flex items-start gap-3 rounded-token-lg border border-danger-line bg-danger-soft px-3 py-2.5" role="alert">
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-token-md bg-danger text-fg-inverse">
                <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
              </span>
              <div class="min-w-0 text-sm">
                <p class="m-0 font-semibold text-danger-text">{{ t().pos2.limitExceeded(money(lim.overBy)) }}</p>
                <p class="num m-0 mt-0.5 text-xs text-fg-secondary">{{ t().pos2.newBalance }}: {{ lim.newBalance | currencyTr }} · {{ t().pos2.limit }} {{ lim.limit | currencyTr }}</p>
              </div>
            </div>
          } @else if (lim.available !== null) {
            <p class="num m-0 text-xs text-fg-muted">{{ t().pos2.limitOk(money(lim.available)) }}</p>
          }
        }
      </div>
      <ng-template #footer>
        <div class="flex w-full gap-2">
          <p-button [label]="t().pos.cancel" severity="secondary" styleClass="min-h-[48px]"
            (onClick)="showCredit.set(false)" [disabled]="saving()" />
          <p-button class="flex-1" styleClass="w-full min-h-[48px]"
            [label]="lim?.exceeded ? t().pos2.completeAnyway : t().pos.complete" icon="pi pi-check"
            severity="warn" (onClick)="confirmCreditPayment()" [loading]="saving()"
            [disabled]="saving() || !creditDueValid() || calc.financed <= 0" />
        </div>
      </ng-template>
    </p-dialog>

    <!-- ============ Müşteri seç ============ -->
    <p-dialog [header]="t().pos.selectCustomer" [(visible)]="showCustomer" [modal]="true" [draggable]="false"
      appendTo="body" styleClass="w-[440px] max-w-[calc(100vw-2rem)]"
      (onShow)="focusById('pos-customer-search')" (onHide)="onCustomerDialogHide()">
      <div class="flex flex-col gap-3">
        <div class="relative">
          <label for="pos-customer-search" class="sr-only">{{ t().pos.searchCustomer }}</label>
          <i class="pi pi-search pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted" aria-hidden="true"></i>
          <input pInputText id="pos-customer-search" type="search" autocomplete="off" class="h-12 w-full !pl-10"
            [placeholder]="t().pos.searchCustomer" [ngModel]="customerSearch()" (ngModelChange)="customerSearch.set($event)"
            (keydown.enter)="selectFirstCustomer()" />
        </div>
        <ul class="m-0 flex max-h-[min(380px,55vh)] list-none flex-col overflow-y-auto p-0">
          @for (c of filteredCustomers(); track c.id) {
            <li class="border-b border-line last:border-b-0">
              <button type="button" (click)="selectCustomer(c)"
                class="list-row flex min-h-[56px] w-full cursor-pointer items-center gap-3 bg-transparent px-2 py-2 text-left">
                <ui-avatar [name]="c.firstName + ' ' + c.lastName" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold text-fg">{{ c.firstName }} {{ c.lastName }}</span>
                  <span class="block truncate text-xs text-fg-muted">{{ c.village || c.phone }}</span>
                </span>
                @if (c.balance > 0) {
                  <ui-status-badge tone="danger" size="sm"><span class="num">{{ c.balance | currencyTr }}</span></ui-status-badge>
                }
              </button>
            </li>
          } @empty {
            <li><ui-empty-state compact icon="pi-users" [title]="t().pos.noCustomer" /></li>
          }
        </ul>
      </div>
    </p-dialog>

    <!-- ============ Sepet iskontosu ============ -->
    <p-dialog [header]="t().pos.globalDiscount" [(visible)]="showDiscount" [modal]="true" [draggable]="false"
      appendTo="body" styleClass="w-[380px] max-w-[calc(100vw-2rem)]"
      (onShow)="focusById('pos-discount-value', true)" (onHide)="focusSearch()">
      <div class="flex flex-col gap-4">
        <ui-segmented [options]="discountTypes()" [value]="discountType()" (valueChange)="discountType.set($event ?? 'percent')"
          [block]="true" [ariaLabel]="t().pos.globalDiscount" />
        <div class="flex flex-col gap-1.5">
          <label for="pos-discount-value" class="text-sm font-semibold text-fg-secondary">{{ t().pos.discountValue }}</label>
          <p-inputNumber inputId="pos-discount-value" [ngModel]="discountValue()" (ngModelChange)="discountValue.set($event ?? 0)"
            locale="tr-TR" [min]="0" [max]="discountType() === 'percent' ? 100 : 1000000" [minFractionDigits]="0" [maxFractionDigits]="2"
            [prefix]="discountType() === 'amount' ? '₺ ' : ''" [suffix]="discountType() === 'percent' ? ' %' : ''"
            styleClass="w-full" inputStyleClass="num h-12 w-full text-lg font-bold" (keydown.enter)="applyDiscount()" />
        </div>
      </div>
      <ng-template #footer>
        <div class="flex w-full flex-wrap gap-2">
          @if (cart.globalDiscount() > 0) {
            <p-button [label]="t().pos.removeDiscount" severity="danger" [text]="true" (onClick)="removeDiscount()" />
          }
          <p-button class="ml-auto" [label]="t().common.apply" icon="pi pi-check" (onClick)="applyDiscount()" />
        </div>
      </ng-template>
    </p-dialog>

    <!-- ============ Beklet ============ -->
    <p-dialog [header]="t().pos2.holdTitle" [(visible)]="showHold" [modal]="true" [draggable]="false"
      appendTo="body" styleClass="w-[400px] max-w-[calc(100vw-2rem)]"
      (onShow)="focusById('pos-hold-name', true)" (onHide)="focusSearch()">
      <div class="flex flex-col gap-1.5">
        <label for="pos-hold-name" class="text-sm font-semibold text-fg-secondary">{{ t().pos2.holdName }}</label>
        <input pInputText id="pos-hold-name" autocomplete="off" class="h-12 w-full" maxlength="60"
          [placeholder]="t().pos2.holdNamePlaceholder" [ngModel]="holdName()" (ngModelChange)="holdName.set($event ?? '')"
          (keydown.enter)="confirmHold()" />
        <p class="num m-0 text-xs text-fg-muted">{{ t().pos2.lines(cart.items().length) }} · {{ cart.totalAmount() | currencyTr }}</p>
      </div>
      <ng-template #footer>
        <div class="flex w-full gap-2">
          <p-button [label]="t().pos.cancel" severity="secondary" (onClick)="showHold.set(false)" />
          <p-button class="flex-1" styleClass="w-full" [label]="t().pos2.holdConfirm" icon="pi pi-clock" (onClick)="confirmHold()" />
        </div>
      </ng-template>
    </p-dialog>

    <!-- ============ Bekleyen sepetler ============ -->
    <p-dialog [header]="t().pos2.heldTitle" [(visible)]="showHeld" [modal]="true" [draggable]="false"
      appendTo="body" styleClass="w-[460px] max-w-[calc(100vw-2rem)]" (onHide)="focusSearch()">
      <ul class="m-0 flex list-none flex-col p-0">
        @for (h of held(); track h.id) {
          <li class="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-token-md bg-accent-soft text-accent-text" aria-hidden="true">
              <i class="pi pi-clock"></i>
            </span>
            <div class="min-w-0 flex-1">
              <p class="m-0 truncate text-sm font-semibold text-fg">{{ h.name }}</p>
              <p class="num m-0 text-xs text-fg-muted">{{ timeText(h.heldAt) }} · {{ t().pos2.heldItems(h.state.items.length) }} · {{ heldTotal(h) | currencyTr }}</p>
            </div>
            <ui-icon-button icon="pi-trash" tone="danger" size="sm" [ariaLabel]="t().pos2.remove + ': ' + h.name" (click)="deleteHeld(h)" />
            <p-button [label]="t().pos2.resume" icon="pi pi-replay" size="small" (onClick)="resumeHeld(h)" />
          </li>
        } @empty {
          <li><ui-empty-state compact icon="pi-clock" [title]="t().pos2.heldEmpty" /></li>
        }
      </ul>
    </p-dialog>

    <!-- ============ Ekran ============ -->
    <div appBarcodeInput (barcodeDetected)="onBarcodeDetected($event)"
      class="flex flex-1 flex-col gap-3 px-3 pb-3 pt-3 lg:min-h-0 lg:gap-3.5 lg:px-6 lg:pb-4 lg:pt-4">
      <h1 class="sr-only">{{ t().pos.pageTitle }}</h1>
      <p class="sr-only" aria-live="polite">{{ liveMessage() }}</p>

      <!-- Fiş / kasiyer şeridi + F tuşları -->
      <div class="flex flex-wrap items-center gap-x-2.5 gap-y-2 text-13.5 text-fg-muted">
        <ui-status-badge tone="neutral"><span class="num">{{ receiptLabel() }}</span></ui-status-badge>
        <span class="truncate">{{ t().pos2.cashier }}: <b class="font-semibold text-fg-secondary">{{ cashierName() }}</b></span>
        <span class="hidden items-center gap-1.5 lg:inline-flex" aria-hidden="true">
          · <ui-kbd>F1</ui-kbd> {{ t().pos.cash }} <ui-kbd>F2</ui-kbd> {{ t().pos.card }}
          <ui-kbd>F3</ui-kbd> {{ t().pos.creditPayment }} <ui-kbd>F4</ui-kbd> {{ t().pos2.hintSearch }}
        </span>
        <span class="flex-1"></span>
        <button type="button" (click)="openHeldList()"
          class="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-token-md border border-line-strong bg-surface px-3 text-13.5 font-semibold text-fg transition-colors hover:bg-surface-muted">
          <i class="pi pi-clock text-sm" aria-hidden="true"></i>{{ t().pos2.heldBtn }}
          @if (held().length) {
            <span class="num grid h-5 min-w-[20px] place-items-center rounded-token-sm bg-accent px-1 text-11 font-bold text-accent-contrast">{{ held().length }}</span>
          }
        </button>
      </div>

      <div class="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <!-- ===== Sol: arama + sonuçlar + sık satılanlar ===== -->
        <div class="flex min-w-0 flex-col gap-3.5 lg:-m-[3px] lg:min-h-0 lg:overflow-y-auto lg:p-[3px]">
          <div class="flex h-[60px] shrink-0 items-center gap-3 rounded-[11px] border-2 border-brand bg-surface pl-4 pr-2.5 shadow-focus">
            <i class="pi pi-barcode text-2xl text-brand-text" aria-hidden="true"></i>
            <label for="pos-search" class="sr-only">{{ t().pos.searchLabel }}</label>
            <input #searchInput id="pos-search" type="text" autocomplete="off" spellcheck="false"
              enterkeyhint="search" aria-controls="pos-results" aria-keyshortcuts="F4"
              class="h-full min-w-0 flex-1 border-0 bg-transparent text-17 font-semibold text-fg outline-none placeholder:font-medium placeholder:text-fg-muted lg:text-19"
              [placeholder]="t().pos.searchPlaceholder" [ngModel]="query()" (ngModelChange)="onQuery($event)"
              (keydown)="onSearchKeydown($event)" (focus)="searchFocused.set(true)" (blur)="searchFocused.set(false)" />
            @if (query()) {
              <ui-icon-button icon="pi-times" size="sm" [ariaLabel]="t().common.close" (click)="clearSearch()" />
            }
            <span class="hidden lg:inline-flex" [title]="scannerReady() ? t().pos.scannerReady : t().pos.scannerPaused">
              <span class="h-2.5 w-2.5 rounded-full" [class]="scannerReady() ? 'bg-success' : 'bg-fg-muted'"></span>
              <span class="sr-only">{{ scannerReady() ? t().pos.scannerReady : t().pos.scannerPaused }}</span>
            </span>
            <ui-kbd class="hidden lg:inline-grid">F4</ui-kbd>
          </div>

          @if (query().trim()) {
            <section class="ui-card shrink-0 overflow-hidden" [attr.aria-label]="t().pos2.results">
              <header class="card-head">
                <span class="card-head-icon bg-brand-soft text-brand-text"><i class="pi pi-search text-15" aria-hidden="true"></i></span>
                <h3>{{ t().pos2.results }}</h3>
                <span class="num truncate text-13 text-fg-muted">{{ t().pos2.resultsMeta(query().trim(), matchCount()) }}</span>
                <span class="ml-auto hidden items-center gap-1 text-13 text-fg-muted xl:inline-flex" aria-hidden="true">
                  <ui-kbd>↑↓</ui-kbd> {{ t().pos2.select }} · <ui-kbd>Enter</ui-kbd> {{ t().pos2.addToCart }}
                </span>
              </header>
              @if (results().length) {
                <ul id="pos-results" class="m-0 list-none p-0">
                  @for (p of results(); track p.id; let i = $index) {
                    @let unit = unitOf(p);
                    @let sel = i === activeIndex();
                    @let inCart = cartQty().get(p.id) ?? 0;
                    <li class="border-b border-line last:border-b-0">
                      <button type="button" [id]="'pos-opt-' + i" (click)="addProduct(p)" [disabled]="p.stock <= 0"
                        [attr.aria-current]="sel ? 'true' : null"
                        class="grid min-h-[64px] w-full cursor-pointer grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-2.5 bg-transparent px-3 py-2.5 text-left transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-55 sm:grid-cols-[44px_minmax(0,1fr)_auto_auto_auto] sm:gap-x-3.5 sm:px-4"
                        [class]="sel ? 'bg-brand-soft shadow-[inset_3px_0_0_var(--brand)]' : ''">
                        <span class="grid h-10 w-10 place-items-center rounded-token-md bg-surface-muted text-fg-secondary sm:h-11 sm:w-11" aria-hidden="true">
                          <i class="pi" [class]="kindIcon(p)"></i>
                        </span>
                        <span class="min-w-0">
                          <span class="block truncate text-15 font-semibold text-fg">{{ p.name }}</span>
                          <span class="flex flex-wrap items-center gap-x-2 text-12.5 text-fg-muted">
                            @if (p.barcode) { <span class="num truncate">{{ p.barcode }}</span> }
                            @if (inCart > 0) { <span class="font-semibold text-brand-text">{{ t().pos.inCart }} <span class="num">{{ qtyText(inCart, unit) }}</span></span> }
                            <ui-money class="num text-15 font-extrabold text-fg sm:hidden" [value]="p.salePrice" />
                          </span>
                        </span>
                        <span class="hidden sm:block">
                          <ui-status-badge size="sm" [tone]="p.stock <= 0 ? 'danger' : p.stock <= (p.minStock || 0) ? 'warning' : 'success'">
                            <span class="num">{{ p.stock <= 0 ? t().pos.outOfStock : t().pos2.stockPill(qtyText(p.stock, unit)) }}</span>
                          </ui-status-badge>
                        </span>
                        <ui-money class="hidden text-right text-17 font-extrabold text-fg sm:block" [value]="p.salePrice" />
                        <span class="inline-flex h-10 items-center justify-center gap-1.5 rounded-token-md border px-3 text-13.5 font-semibold"
                          [class]="sel ? 'border-brand bg-brand text-brand-contrast' : 'border-line-strong bg-surface text-fg'" aria-hidden="true">
                          <i class="pi pi-plus text-xs"></i><span class="hidden sm:inline">{{ t().pos2.add }}</span>
                        </span>
                      </button>
                    </li>
                  }
                </ul>
                @if (matchCount() > results().length) {
                  <p class="m-0 border-t border-line px-4 py-2 text-center text-xs text-fg-muted">{{ t().pos.moreResults }}</p>
                }
              } @else {
                <ui-empty-state compact icon="pi-search" [title]="productStore.loading() ? t().common.loading : t().pos.noResults" />
              }
            </section>
          }

          <section class="ui-card shrink-0 overflow-hidden" [attr.aria-label]="t().pos2.favorites">
            <header class="card-head">
              <span class="card-head-icon bg-accent-soft text-accent-text"><i class="pi pi-tag text-15" aria-hidden="true"></i></span>
              <h3>{{ t().pos2.favorites }}</h3>
              <div class="ml-auto hidden md:block">
                <ui-segmented size="sm" [options]="favFilters()" [value]="favFilter()" (valueChange)="favFilter.set($event ?? 'all')"
                  [ariaLabel]="t().pos2.favorites" />
              </div>
            </header>
            @if (favorites().length) {
              <div class="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 sm:gap-2.5 sm:p-3.5 2xl:grid-cols-4">
                @for (p of favorites(); track p.id) {
                  <button type="button" (click)="addProduct(p)" [disabled]="p.stock <= 0"
                    class="flex min-h-[76px] cursor-pointer flex-col justify-between gap-1.5 rounded-token-lg border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-brand hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50">
                    <span class="line-clamp-2 text-sm font-semibold leading-tight text-fg">{{ p.name }}</span>
                    <span class="flex items-baseline justify-between gap-2">
                      <ui-money class="text-15 font-extrabold text-brand-text" [value]="p.salePrice" />
                      @if ((cartQty().get(p.id) ?? 0) > 0) {
                        <span class="num whitespace-nowrap rounded-token-sm bg-brand px-1.5 text-11 font-bold text-brand-contrast">{{ qtyText(cartQty().get(p.id) ?? 0, unitOf(p)) }}</span>
                      }
                    </span>
                  </button>
                }
              </div>
            } @else {
              <ui-empty-state compact icon="pi-tag" [title]="productStore.loading() ? t().common.loading : t().pos2.noFavorites" />
            }
          </section>
        </div>

        <!-- ===== Sağ: sepet ===== -->
        <section id="pos-cart" class="ui-card flex scroll-mt-3 flex-col overflow-hidden lg:min-h-0" [attr.aria-label]="t().pos2.cart">
          @if (showDone(); as ls) {
            <!-- Satış sonrası özet -->
            <div class="flex flex-col lg:min-h-0 lg:overflow-y-auto" role="status">
              <div class="flex items-center gap-3.5 border-b border-line bg-brand-soft px-4 py-[18px]">
                <span class="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-token-2xl bg-brand text-brand-contrast" aria-hidden="true">
                  <i class="pi pi-check text-2xl font-bold"></i>
                </span>
                <div class="min-w-0">
                  <h2 class="m-0 font-display text-19 font-extrabold text-fg">{{ t().pos2.doneTitle }}</h2>
                  <p class="num m-0 truncate text-13 text-fg-secondary">{{ ls.saleNumber }} · {{ methodText(ls) }} · {{ timeText(ls.receipt.date.getTime()) }}</p>
                </div>
              </div>
              <dl class="m-0 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] border-b border-line">
                <div class="min-w-0 border-r border-line px-3 py-3 xl:px-4 xl:py-3.5">
                  <dt class="text-12.5 font-semibold text-fg-muted">{{ t().pos2.amount }}</dt>
                  <dd class="m-0"><ui-money class="num-xl block text-18 text-fg xl:text-20" [value]="ls.receipt.totalAmount" [symbol]="false" /></dd>
                </div>
                <div class="min-w-0 border-r border-line px-3 py-3 xl:px-4 xl:py-3.5">
                  <dt class="text-12.5 font-semibold text-fg-muted">{{ ls.receipt.creditAmount > 0 && ls.receipt.downPayment ? t().pos2.downPaymentLabel : t().pos2.received }}</dt>
                  <dd class="m-0"><ui-money class="num-xl block text-18 text-fg xl:text-20" [value]="ls.receipt.cashPaid + ls.receipt.cardPaid" [symbol]="false" /></dd>
                </div>
                @if (ls.receipt.creditAmount > 0) {
                  <div class="min-w-0 bg-accent-soft px-3 py-3 xl:px-4 xl:py-3.5">
                    <dt class="eyebrow text-accent-text">{{ t().pos2.creditBig }}</dt>
                    <dd class="m-0"><ui-money class="num-xl block text-19 text-accent-text xl:text-[1.3125rem]" [value]="ls.receipt.totalWithInterest ?? ls.receipt.creditAmount" /></dd>
                  </div>
                } @else {
                  <div class="min-w-0 bg-accent-soft px-3 py-3 xl:px-4 xl:py-3.5">
                    <dt class="eyebrow text-accent-text">{{ t().pos2.changeBig }}</dt>
                    <dd class="m-0"><ui-money class="num-xl block text-22 text-accent-text xl:text-26" [value]="ls.receipt.change" /></dd>
                  </div>
                }
              </dl>
              @if (ls.receipt.dueDate) {
                <p class="num m-0 border-b border-line px-4 py-2.5 text-13 text-fg-secondary">
                  {{ t().pos2.dueLabel }}: <b class="text-fg">{{ dateText(ls.receipt.dueDate) }}</b>
                  @if (ls.receipt.installments && ls.receipt.installments.length > 1) {
                    · {{ ls.receipt.installments.length }} × {{ ls.receipt.installments[0].amount | currencyTr }}
                  }
                </p>
              }
              <div class="grid grid-cols-2 gap-2 px-4 py-3.5">
                <p-button styleClass="w-full min-h-[52px]" icon="pi pi-print" [label]="t().pos2.print" (onClick)="printLast()" aria-keyshortcuts="Enter" />
                <a [href]="waUrl()" target="_blank" rel="noopener"
                  class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-token-md border border-line-strong bg-surface px-3 text-sm font-semibold text-fg no-underline transition-colors hover:bg-surface-muted">
                  <i class="pi pi-whatsapp" aria-hidden="true"></i>{{ t().pos2.whatsapp }}
                </a>
                <button type="button" (click)="newSale()" aria-keyshortcuts="Escape"
                  class="col-span-2 inline-flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-token-md border-0 bg-accent px-3 text-15 font-bold text-accent-contrast transition-opacity hover:opacity-90">
                  <i class="pi pi-plus" aria-hidden="true"></i>{{ t().pos2.newSale }} <ui-kbd tone="inverse">Esc</ui-kbd>
                </button>
              </div>
              <div class="mx-4 mb-3.5 rounded-token-md border border-dashed border-line-strong bg-page px-3.5 py-3 font-mono text-12.5 leading-relaxed text-fg-secondary">
                <div class="text-center font-bold">{{ businessName() || t().pos.pageTitle }}</div>
                <div class="text-center">{{ dateTimeText(ls.receipt.date) }} · {{ ls.saleNumber }}</div>
                <div class="my-1 border-t border-dashed border-line-strong"></div>
                @for (i of ls.receipt.items; track $index) {
                  <div class="flex justify-between gap-3"><span class="truncate">{{ i.productName }} x{{ qtyNum(i.quantity) }}</span><span class="num shrink-0">{{ i.totalPrice | currencyTr: false }}</span></div>
                }
                <div class="my-1 border-t border-dashed border-line-strong"></div>
                <div class="flex justify-between gap-3 font-bold"><span>{{ t().pos2.total }}</span><span class="num">{{ ls.receipt.totalAmount | currencyTr: false }}</span></div>
              </div>
              <div class="flex flex-col gap-2 px-4 pb-3.5">
                <a [routerLink]="['/sales', ls.id]" class="text-center text-13.5 font-semibold text-brand-text no-underline hover:underline">{{ t().pos2.detail }}</a>
                <p-button styleClass="w-full" severity="danger" [outlined]="true" icon="pi pi-times" [label]="t().pos2.cancelSale"
                  [loading]="cancelling()" [disabled]="cancelling()" (onClick)="cancelLast()" />
              </div>
            </div>
          } @else {
            <header class="card-head shrink-0">
              <span class="card-head-icon bg-accent-soft text-accent-text"><i class="pi pi-shopping-cart text-15" aria-hidden="true"></i></span>
              <h2 class="!text-15">{{ t().pos2.cart }}</h2>
              <span class="num text-13 text-fg-muted">{{ t().pos2.lines(cart.items().length) }}</span>
              @if (cart.items().length) {
                <ui-icon-button class="ml-auto" icon="pi-trash" variant="ghost" size="sm" [ariaLabel]="t().pos.clearCart" (click)="clearCart()" />
              }
            </header>

            <!-- Müşteri kartı -->
            <div class="flex shrink-0 items-center gap-2.5 border-b border-line px-4 py-3">
              @if (selectedCustomer(); as c) {
                <ui-avatar [name]="c.firstName + ' ' + c.lastName" tone="accent" />
                <div class="min-w-0 flex-1">
                  <b class="block truncate text-14.5 font-bold text-fg">{{ c.firstName }} {{ c.lastName }}</b>
                  <span class="num block truncate text-12.5" [class]="customerOverLimit() ? 'font-semibold text-danger-text' : 'text-fg-muted'">
                    @if (c.balance > 0) { {{ t().pos2.debt }} {{ c.balance | currencyTr }} } @else { {{ t().pos2.noDebt }} }
                    @if (c.creditLimit) { · {{ t().pos2.limit }} {{ c.creditLimit | currencyTr }} }
                  </span>
                </div>
                <p-button [label]="t().pos2.change" severity="secondary" size="small" (onClick)="openCustomerDialog(false)" />
                <ui-icon-button icon="pi-times" size="sm" [ariaLabel]="t().pos.removeCustomer" (click)="clearCustomer()" />
              } @else if (cart.customerId()) {
                <ui-avatar [name]="cart.customerName() ?? ''" tone="accent" />
                <b class="min-w-0 flex-1 truncate text-14.5 font-bold text-fg">{{ cart.customerName() }}</b>
                <p-button [label]="t().pos2.change" severity="secondary" size="small" (onClick)="openCustomerDialog(false)" />
              } @else {
                <span class="grid h-10 w-10 shrink-0 place-items-center rounded-token-md bg-surface-muted text-fg-muted" aria-hidden="true"><i class="pi pi-user"></i></span>
                <span class="min-w-0 flex-1 truncate text-sm text-fg-secondary">{{ t().pos2.walkIn }}</span>
                <p-button [label]="t().pos.selectCustomer" severity="secondary" size="small" icon="pi pi-user-plus" (onClick)="openCustomerDialog(false)" />
              }
            </div>

            <!-- Kalemler -->
            <div class="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              @if (cart.items().length) {
                <ul class="m-0 list-none p-0">
                  @for (item of cart.items(); track item._tempId) {
                    @let dec = isDecimal(item.unit);
                    @let pills = linePills(item);
                    <li class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 gap-y-1.5 border-b border-line px-4 py-2.5 transition-colors duration-300"
                      [class.bg-brand-soft]="flashId() === item._tempId">
                      <div class="min-w-0">
                        <b class="line-clamp-2 text-14.5 font-semibold leading-snug text-fg">{{ item.productName }}</b>
                        <span class="num block text-13 text-fg-muted">
                          {{ item.unitPrice | currencyTr }} / {{ unitLabel(item.unit) }}
                          @if (item.discount > 0) {
                            · <span class="text-success-text">-{{ item.discountType === 'percent' ? '%' + item.discount : (item.discount | currencyTr) }}</span>
                          }
                          @if (item.requiresPrescription) {
                            · <span class="inline-flex items-center gap-1 font-semibold text-warning-text"><i class="pi pi-file-check text-11" aria-hidden="true"></i>{{ t().compliance.rxBadge }}</span>
                          }
                        </span>
                      </div>
                      <ui-money class="num-xl text-right text-base text-fg" [value]="item.totalPrice" [symbol]="false" />
                      <div class="col-span-2 flex items-center gap-2">
                        <div class="flex h-10 shrink-0 items-stretch overflow-hidden rounded-token-md border border-line-strong">
                          <button type="button" (click)="stepQty(item, -1)" [attr.aria-label]="t().pos.decrease + ': ' + item.productName"
                            class="grid w-10 cursor-pointer place-items-center border-0 bg-surface-muted text-fg-secondary hover:text-fg">
                            <i class="pi pi-minus text-xs" aria-hidden="true"></i>
                          </button>
                          <p-inputNumber #qtyInput [ngModel]="item.quantity" [inputId]="'qty-' + item._tempId"
                            [ariaLabel]="t().pos.quantity + ': ' + item.productName"
                            locale="tr-TR" [useGrouping]="false" [min]="0" [minFractionDigits]="0" [maxFractionDigits]="dec ? 2 : 0"
                            inputStyleClass="pos-qty num h-10 w-16 rounded-none border-0 bg-surface px-1 text-center text-15 font-bold shadow-none"
                            (onBlur)="applyQty(item, qtyInput)" (keydown.enter)="applyQty(item, qtyInput, true)" />
                          <span class="flex items-center bg-surface pl-0.5 pr-2.5 text-13 text-fg-muted">{{ unitLabel(item.unit) }}</span>
                          <button type="button" (click)="stepQty(item, 1)" [disabled]="item.quantity >= item.stock"
                            [attr.aria-label]="t().pos.increase + ': ' + item.productName"
                            class="grid w-10 cursor-pointer place-items-center border-0 bg-surface-muted text-fg-secondary hover:text-fg disabled:cursor-not-allowed disabled:opacity-40">
                            <i class="pi pi-plus text-xs" aria-hidden="true"></i>
                          </button>
                        </div>
                        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                          @for (pl of pills; track pl.text) {
                            <ui-status-badge size="sm" [tone]="pl.tone"><span class="num whitespace-nowrap">{{ pl.text }}</span></ui-status-badge>
                          }
                        </div>
                        <button type="button" (click)="removeItem(item)" [attr.aria-label]="t().pos.removeItem + ': ' + item.productName"
                          class="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-token-md border-0 bg-transparent text-fg-muted transition-colors hover:bg-danger-soft hover:text-danger-text">
                          <i class="pi pi-times" aria-hidden="true"></i>
                        </button>
                      </div>
                      @if (item.gtsNos?.length) {
                          <div class="col-span-2 flex flex-wrap gap-1">
                            @for (g of item.gtsNos ?? []; track g) {
                              <span class="inline-flex items-center gap-0.5 rounded-token-sm bg-info-soft py-0.5 pl-1.5 pr-0.5 font-mono text-11 text-info-text">
                                {{ g }}
                                <button type="button" (click)="removeGts(item, g)" [attr.aria-label]="t().compliance.gtsRemove + ': ' + g"
                                  class="grid h-6 w-6 cursor-pointer place-items-center rounded border-0 bg-transparent text-info-text hover:bg-surface-hover">
                                  <i class="pi pi-times text-[0.5625rem]" aria-hidden="true"></i>
                                </button>
                              </span>
                            }
                          </div>
                      }
                    </li>
                  }
                </ul>
              } @else {
                <ui-empty-state icon="pi-shopping-cart" tone="accent" [title]="t().pos.emptyCart" [description]="t().pos.emptyCartHint" />
              }
            </div>

            <!-- Toplamlar -->
            <div class="flex shrink-0 flex-col gap-1 border-y border-line bg-surface-muted px-4 py-2.5 text-sm text-fg-secondary">
              <div class="flex flex-wrap justify-between gap-x-3">
                <span>{{ t().pos2.subtotal }} <b class="num text-fg">{{ cart.subtotal() | currencyTr: false }}</b> ·
                  <button type="button" (click)="openDiscount()" [disabled]="!cart.items().length"
                    class="cursor-pointer border-0 bg-transparent p-0 text-sm text-fg-secondary underline-offset-2 hover:underline disabled:cursor-default disabled:no-underline">
                    {{ t().pos2.discount }}{{ cart.globalDiscountType() === 'percent' && cart.globalDiscount() > 0 ? ' %' + cart.globalDiscount() : '' }}
                  </button>&nbsp;
                  <b class="num" [class]="cart.totalDiscount() > 0 ? 'text-success-text' : 'text-fg'">{{ cart.totalDiscount() > 0 ? '-' : '' }}{{ cart.totalDiscount() | currencyTr: false }}</b>
                </span>
                <span>{{ t().pos2.vatIncluded }} <b class="num text-fg">{{ vatAmount() | currencyTr: false }}</b></span>
              </div>
              <div class="mt-1 flex items-baseline justify-between gap-3 border-t border-dashed border-line-strong pt-1.5 text-fg">
                <span class="font-display text-15 font-bold">{{ t().pos2.total }}</span>
                <ui-money class="num-xl text-[1.875rem] text-fg xl:text-[2.125rem]" [value]="cart.totalAmount()" />
              </div>
            </div>

            <!-- Ödeme -->
            <div class="grid shrink-0 grid-cols-3 gap-2 px-4 pt-3">
              <button type="button" (click)="pay('cash')" [disabled]="!canPay()" aria-keyshortcuts="F1"
                class="relative flex h-[66px] cursor-pointer flex-col items-center justify-center gap-1 rounded-token-lg border-0 bg-brand font-display text-base font-extrabold text-brand-contrast transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45">
                <ui-kbd tone="inverse" class="absolute left-2 top-[7px] hidden lg:inline-grid">F1</ui-kbd>
                <i class="pi pi-wallet text-xl" aria-hidden="true"></i>{{ t().pos.cash }}
              </button>
              <button type="button" (click)="pay('card')" [disabled]="!canPay()" aria-keyshortcuts="F2"
                class="relative flex h-[66px] cursor-pointer flex-col items-center justify-center gap-1 rounded-token-lg border border-side-line bg-side-2 font-display text-white text-base font-extrabold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45">
                <ui-kbd tone="inverse" class="absolute left-2 top-[7px] hidden lg:inline-grid">F2</ui-kbd>
                <i class="pi pi-credit-card text-xl" aria-hidden="true"></i>{{ t().pos.card }}
              </button>
              <button type="button" (click)="payCredit()" [disabled]="!canPay()" aria-keyshortcuts="F3"
                class="relative flex h-[66px] cursor-pointer flex-col items-center justify-center gap-1 rounded-token-lg border-0 bg-accent font-display text-base font-extrabold text-accent-contrast transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45">
                <ui-kbd tone="inverse" class="absolute left-2 top-[7px] hidden lg:inline-grid">F3</ui-kbd>
                <i class="pi pi-book text-xl" aria-hidden="true"></i>{{ t().pos.creditPayment }}
              </button>
            </div>
            <div class="grid shrink-0 grid-cols-3 gap-2 px-4 pb-3.5 pt-2">
              <p-button styleClass="w-full !h-10 !text-13.5" severity="secondary" icon="pi pi-percentage" [label]="t().pos2.discountBtn"
                [disabled]="!cart.items().length" (onClick)="openDiscount()" />
              <p-button styleClass="w-full !h-10 !text-13.5" severity="secondary" icon="pi pi-clock" [label]="t().pos2.hold"
                [disabled]="!cart.items().length" (onClick)="openHold()" />
              <p-button styleClass="w-full !h-10 !text-13.5" severity="secondary" icon="pi pi-users" [label]="t().pos2.customer"
                (onClick)="openCustomerDialog(false)" />
            </div>
          }
        </section>
      </div>

      <!-- Telefon: yapışkan sepet çubuğu -->
      @if (cart.items().length && !isDesktop() && !cartInView()) {
        <div class="sticky bottom-0 z-sticky -mx-3 -mb-3 flex items-center gap-2.5 border-t border-line-strong bg-surface px-3 pb-3 pt-2.5">
          <span class="num grid h-9 w-9 shrink-0 place-items-center rounded-token-md bg-accent-soft font-display text-15 font-extrabold text-accent-text">{{ cart.items().length }}</span>
          <div class="min-w-0">
            <ui-money class="num-xl block text-lg text-fg" [value]="cart.totalAmount()" />
            <span class="block truncate text-xs text-fg-muted">{{ cart.customerName() || t().pos2.walkIn }} · {{ t().pos2.lines(cart.items().length) }}</span>
          </div>
          <button type="button" (click)="scrollToCart()"
            class="ml-auto inline-flex h-[46px] shrink-0 cursor-pointer items-center gap-1.5 rounded-token-md border-0 bg-accent px-3.5 text-sm font-bold text-accent-contrast">
            {{ t().pos2.mobileCart }}<i class="pi pi-chevron-down text-xs" aria-hidden="true"></i>
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    :host ::ng-deep .pos-qty:focus { box-shadow: none; outline: 2px solid var(--brand); outline-offset: -2px; }
  `,
})
export class PosPage implements OnInit, AfterViewInit {
  readonly cart = inject(CartStore);
  readonly productStore = inject(ProductStore);
  private readonly customerSvc = inject(CustomerService);
  private readonly saleSvc = inject(SaleService);
  private readonly salesQuery = inject(SalesQueryService);
  private readonly messageSvc = inject(MessageService);
  private readonly confirmSvc = inject(ConfirmationService);
  private readonly logger = inject(LoggerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly printer = inject(ReceiptPrinterService);
  private readonly receiptBusiness = inject(ReceiptBusinessService);
  private readonly lang = inject(LangService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  readonly settings = inject(TenantSettingsService);
  readonly t = this.lang.t;

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  // ---- Ekran ----
  private readonly windowWidth = signal(window.innerWidth);
  readonly isDesktop = computed(() => this.windowWidth() >= 1024);
  readonly cartInView = signal(false);

  @HostListener('window:resize')
  onResize(): void { this.windowWidth.set(window.innerWidth); }

  // ---- Durum ----
  readonly customers = signal<CustomerWithLinks[]>([]);
  /** Satış kaydedilirken tüm ödeme butonları kilitli (1.3). */
  readonly saving = signal(false);
  readonly cancelling = signal(false);
  /** Son tamamlanan satış — sepet boşken özet + fiş. */
  readonly lastSale = signal<CompletedSale | null>(null);
  readonly showDone = computed(() => (this.cart.items().length ? null : this.lastSale()));
  readonly flashId = signal<string | null>(null);
  readonly liveMessage = signal('');
  readonly businessName = signal('');
  private flashTimer: ReturnType<typeof setTimeout> | null = null;

  readonly cashierName = computed(() => this.auth.currentUser()?.displayName || this.auth.currentUser()?.email || '—');
  readonly receiptLabel = computed(() => {
    const ls = this.showDone();
    return ls ? `${this.t().pos2.receipt} ${ls.saleNumber}` : this.t().pos2.newReceipt;
  });

  // ---- Dialoglar ----
  readonly showCash = signal(false);
  readonly showCard = signal(false);
  readonly showCredit = signal(false);
  readonly showCustomer = signal(false);
  readonly showDiscount = signal(false);
  readonly showRx = signal(false);
  readonly showHold = signal(false);
  readonly showHeld = signal(false);
  private readonly anyDialog = computed(() =>
    this.showCash() || this.showCard() || this.showCredit() || this.showCustomer() || this.showDiscount() || this.showRx()
    || this.showHold() || this.showHeld());
  private pendingCredit = false;

  // ---- E-reçete ----
  readonly rxNo = signal('');
  readonly rxPrescriber = signal('');
  /** E-reçete sonrası açılacak ödeme. */
  private pendingPayment: 'cash' | 'card' | 'credit' | null = null;
  /** 'warn' modunda kullanıcı "reçetesiz devam" dedi (sepet temizlenince sıfırlanır). */
  private rxSkipped = false;
  /** /pos?customer=<id> ile gelen, müşteri listesi yüklenince seçilecek müşteri. */
  private pendingCustomerId: string | null = null;

  /** Sepetteki e-reçeteli ürünlerin adları. */
  readonly rxProductNames = computed(() => this.cart.items().filter(i => i.requiresPrescription).map(i => i.productName));
  readonly rxNoValid = computed(() => isValidPrescriptionNo(this.rxNo()));
  readonly rxReady = computed(() =>
    this.settings.prescriptionMode() !== 'required' || (!!this.cart.customerId() && this.rxNoValid()));

  // ---- Arama ----
  readonly query = signal('');
  readonly activeIndex = signal(0);
  readonly searchFocused = signal(false);
  /** Arama kutusu dışında bir form alanı odakta mı (okuyucu oraya yazar). */
  private readonly otherFieldFocused = signal(false);
  readonly scannerReady = computed(() => !this.anyDialog() && (this.searchFocused() || !this.otherFieldFocused()));

  private readonly productsById = computed(() => new Map(this.productStore.products().map(p => [p.id, p])));

  private readonly indexed = computed<IndexedProduct[]>(() =>
    this.productStore.products()
      .filter(p => p.isActive !== false)
      .map(p => {
        const name = (p.name ?? '').toLocaleLowerCase('tr');
        const codes = [p.barcode, ...(p.batches ?? []).map(b => b.gtsNo)].filter((c): c is string => !!c);
        const hay = [name, (p.brand ?? '').toLocaleLowerCase('tr'), (p.category ?? '').toLocaleLowerCase('tr'), ...codes].join(' ');
        return { p, name, hay, codes };
      })
      .sort((a, b) => Number(b.p.stock > 0) - Number(a.p.stock > 0) || a.name.localeCompare(b.name, 'tr')),
  );

  private readonly matches = computed<Product[]>(() => {
    const q = this.query().trim().toLocaleLowerCase('tr');
    const all = this.indexed();
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    const scored: { p: Product; s: number }[] = [];
    for (const x of all) {
      if (!tokens.every(tk => x.hay.includes(tk))) continue;
      const s = x.codes.includes(q) ? 0
        : x.name.startsWith(q) ? 1
        : x.name.split(/\s+/).some(w => w.startsWith(tokens[0])) ? 2
        : x.name.includes(tokens[0]) ? 3 : 4;
      scored.push({ p: x.p, s });
    }
    // stokta olanlar önce (Enter ilk sonucu ekler)
    return scored.sort((a, b) => Number(b.p.stock > 0) - Number(a.p.stock > 0) || a.s - b.s).map(x => x.p);
  });
  readonly matchCount = computed(() => this.matches().length);
  readonly results = computed(() => this.matches().slice(0, RESULT_LIMIT));

  readonly cartQty = computed(() => new Map(this.cart.items().map(i => [i.productId, i.quantity])));
  readonly canPay = computed(() => this.cart.items().length > 0 && !this.saving());

  // ---- Sık satılanlar ----
  /** Son 30 günde kaç satışta geçtiği (productId → adet). */
  private readonly saleCounts = signal<Map<string, number>>(new Map());
  readonly favFilter = signal<FavFilter>('all');
  readonly favFilters = computed<UiSegmentOption<FavFilter>[]>(() => {
    const c = this.t().pos2.categories;
    return [
      { value: 'all', label: this.t().pos2.favAll },
      { value: 'gubre', label: c.gubre },
      { value: 'bitki_koruma', label: c.bitki_koruma },
      { value: 'tohum', label: c.tohum },
      { value: 'fide', label: c.fide },
    ];
  });
  readonly favorites = computed<Product[]>(() => {
    const f = this.favFilter();
    const counts = this.saleCounts();
    const list = this.indexed()
      .map(x => x.p)
      .filter(p => p.stock > 0 && (f === 'all' || productTypeOf(p) === f));
    return list
      .map(p => ({ p, n: counts.get(p.id) ?? 0 }))
      .sort((a, b) => b.n - a.n || a.p.name.localeCompare(b.p.name, 'tr'))
      .slice(0, FAVORITE_LIMIT)
      .map(x => x.p);
  });

  // ---- Müşteri ----
  readonly selectedCustomer = computed<CustomerWithLinks | null>(() => {
    const id = this.cart.customerId();
    return id ? this.customers().find(c => c.id === id) ?? null : null;
  });
  readonly customerOverLimit = computed(() => {
    const c = this.selectedCustomer();
    return !!c?.creditLimit && (c.balance ?? 0) >= c.creditLimit;
  });

  // ---- KDV (fiyatlar KDV dahil; genel iskonto oransal dağıtılır) ----
  readonly vatAmount = computed(() => {
    const items = this.cart.items();
    const afterItems = round2(this.cart.subtotal() - this.cart.itemsDiscount());
    if (!items.length || afterItems <= 0) return 0;
    const factor = this.cart.totalAmount() / afterItems;
    const byId = this.productsById();
    let vat = 0;
    for (const i of items) {
      const rate = Number(byId.get(i.productId)?.vatRate) || 0;
      if (rate > 0) vat += (i.totalPrice * factor * rate) / (100 + rate);
    }
    return round2(vat);
  });

  /** Ödeme dialogu açılırken sepet toplamı (kayıt sırasında sepet temizlenince dialog 0 göstermesin). */
  readonly payTotal = signal(0);

  // ---- Nakit ----
  readonly cashAmount = signal<number | null>(null);
  private readonly receivedCash = computed(() => {
    const v = Number(this.cashAmount());
    return v > 0 ? round2(v) : this.payTotal();
  });
  /** Nakit eksik kalan tutar (1.4). */
  readonly cashShortfall = computed(() => round2(Math.max(0, this.payTotal() - this.receivedCash())));
  readonly cashChange = computed(() => round2(Math.max(0, this.receivedCash() - this.payTotal())));

  readonly cardQuestion = computed(() =>
    this.t().pos.cardConfirmQuestion.replace('{amount}', `₺${this.money(this.payTotal(), false)}`));

  // ---- Veresiye ----
  readonly installmentOptions = INSTALLMENT_OPTIONS;
  readonly todayInput = toDateInput(new Date());
  readonly creditMode = signal<CreditMode>('installment');
  readonly creditRate = signal(0);
  readonly creditCount = signal(1);
  readonly creditDown = signal(0);
  readonly creditInterval = signal(1);
  readonly creditFirstDue = signal('');
  readonly creditHarvest = signal('');
  readonly creditModes = computed<UiSegmentOption<CreditMode>[]>(() => [
    { value: 'installment', label: this.t().pos2.modeInstallment, icon: 'pi-calendar' },
    { value: 'harvest', label: this.t().pos2.modeHarvest, icon: 'pi-sun' },
  ]);
  readonly intervalOptions = computed<UiSegmentOption<number>[]>(() =>
    [1, 2, 3].map(n => ({ value: n, label: this.t().pos2.months(n) })));
  private readonly creditDueDate = computed(() =>
    fromDateInput(this.creditMode() === 'harvest' ? this.creditHarvest() : this.creditFirstDue()));
  readonly creditDueValid = computed(() => {
    const d = this.creditDueDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return !!d && d.getTime() >= today.getTime();
  });
  readonly creditCalc = computed(() => buildCreditPlan({
    total: this.payTotal(),
    rate: this.creditRate() || 0,
    downPayment: this.creditDown() || 0,
    count: this.creditMode() === 'harvest' ? 1 : this.creditCount(),
    firstDueDate: this.creditDueDate() ?? addMonths(new Date(), 1),
    intervalMonths: this.creditInterval(),
  }));
  readonly creditLimit = computed(() => {
    const c = this.selectedCustomer();
    return c ? CreditService.checkCreditLimit(c, this.creditCalc().financed) : null;
  });

  // ---- İndirim ----
  readonly discountType = signal<DiscountType>('percent');
  readonly discountValue = signal(0);
  readonly discountTypes = computed<UiSegmentOption<DiscountType>[]>(() => [
    { value: 'percent', label: this.t().pos.discountPercent },
    { value: 'amount', label: this.t().pos.discountAmount },
  ]);

  // ---- Beklet ----
  readonly held = signal<HeldCart[]>(loadHeldCarts());
  readonly holdName = signal('');

  // ---- Müşteri arama ----
  readonly customerSearch = signal('');
  readonly filteredCustomers = computed(() => {
    const q = this.customerSearch().trim().toLocaleLowerCase('tr');
    const list = this.customers();
    if (!q) return list;
    return list.filter(c =>
      `${c.firstName} ${c.lastName}`.toLocaleLowerCase('tr').includes(q) || (c.phone ?? '').includes(q)
      || (c.village ?? '').toLocaleLowerCase('tr').includes(q));
  });

  readonly waUrl = computed(() => {
    const ls = this.lastSale();
    if (!ls) return '';
    const r = ls.receipt;
    const credit = r.creditAmount > 0 ? `₺${this.money(r.totalWithInterest ?? r.creditAmount, false)}` : null;
    const text = this.t().pos2.waText(this.businessName(), ls.saleNumber, `₺${this.money(r.totalAmount, false)}`, credit);
    const phone = ls.customerPhone ?? null;
    return whatsappLink(phone, text);
  });

  ngOnInit(): void {
    this.productStore.ensureLoaded();
    this.settings.ensureLoaded();
    // "Bu müşteriye satış" kısayolu: /pos?customer=<id>
    this.pendingCustomerId = this.route.snapshot.queryParamMap.get('customer');
    // fiş başlığını önceden önbelleğe al
    this.receiptBusiness.get().then(b => this.businessName.set(b.name)).catch(() => undefined);
    this.customerSvc.getAll$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: c => {
          this.customers.set(c as CustomerWithLinks[]);
          this.applyPendingCustomer();
        },
        error: err => this.logger.error('POS customers load failed', err),
      });
    this.loadSaleCounts();
    this.destroyRef.onDestroy(() => { if (this.flashTimer) clearTimeout(this.flashTimer); });
  }

  ngAfterViewInit(): void {
    this.focusSearch();
    // Telefon: sepet ekrandayken yapışkan sepet çubuğu gizlenir
    const cartEl = document.getElementById('pos-cart');
    if (cartEl && typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(([e]) => this.cartInView.set(e.isIntersecting), { threshold: 0.25 });
      io.observe(cartEl);
      this.destroyRef.onDestroy(() => io.disconnect());
    }
  }

  /** Sık satılanlar: son 30 günün satışlarında ürünün geçtiği satış sayısı (bir kez okunur). */
  private loadSaleCounts(): void {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * DAY);
    this.salesQuery.getRange$(start, end)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: sales => {
          const m = new Map<string, number>();
          for (const s of sales) {
            if (s.status !== 'completed') continue;
            for (const i of s.items ?? []) m.set(i.productId, (m.get(i.productId) ?? 0) + 1);
          }
          this.saleCounts.set(m);
        },
        error: err => this.logger.warn('POS best sellers load failed', err),
      });
  }

  // ================= Odak / klavye =================

  @HostListener('document:focusin', ['$event'])
  onFocusIn(e: FocusEvent): void {
    const el = e.target as HTMLElement | null;
    const tag = el?.tagName;
    const isField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el?.isContentEditable;
    this.otherFieldFocused.set(isField && el?.id !== 'pos-search');
  }

  @HostListener('document:focusout')
  onFocusOut(): void { this.otherFieldFocused.set(false); }

  /** F1 nakit · F2 kart · F3 veresiye · F4 arama; satış özetinde Enter fiş, Esc yeni satış (dialog açıkken çalışmaz). */
  @HostListener('document:keydown', ['$event'])
  onHotkey(e: KeyboardEvent): void {
    if (this.anyDialog() || e.ctrlKey || e.altKey || e.metaKey) return;
    if (document.querySelector('.p-dialog-mask')) return;
    const map: Record<string, () => void> = {
      F1: () => this.pay('cash'),
      F2: () => this.pay('card'),
      F3: () => this.payCredit(),
      F4: () => this.searchInput()?.nativeElement.focus(),
    };
    if (this.showDone() && !this.query().trim()) {
      const target = e.target as HTMLElement | null;
      const onControl = !!target && target.id !== 'pos-search' && /^(BUTTON|A|INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if (e.key === 'Escape') map['Escape'] = () => this.newSale();
      if (e.key === 'Enter' && !onControl) map['Enter'] = () => this.printLast();
    }
    const fn = map[e.key];
    if (!fn) return;
    e.preventDefault();
    fn();
  }

  /** Masaüstünde odağı arama kutusuna geri ver (barkod okuyucu oraya yazar). Mobilde klavye açmamak için yapmaz. */
  focusSearch(): void {
    if (!this.isDesktop()) return;
    setTimeout(() => {
      if (this.anyDialog()) return;
      this.searchInput()?.nativeElement.focus();
    });
  }

  focusById(id: string, select = false, delay = 30): void {
    setTimeout(() => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      el?.focus();
      if (select) el?.select?.();
    }, delay);
  }

  scrollToCart(): void {
    document.getElementById('pos-cart')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  onQuery(v: string): void {
    this.query.set(v ?? '');
    this.activeIndex.set(0);
  }

  clearSearch(): void {
    this.onQuery('');
    this.focusSearch();
  }

  onSearchKeydown(e: KeyboardEvent): void {
    const n = this.results().length;
    switch (e.key) {
      case 'ArrowDown':
        if (!n) return;
        e.preventDefault();
        this.moveActive(Math.min(n - 1, this.activeIndex() + 1));
        break;
      case 'ArrowUp':
        if (!n) return;
        e.preventDefault();
        this.moveActive(Math.max(0, this.activeIndex() - 1));
        break;
      case 'Enter':
        if (!this.query().trim()) return; // satış özetinde Enter = fiş (onHotkey)
        e.preventDefault();
        e.stopPropagation();
        this.submitSearch();
        break;
      case 'Escape':
        if (this.query()) {
          e.preventDefault();
          e.stopPropagation();
          this.onQuery('');
        }
        break;
    }
  }

  private moveActive(i: number): void {
    this.activeIndex.set(i);
    document.getElementById(`pos-opt-${i}`)?.scrollIntoView({ block: 'nearest' });
  }

  /** Enter: tam barkod/GTS eşleşmesi → o ürün; değilse seçili sonuç. */
  private submitSearch(): void {
    const raw = this.query().trim();
    if (!raw) return;
    const hit = findByCode(this.productStore.products(), raw);
    if (hit) {
      this.addProduct(hit.product, hit.gtsNo);
      return;
    }
    const target = this.results()[this.activeIndex()] ?? null;
    if (!target) {
      this.toast(`${this.t().pos.barcodeNotFound}: ${raw}`, 'warn');
      this.searchInput()?.nativeElement.select();
      return;
    }
    this.addProduct(target);
  }

  // ================= Sepet =================

  unitOf(p: Product): SaleUnit | null { return productUnit(p); }
  isDecimal(unit: SaleUnit | null | undefined): boolean { return isDecimalUnit(unit); }
  unitLabel(unit: SaleUnit | null | undefined): string { return this.t().pos.units[unit ?? 'adet']; }
  qtyText(q: number, unit: SaleUnit | null | undefined): string {
    return `${formatQty(q, this.lang.lang())} ${this.unitLabel(unit)}`;
  }
  qtyNum(q: number): string { return formatQty(q, this.lang.lang()); }
  kindIcon(p: Product): string { return KIND_ICON[productTypeOf(p) as ProductKind] ?? 'pi-box'; }

  /** Satır rozetleri: kalan stok (az/son) ve yaklaşan SKT. */
  linePills(item: CartItem): LinePill[] {
    const p = this.productsById().get(item.productId);
    const pills: LinePill[] = [];
    const left = item.stock;
    const min = p?.minStock || 0;
    const text = formatQty(left, this.lang.lang());
    if (item.quantity >= left) pills.push({ tone: 'danger', text: this.t().pos2.lowStock(text) });
    else if (left - item.quantity <= min) pills.push({ tone: 'warning', text: this.t().pos2.lowStock(text) });
    else pills.push({ tone: 'success', text: this.t().pos2.stockPill(text) });
    const exp = p ? expiryInfo(p.batches).nearestValid : null;
    const ms = exp?.toMillis?.();
    if (ms != null) {
      const days = Math.ceil((ms - Date.now()) / DAY);
      if (days <= this.settings.expiryWarnDays()) pills.push({ tone: 'warning', text: this.t().pos2.expiryDays(Math.max(0, days)) });
    }
    return pills;
  }

  /**
   * Ürünü sepete ekle. `gtsNo` verilirse (GTS/karekod okutuldu) o birim kaleme yazılır ve satışta o parti düşer.
   * Bitki koruma ürününde SKT'si geçmiş birim eklenemez (engel).
   */
  addProduct(product: Product, gtsNo: string | null = null): void {
    if (product.stock <= 0) {
      this.toast(`${product.name}: ${this.t().pos.outOfStock}`, 'warn');
      this.focusSearch();
      return;
    }
    const plantProtection = isPlantProtection(product);
    if (gtsNo && plantProtection) {
      const b = (product.batches ?? []).find(x => x.gtsNo === gtsNo);
      if (b && isBatchExpired(b)) {
        this.onQuery('');
        this.toast(`${product.name}: ${this.t().compliance.expiredBlocked} (${gtsNo})`, 'error');
        this.focusSearch();
        return;
      }
    }
    const unit = productUnit(product);
    const isNew = !this.cart.items().some(i => i.productId === product.id);
    const draft = cartItemFromProduct(product, gtsNo);
    if (draft.stock <= 0 && plantProtection) {
      this.onQuery('');
      this.toast(`${product.name}: ${this.t().compliance.expiredBlocked}`, 'error');
      this.focusSearch();
      return;
    }
    const result = this.cart.addItem(draft);
    this.onQuery('');
    if (result === 'added') {
      this.lastSale.set(null);
      const item = this.cart.items().find(i => i.productId === product.id);
      if (item) this.flash(item._tempId);
      this.liveMessage.set(`${product.name} ${this.t().pos.added}`);
      // kg / lt / metre: miktarı hemen yazabilmek için miktar kutusuna geç
      if (isNew && item && isDecimalUnit(unit) && this.isDesktop()) {
        this.focusById(`qty-${item._tempId}`, true);
        return;
      }
    } else if (result === 'limit') {
      this.toast(`${product.name}: ${this.t().pos.stockLimit}`, 'warn');
    } else if (result === 'duplicate') {
      this.toast(`${this.t().compliance.gtsAlreadyInCart}: ${gtsNo}`, 'warn');
    } else {
      this.toast(`${product.name}: ${this.t().pos.outOfStock}`, 'warn');
    }
    this.focusSearch();
  }

  onBarcodeDetected(barcode: string): void {
    const hit = findByCode(this.productStore.products(), barcode);
    if (!hit) {
      this.toast(`${this.t().pos.barcodeNotFound}: ${barcode}`, 'warn');
      return;
    }
    this.addProduct(hit.product, hit.gtsNo);
  }

  removeGts(item: CartItem, gtsNo: string): void {
    this.cart.removeGts(item._tempId, gtsNo);
  }

  stepQty(item: CartItem, delta: number): void {
    const res = this.cart.updateQuantity(item._tempId, item.quantity + delta);
    if (res === 'clamped') this.toast(`${item.productName}: ${this.t().pos.stockLimit}`, 'warn');
    this.focusSearch();
  }

  /** Miktar kutusu: Enter / blur ile uygula; stok sınırına indirildiyse kutuyu düzelt. */
  applyQty(item: CartItem, input: InputNumber, refocus = false): void {
    const current = this.cart.items().find(i => i._tempId === item._tempId);
    if (!current) return;
    const typed = input.value ?? 0;
    if (typed !== current.quantity) {
      const res = this.cart.updateQuantity(item._tempId, typed);
      const after = this.cart.items().find(i => i._tempId === item._tempId);
      if (res === 'clamped') this.toast(`${item.productName}: ${this.t().pos.stockLimit}`, 'warn');
      if (after) this.syncQtyInput(input, after);
    }
    if (refocus) this.focusSearch();
  }

  private syncQtyInput(input: InputNumber, item: CartItem): void {
    input.writeValue(item.quantity);
    const el = document.getElementById(`qty-${item._tempId}`) as HTMLInputElement | null;
    if (el) {
      el.value = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2, useGrouping: false }).format(item.quantity);
    }
  }

  removeItem(item: CartItem): void {
    this.cart.removeItem(item._tempId);
    this.focusSearch();
  }

  clearCart(): void {
    this.cart.clearCart();
    this.rxSkipped = false;
    this.focusSearch();
  }

  private flash(tempId: string): void {
    this.flashId.set(tempId);
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.flashId.set(null), 900);
  }

  // ================= İndirim =================

  openDiscount(): void {
    if (!this.cart.items().length) return;
    this.discountType.set(this.cart.globalDiscountType());
    this.discountValue.set(this.cart.globalDiscount());
    this.showDiscount.set(true);
  }

  applyDiscount(): void {
    this.cart.setGlobalDiscount(this.discountValue() || 0, this.discountType());
    this.showDiscount.set(false);
  }

  removeDiscount(): void {
    this.cart.setGlobalDiscount(0, this.discountType());
    this.showDiscount.set(false);
  }

  // ================= Beklet =================

  openHold(): void {
    if (!this.cart.items().length) return;
    this.held.set(loadHeldCarts());
    if (this.held().length >= MAX_HELD_CARTS) {
      this.toast(this.t().pos2.holdFull(MAX_HELD_CARTS), 'warn');
      return;
    }
    this.holdName.set(this.cart.customerName() ?? `${this.t().pos2.cart} ${this.held().length + 1}`);
    this.showHold.set(true);
  }

  confirmHold(): void {
    const name = this.holdName().trim() || `${this.t().pos2.cart} ${this.held().length + 1}`;
    const res = holdCart(name, this.cart.snapshot());
    if (!res.ok) {
      this.toast(res.reason === 'full' ? this.t().pos2.holdFull(MAX_HELD_CARTS) : this.t().pos2.holdFailed, 'warn');
      return;
    }
    this.cart.clearCart();
    this.rxSkipped = false;
    this.held.set(loadHeldCarts());
    this.showHold.set(false);
    this.toast(this.t().pos2.holdOk(res.cart.name), 'success');
  }

  openHeldList(): void {
    this.held.set(loadHeldCarts());
    this.showHeld.set(true);
  }

  heldTotal(h: HeldCart): number {
    return round2(h.state.items.reduce((s, i) => s + (i.totalPrice || 0), 0));
  }

  /** Bekleyen sepeti geri çağır; stoklar güncel ürün verisine göre yenilenir (stok sınırı korunur). */
  resumeHeld(h: HeldCart): void {
    if (this.cart.items().length) {
      this.toast(this.t().pos2.resumeBusy, 'warn');
      return;
    }
    const taken = takeHeldCart(h.id);
    this.held.set(loadHeldCarts());
    if (!taken) return;
    const byId = this.productsById();
    const items = taken.state.items
      .map(i => {
        const p = byId.get(i.productId);
        if (!p) return i;
        const stock = cartItemFromProduct(p).stock;
        return { ...i, stock, quantity: Math.min(i.quantity, stock) };
      })
      .filter(i => i.quantity > 0);
    this.cart.restore({ ...taken.state, items });
    this.lastSale.set(null);
    this.rxSkipped = false;
    this.showHeld.set(false);
    this.toast(this.t().pos2.resumed(taken.name), 'success');
  }

  deleteHeld(h: HeldCart): void {
    removeHeldCart(h.id);
    this.held.set(loadHeldCarts());
  }

  // ================= Müşteri =================

  openCustomerDialog(pendingCredit: boolean): void {
    this.pendingCredit = pendingCredit;
    this.customerSearch.set('');
    this.showCustomer.set(true);
  }

  selectCustomer(c: Customer): void {
    const pending = this.pendingCredit;
    this.pendingCredit = false;
    this.cart.setCustomer(c.id, `${c.firstName} ${c.lastName}`);
    this.showCustomer.set(false);
    this.customerSearch.set('');
    if (pending) this.pay('credit');
  }

  /** /pos?customer=<id>: müşteri listesi gelince sepete müşteriyi yaz (bir kez). */
  private applyPendingCustomer(): void {
    const id = this.pendingCustomerId;
    if (!id) return;
    const c = this.customers().find(x => x.id === id);
    if (!c) return;
    this.pendingCustomerId = null;
    this.cart.setCustomer(c.id, `${c.firstName} ${c.lastName}`);
    this.liveMessage.set(`${this.t().sales.customer}: ${c.firstName} ${c.lastName}`);
  }

  /** Reçeteli satış kaydı için müşterinin kimlik bilgileri (satış anındaki kopya). */
  private customerIds(): { tcNo: string | null; cksNo: string | null } {
    const c = this.selectedCustomer();
    return { tcNo: c?.tcNo || null, cksNo: c?.cksNo || null };
  }

  // ================= E-reçete =================

  /** Ödemeden önce e-reçete gerekiyorsa dialogu açar ve true döner (ödeme dialogdan sonra açılır). */
  private needsRxPrompt(method: 'cash' | 'card' | 'credit'): boolean {
    const check = checkPrescription({
      mode: this.settings.prescriptionMode(),
      hasPrescriptionItems: this.rxProductNames().length > 0,
      customerId: this.cart.customerId(),
      prescriptionNo: this.cart.prescriptionNo(),
    });
    if (!check.needed || !check.missing.length) return false;
    if (this.rxSkipped && !check.blocking.length) return false;
    this.openRx(method);
    return true;
  }

  private openRx(method: 'cash' | 'card' | 'credit' | null): void {
    this.pendingPayment = method;
    this.rxNo.set(this.cart.prescriptionNo() ?? '');
    this.rxPrescriber.set(this.cart.prescriberName() ?? '');
    this.showRx.set(true);
  }

  confirmRx(): void {
    if (!this.rxReady()) {
      if (!this.cart.customerId()) this.toast(this.t().compliance.rxNeedsCustomer, 'warn');
      else if (!this.rxNoValid()) this.toast(this.t().compliance.rxNoInvalid, 'warn');
      return;
    }
    this.cart.setPrescription(this.rxNoValid() ? normalizePrescriptionNo(this.rxNo()) : '', this.rxPrescriber());
    if (!this.rxNoValid()) this.rxSkipped = true;
    this.continueAfterRx();
  }

  /** Yalnızca 'warn' modunda: e-reçetesiz devam (bayinin sorumluluğunda). */
  skipRx(): void {
    if (this.settings.prescriptionMode() !== 'warn') return;
    this.rxSkipped = true;
    if (this.rxNoValid()) this.cart.setPrescription(normalizePrescriptionNo(this.rxNo()), this.rxPrescriber());
    this.continueAfterRx();
  }

  private continueAfterRx(): void {
    const method = this.pendingPayment;
    this.pendingPayment = null;
    this.showRx.set(false);
    if (method === 'credit') this.payCredit();
    else if (method) this.pay(method);
  }

  onRxHide(): void {
    this.pendingPayment = null;
    this.focusSearch();
  }

  selectFirstCustomer(): void {
    const first = this.filteredCustomers()[0];
    if (first) this.selectCustomer(first);
  }

  /** Müşteri dialogu seçim yapılmadan kapanırsa bekleyen veresiye bayrağını sıfırla (2.7). */
  onCustomerDialogHide(): void {
    this.pendingCredit = false;
    this.customerSearch.set('');
    this.focusSearch();
  }

  clearCustomer(): void {
    this.cart.setCustomer(null, null);
    this.focusSearch();
  }

  // ================= Ödeme =================

  payCredit(): void {
    if (!this.canPay()) return;
    if (!this.cart.customerId()) {
      this.openCustomerDialog(true);
      return;
    }
    this.pay('credit');
  }

  pay(method: 'cash' | 'card' | 'credit'): void {
    if (!this.canPay()) return;
    if (this.needsRxPrompt(method)) return;
    this.payTotal.set(this.cart.totalAmount());
    if (method === 'cash') {
      this.cashAmount.set(this.cart.totalAmount());
      this.showCash.set(true);
    } else if (method === 'card') {
      this.showCard.set(true);
    } else {
      this.creditMode.set('installment');
      this.creditRate.set(0);
      this.creditCount.set(1);
      this.creditDown.set(0);
      this.creditInterval.set(1);
      // İlk vade önerisi: Ayarlar → Veresiye "varsayılan vade" (gün)
      const due = new Date();
      due.setDate(due.getDate() + this.settings.credit().defaultDueDays);
      this.creditFirstDue.set(toDateInput(due));
      this.creditHarvest.set(toDateInput(addMonths(new Date(), 3)));
      this.showCredit.set(true);
    }
  }

  setCreditMode(m: CreditMode | null): void {
    this.creditMode.set(m ?? 'installment');
  }

  setCash(v: number | null): void {
    this.cashAmount.set(v);
    this.focusById('cash-received', true);
  }

  async confirmCashPayment(): Promise<void> {
    if (this.saving()) return;
    const amount = this.receivedCash();
    const shortfall = this.cashShortfall();
    if (shortfall > 0 && !this.cart.customerId()) {
      // Müşteri yoksa eksik ödeme ile satış tamamlanmaz
      this.toast(this.t().pos.creditNeedsCustomer, 'warn');
      return;
    }
    // Eksik tutar varsa kalan veresiyeye yazılır (cart.creditAmount > 0)
    this.cart.setPayment(shortfall > 0 ? 'mixed' : 'cash', amount, 0);
    if (await this.completeSale()) this.showCash.set(false);
  }

  async confirmCardPayment(): Promise<void> {
    if (this.saving()) return;
    this.payTotal.set(this.cart.totalAmount());
    this.cart.setPayment('card', 0, this.cart.totalAmount());
    if (await this.completeSale()) this.showCard.set(false);
  }

  /**
   * Veresiye: peşinat nakit tahsil edilmiş sayılır (cashPaid), kalan + vade farkı borç kaydına
   * taksit planıyla yazılır (CreditService.buildInstallmentPlan). Limit aşımı uyarıdır, engel değil.
   */
  async confirmCreditPayment(): Promise<void> {
    if (this.saving()) return;
    if (!this.cart.customerId()) {
      this.showCredit.set(false);
      this.payCredit();
      return;
    }
    if (!this.creditDueValid()) {
      this.toast(this.t().pos2.dueRequired, 'warn');
      return;
    }
    const calc = this.creditCalc();
    if (calc.financed <= 0) return;
    const rate = this.creditRate() || 0;
    const count = calc.plan.installments.length;
    this.cart.setPayment(calc.downPayment > 0 ? 'mixed' : 'credit', calc.downPayment, 0);
    const ok = await this.completeSale({
      interestRate: rate || null,
      installmentCount: count > 1 ? count : null,
      installmentAmount: count > 1 ? calc.plan.installments[0].amount : null,
      // vade farkı varsa: veresiye + vade farkı (raporda vade farkı = bu − creditAmount)
      totalWithInterest: calc.interest > 0 ? calc.financed : null,
      plan: {
        financed: calc.financed,
        dueDate: calc.plan.dueDate,
        installments: calc.plan.installments,
        downPayment: calc.downPayment,
      },
    });
    if (ok) this.showCredit.set(false);
  }

  private async completeSale(creditOptions?: CreditOptions): Promise<boolean> {
    if (this.saving()) return false;
    this.saving.set(true);
    const customer = this.selectedCustomer();
    const options = {
      customerIds: this.customerIds(),
      // müşteri listesi yüklüyse farmerId biliniyor (yoksa servis müşteri dokümanından okur)
      ...(customer ? { farmerId: customer.farmerId ?? null } : {}),
    };
    try {
      let result: CompletedSale;
      try {
        result = await this.saleSvc.completeSale(creditOptions, options);
      } catch (err) {
        if (!(err instanceof SaleNeedsConfirmationError)) throw err;
        if (!(await this.confirmWarnings(err.warnings))) return false;
        result = await this.saleSvc.completeSale(creditOptions, { ...options, confirmed: true });
      }
      this.rxSkipped = false;
      this.lastSale.set({ ...result, customerPhone: customer?.phone ?? null });
      this.liveMessage.set(`${this.t().pos.saleCompleted} ${result.saleNumber}`);
      if (!this.isDesktop()) setTimeout(() => this.scrollToCart(), 50);
      return true;
    } catch (err) {
      this.logger.error('completeSale error', err);
      if (err instanceof InsufficientStockError) {
        this.toast(`${this.t().pos.insufficientStock}: ${err.productName} (-${err.missing})`, 'error');
      } else if (err instanceof ProductNotFoundError) {
        this.toast(`${this.t().pos.productUnavailable}: ${err.productName}`, 'error');
      } else if (err instanceof PrescriptionRequiredError) {
        this.toast(`${this.t().compliance.rxRequiredError}: ${err.productNames.join(', ')}`, 'error');
        this.showCash.set(false);
        this.showCard.set(false);
        this.showCredit.set(false);
        this.openRx(null);
      } else if (err instanceof ExpiredPlantProtectionError) {
        this.toast(`${err.productName}: ${this.t().compliance.expiredBlocked}${err.gtsNos.length ? ' (' + err.gtsNos.join(', ') + ')' : ''}`, 'error');
      } else if (err instanceof GtsUnavailableError) {
        this.toast(`${this.t().compliance.gtsUnavailable}: ${err.productName} (${err.gtsNos.join(', ')})`, 'error');
      } else {
        this.toast(this.t().pos.saleFailed, 'error');
      }
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  /** Süresi geçmiş birim / parti yetersizliği için kullanıcı onayı. */
  private confirmWarnings(w: SaleWarnings): Promise<boolean> {
    const p = this.t().pos;
    const lines = [
      ...w.expired.map(x => `${p.expiredUnitsWarn}: ${x.productName} (${x.quantity})`),
      ...w.batchShortfall.map(x => `${p.batchShortfallWarn}: ${x.productName} (${x.quantity})`),
    ];
    return new Promise(resolve => {
      this.confirmSvc.confirm({
        key: 'pos-sale-confirm',
        header: p.confirmSaleTitle,
        message: lines.join(' · '),
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: p.confirmSellAnyway,
        rejectLabel: p.cancel,
        acceptButtonStyleClass: 'p-button-warn',
        rejectButtonStyleClass: 'p-button-secondary',
        accept: () => resolve(true),
        reject: () => resolve(false),
      });
    });
  }

  // ================= Satış sonrası =================

  methodText(ls: CompletedSale): string {
    const s = this.t().sales;
    const m = ls.receipt.paymentMethod;
    return m === 'cash' ? s.methodCash : m === 'card' ? s.methodCard : m === 'credit' ? s.methodCredit : s.methodMixed;
  }

  printLast(): void {
    const ls = this.lastSale();
    if (!ls) return;
    this.printer.print(ls.receipt).catch(err => this.logger.error('Receipt print failed', err));
  }

  /** Satış özetinden iptal (onaylı) — stok, veresiye ve çiftçi ambarı geri alınır. */
  cancelLast(): void {
    const ls = this.lastSale();
    if (!ls || this.cancelling()) return;
    const s = this.t().sales;
    this.confirmSvc.confirm({
      key: 'pos-sale-confirm',
      header: s.cancelConfirmTitle,
      message: s.cancelConfirmDesc,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: s.cancelSale,
      rejectLabel: this.t().common.close,
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary',
      accept: () => void this.doCancel(ls),
    });
  }

  private async doCancel(ls: CompletedSale): Promise<void> {
    this.cancelling.set(true);
    try {
      await this.saleSvc.cancelSale(ls.id, null);
      this.toast(this.t().sales.cancelSuccess, 'success');
      this.newSale();
    } catch (err) {
      this.logger.error('POS cancelSale failed', err);
      this.toast(this.t().sales.cancelFailed, 'error');
    } finally {
      this.cancelling.set(false);
    }
  }

  newSale(): void {
    this.lastSale.set(null);
    this.rxSkipped = false;
    this.focusSearch();
    if (!this.isDesktop()) this.searchInput()?.nativeElement.focus();
  }

  // ================= Biçim =================

  money(n: number, symbol = true): string {
    const s = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
    return symbol ? `${s} ₺` : s;
  }

  dateText(d: Date | null | undefined): string {
    return d ? d.toLocaleDateString(this.lang.lang() === 'tr' ? 'tr-TR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  }

  dateTimeText(d: Date): string {
    return d.toLocaleString(this.lang.lang() === 'tr' ? 'tr-TR' : 'en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  timeText(ms: number): string {
    return new Date(ms).toLocaleTimeString(this.lang.lang() === 'tr' ? 'tr-TR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  private toast(message: string, severity: 'success' | 'error' | 'warn'): void {
    this.messageSvc.add({ severity, summary: '', detail: message, life: 2500 });
  }
}
