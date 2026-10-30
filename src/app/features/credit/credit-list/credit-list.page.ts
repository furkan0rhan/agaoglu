import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { DatePipe } from '@angular/common';
import { Customer } from '../../../shared/models/customer.model';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { LangService } from '../../../core/i18n/lang.service';
import { CreditService, CustomerCreditStatus, roundKurus } from '../services/credit.service';
import { summarizeOverdue } from '../services/credit.utils';
import {
  AvatarComponent, EmptyStateComponent, GlassCardComponent, MoneyComponent, PageHeaderComponent, StatCardComponent,
  StatusBadgeComponent,
} from '../../../shared/ui';

type DueFilter = 'all' | 'overdue' | 'week';

@Component({
  selector: 'app-credit-list',
  standalone: true,
  imports: [
    RouterLink, DatePipe, CurrencyTrPipe, InputTextModule, IconFieldModule, InputIconModule,
    PageHeaderComponent, StatCardComponent, GlassCardComponent, EmptyStateComponent, AvatarComponent, MoneyComponent,
    StatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ui-page-header [title]="t().credit.title" icon="pi-book" iconTone="danger"
      [subtitle]="allDebtors().length + ' ' + t().credit.debtors" />

    <div class="page-body">
      <!-- Özet blokları -->
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <ui-stat-card icon="pi-wallet" tone="brand" [label]="t().credit.totalReceivable" [value]="totalReceivable() | currencyTr"
          [hint]="allDebtors().length + ' ' + t().credit.debtors" [loading]="loading()" />
        <ui-stat-card icon="pi-exclamation-triangle" tone="danger" [tinted]="overdue().totalOverdue > 0"
          [label]="t().credit.overdueTotal" [value]="overdue().totalOverdue | currencyTr"
          [hint]="overdue().customerCount + ' ' + t().credit.overdueCustomers" [loading]="loading()" />
        <ui-stat-card icon="pi-calendar" tone="warning" [highlight]="dueWeek().amount > 0"
          [label]="a().dueWeek" [value]="dueWeek().amount | currencyTr" [hint]="a().dueWeekHint(dueWeek().count)" [loading]="loading()" />
        <ui-stat-card icon="pi-arrow-up" tone="neutral" [label]="t().credit.largestDebt" [value]="largestDebt() | currencyTr"
          [hint]="largestDebtor()" [loading]="loading()" />
      </div>

      <ui-glass-card [title]="a().debtorsTitle" icon="pi-users" tone="danger" padding="none" clip
        [subtitle]="debtors().length + ' / ' + allDebtors().length">
        <!-- Filtre + arama -->
        <div class="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-4">
          <div class="flex flex-wrap gap-2" role="group" [attr.aria-label]="t().common.filters">
            @for (f of filters(); track f.value) {
              <button type="button" (click)="filter.set(f.value)" [attr.aria-pressed]="filter() === f.value"
                class="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-token-md border px-3.5 text-13.5 font-semibold transition-colors"
                [class]="filter() === f.value ? 'border-brand-line bg-brand-soft text-brand-text' : 'border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover'">
                @if (f.value === 'overdue') { <span class="h-2 w-2 rounded-full bg-danger" aria-hidden="true"></span> }
                @if (f.value === 'week') { <span class="h-2 w-2 rounded-full bg-warning" aria-hidden="true"></span> }
                {{ f.label }}<span class="num opacity-70">{{ f.count }}</span>
              </button>
            }
          </div>
          <p-iconfield class="block w-full sm:ml-auto sm:w-72">
            <p-inputicon styleClass="pi pi-search" />
            <input pInputText type="search" class="w-full" [value]="q()"
              (input)="search($any($event.target).value)"
              [placeholder]="t().credit.searchPlaceholder" [attr.aria-label]="t().common.search" />
          </p-iconfield>
        </div>

        @if (loading()) {
          <div class="flex flex-col gap-3 p-4" aria-hidden="true">
            @for (i of [1, 2, 3, 4]; track i) { <div class="h-10 animate-pulse rounded-token-md bg-surface-muted"></div> }
          </div>
        } @else if (debtors().length === 0) {
          <ui-empty-state compact icon="pi-check-circle" tone="success"
            [title]="filter() === 'all' && !q() ? t().credit.noDebtors : t().credit.noFilterResult" />
        } @else {
          <!-- Masaüstü tablo -->
          <div class="hidden overflow-x-auto md:block">
            <table class="w-full border-collapse text-14.5">
              <thead>
                <tr class="bg-surface-muted text-left text-12 font-semibold uppercase tracking-[0.03em] text-fg-muted">
                  <th class="h-10 border-b border-line px-4">{{ a().colCustomer }}</th>
                  <th class="h-10 border-b border-line px-3">{{ a().colStatus }}</th>
                  <th class="h-10 border-b border-line px-3">{{ a().colNextDue }}</th>
                  <th class="h-10 border-b border-line px-3 text-right">{{ a().colOverdue }}</th>
                  <th class="h-10 border-b border-line px-4 text-right">{{ a().colDebt }}</th>
                </tr>
              </thead>
              <tbody>
                @for (s of debtors(); track s.customer.id) {
                  @let c = s.customer;
                  <tr class="list-row cursor-pointer border-b border-line last:border-b-0"
                    [class.shadow-[inset_3px_0_0_var(--danger)]]="s.overdueAmount > 0" (click)="open(c)">
                    <td class="h-[56px] px-4">
                      <div class="flex min-w-0 items-center gap-3">
                        <ui-avatar size="sm" [name]="c.firstName + ' ' + c.lastName" />
                        <div class="min-w-0">
                          <a [routerLink]="[c.id]" (click)="$event.stopPropagation()"
                            class="block truncate font-semibold text-fg no-underline hover:text-brand-text hover:underline">{{ c.firstName }} {{ c.lastName }}</a>
                          <span class="num block truncate text-12.5 text-fg-muted">{{ c.village ? c.village + ' · ' : '' }}{{ c.phone }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="px-3">
                      @if (s.overdueAmount > 0) {
                        <ui-status-badge tone="danger" icon="pi-clock">{{ s.maxDaysOverdue }} {{ t().credit.daysLate }}</ui-status-badge>
                      } @else if (s.dueThisWeekAmount > 0) {
                        <ui-status-badge tone="warning" icon="pi-calendar">{{ t().credit.dueThisWeek }}</ui-status-badge>
                      } @else if (s.nextDue) {
                        <ui-status-badge tone="success">{{ a().onTime }}</ui-status-badge>
                      } @else {
                        <ui-status-badge tone="neutral">{{ a().undatedOnly }}</ui-status-badge>
                      }
                    </td>
                    <td class="num whitespace-nowrap px-3 text-fg-secondary">
                      @if (s.nextDue; as n) {
                        {{ n.date | date:'dd.MM.yyyy' }}<span class="block text-12.5 text-fg-muted">{{ n.amount | currencyTr }}</span>
                      } @else { <span class="text-fg-muted">–</span> }
                    </td>
                    <td class="num whitespace-nowrap px-3 text-right font-bold"
                      [class]="s.overdueAmount > 0 ? 'text-danger-text' : 'text-fg-muted'">
                      {{ s.overdueAmount > 0 ? (s.overdueAmount | currencyTr) : '–' }}
                    </td>
                    <td class="px-4 text-right">
                      <ui-money class="font-display text-15.5 font-extrabold text-fg" [value]="c.balance" />
                      <span class="ml-auto mt-1 block h-1.5 w-24 overflow-hidden rounded-full bg-surface-strong" aria-hidden="true">
                        <span class="block h-full rounded-full" [class]="s.overdueAmount > 0 ? 'bg-danger' : 'bg-brand'" [style.width.%]="share(c)"></span>
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Mobil satırlar -->
          <ul class="m-0 list-none p-0 md:hidden">
            @for (s of debtors(); track s.customer.id) {
              @let c = s.customer;
              <li class="border-b border-line last:border-b-0" [class.shadow-[inset_3px_0_0_var(--danger)]]="s.overdueAmount > 0">
                <a [routerLink]="[c.id]" class="list-row flex min-h-[64px] items-center gap-3 px-3 py-2.5 no-underline">
                  <ui-avatar [name]="c.firstName + ' ' + c.lastName" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-15 font-semibold text-fg">{{ c.firstName }} {{ c.lastName }}</span>
                    <span class="mt-1 flex flex-wrap items-center gap-1.5">
                      @if (s.overdueAmount > 0) {
                        <ui-status-badge tone="danger" size="sm" icon="pi-clock">{{ s.maxDaysOverdue }} {{ t().credit.daysLate }}</ui-status-badge>
                      } @else if (s.nextDue) {
                        <span class="num text-12.5 text-fg-muted">{{ t().credit.nextDue }}: {{ s.nextDue.date | date:'dd.MM.yyyy' }}</span>
                      } @else {
                        <span class="truncate text-12.5 text-fg-muted">{{ c.village || c.phone }}</span>
                      }
                    </span>
                  </span>
                  <span class="flex shrink-0 flex-col items-end leading-tight">
                    <ui-money class="font-display text-16 font-extrabold text-fg" [value]="c.balance" />
                    @if (s.overdueAmount > 0) {
                      <span class="num text-11.5 font-semibold text-danger-text">{{ s.overdueAmount | currencyTr }}</span>
                    }
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
export class CreditListPage implements OnInit {
  private readonly svc = inject(CreditService);
  private readonly router = inject(Router);
  readonly t = inject(LangService).t;
  readonly a = computed(() => this.t().acc);
  readonly statuses = signal<CustomerCreditStatus[]>([]);
  readonly q = signal('');
  readonly filter = signal<DueFilter>('all');
  readonly loading = signal(true);

  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.svc.statusByCustomer$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: m => { this.statuses.set([...m.values()]); this.loading.set(false); },
      error: () => { this.statuses.set([]); this.loading.set(false); },
    });
  }

  open(c: Customer): void { void this.router.navigate(['/credit', c.id]); }

  readonly dueWeek = computed(() => {
    const list = this.statuses().filter(s => s.dueThisWeekAmount > 0);
    return { amount: roundKurus(list.reduce((sum, s) => sum + s.dueThisWeekAmount, 0)), count: list.length };
  });

  /** Borcu olan tüm müşteriler, en çok borçlu üstte (aramadan bağımsız). */
  readonly allDebtors = computed(() =>
    [...this.statuses()].sort((a, b) => b.customer.balance - a.customer.balance));

  readonly overdue = computed(() => summarizeOverdue(this.statuses()));

  readonly filters = computed(() => {
    const cr = this.t().credit;
    const all = this.allDebtors();
    return [
      { value: 'all' as DueFilter, label: cr.filterAll, count: all.length },
      { value: 'overdue' as DueFilter, label: cr.filterOverdue, count: all.filter(s => s.overdueAmount > 0).length },
      { value: 'week' as DueFilter, label: cr.filterDueWeek, count: all.filter(s => s.dueThisWeekAmount > 0).length },
    ];
  });

  readonly debtors = computed(() => {
    const f = this.filter();
    let list = this.allDebtors();
    if (f === 'overdue') {
      // En uzun geciken üstte
      list = list.filter(s => s.overdueAmount > 0)
        .sort((a, b) => b.maxDaysOverdue - a.maxDaysOverdue || b.overdueAmount - a.overdueAmount);
    } else if (f === 'week') {
      list = list.filter(s => s.dueThisWeekAmount > 0)
        .sort((a, b) => (a.nextDue?.date.getTime() ?? 0) - (b.nextDue?.date.getTime() ?? 0));
    }
    const q = this.q().trim().toLocaleLowerCase('tr');
    if (!q) return list;
    return list.filter(({ customer: c }) =>
      `${c.firstName} ${c.lastName}`.toLocaleLowerCase('tr').includes(q) || (c.phone ?? '').includes(q));
  });

  readonly totalReceivable = computed(() => roundKurus(this.allDebtors().reduce((s, c) => s + c.customer.balance, 0)));
  readonly largestDebt = computed(() => this.allDebtors()[0]?.customer.balance ?? 0);
  readonly largestDebtor = computed(() => {
    const c = this.allDebtors()[0]?.customer;
    return c ? `${c.firstName} ${c.lastName}` : '';
  });

  /** En büyük borca göre oran (çubuk genişliği). */
  share(c: Customer): number {
    const max = this.largestDebt();
    return max > 0 ? Math.max(4, Math.round((c.balance / max) * 100)) : 0;
  }

  search(q: string) { this.q.set(q); }
}
