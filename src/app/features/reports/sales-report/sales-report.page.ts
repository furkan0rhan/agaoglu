import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { Sale, PaymentMethod } from '../../../shared/models/sale.model';
import { CreditTransaction } from '../../../shared/models/credit.model';
import { Expense } from '../../../shared/models/expense.model';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { LangService } from '../../../core/i18n/lang.service';
import { ThemeService } from '../../../core/theme/theme.service';
import { ProductStore } from '../../products/store/product.store';
import { Period, getPeriodRange } from '../../../shared/utils/date-range.util';
import { ReportDataService } from '../services/report-data.service';
import {
  summarizeSales, summarizeCollections, sumExpenses, topProducts, salesByCategory,
  trendBuckets, productMap, readChartColors, saleCost, saleInterest, saleVat, toDate, round2,
} from '../services/report-calc';
import { exportExcel, exportPdf, ExportTable } from '../services/report-export';
import { TenantInfoService } from '../../settings/business/tenant-info.service';
import {
  EmptyStateComponent, GlassCardComponent, IconButtonComponent, MoneyComponent, PageHeaderComponent,
  SegmentedComponent, StatCardComponent, StatusBadgeComponent, TONE_SOFT, UiSegmentOption, UiTone,
} from '../../../shared/ui';
import { PurchaseService } from '../../purchases/services/purchase.service';
import { PurchaseSummary } from '../../purchases/services/purchase.utils';
import { injectReportTexts } from '../reports.i18n';

interface ChainStep {
  key: string;
  op: string;
  label: string;
  value: number;
  /** Çubuğun başlangıcı ve genişliği (%), şelale ekseninde. */
  left: number;
  width: number;
  bar: string;
  total: boolean;
}

interface RegisterRow { label: string; value: number; icon: string; tone: UiTone; sign: '' | '−' }

/** CSS değişkeni oku (grafik teması; tema değişince yeniden okunur). */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

