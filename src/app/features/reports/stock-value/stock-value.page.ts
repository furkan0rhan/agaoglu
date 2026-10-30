import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { LangService } from '../../../core/i18n/lang.service';
import { LoggerService } from '../../../core/logging/logger.service';
import { AuthService } from '../../../core/auth/services/auth.service';
import { TenantSettingsService } from '../../../core/settings/tenant-settings.service';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import {
  EmptyStateComponent, GlassCardComponent, MoneyComponent, PageHeaderComponent, StatCardComponent,
} from '../../../shared/ui';
import { ProductStore } from '../../products/store/product.store';
import { qtyWithUnit } from '../../sales/services/sales.helpers';
import { exportExcel, exportPdf, ExportTable } from '../services/report-export';
import { buildStockValue, StockValueLine } from '../services/stock-value';
import { injectReportTexts } from '../reports.i18n';

/**
 * 5.11 Stok değer raporu: alış (KDV hariç) ve satış (KDV hariç / dahil) değeri; kategori ve ürün bazında; SKT yakın değer.
 * Yetki: yönetici ya da `seeCosts` (rota guard'ı app.routes.ts). Veri: ProductStore (canlı ürün listesi), saf hesap stock-value.ts.
 */
@Component({
  selector: 'app-stock-value',
  standalone: true,
  imports: [
    CurrencyTrPipe, RouterLink, FormsModule, ButtonModule, InputTextModule, SelectModule, ToastModule,
    PageHeaderComponent, GlassCardComponent, StatCardComponent, EmptyStateComponent, MoneyComponent,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p-toast />
    <ui-page-header [title]="rx().stockValueTitle" [subtitle]="rx().stockValueSubtitle(report().lines.length)" [backLink]="isAdmin() ? '/reports' : null">
      <p-button icon="pi pi-file-excel" [label]="t().reports.exportExcel" severity="secondary"
        [loading]="exporting() === 'xlsx'" [disabled]="loading() || !!exporting() || report().lines.length === 0" (onClick)="export('xlsx')" />
      <p-button icon="pi pi-file-pdf" [label]="t().reports.exportPdf" severity="secondary"
        [loading]="exporting() === 'pdf'" [disabled]="loading() || !!exporting() || report().lines.length === 0" (onClick)="export('pdf')" />
    </ui-page-header>

    <div class="page-body">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
        <ui-stat-card icon="pi-wallet" tone="accent" [label]="rx().svCost" [value]="totals().costValue | currencyTr"
          [hint]="totals().productCount + ' ' + rx().svProductCount" [loading]="loading()" />
        <ui-stat-card icon="pi-tag" tone="info" [label]="rx().svSaleNet" [value]="totals().saleValueNet | currencyTr" [loading]="loading()" />
        <ui-stat-card icon="pi-receipt" tone="neutral" [label]="rx().svSaleGross" [value]="totals().saleValueGross | currencyTr" [loading]="loading()" />
        <ui-stat-card icon="pi-chart-line" [tone]="totals().potentialProfit < 0 ? 'danger' : 'brand'" [label]="rx().svProfit"
          [value]="totals().potentialProfit | currencyTr" [loading]="loading()" />
        <ui-stat-card class="col-span-2 lg:col-span-1" icon="pi-hourglass" [tone]="totals().nearExpiryCost > 0 ? 'warning' : 'success'"
          [tinted]="totals().nearExpiryCost > 0" [label]="rx().svNear(nearDays())" [value]="totals().nearExpiryCost | currencyTr"
          [hint]="totals().expiredCost > 0 ? rx().svExpired + ': ' + money(totals().expiredCost) : ''" [loading]="loading()" />
      </div>

      <div class="flex gap-2.5 rounded-token-lg border border-info-line bg-info-soft px-3 py-2.5 text-xs text-info-text">
        <i class="pi pi-info-circle mt-0.5" aria-hidden="true"></i>
        <p class="m-0">{{ rx().svVatNote }} @if (totals().noCostCount > 0) { <b>{{ rx().svNoCost(totals().noCostCount) }}</b> }</p>
      </div>

      <!-- Kategori bazında -->
      <ui-glass-card [title]="rx().svByCategory" icon="pi-tags" iconTone="brand" padding="none" clip>
        @if (loading()) {
          <div class="flex flex-col gap-3 p-4" aria-hidden="true">
            @for (i of [1, 2, 3]; track i) { <div class="h-10 animate-pulse rounded-token-md bg-surface-muted"></div> }
          </div>
        } @else if (report().categories.length === 0) {
          <ui-empty-state compact icon="pi-box" [title]="rx().svEmpty" />
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="h-10 border-b border-line bg-surface-muted text-left text-12.5 uppercase tracking-wide text-fg-muted">
                  <th class="px-4 font-bold">{{ rx().svCategory }}</th>
                  <th class="px-3 text-right font-bold">{{ rx().svProductCount }}</th>
                  <th class="px-3 text-right font-bold">{{ rx().svCost }}</th>
                  <th class="hidden px-3 text-right font-bold sm:table-cell">{{ rx().svSaleNet }}</th>
                  <th class="hidden px-3 text-right font-bold lg:table-cell">{{ rx().svSaleGross }}</th>
                  <th class="hidden px-4 text-right font-bold md:table-cell">{{ rx().svNear(nearDays()) }}</th>
                </tr>
              </thead>
              <tbody>
                @for (c of report().categories; track c.category) {
                  <tr class="list-row h-[46px] border-b border-line">
                    <td class="px-4">
                      <button type="button" class="cursor-pointer border-0 bg-transparent p-0 text-left font-semibold text-fg hover:underline"
                        (click)="category.set(c.category)">{{ c.category }}</button>
                    </td>
                    <td class="num px-3 text-right text-fg-secondary">{{ c.productCount }}</td>
                    <td class="num px-3 text-right font-bold text-fg">{{ money(c.costValue) }}</td>
                    <td class="num hidden px-3 text-right text-fg-secondary sm:table-cell">{{ money(c.saleValueNet) }}</td>
                    <td class="num hidden px-3 text-right text-fg-secondary lg:table-cell">{{ money(c.saleValueGross) }}</td>
                    <td class="num hidden px-4 text-right md:table-cell" [class]="c.nearExpiryCost > 0 ? 'text-warning-text' : 'text-fg-muted'">{{ money(c.nearExpiryCost) }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr class="h-[46px] bg-surface-muted font-bold text-fg">
                  <td class="px-4">{{ rx().svTotalRow }}</td>
                  <td class="num px-3 text-right">{{ totals().productCount }}</td>
                  <td class="num px-3 text-right">{{ money(totals().costValue) }}</td>
                  <td class="num hidden px-3 text-right sm:table-cell">{{ money(totals().saleValueNet) }}</td>
                  <td class="num hidden px-3 text-right lg:table-cell">{{ money(totals().saleValueGross) }}</td>
                  <td class="num hidden px-4 text-right md:table-cell">{{ money(totals().nearExpiryCost) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        }
      </ui-glass-card>

      <!-- Ürün bazında -->
      <ui-glass-card [title]="rx().svByProduct" icon="pi-box" iconTone="info" padding="none" clip>
        <div class="flex flex-wrap items-center gap-2 border-b border-line p-3 sm:px-4">
          <input pInputText class="h-11 min-w-0 flex-1 sm:max-w-xs" [attr.aria-label]="rx().svSearch" [placeholder]="rx().svSearch"
            [ngModel]="search()" (ngModelChange)="search.set($event ?? '')" />
          <p-select [options]="categoryOptions()" optionLabel="label" optionValue="value" [ngModel]="category()"
            (ngModelChange)="category.set($event)" [ariaLabel]="rx().svCategory" styleClass="w-full sm:w-56" appendTo="body" />
        </div>
        @if (!loading() && visible().length === 0) {
          <ui-empty-state compact icon="pi-box" [title]="rx().svEmpty" />
        } @else if (!loading()) {
          <div class="hidden overflow-x-auto md:block">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="h-10 border-b border-line bg-surface-muted text-left text-12.5 uppercase tracking-wide text-fg-muted">
                  <th class="px-4 font-bold">{{ rx().svProduct }}</th>
                  <th class="px-3 text-right font-bold">{{ rx().svStock }}</th>
                  <th class="px-3 text-right font-bold">{{ rx().svUnitCost }}</th>
                  <th class="px-3 text-right font-bold">{{ rx().svCost }}</th>
                  <th class="px-3 text-right font-bold">{{ rx().svSaleNet }}</th>
                  <th class="hidden px-3 text-right font-bold xl:table-cell">{{ rx().svSaleGross }}</th>
                  <th class="px-4 text-right font-bold">{{ rx().svNear(nearDays()) }}</th>
                </tr>
              </thead>
              <tbody>
                @for (l of visible(); track l.productId) {
                  <tr class="list-row h-[46px] border-b border-line last:border-b-0">
                    <td class="px-4">
                      <a [routerLink]="['/products', l.productId]" class="font-semibold text-fg no-underline hover:underline">{{ l.name }}</a>
                      <span class="ml-2 text-xs text-fg-muted">{{ l.category }}</span>
                      @if (l.noCost) { <i class="pi pi-exclamation-circle ml-1.5 text-xs text-warning-text" [title]="rx().svNoCost(1)" aria-hidden="true"></i> }
                    </td>
                    <td class="num whitespace-nowrap px-3 text-right text-fg-secondary">{{ qty(l) }}</td>
                    <td class="num px-3 text-right text-fg-secondary">{{ money(l.unitCost) }}</td>
                    <td class="num px-3 text-right font-bold text-fg">{{ money(l.costValue) }}</td>
                    <td class="num px-3 text-right text-fg-secondary">{{ money(l.saleValueNet) }}</td>
                    <td class="num hidden px-3 text-right text-fg-secondary xl:table-cell">{{ money(l.saleValueGross) }}</td>
                    <td class="num px-4 text-right" [class]="l.nearExpiryCost > 0 ? 'text-warning-text' : 'text-fg-muted'">
                      {{ l.nearExpiryQty > 0 ? money(l.nearExpiryCost) : '—' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <ul class="m-0 flex list-none flex-col p-0 md:hidden">
            @for (l of visible(); track l.productId) {
              <li class="border-b border-line last:border-b-0">
                <a [routerLink]="['/products', l.productId]" class="list-row flex items-center gap-3 px-4 py-3 no-underline">
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-15 font-semibold text-fg">{{ l.name }}</span>
                    <span class="num mt-0.5 block text-xs text-fg-muted">{{ qty(l) }} × {{ money(l.unitCost) }} · {{ l.category }}</span>
                    @if (l.nearExpiryQty > 0) { <span class="num block text-xs text-warning-text">{{ rx().svNear(nearDays()) }}: {{ money(l.nearExpiryCost) }}</span> }
                  </span>
                  <span class="flex shrink-0 flex-col items-end">
                    <ui-money class="num font-extrabold text-fg" [value]="l.costValue" />
                    <span class="num text-xs text-fg-muted">{{ money(l.saleValueNet) }}</span>
                  </span>
                </a>
              </li>
            }
          </ul>
        }
      </ui-glass-card>
    </div>
  `,
})
export class StockValuePage implements OnInit {
  private readonly store = inject(ProductStore);
  private readonly settings = inject(TenantSettingsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(MessageService);
  private readonly logger = inject(LoggerService);
  private readonly lang = inject(LangService);
  readonly t = this.lang.t;
  readonly rx = injectReportTexts();
  readonly isAdmin = computed(() => this.auth.hasRole('admin'));

  readonly loading = computed(() => !this.store.loaded());
  readonly nearDays = computed(() => this.settings.expiryWarnDays());
  readonly report = computed(() => buildStockValue(this.store.products(), this.nearDays()));
  readonly totals = computed(() => this.report().totals);

  readonly search = signal('');
  readonly category = signal<string | null>(null);
  readonly categoryOptions = computed(() => [
    { label: this.rx().svAllCategories, value: null as string | null },
    ...this.report().categories.map(c => ({ label: c.category, value: c.category as string | null })),
  ]);
  readonly visible = computed(() => {
    const q = this.search().trim().toLocaleLowerCase('tr');
    const cat = this.category();
    return this.report().lines.filter(l => (!cat || l.category === cat) && (!q || l.name.toLocaleLowerCase('tr').includes(q)));
  });

  readonly exporting = signal<'xlsx' | 'pdf' | null>(null);
  private readonly pipe = new CurrencyTrPipe();
  readonly money = (v: number) => this.pipe.transform(v);

  ngOnInit(): void {
    this.store.ensureLoaded();
  }

  qty(l: StockValueLine): string {
    return qtyWithUnit(this.t(), l.stock, l.unit, this.lang.lang());
  }

  private tables(): ExportTable[] {
    const r = this.rx(), tot = this.totals(), n = this.nearDays();
    return [
      {
        title: r.stockValueTitle,
        headers: ['', r.svCost],
        rows: [
          [r.svCost, tot.costValue], [r.svSaleNet, tot.saleValueNet], [r.svSaleGross, tot.saleValueGross],
          [r.svProfit, tot.potentialProfit], [r.svNear(n), tot.nearExpiryCost], [r.svNearSale(n), tot.nearExpirySaleNet],
          [r.svExpired, tot.expiredCost], [r.svProductCount, tot.productCount],
        ],
      },
      {
        title: r.svByCategory,
        headers: [r.svCategory, r.svProductCount, r.svCost, r.svSaleNet, r.svSaleGross, r.svProfit, r.svNear(n)],
        rows: [
          ...this.report().categories.map(c => [c.category, c.productCount, c.costValue, c.saleValueNet, c.saleValueGross, c.potentialProfit, c.nearExpiryCost]),
          [r.svTotalRow, tot.productCount, tot.costValue, tot.saleValueNet, tot.saleValueGross, tot.potentialProfit, tot.nearExpiryCost],
        ],
      },
      {
        title: r.svByProduct,
        headers: [r.svProduct, r.svCategory, r.svStock, r.svUnitCost, r.svCost, r.svSaleNet, r.svSaleGross, r.svNear(n), r.svExpired],
        rows: this.visible().map(l => [l.name, l.category, this.qty(l), l.unitCost, l.costValue, l.saleValueNet, l.saleValueGross, l.nearExpiryCost, l.expiredCost]),
      },
    ];
  }

  async export(kind: 'xlsx' | 'pdf'): Promise<void> {
    this.exporting.set(kind);
    try {
      const d = new Date();
      const pad = (x: number) => String(x).padStart(2, '0');
      const fileName = `stok-degeri-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const tables = this.tables();
      if (kind === 'xlsx') {
        await exportExcel(fileName, tables);
      } else {
        await exportPdf(fileName, `${this.rx().stockValueTitle} — ${d.toLocaleDateString(this.t().reports.dateLocale)}`, tables.map(tb => ({
          ...tb,
          rows: tb.rows.map(row => row.map(v => (typeof v === 'number' ? this.fmtNum(v) : v))),
        })));
      }
    } catch (e) {
      this.logger.error('stock value export', e);
      this.toast.add({ severity: 'error', summary: '', detail: this.t().reports.exportFailed, life: 4000 });
    } finally {
      this.exporting.set(null);
    }
  }

  private fmtNum(v: number): string {
    return Number.isInteger(v) ? String(v) : v.toLocaleString(this.t().reports.dateLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
