import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, of, switchMap, tap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LangService } from '../../../core/i18n/lang.service';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { Purchase } from '../../../shared/models/purchase.model';
import {
  DateFieldComponent, EmptyStateComponent, GlassCardComponent, MoneyComponent, normalizeDay, PageHeaderComponent, StatusBadgeComponent,
} from '../../../shared/ui';
import { SumStripComponent, SumStripItem } from '../../products/components/sum-strip.component';
import { SupplierService } from '../../suppliers/services/supplier.service';
import { PurchaseService } from '../services/purchase.service';
import { roundKurus } from '../services/purchase.utils';
import { injectReturnTexts } from '../returns/supplier-return.i18n';

@Component({
  selector: 'app-purchase-list',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DatePipe, NgTemplateOutlet, ButtonModule, InputTextModule, SelectModule, ToastModule,
    PageHeaderComponent, GlassCardComponent, EmptyStateComponent, StatusBadgeComponent, MoneyComponent, SumStripComponent, DateFieldComponent,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p-toast />
    <ui-page-header [title]="t().purchases.title" icon="pi-download" iconTone="info"
      [subtitle]="filtered().length + ' ' + t().purchases.countSuffix">
      <!-- 11.13 Firmaya iade -->
      <p-button [label]="rt().openLink" icon="pi pi-reply" severity="secondary" routerLink="returns" />
      <p-button [label]="t().purchases.newPurchase" icon="pi pi-plus" routerLink="new" />
    </ui-page-header>

    <div class="page-body">
      <app-sum-strip [items]="summary()" [ariaLabel]="t().purchases.title" />

      <ui-glass-card [title]="inv().purchaseList" icon="pi-file" tone="info" padding="none">
        <div class="grid grid-cols-2 gap-3 border-b border-line p-3 sm:px-4 lg:grid-cols-[repeat(2,minmax(0,11rem))_minmax(0,18rem)] lg:items-end">
          <ui-date-field class="!gap-1" inputId="pu-from" labelClass="text-xs font-semibold text-fg-secondary" [label]="t().sales.from"
            [ngModel]="from()" (ngModelChange)="from.set($event)" />
          <ui-date-field class="!gap-1" inputId="pu-to" labelClass="text-xs font-semibold text-fg-secondary" [label]="t().sales.to"
            endOfDay [ngModel]="to()" (ngModelChange)="to.set($event)" />
          <div class="col-span-2 flex min-w-0 flex-col gap-1 lg:col-span-1">
            <label class="text-xs font-semibold text-fg-secondary" for="pu-supplier">{{ t().purchases.supplierFilter }}</label>
            <p-select inputId="pu-supplier" [options]="supplierOptions()" optionLabel="label" optionValue="value"
              [ngModel]="supplierId()" (ngModelChange)="supplierId.set($event)" [filter]="true" styleClass="w-full" appendTo="body" />
          </div>
        </div>

        @if (loading()) {
          <div class="flex flex-col gap-3 p-4" aria-hidden="true">
            @for (i of [1,2,3,4]; track i) { <div class="h-11 animate-pulse rounded-token-md bg-surface-muted"></div> }
          </div>
        } @else if (filtered().length === 0) {
          <ui-empty-state compact icon="pi-download" [title]="t().purchases.empty" [description]="t().purchases.emptyHint">
            <p-button [label]="t().purchases.newPurchase" icon="pi pi-plus" routerLink="new" />
          </ui-empty-state>
        } @else {
          <!-- Masaüstü: tablo -->
          <table class="hidden w-full border-collapse text-sm md:table">
            <thead>
              <tr class="h-10 border-b border-line bg-surface-muted text-left text-12.5 uppercase tracking-wide text-fg-muted">
                <th class="px-4 font-bold">{{ t().purchases.date }}</th>
                <th class="px-4 font-bold">{{ t().purchases.supplier }}</th>
                <th class="px-4 font-bold">{{ t().purchases.docNo }}</th>
                <th class="px-4 text-right font-bold">{{ t().purchases.items }}</th>
                <th class="px-4 font-bold">{{ t().purchases.payment }}</th>
                <th class="px-4 text-right font-bold">{{ t().purchases.total }}</th>
                <th class="w-10 px-2"><span class="sr-only">{{ t().purchases.detailTitle }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (p of filtered(); track p.id) {
                <tr class="list-row h-[52px] cursor-pointer border-b border-line last:border-b-0" tabindex="0"
                    [class.opacity-60]="p.status === 'cancelled'" (click)="open(p.id)" (keydown.enter)="open(p.id)">
                  <td class="num whitespace-nowrap px-4 text-fg-secondary">{{ p.documentDate.toDate() | date: 'dd.MM.yyyy' }}</td>
                  <td class="px-4">
                    <a [routerLink]="[p.id]" class="font-semibold text-fg no-underline" (click)="$event.stopPropagation()">{{ p.supplierName }}</a>
                  </td>
                  <td class="px-4 text-fg-secondary">
                    {{ p.docType === 'invoice' ? t().purchases.docInvoice : t().purchases.docWaybill }}
                    <span class="num text-fg">{{ p.documentNo }}</span>
                  </td>
                  <td class="num px-4 text-right text-fg-secondary">{{ p.items.length }}</td>
                  <td class="px-4">
                    <ng-container [ngTemplateOutlet]="badge" [ngTemplateOutletContext]="{ $implicit: p }" />
                  </td>
                  <td class="px-4 text-right"><ui-money [value]="p.grandTotal" class="num font-extrabold text-fg" /></td>
                  <td class="px-2 text-right"><i class="pi pi-chevron-right text-xs text-fg-muted" aria-hidden="true"></i></td>
                </tr>
              }
            </tbody>
          </table>

          <!-- Telefon: liste -->
          <ul class="m-0 flex list-none flex-col p-0 md:hidden">
            @for (p of filtered(); track p.id) {
              <li class="border-b border-line last:border-b-0">
                <a [routerLink]="[p.id]" class="list-row flex min-h-[60px] items-center gap-3 px-3 py-2.5 no-underline"
                  [class.opacity-60]="p.status === 'cancelled'">
                  <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-token-md bg-info-soft text-info-text" aria-hidden="true">
                    <i class="pi pi-file text-base"></i>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-15 font-semibold text-fg">{{ p.supplierName }}</span>
                    <span class="num mt-0.5 block truncate text-xs text-fg-muted">
                      {{ p.documentDate.toDate() | date: 'dd.MM.yyyy' }} · {{ p.documentNo || '-' }} · {{ p.items.length }} {{ t().purchases.itemCount }}
                    </span>
                  </span>
                  <span class="flex shrink-0 flex-col items-end gap-1">
                    <ui-money [value]="p.grandTotal" class="num text-sm font-extrabold text-fg" />
                    <ng-container [ngTemplateOutlet]="badge" [ngTemplateOutletContext]="{ $implicit: p }" />
                  </span>
                </a>
              </li>
            }
          </ul>
        }
      </ui-glass-card>
    </div>

    <ng-template #badge let-p>
      @if (p.status === 'cancelled') {
        <ui-status-badge tone="danger" size="sm">{{ t().purchases.statusCancelled }}</ui-status-badge>
      } @else if (p.paymentType === 'credit') {
        <ui-status-badge tone="warning" size="sm">{{ t().purchases.paymentCredit }}</ui-status-badge>
      } @else {
        <ui-status-badge tone="success" size="sm">{{ t().purchases.paymentCash }}</ui-status-badge>
      }
    </ng-template>
  `,
})
export class PurchaseListPage {
  private readonly svc = inject(PurchaseService);
  private readonly suppliersSvc = inject(SupplierService);
  private readonly toast = inject(MessageService);
  readonly t = inject(LangService).t;
  readonly inv = computed(() => this.t().inventory);
  readonly rt = injectReturnTexts();
  private readonly router = inject(Router);
  private readonly currency = new CurrencyTrPipe();

  private readonly now = new Date();
  readonly from = signal<Date | null>(new Date(this.now.getFullYear(), this.now.getMonth(), 1));
  /** Bitiş: seçilen günün sonu (23:59:59.999). */
  readonly to = signal<Date | null>(normalizeDay(this.now, true));
  readonly supplierId = signal<string | null>(null);
  readonly loading = signal(true);

  private readonly range = computed(() => ({
    start: this.from() ?? new Date(this.now.getFullYear(), this.now.getMonth(), 1),
    end: this.to() ?? this.now,
  }));

  readonly purchases = toSignal(
    toObservable(this.range).pipe(
      tap(() => this.loading.set(true)),
      switchMap(r => this.svc.getRange$(r.start, r.end).pipe(
        catchError(() => {
          this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().purchases.loadFailed });
          return of([] as Purchase[]);
        }),
      )),
      tap(() => this.loading.set(false)),
    ),
    { initialValue: [] as Purchase[] },
  );

  private readonly suppliers = toSignal(this.suppliersSvc.getAll$().pipe(catchError(() => of([]))), { initialValue: [] });

  readonly supplierOptions = computed(() => [
    { label: this.t().purchases.allSuppliers, value: null as string | null },
    ...this.suppliers().map(s => ({ label: s.name, value: s.id as string | null })),
  ]);

  readonly filtered = computed(() => {
    const sid = this.supplierId();
    return sid ? this.purchases().filter(p => p.supplierId === sid) : this.purchases();
  });

  open(id: string): void {
    this.router.navigate(['/purchases', id]);
  }

  /** C özet şeridi: toplam alış, belge sayısı, vadeli (cari) ve peşin toplamları (iptaller hariç) */
  readonly summary = computed<SumStripItem[]>(() => {
    const i = this.inv();
    const active = this.filtered().filter(p => p.status !== 'cancelled');
    const sum = (list: Purchase[]) => roundKurus(list.reduce((s, p) => s + p.grandTotal, 0));
    const credit = sum(active.filter(p => p.paymentType === 'credit'));
    const cash = sum(active.filter(p => p.paymentType !== 'credit'));
    const loading = this.loading();
    return [
      { icon: 'pi-download', tone: 'info', label: i.purchaseTotal, value: loading ? '…' : this.currency.transform(this.total()) },
      { icon: 'pi-file', tone: 'neutral', label: i.purchaseDocs, value: loading ? '…' : this.activeCount() },
      { icon: 'pi-book', tone: 'warning', label: i.purchaseCredit, value: loading ? '…' : this.currency.transform(credit) },
      { icon: 'pi-wallet', tone: 'success', label: i.purchaseCash, value: loading ? '…' : this.currency.transform(cash) },
    ];
  });

  readonly activeCount = computed(() => this.filtered().filter(p => p.status !== 'cancelled').length);
  readonly total = computed(() =>
    roundKurus(this.filtered().filter(p => p.status !== 'cancelled').reduce((s, p) => s + p.grandTotal, 0)));
}