@Component({
  selector: 'app-sales-report',
  standalone: true,
  imports: [
    CurrencyTrPipe, RouterLink, ChartModule, ButtonModule, TableModule, ToastModule,
    PageHeaderComponent, GlassCardComponent, StatCardComponent, EmptyStateComponent,
    StatusBadgeComponent, MoneyComponent, IconButtonComponent, SegmentedComponent,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  // Yazdırma: yalnızca kasa özeti kartı basılır (body:has ile bu sayfaya sınırlı).
  encapsulation: ViewEncapsulation.None,
  styles: [`
    @media print {
      body:has(.cash-print) * { visibility: hidden !important; }
      body:has(.cash-print) .cash-print,
      body:has(.cash-print) .cash-print * { visibility: visible !important; }
      body:has(.cash-print) .cash-print {
        position: fixed; inset: 0 0 auto 0; margin: 0;
        background: white !important; box-shadow: none !important;
        -webkit-backdrop-filter: none !important; backdrop-filter: none !important;
        border: 1px solid gray !important;
      }
      body:has(.cash-print) .cash-print * { color: black !important; background: transparent !important; }
    }
  `],
  template: `
    <p-toast />

    <ui-page-header [title]="t().reports.title" [subtitle]="t().reports.subtitle" icon="pi-chart-bar" iconTone="info">
      <p-button icon="pi pi-file-excel" [label]="t().reports.exportExcel" severity="secondary"
        [loading]="exporting() === 'xlsx'" [disabled]="loading() || !!exporting()" (onClick)="export('xlsx')" />
      <p-button icon="pi pi-file-pdf" [label]="t().reports.exportPdf" severity="secondary"
        [loading]="exporting() === 'pdf'" [disabled]="loading() || !!exporting()" (onClick)="export('pdf')" />
    </ui-page-header>

    <div class="page-body">

      <!-- Dönem seçici + tarih aralığı -->
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ui-segmented class="w-full sm:w-auto" [block]="true" [options]="periods()" [value]="period()" (valueChange)="setPeriod($event!)"
          [ariaLabel]="t().reports.period" />
        <span class="num text-13 text-fg-muted">{{ rangeText() }}</span>
      </div>

      <!-- KPI (C durum blokları) -->
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4 xl:grid-cols-5">
        <ui-stat-card icon="pi-wallet" tone="info" [label]="rx().revenueGross"
          [value]="summary().revenue | currencyTr"
          [hint]="rx().avgHint(summary().saleCount, money(avgBasket()))" [loading]="loading()" />
        <ui-stat-card icon="pi-receipt" tone="neutral" [label]="rx().netSales"
          [value]="summary().netRevenue | currencyTr"
          [hint]="rx().vatHint(money(summary().vat)) + (summary().vatEstimated ? ' *' : '')" [loading]="loading()" />
        <ui-stat-card icon="pi-chart-line" [tone]="summary().grossProfit < 0 ? 'danger' : 'brand'" [label]="t().reports.grossProfit"
          [value]="summary().grossProfit | currencyTr"
          [hint]="summary().costEstimated ? '* ' + t().dashboard.estimated : marginText()"
          [tinted]="summary().grossProfit < 0" [loading]="loading()" />
        <ui-stat-card icon="pi-calculator" [tone]="netProfit() < 0 ? 'danger' : 'success'" [label]="t().reports.netProfit"
          [value]="netProfit() | currencyTr" [hint]="rx().netProfitHint(money(expenseTotal()))"
          [tinted]="netProfit() < 0" [loading]="loading()" />
        <ui-stat-card icon="pi-download" tone="accent" [label]="t().reports.collections"
          [value]="collections().total | currencyTr"
          [hint]="collections().count + ' ' + t().dashboard.transactions" [loading]="loading()" />
      </div>

      @if (loading()) {
        <div class="ui-card flex flex-col gap-4 p-5" aria-hidden="true">
          @for (i of [1, 2, 3, 4, 5]; track i) {
            <div class="h-6 animate-pulse rounded-token-sm bg-surface-muted"></div>
          }
        </div>
      } @else {

        <!-- Kâr zinciri (şelale) -->
        <ui-glass-card [title]="t().reports.profitChain" icon="pi-sitemap" iconTone="brand" [subtitle]="marginText()">
          <a card-actions routerLink="/expenses" class="text-13.5 font-semibold text-brand-text no-underline hover:underline">{{ t().nav.expenses }} ›</a>
          <ol class="m-0 flex list-none flex-col gap-3 p-0">
            @for (s of chain(); track s.key) {
              <li class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 md:grid-cols-[170px_minmax(0,1fr)_150px]"
                [class]="s.total ? 'rounded-token-md bg-surface-muted px-3 py-2' : 'px-3'">
                <span class="order-1 truncate text-sm" [class]="s.total ? 'font-semibold text-fg' : 'font-medium text-fg-secondary'">
                  <span class="num mr-1 inline-block w-3 text-fg-muted" aria-hidden="true">{{ s.op }}</span>{{ s.label }}
                </span>
                <div class="relative order-3 col-span-2 h-2.5 overflow-hidden rounded-full bg-surface-hover md:order-2 md:col-span-1" aria-hidden="true">
                  <div class="absolute inset-y-0 rounded-full transition-[left,width] duration-500" [class]="s.bar"
                    [style.left.%]="s.left" [style.width.%]="s.width"></div>
                </div>
                <ui-money class="order-2 text-right text-sm md:order-3" [class]="s.total ? 'text-base font-bold' : 'font-semibold text-fg'"
                  [value]="s.op === '−' ? -s.value : s.value" [colorize]="s.total" />
              </li>
            }
          </ol>
          @if (summary().interestIncome > 0 || summary().costEstimated || summary().vatEstimated) {
            <div class="mt-4 flex flex-col gap-2 border-0 border-t border-solid border-line pt-3">
              @if (summary().interestIncome > 0) {
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="text-sm text-fg-secondary">
                    <i class="pi pi-percentage mr-1 text-info-text" aria-hidden="true"></i>{{ t().reports.interestIncome }}
                    <span class="text-xs text-fg-muted"> — {{ t().reports.interestIncomeNote }}</span>
                  </span>
                  <ui-money class="font-bold text-info-text" [value]="summary().interestIncome" />
                </div>
              }
              @if (summary().costEstimated) {
                <p class="m-0 text-xs text-warning-text">* {{ t().reports.costEstimatedNote }}</p>
              }
              @if (summary().vatEstimated) {
                <p class="m-0 text-xs text-warning-text">* {{ rx().vatEstimatedNote }}</p>
              }
            </div>
          }
        </ui-glass-card>

        <!-- Satış trendi -->
        <ui-glass-card [title]="t().reports.salesTrend" [subtitle]="trendLabel()" icon="pi-chart-bar" iconTone="info">
          <p-chart type="bar" [data]="trendChartData()" [options]="trendChartOptions()" height="260px" />
        </ui-glass-card>

        <!-- Alışlar & tedarikçi borcu (PurchaseService.summary) -->
        <ui-glass-card [title]="rx().purchasesTitle" [subtitle]="rx().purchasesDesc" icon="pi-truck" tone="accent" padding="none" clip>
          <a card-actions routerLink="/purchases" class="text-13.5 font-semibold text-brand-text no-underline hover:underline">{{ rx().allPurchases }} ›</a>
          @if (purchaseError()) {
            <p class="m-0 p-4 text-sm text-danger-text" role="alert">{{ rx().purchasesFailed }}</p>
          } @else {
            <div class="grid grid-cols-2 lg:grid-cols-4">
              <div class="border-0 border-b border-r border-solid border-line px-4 py-3 lg:border-b-0">
                <p class="eyebrow m-0 text-fg-muted">{{ rx().purchasesTotal }}</p>
                <ui-money class="mt-1 block font-display text-xl font-extrabold text-fg" [value]="purchases()?.totalPurchases ?? 0" />
                <p class="m-0 mt-0.5 text-xs text-fg-muted">{{ rx().purchasesCount(purchases()?.purchaseCount ?? 0) }}</p>
              </div>
              <div class="border-0 border-b border-solid border-line px-4 py-3 lg:border-b-0 lg:border-r">
                <p class="eyebrow m-0 text-fg-muted">{{ rx().supplierPaid }}</p>
                <ui-money class="mt-1 block font-display text-xl font-extrabold text-fg" [value]="purchases()?.totalPaid ?? 0" />
              </div>
              <div class="border-0 border-r border-solid border-line px-4 py-3" [class.bg-warning-soft]="(purchases()?.supplierDebt ?? 0) > 0">
                <p class="eyebrow m-0" [class]="(purchases()?.supplierDebt ?? 0) > 0 ? 'text-warning-text' : 'text-fg-muted'">{{ rx().supplierDebt }}</p>
                <ui-money class="mt-1 block font-display text-xl font-extrabold text-fg" [value]="purchases()?.supplierDebt ?? 0" />
                <a routerLink="/suppliers" class="text-xs font-semibold text-brand-text no-underline hover:underline" [title]="rx().supplierDebtNote">{{ rx().allSuppliers }} ›</a>
              </div>
              <div class="px-4 py-3">
                <p class="eyebrow m-0 text-fg-muted">{{ rx().purchaseVsRevenue }}</p>
                <p class="num m-0 mt-1 font-display text-xl font-extrabold text-fg">{{ purchaseRatioText() }}</p>
                <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-strong" aria-hidden="true">
                  <div class="h-full rounded-full bg-accent transition-[width] duration-500" [style.width.%]="purchaseRatio()"></div>
                </div>
              </div>
            </div>
          }
        </ui-glass-card>

        <!-- Kasa özeti + ödeme dağılımı -->
        <div class="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-4">
          <ui-glass-card class="cash-print lg:col-span-2" [title]="t().reports.cashRegister" icon="pi-calculator" iconTone="success"
            [subtitle]="periodLabel() + ' · ' + rangeText()">
            <p-button card-actions class="hidden sm:block print:hidden" icon="pi pi-print" [label]="t().reports.printCash"
              severity="secondary" size="small" (onClick)="printCash()" />
            <ui-icon-button card-actions class="sm:hidden print:hidden" icon="pi-print" variant="outline" size="sm"
              [ariaLabel]="t().reports.printCash" (click)="printCash()" />

            <div class="mb-3 hidden print:block">
              @if (businessName()) {
                <p class="m-0 text-base font-bold">{{ businessName() }}</p>
              }
              <p class="m-0 text-xs">{{ t().reports.printedAt }}: {{ printedAt() }}</p>
            </div>

            <dl class="m-0 flex flex-col">
              @for (r of registerRows(); track r.label) {
                <div class="flex items-center justify-between gap-3 border-0 border-b border-solid border-line py-2.5">
                  <dt class="flex min-w-0 items-center gap-2.5 text-sm text-fg-secondary">
                    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-token-sm print:hidden" [class]="toneSoft[r.tone]">
                      <i class="pi text-sm" [class]="r.icon" aria-hidden="true"></i>
                    </span>
                    <span class="truncate">{{ r.label }}</span>
                  </dt>
                  <dd class="m-0 shrink-0 text-sm font-semibold text-fg">
                    <span class="num">{{ r.sign }}</span><ui-money [value]="r.value" />
                  </dd>
                </div>
              }
              <div class="mt-2 flex items-center justify-between gap-3 rounded-token-md bg-brand-soft px-3 py-3">
                <dt class="min-w-0 text-sm font-bold text-fg">
                  {{ t().reports.netCash }}
                  <span class="block text-xs font-normal text-fg-muted sm:inline">({{ t().reports.netCashNote }})</span>
                </dt>
                <dd class="m-0 shrink-0"><ui-money class="text-lg font-bold" [value]="netCash()" colorize /></dd>
              </div>
            </dl>
          </ui-glass-card>

          <ui-glass-card [title]="t().reports.paymentTypes" icon="pi-credit-card" iconTone="info">
            @if (summary().revenue > 0) {
              <div class="relative mx-auto w-full max-w-[280px]">
                <p-chart type="doughnut" [data]="paymentChartData()" [options]="paymentChartOptions()" height="240px" />
              </div>
            } @else {
              <ui-empty-state compact icon="pi-chart-pie" [title]="t().reports.noData" />
            }
          </ui-glass-card>
        </div>

        <!-- En çok satanlar + kategori -->
        <div class="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
          <ui-glass-card [title]="t().reports.topProducts" icon="pi-star" iconTone="warning" padding="none" clip>
            @if (top().length === 0) {
              <ui-empty-state compact icon="pi-box" [title]="t().reports.noData" />
            } @else {
              <!-- Masaüstü: tablo -->
              <div class="hidden md:block">
                <p-table [value]="top()" size="small">
                  <ng-template #header>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">{{ t().reports.product }}</th>
                      <th scope="col" class="text-right">{{ t().reports.quantity }}</th>
                      <th scope="col" class="text-right">{{ t().reports.revenue }}</th>
                    </tr>
                  </ng-template>
                  <ng-template #body let-r let-i="rowIndex">
                    <tr>
                      <td class="num text-fg-muted">{{ i + 1 }}</td>
                      <td class="text-fg">{{ r.name }}</td>
                      <td class="num text-right text-fg-secondary">{{ r.quantity }}</td>
                      <td class="text-right"><ui-money class="num font-extrabold text-fg" [value]="r.revenue" /></td>
                    </tr>
                  </ng-template>
                </p-table>
              </div>
              <!-- Mobil: kart listesi -->
              <ol class="m-0 flex list-none flex-col p-0 md:hidden">
                @for (r of top(); track r.productId || r.name; let i = $index) {
                  <li class="list-row flex items-center gap-3 border-0 border-b border-solid border-line px-4 py-3 last:border-b-0">
                    <span class="num flex h-8 w-8 shrink-0 items-center justify-center rounded-token-sm text-xs font-bold"
                      [class]="i < 3 ? toneSoft.warning : toneSoft.neutral">{{ i + 1 }}</span>
                    <div class="min-w-0 flex-1">
                      <p class="m-0 truncate text-sm font-semibold text-fg">{{ r.name }}</p>
                      <p class="num m-0 mt-0.5 text-xs text-fg-muted">{{ r.quantity }} {{ t().common.piece }}</p>
                    </div>
                    <ui-money class="shrink-0 text-sm font-bold text-fg" [value]="r.revenue" />
                  </li>
                }
              </ol>
            }
          </ui-glass-card>

          <ui-glass-card [title]="t().reports.byCategory" icon="pi-tags" iconTone="brand">
            @if (categories().length === 0) {
              <ui-empty-state compact icon="pi-tags" [title]="t().reports.noData" />
            } @else {
              <ul class="m-0 flex list-none flex-col gap-4 p-0">
                @for (c of categories(); track c.category) {
                  <li class="flex flex-col gap-1.5">
                    <div class="flex items-baseline justify-between gap-3 text-sm">
                      <span class="min-w-0 truncate text-fg">{{ c.category }}
                        <span class="num text-xs text-fg-muted">· {{ c.quantity }} {{ t().common.piece }}</span></span>
                      <ui-money class="shrink-0 font-semibold text-fg" [value]="c.revenue" />
                    </div>
                    <div class="h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
                      <div class="h-full rounded-full bg-brand transition-[width] duration-500" [style.width.%]="categoryPct(c.revenue)"></div>
                    </div>
                  </li>
                }
              </ul>
            }
          </ui-glass-card>
        </div>

        <!-- Satış listesi -->
        <ui-glass-card [title]="t().reports.salesList" [subtitle]="summary().saleCount + ' ' + t().reports.sale"
          icon="pi-list" iconTone="neutral" padding="none" clip>
          @if (sales().length === 0) {
            <ui-empty-state icon="pi-inbox" [title]="t().reports.noData" />
          } @else {
            <ul class="m-0 flex list-none flex-col p-0">
              @for (sale of sales(); track sale.id) {
                <li class="list-row flex items-center gap-3 border-0 border-b border-solid border-line px-4 py-3 last:border-b-0">
                  <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-token-md" [class]="toneSoft[payTone(sale.paymentMethod)]" aria-hidden="true">
                    <i class="pi text-base" [class]="paymentIcon(sale.paymentMethod)"></i>
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="num m-0 truncate text-sm font-semibold text-fg">{{ sale.saleNumber }}</p>
                    <p class="m-0 mt-0.5 truncate text-xs text-fg-muted">{{ sale.customerName || t().reports.cashCustomer }} · <span class="num">{{ formatTime(sale.createdAt) }}</span></p>
                  </div>
                  <div class="flex shrink-0 flex-col items-end gap-1">
                    <ui-money class="text-sm font-bold text-fg" [value]="sale.totalAmount" />
                    <ui-status-badge size="sm" [tone]="payTone(sale.paymentMethod)">{{ paymentLabel(sale.paymentMethod) }}</ui-status-badge>
                  </div>
                </li>
              }
            </ul>
          }
        </ui-glass-card>
      }
    </div>
  `,
})
export class SalesReportPage implements OnInit {
  private readonly data = inject(ReportDataService);
  private readonly productStore = inject(ProductStore);
  private readonly theme = inject(ThemeService);
  private readonly toast = inject(MessageService);
  private readonly tenantInfo = inject(TenantInfoService);
  private readonly purchaseSvc = inject(PurchaseService);
  readonly t = inject(LangService).t;
  readonly rx = injectReportTexts();
  readonly toneSoft = TONE_SOFT;

  readonly period = signal<Period>('today');
  readonly loading = signal(false);
  readonly exporting = signal<'xlsx' | 'pdf' | null>(null);
  readonly sales = signal<Sale[]>([]);
  readonly payments = signal<CreditTransaction[]>([]);
  readonly expenses = signal<Expense[]>([]);
  readonly businessName = signal('');
  readonly purchases = signal<PurchaseSummary | null>(null);
  readonly purchaseError = signal(false);
  readonly printedAt = signal('');
  private loadSeq = 0;

  readonly periods = computed<UiSegmentOption<Period>[]>(() => {
    const r = this.t().reports;
    return [
      { value: 'today' as Period, label: r.today },
      { value: 'week' as Period, label: r.thisWeek },
      { value: 'month' as Period, label: r.thisMonth },
      { value: 'year' as Period, label: r.thisYear },
    ];
  });

  readonly periodLabel = computed(() => this.periods().find(p => p.value === this.period())?.label ?? '');

  readonly rangeText = computed(() => {
    const { start, end } = getPeriodRange(this.period());
    const loc = this.t().reports.dateLocale;
    const f = (d: Date) => d.toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' });
    return this.period() === 'today' ? f(start) : `${f(start)} – ${f(end)}`;
  });

  private readonly products = computed(() => productMap(this.productStore.products()));
  readonly summary = computed(() => summarizeSales(this.sales(), this.products()));
  readonly collections = computed(() => summarizeCollections(this.payments()));
  readonly expenseTotal = computed(() => sumExpenses(this.expenses()));
  readonly netProfit = computed(() => round2(this.summary().grossProfit - this.expenseTotal()));
  readonly avgBasket = computed(() => this.summary().saleCount ? this.summary().revenue / this.summary().saleCount : 0);
  readonly netCash = computed(() => round2(this.summary().cash + this.collections().cash - this.expenseTotal()));
  readonly top = computed(() => topProducts(this.sales(), 10));
  readonly categories = computed(() => salesByCategory(this.sales(), this.products(), this.t().reports.uncategorized));
  private readonly maxCategory = computed(() => Math.max(1, ...this.categories().map(c => c.revenue)));

  /** Alış / ciro oranı (%; çubuk için 0–100). */
  readonly purchaseRatio = computed(() => {
    const rev = this.summary().revenue, p = this.purchases()?.totalPurchases ?? 0;
    return rev > 0 ? Math.min(100, (p / rev) * 100) : (p > 0 ? 100 : 0);
  });
  readonly purchaseRatioText = computed(() => {
    const rev = this.summary().revenue, p = this.purchases()?.totalPurchases ?? 0;
    if (!rev) return '–';
    return `%${((p / rev) * 100).toLocaleString(this.t().reports.dateLocale, { maximumFractionDigits: 1 })}`;
  });

  readonly marginText = computed(() => {
    const s = this.summary();
    if (!s.netRevenue) return '';
    const pct = (s.grossProfit / s.netRevenue) * 100;
    return `${this.t().reports.grossMargin} %${pct.toLocaleString(this.t().reports.dateLocale, { maximumFractionDigits: 1 })}`;
  });

  /** Ciro (KDV dahil) → KDV → Net satış → Maliyet → Brüt → Gider → Net şelalesi. Eksen [min(0, brüt, net), max(ciro, 0)]. */
  readonly chain = computed<ChainStep[]>(() => {
    const r = this.t().reports, s = this.summary(), exp = this.expenseTotal(), net = this.netProfit();
    const min = Math.min(0, s.grossProfit, net);
    const max = Math.max(s.revenue, s.grossProfit, 0);
    const span = max - min || 1;
    const seg = (a: number, b: number) => {
      const lo = Math.min(a, b), hi = Math.max(a, b);
      return { left: ((lo - min) / span) * 100, width: Math.max(((hi - lo) / span) * 100, hi > lo ? 0.8 : 0) };
    };
    return [
      { key: 'rev', op: '', label: this.rx().revenueGross, value: s.revenue, ...seg(0, s.revenue), bar: 'bg-info', total: false },
      { key: 'vat', op: '−', label: this.rx().vat + (s.vatEstimated ? ' *' : ''), value: s.vat, ...seg(s.revenue, s.netRevenue), bar: 'bg-fg-muted', total: false },
      { key: 'netrev', op: '=', label: this.rx().netSales, value: s.netRevenue, ...seg(0, s.netRevenue), bar: 'bg-info', total: true },
      { key: 'cost', op: '−', label: r.cost + (s.costEstimated ? ' *' : ''), value: s.cost, ...seg(s.netRevenue, s.grossProfit), bar: 'bg-danger', total: false },
      { key: 'gross', op: '=', label: r.grossProfit, value: s.grossProfit, ...seg(0, s.grossProfit), bar: s.grossProfit >= 0 ? 'bg-brand' : 'bg-danger', total: true },
      { key: 'exp', op: '−', label: r.expenseTotal, value: exp, ...seg(s.grossProfit, net), bar: 'bg-accent', total: false },
      { key: 'net', op: '=', label: r.netProfit, value: net, ...seg(0, net), bar: net >= 0 ? 'bg-success' : 'bg-danger', total: true },
    ];
  });

  readonly registerRows = computed<RegisterRow[]>(() => {
    const r = this.t().reports, s = this.summary(), c = this.collections();
    return [
      { label: r.cashSales, value: s.cash, icon: 'pi-money-bill', tone: 'success', sign: '' },
      { label: r.cardSales, value: s.card, icon: 'pi-credit-card', tone: 'info', sign: '' },
      { label: r.creditSales, value: s.credit, icon: 'pi-users', tone: 'warning', sign: '' },
      { label: r.collectionsCash, value: c.cash, icon: 'pi-wallet', tone: 'success', sign: '' },
      { label: r.collectionsCard, value: c.card, icon: 'pi-wallet', tone: 'info', sign: '' },
      ...(c.transfer > 0 ? [{ label: r.collectionsTransfer, value: c.transfer, icon: 'pi-send', tone: 'info', sign: '' } as RegisterRow] : []),
      { label: r.expenseTotal, value: this.expenseTotal(), icon: 'pi-arrow-down', tone: 'accent', sign: '−' },
    ];
  });

  readonly trendLabel = computed(() => {
    const r = this.t().reports;
    const map: Record<Period, string> = { today: r.hourly, week: r.daily, month: r.daily, year: r.thisYear };
    return map[this.period()];
  });

  /** Grafik teması: seri renkleri report-calc'tan, ızgara/tooltip camı tokenlardan. */
  private readonly chartTheme = computed(() => {
    this.theme.isDark(); // tema değişince yeniden oku
    const c = readChartColors();
    return {
      ...c,
      grid: cssVar('--border-subtle') || c.grid,
      tooltip: {
        backgroundColor: cssVar('--surface-overlay') || c.grid,
        borderColor: cssVar('--border-strong') || c.grid,
        borderWidth: 1,
        titleColor: cssVar('--text-primary') || c.text,
        bodyColor: cssVar('--text-secondary') || c.text,
        cornerRadius: 10,
        padding: 10,
        boxPadding: 4,
        titleFont: { weight: 600 },
      },
    };
  });

  readonly trendChartData = computed(() => {
    const p = this.period();
    const start = getPeriodRange(p).start;
    const values = trendBuckets(this.sales(), p, start);
    const r = this.t().reports;
    let labels: string[];
    switch (p) {
      case 'today': labels = values.map((_, i) => `${String(i).padStart(2, '0')}:00`); break;
      case 'week': labels = r.weekDays.split(','); break;
      case 'month': labels = values.map((_, i) => String(i + 1)); break;
      case 'year': labels = r.monthsShort.split(','); break;
    }
    const c = this.chartTheme().series[0];
    return {
      labels,
      datasets: [{
        label: r.chartSales,
        data: values,
        backgroundColor: c,
        hoverBackgroundColor: c,
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 36,
      }],
    };
  });

  readonly trendChartOptions = computed(() => {
    const c = this.chartTheme();
    const fmt = this.money;
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { ...c.tooltip, displayColors: false, callbacks: { label: (ctx: { raw: unknown }) => fmt(Number(ctx.raw)) } },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11 }, color: c.text, maxRotation: 0, autoSkipPadding: 8 } },
        y: { grid: { color: c.grid }, border: { display: false }, ticks: { font: { size: 11 }, color: c.text, maxTicksLimit: 6 } },
      },
    };
  });

  readonly paymentChartData = computed(() => {
    const r = this.t().reports, s = this.summary(), c = this.chartTheme().series;
    return {
      labels: [r.cash, r.card, r.credit],
      datasets: [{ data: [s.cash, s.card, s.credit], backgroundColor: [c[0], c[1], c[3]], borderWidth: 0, hoverOffset: 6 }],
    };
  });

  readonly paymentChartOptions = computed(() => {
    const c = this.chartTheme();
    const fmt = this.money;
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 12 }, color: c.text, padding: 14, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: { ...c.tooltip, callbacks: { label: (ctx: { raw: unknown }) => ' ' + fmt(Number(ctx.raw)) } },
      },
      cutout: '68%',
    };
  });

  private readonly pipe = new CurrencyTrPipe();
  readonly money = (v: number) => this.pipe.transform(v);

  ngOnInit(): void {
    this.productStore.ensureLoaded(); // maliyet tahmini ve kategori için
    this.load();
    // Yazdırılan kasa raporu başlığı için işletme adı (hata olursa sessizce boş kalır)
    this.tenantInfo.get().then(i => this.businessName.set(i.name)).catch(() => undefined);
  }

  setPeriod(p: Period): void {
    if (this.period() === p) return;
    this.period.set(p);
    this.load();
  }

  printCash(): void {
    this.printedAt.set(new Date().toLocaleString(this.t().reports.dateLocale, {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }));
    // Tarih alanının DOM'a yansıması için bir kare bekle
    requestAnimationFrame(() => window.print());
  }

  private async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    try {
      const range = getPeriodRange(this.period());
      // Alış özeti ayrı: hata olursa (ör. indeks yok) satış raporu yine görünsün
      this.purchaseError.set(false);
      void this.purchaseSvc.summary(range.start, range.end).then(
        p => { if (seq === this.loadSeq) this.purchases.set(p); },
        err => {
          console.error('[Reports] purchase summary error:', err);
          if (seq === this.loadSeq) { this.purchases.set(null); this.purchaseError.set(true); }
        },
      );
      const [sales, payments, expenses] = await Promise.all([
        this.data.getSales(range),
        this.data.getCollections(range),
        this.data.getExpenses(range),
      ]);
      if (seq !== this.loadSeq) return; // daha yeni bir dönem seçildi
      this.sales.set(sales);
      this.payments.set(payments);
      this.expenses.set(expenses);
    } catch (e) {
      console.error('[Reports] load error:', e);
      if (seq === this.loadSeq) {
        this.toast.add({ severity: 'error', summary: '', detail: this.t().reports.loadError, life: 4000 });
      }
    } finally {
      if (seq === this.loadSeq) this.loading.set(false);
    }
  }

  categoryPct(v: number): number {
    return Math.round((v / this.maxCategory()) * 100);
  }

  formatTime(ts: unknown): string {
    const d = toDate(ts);
    if (!d) return '';
    return d.toLocaleString(this.t().reports.dateLocale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  paymentIcon(method: PaymentMethod): string {
    const m: Record<string, string> = { cash: 'pi-money-bill', card: 'pi-credit-card', credit: 'pi-users', mixed: 'pi-sync' };
    return m[method] ?? 'pi-dollar';
  }

  payTone(method: PaymentMethod): UiTone {
    const m: Record<string, UiTone> = { cash: 'success', card: 'info', credit: 'warning', mixed: 'neutral' };
    return m[method] ?? 'neutral';
  }

  paymentLabel(method: PaymentMethod): string {
    const r = this.t().reports;
    const m: Record<string, string> = { cash: r.cash, card: r.card, credit: r.credit, mixed: r.mixed };
    return m[method] ?? method;
  }

  // ── Dışa aktarma ──────────────────────────────────────────────

  private buildExportTables(): ExportTable[] {
    const r = this.t().reports, s = this.summary(), c = this.collections(), pm = this.products();
    const summaryRows: (string | number)[][] = [
      [this.rx().revenueGross, s.revenue],
      [this.rx().vat + (s.vatEstimated ? ' *' : ''), s.vat],
      [this.rx().netSales, s.netRevenue],
      [r.saleCount, s.saleCount],
      [r.cost + (s.costEstimated ? ' *' : ''), s.cost],
      [r.grossProfit, s.grossProfit],
      [r.expenseTotal, this.expenseTotal()],
      [r.netProfit, this.netProfit()],
      [r.interestIncome, s.interestIncome],
      [r.cashSales, s.cash],
      [r.cardSales, s.card],
      [r.creditSales, s.credit],
      [r.collectionsCash, c.cash],
      [r.collectionsCard, c.card],
      [r.collectionsTransfer, c.transfer],
      [r.netCash, this.netCash()],
    ];
    if (s.costEstimated) summaryRows.push(['*', r.costEstimatedNote]);
    if (s.vatEstimated) summaryRows.push(['*', this.rx().vatEstimatedNote]);
    return [
      { title: r.summary, headers: ['', r.amount], rows: summaryRows },
      {
        title: r.sale,
        headers: ['No', r.date, r.customer, r.payment, r.amount, this.rx().vat, this.rx().netSales, r.cost, r.grossProfit, r.interestIncome],
        rows: this.sales().map(x => {
          const cost = round2(saleCost(x, pm).cost);
          const v = saleVat(x, pm);
          return [
            x.saleNumber, this.formatTime(x.createdAt), x.customerName || r.cashCustomer, this.paymentLabel(x.paymentMethod),
            x.totalAmount, v.vat, v.net, cost, round2(v.net - cost), round2(saleInterest(x)),
          ];
        }),
      },
      {
        title: r.topProducts,
        headers: ['#', r.product, r.quantity, r.revenue],
        rows: this.top().map((p, i) => [i + 1, p.name, p.quantity, p.revenue]),
      },
      {
        title: r.byCategory,
        headers: [r.category, r.quantity, r.revenue],
        rows: this.categories().map(x => [x.category, x.quantity, x.revenue]),
      },
    ];
  }

  async export(kind: 'xlsx' | 'pdf'): Promise<void> {
    this.exporting.set(kind);
    try {
      const label = this.periodLabel();
      const range = getPeriodRange(this.period());
      const pad = (n: number) => String(n).padStart(2, '0');
      const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const fileName = `rapor-${day(range.start)}_${day(range.end)}`;
      const tables = this.buildExportTables();
      if (kind === 'xlsx') {
        await exportExcel(fileName, tables);
      } else {
        await exportPdf(fileName, `${this.t().reports.title} — ${label}`, tables.map(tb => ({
          ...tb,
          rows: tb.rows.map(row => row.map(v => typeof v === 'number' && tb.headers.length > 1 ? this.fmtNum(v) : v)),
        })));
      }
    } catch (e) {
      console.error('[Reports] export error:', e);
      this.toast.add({ severity: 'error', summary: '', detail: this.t().reports.exportFailed, life: 4000 });
    } finally {
      this.exporting.set(null);
    }
  }

  private fmtNum(v: number): string {
    return Number.isInteger(v) ? String(v) : v.toLocaleString(this.t().reports.dateLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
