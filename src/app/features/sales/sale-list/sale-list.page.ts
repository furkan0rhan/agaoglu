import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, firstValueFrom, of, switchMap, tap, timeout } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CustomerService } from '../../customers/services/customer.service';
import { Customer } from '../../../shared/models/customer.model';
import { buildPrescriptionRows, CustomerIdLookup, isPrescriptionSale } from '../../../shared/utils/regulatory.utils';
import { exportExcel } from '../../reports/services/report-export';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LangService } from '../../../core/i18n/lang.service';
import { LoggerService } from '../../../core/logging/logger.service';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { Sale, SaleStatus } from '../../../shared/models/sale.model';
import {
  DateFieldComponent, EmptyStateComponent, MoneyComponent, PageHeaderComponent, StatusBadgeComponent, TONE_SOFT, UiTone,
} from '../../../shared/ui';
import { SalesQueryService } from '../services/sales-query.service';
import { injectPermissions } from '../../../core/auth/permissions';
import {
  formatDateTime, fromDateInput, methodIcon, methodLabel, methodTone, statusLabel, statusTone, StatusTone, toDateInput,
} from '../services/sales.helpers';

@Component({
  selector: 'app-sale-list',
  standalone: true,
  imports: [
    RouterLink, FormsModule, CurrencyTrPipe, InputTextModule, ToastModule, ButtonModule,
    PageHeaderComponent, EmptyStateComponent, StatusBadgeComponent, MoneyComponent, DateFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p-toast position="top-right" />

    <ui-page-header [title]="t().sales.title"
      [subtitle]="filtered().length + ' ' + t().sales.count + ' · ' + (revenue() | currencyTr)">
      @if (can().exportData) {
        <p-button [label]="t().compliance.rxExport" icon="pi pi-file-excel" severity="secondary"
          [loading]="exporting()" [disabled]="exporting() || loading()" (onClick)="exportRx()" />
      }
      <a routerLink="/pos"
        class="hidden min-h-[42px] items-center gap-2 rounded-token-md bg-accent px-4 text-sm font-bold text-accent-contrast no-underline transition-opacity hover:opacity-90 sm:inline-flex">
        <i class="pi pi-shopping-cart" aria-hidden="true"></i>{{ t().pos.newSale }}
      </a>
    </ui-page-header>

    <div class="page-body">
      <!-- Özet şeridi -->
      <div class="ui-card grid grid-cols-2 overflow-hidden lg:grid-cols-4">
        @for (c of summary(); track c.label; let i = $index) {
          <div class="flex items-center gap-3 border-line px-4 py-3" [class]="cellBorder(i)">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-token-md" [class]="soft(c.tone)" aria-hidden="true">
              <i class="pi text-base" [class]="c.icon"></i>
            </span>
            <div class="min-w-0">
              <span class="block truncate text-12.5 font-semibold text-fg-muted">{{ c.label }}</span>
              <b class="num-xl block truncate text-xl text-fg">{{ c.value }}</b>
            </div>
          </div>
        }
      </div>

      <section class="ui-card overflow-hidden" [attr.aria-label]="t().sales.title">
        <!-- Filtreler -->
        <div class="flex flex-col gap-3 border-b border-line p-3 sm:px-4">
          <div class="grid grid-cols-2 gap-2.5 lg:grid-cols-[repeat(2,minmax(0,12.5rem))_minmax(0,1fr)] lg:items-end">
            <ui-date-field class="!gap-1" inputId="sales-from" valueType="iso" labelClass="text-xs font-semibold text-fg-secondary" [label]="t().sales.from"
              [ngModel]="from()" (ngModelChange)="from.set($event)" />
            <ui-date-field class="!gap-1" inputId="sales-to" valueType="iso" labelClass="text-xs font-semibold text-fg-secondary" [label]="t().sales.to"
              [ngModel]="to()" (ngModelChange)="to.set($event)" />
            <div class="relative col-span-2 lg:col-span-1">
              <label for="sales-search" class="sr-only">{{ t().common.search }}</label>
              <i class="pi pi-search pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted" aria-hidden="true"></i>
              <input pInputText id="sales-search" type="search" class="h-11 w-full !pl-10 text-sm" [placeholder]="t().sales.searchPlaceholder"
                [ngModel]="q()" (ngModelChange)="q.set($event)" />
            </div>
          </div>
          <div class="-mx-3 flex items-center gap-2 overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            @for (o of statusOptions(); track o.value) {
              <button type="button" (click)="status.set(o.value)" [attr.aria-pressed]="status() === o.value"
                class="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-token-md border px-3.5 text-13.5 font-semibold transition-colors"
                [class]="status() === o.value ? 'border-brand-line bg-brand-soft text-brand-text' : 'border-line-strong bg-surface text-fg-secondary hover:bg-surface-muted'">
                {{ o.label }} <b class="num font-bold opacity-80">{{ o.count }}</b>
              </button>
            }
            <span class="mx-1 hidden h-6 w-px shrink-0 bg-line sm:block" aria-hidden="true"></span>
            <button type="button" (click)="rxOnly.set(!rxOnly())" [attr.aria-pressed]="rxOnly()"
              class="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-token-md border px-3.5 text-13.5 font-semibold transition-colors"
              [class]="rxOnly() ? 'border-warning-line bg-warning-soft text-warning-text' : 'border-line-strong bg-surface text-fg-secondary hover:bg-surface-muted'">
              <i class="pi pi-file-check text-xs" aria-hidden="true"></i> {{ t().compliance.rxSalesFilter }}
            </button>
          </div>
        </div>

        @if (loading()) {
          <div class="flex flex-col gap-2 p-4" aria-hidden="true">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <div class="h-11 animate-pulse rounded-token-md bg-surface-muted"></div>
            }
          </div>
        } @else if (filtered().length === 0) {
          <ui-empty-state icon="pi-receipt" tone="accent" [title]="t().sales.noSales" />
        } @else {
          <!-- Mobil: satır listesi -->
          <ul class="m-0 list-none p-0 lg:hidden">
            @for (s of filtered(); track s.id) {
              <li class="border-b border-line last:border-b-0">
                <a [routerLink]="[s.id]" class="list-row flex min-h-[64px] items-center gap-3 px-3 py-2.5 no-underline sm:px-4"
                  [class]="s.status !== 'completed' ? 'shadow-[inset_3px_0_0_var(--danger)]' : ''">
                  <span class="grid h-10 w-10 shrink-0 place-items-center rounded-token-md" [class]="soft(mTone(s))" aria-hidden="true">
                    <i class="pi" [class]="mIcon(s)"></i>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="flex items-center gap-1.5 truncate text-14.5 font-semibold text-fg">
                      @if (rx(s)) { <i class="pi pi-file-check text-xs text-warning-text" [attr.aria-label]="t().compliance.rxBadge"></i> }
                      <span class="truncate">{{ s.customerName || t().sales.walkIn }}</span>
                    </span>
                    <span class="num mt-0.5 block truncate text-xs text-fg-muted">{{ date(s) }} · {{ method(s) }}</span>
                  </span>
                  <span class="flex shrink-0 flex-col items-end gap-1">
                    <ui-money class="num font-extrabold" [value]="s.totalAmount"
                      [class]="s.status === 'completed' ? 'text-fg' : 'text-fg-muted line-through'" />
                    @if (s.status !== 'completed') {
                      <ui-status-badge [tone]="tone(s.status)" size="sm">{{ statusText(s.status) }}</ui-status-badge>
                    }
                  </span>
                </a>
              </li>
            }
          </ul>

          <!-- Masaüstü: C tablosu -->
          <div class="hidden overflow-x-auto lg:block">
            <table class="w-full border-collapse text-14.5">
              <thead>
                <tr class="bg-surface-muted text-left text-12 font-semibold uppercase tracking-[0.03em] text-fg-muted">
                  <th scope="col" class="h-10 border-b border-line px-4">{{ t().sales.saleNo }}</th>
                  <th scope="col" class="h-10 border-b border-line px-4">{{ t().sales.date }}</th>
                  <th scope="col" class="h-10 border-b border-line px-4">{{ t().sales.customer }}</th>
                  <th scope="col" class="h-10 border-b border-line px-4">{{ t().sales.paymentMethod }}</th>
                  <th scope="col" class="h-10 border-b border-line px-4">{{ t().sales.status }}</th>
                  <th scope="col" class="h-10 border-b border-line px-4 text-right">{{ t().sales.lineTotal }}</th>
                  <th scope="col" class="h-10 w-12 border-b border-line px-2"><span class="sr-only">{{ t().sales.detail }}</span></th>
                </tr>
              </thead>
              <tbody>
                @for (s of filtered(); track s.id) {
                  <tr class="list-row border-b border-line last:border-b-0"
                    [class]="s.status !== 'completed' ? 'shadow-[inset_3px_0_0_var(--danger)]' : ''">
                    <td class="h-[52px] px-4">
                      <a [routerLink]="[s.id]" class="num text-13 font-semibold text-fg-secondary no-underline hover:text-brand-text hover:underline">{{ s.saleNumber }}</a>
                    </td>
                    <td class="num whitespace-nowrap px-4 text-fg-secondary">{{ date(s) }}</td>
                    <td class="max-w-[18rem] px-4">
                      <span class="flex items-center gap-1.5 font-semibold text-fg">
                        <span class="truncate">{{ s.customerName || t().sales.walkIn }}</span>
                        @if (rx(s)) {
                          <ui-status-badge tone="warning" size="sm" icon="pi-file-check">{{ t().compliance.rxBadge }}</ui-status-badge>
                        }
                      </span>
                    </td>
                    <td class="px-4"><ui-status-badge [tone]="mTone(s)" [icon]="mIcon(s)">{{ method(s) }}</ui-status-badge></td>
                    <td class="px-4"><ui-status-badge [tone]="tone(s.status)" dot>{{ statusText(s.status) }}</ui-status-badge></td>
                    <td class="whitespace-nowrap px-4 text-right">
                      <ui-money class="num font-extrabold" [value]="s.totalAmount"
                        [class]="s.status === 'completed' ? 'text-fg' : 'text-fg-muted line-through'" />
                    </td>
                    <td class="px-2 text-right">
                      <a [routerLink]="[s.id]" [attr.aria-label]="t().sales.detail + ' ' + s.saleNumber"
                        class="tap inline-flex items-center justify-center rounded-token-md text-fg-muted no-underline hover:bg-surface-hover hover:text-fg">
                        <i class="pi pi-chevron-right text-xs" aria-hidden="true"></i>
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
`,
})
export class SaleListPage {
  private readonly svc = inject(SalesQueryService);
  private readonly toast = inject(MessageService);
  private readonly logger = inject(LoggerService);
  private readonly lang = inject(LangService);
  private readonly customerSvc = inject(CustomerService);
  readonly t = this.lang.t;

  /** Yalnızca e-reçeteli ürün içeren satışlar (Bakanlık denetimi kaydı). */
  readonly rxOnly = signal(false);
  readonly exporting = signal(false);

  readonly from = signal(toDateInput(daysAgo(6)));
  readonly to = signal(toDateInput(new Date()));
  readonly status = signal<SaleStatus | 'all'>('all');
  readonly q = signal('');
  readonly loading = signal(true);

  readonly statusOptions = computed(() => {
    const all = this.sales().filter(s => this.matchesQuery(s));
    const n = (st: SaleStatus) => all.filter(s => s.status === st).length;
    const opts: { label: string; value: SaleStatus | 'all'; count: number }[] = [
      { label: this.t().common.all, value: 'all', count: all.length },
      { label: this.t().sales.statusCompleted, value: 'completed', count: n('completed') },
      { label: this.t().sales.statusCancelled, value: 'cancelled', count: n('cancelled') },
    ];
    const refunded = n('refunded');
    if (refunded) opts.push({ label: this.t().sales.statusRefunded, value: 'refunded', count: refunded });
    return opts;
  });

  /** Özet şeridi (tarih aralığı + reçete/arama filtresi; durum filtresinden bağımsız). */
  readonly summary = computed(() => {
    const p = this.t().pos2;
    const list = this.sales().filter(s => this.matchesQuery(s));
    const done = list.filter(s => s.status === 'completed');
    const fmt = (n: number) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ₺';
    const cells: { label: string; value: string; icon: string; tone: UiTone }[] = [
      { label: p.sumCount, value: String(done.length), icon: 'pi-receipt', tone: 'brand' },
      { label: p.sumRevenue, value: fmt(done.reduce((s, x) => s + (x.totalAmount ?? 0), 0)), icon: 'pi-wallet', tone: 'success' },
      { label: p.sumCredit, value: fmt(done.reduce((s, x) => s + (x.creditAmount ?? 0), 0)), icon: 'pi-book', tone: 'accent' },
      { label: p.sumCancelled, value: String(list.length - done.length), icon: 'pi-undo', tone: 'danger' },
    ];
    return cells;
  });

  private readonly range = computed(() => {
    const start = fromDateInput(this.from(), false) ?? daysAgo(6);
    const end = fromDateInput(this.to(), true) ?? endOfToday();
    return start <= end ? { start, end } : { start: end, end: start };
  });

  readonly sales = toSignal(
    toObservable(this.range).pipe(
      tap(() => this.loading.set(true)),
      switchMap(r => this.svc.getRange$(r.start, r.end).pipe(
        catchError(err => {
          this.logger.error('Sales load failed', err);
          this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().sales.loadError });
          return of([] as Sale[]);
        }),
      )),
      tap(() => this.loading.set(false)),
    ),
    { initialValue: [] as Sale[] },
  );

  readonly filtered = computed(() => {
    const st = this.status();
    return this.sales().filter(s => (st === 'all' || s.status === st) && this.matchesQuery(s));
  });

  /** Reçete filtresi + arama (durumdan bağımsız). */
  private matchesQuery(s: Sale): boolean {
    if (this.rxOnly() && !isPrescriptionSale(s)) return false;
    const q = this.q().trim().toLocaleLowerCase('tr');
    if (!q) return true;
    return !!s.saleNumber?.toLocaleLowerCase('tr').includes(q)
      || (s.customerName ?? '').toLocaleLowerCase('tr').includes(q)
      || (s.items ?? []).some(i => i.productName.toLocaleLowerCase('tr').includes(q) || (i.barcode ?? '').includes(q));
  }

  readonly revenue = computed(() =>
    this.filtered().filter(s => s.status === 'completed').reduce((sum, s) => sum + (s.totalAmount ?? 0), 0)
  );

  date(s: Sale): string { return formatDateTime(s.createdAt, this.lang.lang()); }
  method(s: Sale): string { return methodLabel(this.t(), s.paymentMethod); }
  statusText(s: SaleStatus): string { return statusLabel(this.t(), s); }
  tone(s: SaleStatus): StatusTone { return statusTone(s); }
  rx(s: Sale): boolean { return isPrescriptionSale(s); }
  mTone(s: Sale): UiTone { return methodTone(s.paymentMethod); }
  mIcon(s: Sale): string { return methodIcon(s.paymentMethod); }
  soft(t: UiTone): string { return TONE_SOFT[t]; }
  /** Özet şeridi hücre çizgileri: mobil 2×2, masaüstü 4'lü. */
  cellBorder(i: number): string {
    return [i % 2 === 0 ? 'border-r' : '', i === 1 ? 'lg:border-r' : '', i < 2 ? 'border-b lg:border-b-0' : ''].join(' ');
  }

  /**
   * Reçeteli satış kaydı (Excel): tarih, müşteri, TC / ÇKS, ürün, ruhsat no, miktar, GTS, e-reçete no.
   * Tarih aralığı ve durum filtresi uygulanır; arama ve "reçeteli" filtresinden bağımsız olarak tüm reçeteli satışlar.
   */
  /** Y5: dışa aktarma (reçete kayıtları: müşteri TC / ÇKS) yalnız yönetici */
  readonly can = injectPermissions();

  async exportRx(): Promise<void> {
    if (!this.can().exportData) return;
    if (this.exporting()) return;
    this.exporting.set(true);
    const c = this.t().compliance;
    try {
      const st = this.status();
      const sales = this.sales().filter(s => st === 'all' || s.status === st);
      const customers = new Map<string, CustomerIdLookup>();
      try {
        const list = await firstValueFrom(this.customerSvc.getAll$().pipe(timeout(8000)));
        for (const cu of list as (Customer & { cksNo?: string | null })[]) {
          customers.set(cu.id, { tcNo: cu.tcNo, cksNo: cu.cksNo ?? null });
        }
      } catch (err) {
        this.logger.warn('Rx export: customers not loaded, using sale snapshots only', err);
      }
      const rows = buildPrescriptionRows(sales, customers, u => this.t().pos.units[u ?? 'adet']);
      if (!rows.length) {
        this.toast.add({ severity: 'info', summary: '', detail: c.rxExportEmpty, life: 3000 });
        return;
      }
      const lang = this.lang.lang();
      await exportExcel(`recete-kayitlari_${this.from()}_${this.to()}`, [{
        title: c.rxExportSheet,
        headers: [
          this.t().sales.date, this.t().sales.saleNo, this.t().sales.status, this.t().sales.customer,
          c.tcNo, c.cksNo, this.t().sales.products, c.licenseNo, this.t().sales.quantity, c.unit,
          c.gtsList, this.t().inventory.lotNo, c.rxNo, c.rxPrescriber,
        ],
        rows: rows.map(r => [
          r.date ? r.date.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB') : '',
          r.saleNumber, statusLabel(this.t(), r.status), r.customerName, r.tcNo, r.cksNo, r.productName, r.licenseNo,
          r.quantity, r.unit, r.gtsNos, r.lotNos, r.prescriptionNo, r.prescriberName,
        ]),
      }]);
    } catch (err) {
      this.logger.error('Rx export failed', err);
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: c.rxExportFailed, life: 4000 });
    } finally {
      this.exporting.set(false);
    }
  }

}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
