import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, map, of, startWith } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { LangService } from '../../../core/i18n/lang.service';
import { LoggerService } from '../../../core/logging/logger.service';
import { TenantSettingsService } from '../../../core/settings/tenant-settings.service';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { Customer } from '../../../shared/models/customer.model';
import {
  EmptyStateComponent, GlassCardComponent, MoneyComponent, PageHeaderComponent, SegmentedComponent, StatCardComponent, UiSegmentOption, UiTone,
} from '../../../shared/ui';
import { CreditService } from '../../credit/services/credit.service';
import { AGING_BUCKETS, AgingBucket, AgingRow, emptyAging, sumAging } from '../../credit/services/credit.utils';
import { exportExcel, exportPdf, ExportTable } from '../services/report-export';
import { injectReportTexts } from '../reports.i18n';

interface Row { customer: Customer; name: string; aging: AgingRow }
type View = 'all' | 'overdue';

/**
 * 5.7 Alacak yaşlandırma raporu (Raporlar, yönetici). Dilimler: vadesi gelmemiş, 1-30, 31-60, 61-90, 90+ gün gecikme;
 * müşteri bazında ve toplam. Hesap: credit.utils → buildSchedule + agingOf (varsayılan vade Ayarlar → Veresiye).
 */
@Component({
  selector: 'app-credit-aging',
  standalone: true,
  imports: [
    CurrencyTrPipe, RouterLink, FormsModule, ButtonModule, InputTextModule, ToastModule,
    PageHeaderComponent, GlassCardComponent, StatCardComponent, EmptyStateComponent, MoneyComponent, SegmentedComponent,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p-toast />
    <ui-page-header [title]="rx().agingTitle" [subtitle]="rx().agingSubtitle(rows().length)" backLink="/reports">
      <p-button icon="pi pi-file-excel" [label]="t().reports.exportExcel" severity="secondary"
        [loading]="exporting() === 'xlsx'" [disabled]="loading() || !!exporting() || rows().length === 0" (onClick)="export('xlsx')" />
      <p-button icon="pi pi-file-pdf" [label]="t().reports.exportPdf" severity="secondary"
        [loading]="exporting() === 'pdf'" [disabled]="loading() || !!exporting() || rows().length === 0" (onClick)="export('pdf')" />
    </ui-page-header>

    <div class="page-body">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-6 lg:gap-4">
        <ui-stat-card class="col-span-2 lg:col-span-1" icon="pi-book" tone="neutral" [label]="rx().agingBalance"
          [value]="totals().total | currencyTr" [hint]="rx().agingOverdue + ': ' + money(totals().overdue)" [loading]="loading()" />
        @for (b of buckets; track b) {
          <ui-stat-card [icon]="b === 'notDue' ? 'pi-calendar' : 'pi-clock'" [tone]="bucketTone[b]" [tinted]="b === 'd90p' && totals().d90p > 0"
            [label]="bucketLabel(b)" [value]="totals()[b] | currencyTr" [hint]="pct(totals()[b])" [loading]="loading()" />
        }
      </div>

      <ui-glass-card [title]="rx().agingByCustomer" icon="pi-users" iconTone="accent" padding="none" clip>
        <div class="flex flex-wrap items-center gap-2 border-b border-line p-3 sm:px-4">
          <input pInputText class="h-11 min-w-0 flex-1 sm:max-w-xs" [attr.aria-label]="rx().agingSearch" [placeholder]="rx().agingSearch"
            [ngModel]="search()" (ngModelChange)="search.set($event ?? '')" />
          <ui-segmented size="sm" [options]="views()" [value]="view()" (valueChange)="view.set($event ?? 'all')" [ariaLabel]="rx().agingByCustomer" />
        </div>

        @if (loading()) {
          <div class="flex flex-col gap-3 p-4" aria-hidden="true">
            @for (i of [1, 2, 3, 4]; track i) { <div class="h-11 animate-pulse rounded-token-md bg-surface-muted"></div> }
          </div>
        } @else if (error()) {
          <ui-empty-state compact icon="pi-exclamation-triangle" tone="danger" [title]="rx().agingFailed" />
        } @else if (visible().length === 0) {
          <ui-empty-state compact icon="pi-check-circle" tone="success" [title]="rx().agingEmpty" />
        } @else {
          <div class="hidden overflow-x-auto md:block">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="h-10 border-b border-line bg-surface-muted text-left text-12.5 uppercase tracking-wide text-fg-muted">
                  <th class="px-4 font-bold">{{ rx().agingCustomer }}</th>
                  @for (b of buckets; track b) { <th class="whitespace-nowrap px-3 text-right font-bold">{{ bucketLabel(b) }}</th> }
                  <th class="px-4 text-right font-bold">{{ rx().agingBalance }}</th>
                </tr>
              </thead>
              <tbody>
                @for (r of visible(); track r.customer.id) {
                  <tr class="list-row h-[48px] border-b border-line">
                    <td class="px-4">
                      <a [routerLink]="['/credit', r.customer.id]" class="font-semibold text-fg no-underline hover:underline">{{ r.name }}</a>
                      @if (r.aging.maxDaysOverdue > 0) {
                        <span class="num ml-2 text-xs text-danger-text">{{ r.aging.maxDaysOverdue }} {{ t().compliance.days }}</span>
                      }
                    </td>
                    @for (b of buckets; track b) {
                      <td class="num px-3 text-right" [class]="r.aging[b] > 0 ? bucketText[b] : 'text-fg-muted'">{{ r.aging[b] > 0 ? money(r.aging[b]) : '—' }}</td>
                    }
                    <td class="px-4 text-right"><ui-money class="num font-extrabold text-fg" [value]="r.aging.total" /></td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr class="h-[48px] bg-surface-muted font-bold">
                  <td class="px-4 text-fg">{{ rx().agingTotalRow }}</td>
                  @for (b of buckets; track b) { <td class="num px-3 text-right text-fg">{{ money(visibleTotals()[b]) }}</td> }
                  <td class="num px-4 text-right text-fg">{{ money(visibleTotals().total) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <ul class="m-0 flex list-none flex-col p-0 md:hidden">
            @for (r of visible(); track r.customer.id) {
              <li class="border-b border-line last:border-b-0">
                <a [routerLink]="['/credit', r.customer.id]" class="list-row flex flex-col gap-1.5 px-4 py-3 no-underline">
                  <span class="flex items-center justify-between gap-3">
                    <span class="min-w-0 truncate text-15 font-semibold text-fg">{{ r.name }}</span>
                    <ui-money class="num shrink-0 font-extrabold text-fg" [value]="r.aging.total" />
                  </span>
                  <span class="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    @for (b of buckets; track b) {
                      @if (r.aging[b] > 0) { <span class="num" [class]="bucketText[b]">{{ bucketLabel(b) }}: {{ money(r.aging[b]) }}</span> }
                    }
                  </span>
                </a>
              </li>
            }
          </ul>
        }
        <p class="m-0 border-t border-line px-4 py-3 text-xs text-fg-muted">{{ rx().agingNote(dueDays()) }}</p>
      </ui-glass-card>
    </div>
  `,
})
export class CreditAgingPage {
  private readonly credit = inject(CreditService);
  private readonly settings = inject(TenantSettingsService);
  private readonly toast = inject(MessageService);
  private readonly logger = inject(LoggerService);
  readonly t = inject(LangService).t;
  readonly rx = injectReportTexts();
  readonly buckets = AGING_BUCKETS;
  readonly bucketTone: Record<AgingBucket, UiTone> = { notDue: 'success', d0_30: 'info', d31_60: 'warning', d61_90: 'accent', d90p: 'danger' };
  readonly bucketText: Record<AgingBucket, string> = {
    notDue: 'text-fg', d0_30: 'text-info-text', d31_60: 'text-warning-text', d61_90: 'text-accent-text', d90p: 'text-danger-text font-semibold',
  };

  private readonly data = toSignal(
    this.credit.agingByCustomer$().pipe(
      map(rows => ({ rows: rows.map(x => ({ ...x, name: `${x.customer.firstName ?? ''} ${x.customer.lastName ?? ''}`.trim() })).sort((a, b) => b.aging.overdue - a.aging.overdue || b.aging.total - a.aging.total), error: false, loading: false })),
      catchError(err => {
        this.logger.error('credit aging load', err);
        return of({ rows: [] as Row[], error: true, loading: false });
      }),
      startWith({ rows: [] as Row[], error: false, loading: true }),
    ),
    { requireSync: true },
  );
  readonly rows = computed(() => this.data().rows);
  readonly loading = computed(() => this.data().loading);
  readonly error = computed(() => this.data().error);
  readonly totals = computed(() => sumAging(this.rows().map(r => r.aging)));
  readonly dueDays = computed(() => this.settings.credit().defaultDueDays || 0);

  readonly search = signal('');
  readonly view = signal<View>('all');
  readonly views = computed<UiSegmentOption<View>[]>(() => [
    { value: 'all', label: this.rx().agingAll },
    { value: 'overdue', label: this.rx().agingOnlyOverdue },
  ]);
  readonly visible = computed(() => {
    const q = this.search().trim().toLocaleLowerCase('tr');
    return this.rows().filter(r =>
      (this.view() === 'all' || r.aging.overdue > 0)
      && (!q || r.name.toLocaleLowerCase('tr').includes(q) || (r.customer.phone ?? '').includes(q)));
  });
  readonly visibleTotals = computed(() => (this.visible().length ? sumAging(this.visible().map(r => r.aging)) : emptyAging()));

  readonly exporting = signal<'xlsx' | 'pdf' | null>(null);
  private readonly pipe = new CurrencyTrPipe();
  readonly money = (v: number) => this.pipe.transform(v);

  bucketLabel(b: AgingBucket): string {
    const r = this.rx();
    return { notDue: r.bucketNotDue, d0_30: r.bucket0_30, d31_60: r.bucket31_60, d61_90: r.bucket61_90, d90p: r.bucket90p }[b];
  }

  pct(v: number): string {
    const total = this.totals().total;
    return total > 0 ? `%${Math.round((v / total) * 100)}` : '';
  }

  private tables(): ExportTable[] {
    const r = this.rx();
    const rows = this.visible();
    const tot = this.visibleTotals();
    return [
      {
        title: r.agingTotals,
        headers: ['', r.agingBalance],
        rows: [...this.buckets.map(b => [this.bucketLabel(b), tot[b]] as (string | number)[]), [r.agingBalance, tot.total], [r.agingOverdue, tot.overdue]],
      },
      {
        title: r.agingByCustomer,
        headers: [r.agingCustomer, r.agingPhone, ...this.buckets.map(b => this.bucketLabel(b)), r.agingBalance, r.agingMaxDays],
        rows: [
          ...rows.map(x => [x.name, x.customer.phone ?? '', ...this.buckets.map(b => x.aging[b]), x.aging.total, x.aging.maxDaysOverdue]),
          [r.agingTotalRow, '', ...this.buckets.map(b => tot[b]), tot.total, tot.maxDaysOverdue],
        ],
      },
    ];
  }

  async export(kind: 'xlsx' | 'pdf'): Promise<void> {
    this.exporting.set(kind);
    try {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const fileName = `alacak-yaslandirma-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const tables = this.tables();
      if (kind === 'xlsx') {
        await exportExcel(fileName, tables);
      } else {
        await exportPdf(fileName, `${this.rx().agingTitle} — ${d.toLocaleDateString(this.t().reports.dateLocale)}`, tables.map(tb => ({
          ...tb,
          rows: tb.rows.map(row => row.map(v => (typeof v === 'number' ? this.fmtNum(v) : v))),
        })));
      }
    } catch (e) {
      this.logger.error('credit aging export', e);
      this.toast.add({ severity: 'error', summary: '', detail: this.t().reports.exportFailed, life: 4000 });
    } finally {
      this.exporting.set(null);
    }
  }

  private fmtNum(v: number): string {
    return Number.isInteger(v) ? String(v) : v.toLocaleString(this.t().reports.dateLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
