import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SupplierService } from '../services/supplier.service';
import { Supplier } from '../../../shared/models/supplier.model';
import { LangService } from '../../../core/i18n/lang.service';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import {
  AvatarComponent, EmptyStateComponent, GlassCardComponent, MoneyComponent, PageHeaderComponent, StatCardComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-supplier-list',
  standalone: true,
  imports: [
    RouterLink, CurrencyTrPipe, ButtonModule, InputTextModule, IconFieldModule, InputIconModule, ToastModule,
    PageHeaderComponent, GlassCardComponent, StatCardComponent, EmptyStateComponent, AvatarComponent, MoneyComponent,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p-toast />

    <ui-page-header [title]="t().suppliers.title" icon="pi-truck" iconTone="info"
      [subtitle]="suppliers().length + ' ' + t().suppliers.countSuffix">
      <p-button [label]="t().suppliers.newSupplier" icon="pi pi-plus" [routerLink]="['new']" />
    </ui-page-header>

    <div class="page-body">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        <ui-stat-card icon="pi-truck" tone="info" [label]="t().acc.supplierCount" [value]="suppliers().length" [loading]="loading()" />
        <ui-stat-card icon="pi-users" tone="warning" [label]="t().acc.owedSuppliers" [value]="owedCount()" [loading]="loading()" />
        <ui-stat-card class="col-span-2 lg:col-span-1" icon="pi-wallet" tone="danger" [highlight]="totalDebt() > 0"
          [label]="t().purchases.weOwe" [value]="totalDebt() | currencyTr" [loading]="loading()" />
      </div>

      <ui-glass-card [title]="t().acc.suppliersTitle" icon="pi-truck" tone="info" padding="none" clip>
        <div class="border-b border-line p-3 sm:px-4">
          <p-iconfield class="block w-full sm:max-w-sm">
            <p-inputicon styleClass="pi pi-search" />
            <input pInputText type="search" class="w-full" [value]="q()"
              (input)="search($any($event.target).value)"
              [placeholder]="t().suppliers.searchPlaceholder" [attr.aria-label]="t().common.search" />
          </p-iconfield>
        </div>

        @if (loading()) {
          <div class="flex flex-col gap-3 p-4" aria-hidden="true">
            @for (i of [1, 2, 3]; track i) { <div class="h-10 animate-pulse rounded-token-md bg-surface-muted"></div> }
          </div>
        } @else if (filtered().length === 0) {
          <ui-empty-state compact icon="pi-truck" [title]="t().suppliers.noSuppliers">
            @if (!q()) {
              <p-button [label]="t().suppliers.newSupplier" icon="pi pi-plus" [routerLink]="['new']" />
            }
          </ui-empty-state>
        } @else {
          <!-- Masaüstü tablo -->
          <div class="hidden overflow-x-auto md:block">
            <table class="w-full border-collapse text-14.5">
              <thead>
                <tr class="bg-surface-muted text-left text-12 font-semibold uppercase tracking-[0.03em] text-fg-muted">
                  <th class="h-10 border-b border-line px-4">{{ t().acc.colCompany }}</th>
                  <th class="h-10 border-b border-line px-3">{{ t().acc.colContact }}</th>
                  <th class="h-10 border-b border-line px-3">{{ t().acc.colTax }}</th>
                  <th class="h-10 border-b border-line px-4 text-right">{{ t().acc.colOwed }}</th>
                </tr>
              </thead>
              <tbody>
                @for (s of filtered(); track s.id) {
                  <tr class="list-row cursor-pointer border-b border-line last:border-b-0" (click)="open(s)"
                    [class.shadow-[inset_3px_0_0_var(--danger)]]="(s.balance ?? 0) > 0">
                    <td class="h-[56px] px-4">
                      <div class="flex min-w-0 items-center gap-3">
                        <ui-avatar size="sm" tone="info" [name]="s.name" />
                        <a [routerLink]="[s.id]" (click)="$event.stopPropagation()"
                          class="min-w-0 truncate font-semibold text-fg no-underline hover:text-brand-text hover:underline">{{ s.name }}</a>
                      </div>
                    </td>
                    <td class="px-3 text-fg-secondary">
                      @if (s.contactPerson || s.phone) {
                        <span class="block truncate">{{ s.contactPerson || '–' }}</span>
                        @if (s.phone) { <span class="num block text-12.5 text-fg-muted">{{ s.phone }}</span> }
                      } @else { <span class="text-fg-muted">{{ t().suppliers.noInfo }}</span> }
                    </td>
                    <td class="num px-3 font-mono text-13 text-fg-secondary">{{ s.taxNo || '–' }}</td>
                    <td class="whitespace-nowrap px-4 text-right">
                      <ui-money class="font-display text-15.5 font-extrabold"
                        [class]="(s.balance ?? 0) > 0 ? 'text-danger-text' : 'text-fg-muted'" [value]="s.balance ?? 0" />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Mobil satırlar -->
          <ul class="m-0 list-none p-0 md:hidden">
            @for (s of filtered(); track s.id) {
              <li class="border-b border-line last:border-b-0">
                <a [routerLink]="[s.id]" class="list-row flex min-h-[64px] items-center gap-3 px-3 py-2.5 no-underline">
                  <ui-avatar [name]="s.name" tone="info" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-15 font-semibold text-fg">{{ s.name }}</span>
                    <span class="num mt-0.5 block truncate text-12.5 text-fg-muted">
                      @if (s.contactPerson || s.phone) {
                        {{ s.contactPerson ?? '' }}{{ s.contactPerson && s.phone ? ' · ' : '' }}{{ s.phone ?? '' }}
                      } @else { {{ t().suppliers.noInfo }} }
                    </span>
                  </span>
                  <span class="flex shrink-0 flex-col items-end">
                    <span class="text-11 font-semibold text-fg-muted">{{ t().acc.colOwed }}</span>
                    <ui-money class="font-display text-15 font-extrabold" [value]="s.balance ?? 0"
                      [class]="(s.balance ?? 0) > 0 ? 'text-danger-text' : 'text-fg-muted'" />
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
export class SupplierListPage implements OnInit {
  private readonly svc = inject(SupplierService);
  private readonly toast = inject(MessageService);
  private readonly router = inject(Router);
  readonly t = inject(LangService).t;

  readonly suppliers = signal<Supplier[]>([]);
  readonly q = signal('');
  readonly loading = signal(true);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.svc.getAll$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: s => { this.suppliers.set(s); this.loading.set(false); },
      error: () => {
        this.loading.set(false);
        this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().suppliers.loadError });
      },
    });
  }

  readonly filtered = computed<Supplier[]>(() => {
    const q = this.q().trim().toLocaleLowerCase('tr');
    if (!q) return this.suppliers();
    return this.suppliers().filter(s =>
      s.name.toLocaleLowerCase('tr').includes(q) ||
      (s.phone ?? '').includes(q) ||
      (s.contactPerson ?? '').toLocaleLowerCase('tr').includes(q) ||
      (s.taxNo ?? '').includes(q)
    );
  });

  /** Tüm tedarikçilere toplam borç (pozitif bakiyeler) */
  readonly totalDebt = computed(() =>
    Math.round(this.suppliers().reduce((sum, s) => sum + Math.max(0, s.balance ?? 0), 0) * 100) / 100);

  readonly owedCount = computed(() => this.suppliers().filter(s => (s.balance ?? 0) > 0).length);

  open(s: Supplier): void { void this.router.navigate(['/suppliers', s.id]); }

  search(q: string): void { this.q.set(q); }
}
