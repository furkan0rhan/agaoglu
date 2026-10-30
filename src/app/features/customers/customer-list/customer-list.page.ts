import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { CustomerService } from '../services/customer.service';
import { maskTcNo } from '../services/customer.utils';
import { Customer } from '../../../shared/models/customer.model';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { LangService } from '../../../core/i18n/lang.service';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { retry, timer, throwError, switchMap } from 'rxjs';
import {
  AvatarComponent, EmptyStateComponent, GlassCardComponent, MoneyComponent, PageHeaderComponent, StatCardComponent,
  StatusBadgeComponent,
} from '../../../shared/ui';

type ListFilter = 'all' | 'debt' | 'archived';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [
    RouterLink, CurrencyTrPipe, ButtonModule, InputTextModule, IconFieldModule, InputIconModule, ToastModule,
    PageHeaderComponent, GlassCardComponent, StatCardComponent, EmptyStateComponent, StatusBadgeComponent, MoneyComponent,
    AvatarComponent,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p-toast />

    <ui-page-header [title]="t().customers.title" icon="pi-users"
      [subtitle]="filtered().length + ' ' + t().customers.countSuffix">
      <p-button [label]="t().customers.newCustomer" icon="pi pi-plus" [routerLink]="['new']" />
    </ui-page-header>

    <div class="page-body">
      @if (!showArchived()) {
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
          <ui-stat-card icon="pi-users" [label]="a().customerCount" [value]="customers().length" [loading]="loading()" />
          <ui-stat-card icon="pi-book" tone="warning" [label]="a().debtorCount" [value]="debtorCount()" [loading]="loading()" />
          <ui-stat-card class="col-span-2 lg:col-span-1" icon="pi-wallet" tone="danger" [highlight]="receivable() > 0"
            [label]="a().receivable" [value]="receivable() | currencyTr" link="/credit" [loading]="loading()" />
        </div>
      }

      <ui-glass-card [title]="a().customersTitle" icon="pi-users" padding="none" clip>
        <!-- Filtre + arama -->
        <div class="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-4">
          <div class="flex flex-wrap gap-2" role="group" [attr.aria-label]="t().common.filters">
            @for (f of filters(); track f.value) {
              <button type="button" (click)="filter.set(f.value)" [attr.aria-pressed]="filter() === f.value"
                class="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-token-md border px-3.5 text-13.5 font-semibold transition-colors"
                [class]="filter() === f.value ? 'border-brand-line bg-brand-soft text-brand-text' : 'border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover'">
                @if (f.icon) { <i class="pi text-12" [class]="f.icon" aria-hidden="true"></i> }
                {{ f.label }}
              </button>
            }
          </div>
          <p-iconfield class="block w-full sm:ml-auto sm:w-80">
            <p-inputicon styleClass="pi pi-search" />
            <input pInputText type="search" class="w-full" [value]="q()"
              (input)="search($any($event.target).value)"
              [placeholder]="t().customers.searchPlaceholder" [attr.aria-label]="t().common.search" />
          </p-iconfield>
        </div>

        @if (loading()) {
          <div class="flex flex-col gap-3 p-4" aria-hidden="true">
            @for (i of [1, 2, 3, 4]; track i) { <div class="h-10 animate-pulse rounded-token-md bg-surface-muted"></div> }
          </div>
        } @else if (filtered().length === 0) {
          <ui-empty-state compact icon="pi-users" [title]="t().customers.noCustomers"
            [description]="q() ? '' : t().customers.emptyHint">
            @if (!q() && filter() === 'all') {
              <p-button [label]="t().customers.newCustomer" icon="pi pi-plus" [routerLink]="['new']" />
            }
          </ui-empty-state>
        } @else {
          <!-- Masaüstü tablo -->
          <div class="hidden overflow-x-auto md:block">
            <table class="w-full border-collapse text-14.5">
              <thead>
                <tr class="bg-surface-muted text-left text-12 font-semibold uppercase tracking-[0.03em] text-fg-muted">
                  <th class="h-10 border-b border-line px-4">{{ a().colCustomer }}</th>
                  <th class="h-10 border-b border-line px-3">{{ a().colVillage }}</th>
                  <th class="h-10 border-b border-line px-3">{{ a().colPhone }}</th>
                  <th class="hidden h-10 border-b border-line px-3 xl:table-cell">{{ a().colTc }}</th>
                  <th class="h-10 border-b border-line px-4 text-right">{{ a().colBalance }}</th>
                </tr>
              </thead>
              <tbody>
                @for (c of filtered(); track c.id) {
                  <tr class="list-row cursor-pointer border-b border-line last:border-b-0" (click)="open(c)">
                    <td class="h-[56px] px-4">
                      <div class="flex min-w-0 items-center gap-3">
                        <ui-avatar size="sm" [name]="c.firstName + ' ' + c.lastName" />
                        <div class="min-w-0">
                          <a [routerLink]="[c.id]" (click)="$event.stopPropagation()"
                            class="block truncate font-semibold text-fg no-underline hover:text-brand-text hover:underline">{{ c.firstName }} {{ c.lastName }}</a>
                          @if (c.email) { <span class="block truncate text-12.5 text-fg-muted">{{ c.email }}</span> }
                        </div>
                      </div>
                    </td>
                    <td class="max-w-[200px] truncate px-3 text-fg-secondary">{{ c.village || '–' }}</td>
                    <td class="num whitespace-nowrap px-3 text-fg-secondary">{{ c.phone || '–' }}</td>
                    <td class="num hidden whitespace-nowrap px-3 text-13 text-fg-muted xl:table-cell">{{ c.tcNo ? mask(c.tcNo) : '–' }}</td>
                    <td class="whitespace-nowrap px-4 text-right">
                      @if (!c.isActive) {
                        <ui-status-badge tone="neutral">{{ c.anonymizedAt ? t().customers.anonymizedBadge : t().customers.archivedBadge }}</ui-status-badge>
                      } @else if (c.balance > 0) {
                        <ui-money class="font-display text-15.5 font-extrabold text-danger-text" [value]="c.balance" />
                      } @else {
                        <span class="text-13 text-fg-muted">{{ t().customers.noDebt }}</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Mobil satırlar -->
          <ul class="m-0 list-none p-0 md:hidden">
            @for (c of filtered(); track c.id) {
              <li class="border-b border-line last:border-b-0">
                <a [routerLink]="[c.id]" class="list-row flex min-h-[64px] items-center gap-3 px-3 py-2.5 no-underline">
                  <ui-avatar [name]="c.firstName + ' ' + c.lastName" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-15 font-semibold text-fg">{{ c.firstName }} {{ c.lastName }}</span>
                    <span class="num mt-0.5 block truncate text-12.5 text-fg-muted">{{ c.village ? c.village + ' · ' : '' }}{{ c.phone }}</span>
                  </span>
                  @if (!c.isActive) {
                    <ui-status-badge tone="neutral" size="sm">{{ t().customers.archivedBadge }}</ui-status-badge>
                  } @else if (c.balance > 0) {
                    <ui-money class="font-display shrink-0 text-15.5 font-extrabold text-danger-text" [value]="c.balance" />
                  }
                  <i class="pi pi-chevron-right text-xs text-fg-muted" aria-hidden="true"></i>
                </a>
              </li>
            }
          </ul>
        }
      </ui-glass-card>
    </div>
  `,
})
export class CustomerListPage implements OnInit {
  private readonly svc = inject(CustomerService);
  private readonly toast = inject(MessageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly t = inject(LangService).t;
  readonly a = computed(() => this.t().acc);
  readonly customers = signal<Customer[]>([]);
  readonly q = signal('');
  readonly filter = signal<ListFilter>('all');
  readonly showArchived = computed(() => this.filter() === 'archived');
  readonly loading = signal(true);
  private readonly showArchived$ = toObservable(this.showArchived);

  readonly filters = computed(() => [
    { value: 'all' as ListFilter, label: this.a().filterAll, icon: '' },
    { value: 'debt' as ListFilter, label: this.a().filterDebtors, icon: 'pi-book' },
    { value: 'archived' as ListFilter, label: this.t().customers.showArchived, icon: 'pi-inbox' },
  ]);

  ngOnInit(): void {
    this.showArchived$.pipe(
      switchMap(archived => (archived ? this.svc.getArchived$() : this.svc.getAll$()).pipe(
        retry({
          count: 20,
          delay: (err) => {
            // İndeks oluşturuluyorsa bekle-yeniden dene; diğer hatalarda akışı hata ile sonlandır (toast görünsün).
            if (err?.message?.includes('currently building')) return timer(5000);
            return throwError(() => err);
          },
        }),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: c => { this.customers.set(c); this.loading.set(false); },
      error: () => {
        this.loading.set(false);
        this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().customers.loadError });
      },
    });
  }

  readonly debtorCount = computed(() => this.customers().filter(c => c.isActive && c.balance > 0).length);
  readonly receivable = computed(() =>
    Math.round(this.customers().reduce((s, c) => s + (c.isActive && c.balance > 0 ? c.balance : 0), 0) * 100) / 100);

  readonly filtered = computed(() => {
    const q = this.q().trim().toLocaleLowerCase('tr');
    let list = this.customers();
    if (this.filter() === 'debt') list = list.filter(c => c.balance > 0).sort((x, y) => y.balance - x.balance);
    if (!q) return list;
    return list.filter(c =>
      `${c.firstName} ${c.lastName}`.toLocaleLowerCase('tr').includes(q) ||
      (c.phone ?? '').includes(q) ||
      (c.village ?? '').toLocaleLowerCase('tr').includes(q) ||
      (c.email ?? '').toLocaleLowerCase('tr').includes(q)
    );
  });

  open(c: Customer): void { void this.router.navigate(['/customers', c.id]); }

  search(q: string) { this.q.set(q); }

  /** Listede TC no her zaman maskeli (KVKK). */
  mask(tc: string): string { return maskTcNo(tc); }
}
