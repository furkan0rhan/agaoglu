import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { SelectModule } from 'primeng/select';
import { AuditLogService } from '../../core/auth/services/audit-log.service';
import { LangService } from '../../core/i18n/lang.service';
import { AuditAction, AuditLog, AppUser, LicenseState, Tenant } from '../../shared/models/user.model';
import {
  EmptyStateComponent, GlassCardComponent, PageHeaderComponent, StatCardComponent, StatusBadgeComponent, TONE_SOFT, UiTone,
} from '../../shared/ui';
import { ADMIN_TEXTS } from './admin.i18n';
import { AdminService } from './admin.service';
import {
  buildTenantRows, computeStats, expiryTone, filterTenantRows, PlanFilter, StateFilter, TenantRow,
} from './admin.util';

export function stateTone(s: LicenseState): UiTone {
  switch (s) {
    case 'ok': return 'success';
    case 'warning': return 'warning';
    case 'expired': return 'danger';
    case 'suspended': return 'danger';
    default: return 'neutral';
  }
}

export function auditTone(a: AuditAction | string): UiTone {
  switch (a) {
    case 'support_start': return 'danger';
    case 'support_end': return 'neutral';
    case 'license_change': return 'info';
    default: return 'brand';
  }
}

export function auditIcon(a: AuditAction | string): string {
  switch (a) {
    case 'support_start': return 'pi-sign-in';
    case 'support_end': return 'pi-sign-out';
    case 'license_change': return 'pi-key';
    default: return 'pi-user-edit';
  }
}

/** /admin — genel bakış + işletmeler listesi (arama, plan/durum filtresi) + son denetim kayıtları. */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    DatePipe, FormsModule, RouterLink, SelectModule,
    PageHeaderComponent, GlassCardComponent, StatCardComponent, StatusBadgeComponent, EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ui-page-header [title]="x().title" [subtitle]="x().subtitle" icon="pi-shield" iconTone="danger" [sticky]="false" />

    <div class="page-body">
      @if (error()) {
        <div role="alert" class="flex items-start gap-3 rounded-token-lg border border-danger-line bg-danger-soft p-3 text-danger-text">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-token-md bg-danger text-fg-inverse"><i class="pi pi-exclamation-circle" aria-hidden="true"></i></span>
          <p class="m-0 self-center text-sm font-semibold">{{ error() }}</p>
        </div>
      }

      <section data-tour="sa-stats" [attr.aria-label]="x().overview" class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4 xl:grid-cols-6">
        <ui-stat-card [label]="x().totalTenants" [value]="stats().total" icon="pi-building" tone="brand" [loading]="loading()" />
        <ui-stat-card [label]="x().active" [value]="stats().activePaid" icon="pi-check-circle" tone="success" [loading]="loading()" />
        <ui-stat-card [label]="x().trial" [value]="stats().trial" icon="pi-hourglass" tone="info" [loading]="loading()" />
        <ui-stat-card [label]="x().expired" [value]="stats().expired" icon="pi-clock" tone="danger" [tinted]="stats().expired > 0" [loading]="loading()" />
        <ui-stat-card [label]="x().suspended" [value]="stats().suspended" icon="pi-ban" tone="warning" [tinted]="stats().suspended > 0" [loading]="loading()" />
        <ui-stat-card [label]="x().activeLast7" [value]="stats().activeLast7" icon="pi-bolt" tone="accent" [loading]="loading()" />
      </section>

      <ui-glass-card data-tour="sa-tenants" [title]="x().tenants" icon="pi-building" padding="none" clip>
        <span card-actions class="num text-13 text-fg-muted">{{ filtered().length }} / {{ rows().length }}</span>

        <div class="flex flex-col gap-2.5 border-b border-line p-3 sm:px-4">
          <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_200px]">
            <label class="flex h-11 items-center gap-2 rounded-token-md border border-line-strong bg-page pl-3 pr-2 text-fg-muted focus-within:border-brand focus-within:shadow-focus">
              <i class="pi pi-search text-sm" aria-hidden="true"></i>
              <input type="search" [placeholder]="x().search" [attr.aria-label]="x().search" [ngModel]="search()" (ngModelChange)="search.set($event)"
                class="h-full min-w-0 flex-1 border-0 bg-transparent text-14.5 text-fg outline-none placeholder:text-fg-muted" />
            </label>
            <p-select [options]="planOptions()" optionLabel="label" optionValue="value" [ngModel]="plan()"
              (ngModelChange)="plan.set($event)" styleClass="w-full" appendTo="body" [ariaLabel]="x().plan" />
          </div>
          <div data-tour="sa-filters" class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5" role="group" [attr.aria-label]="x().status">
            @for (o of stateOptions(); track o.value) {
              <button type="button" (click)="state.set(o.value)" [attr.aria-pressed]="state() === o.value"
                class="flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-token-md border px-3 text-13.5 font-semibold transition-colors"
                [class]="state() === o.value ? 'border-brand-line bg-brand-soft text-brand-text' : 'border-line-strong bg-surface text-fg-secondary hover:bg-surface-muted'">
                {{ o.label }}<span class="num text-xs opacity-75">{{ o.count }}</span>
              </button>
            }
          </div>
        </div>

        @if (!loading() && filtered().length === 0) {
          <ui-empty-state [title]="x().noTenants" icon="pi-building" compact />
        } @else {
          <!-- Masaüstü: tablo -->
          <div class="hidden overflow-x-auto md:block">
            <table class="w-full border-collapse text-14.5">
              <thead>
                <tr class="bg-surface-muted text-left text-12 font-semibold uppercase tracking-[0.03em] text-fg-muted">
                  <th class="h-10 border-b border-line px-4">{{ x().name }}</th>
                  <th class="h-10 border-b border-line px-3.5">{{ x().plan }} · {{ x().status }}</th>
                  <th class="h-10 border-b border-line px-3.5">{{ x().expires }}</th>
                  <th class="h-10 border-b border-line px-3.5 text-right">{{ x().users }}</th>
                  <th class="hidden h-10 border-b border-line px-3.5 lg:table-cell">{{ x().lastActivity }}</th>
                  <th class="h-10 w-12 border-b border-line px-3"><span class="sr-only">{{ x().open }}</span></th>
                </tr>
              </thead>
              <tbody>
                @for (r of filtered(); track r.tenant.id) {
                  @let et = expTone(r);
                  <tr class="list-row cursor-pointer border-b border-line last:border-b-0" [class]="rowAlert(r)" (click)="openTenant(r.tenant.id)">
                    <td class="h-[56px] max-w-[320px] px-4 py-2">
                      <a [routerLink]="['/admin/tenants', r.tenant.id]" (click)="$event.stopPropagation()"
                        class="flex items-center gap-1.5 font-semibold text-fg no-underline hover:text-brand-text hover:underline">
                        <span class="truncate">{{ r.tenant.name || r.tenant.id }}</span>
                        @if (!r.tenant.supportAccess) {
                          <i class="pi pi-eye-slash text-xs text-fg-muted" [title]="x().supportOff" [attr.aria-label]="x().supportOff"></i>
                        }
                      </a>
                      <p class="m-0 truncate text-12.5 text-fg-muted">{{ r.ownerEmail || '-' }}</p>
                    </td>
                    <td class="px-3.5">
                      <span class="inline-flex flex-wrap items-center gap-1.5">
                        <ui-status-badge [tone]="planTone(r)" icon="pi-tag">{{ planName(r) }}</ui-status-badge>
                        <ui-status-badge [tone]="tone(r.license.state)" dot>{{ x().statusNames[r.license.state] }}</ui-status-badge>
                      </span>
                    </td>
                    <td class="whitespace-nowrap px-3.5">
                      @if (r.license.expiresAt; as d) {
                        <span class="num block font-semibold" [class]="expClass(et, 'text-fg')">{{ d | date: 'dd.MM.yyyy' }}</span>
                        <span class="block text-12.5" [class]="expClass(et, 'text-fg-muted')">{{ daysText(r.license.daysLeft) }}</span>
                      } @else {
                        <span class="text-fg-muted">{{ r.license.plan ? x().unlimited : '-' }}</span>
                      }
                    </td>
                    <td class="num px-3.5 text-right font-extrabold text-fg">
                      {{ r.userCount }}@if (r.tenant.maxUsers) {<span class="font-normal text-fg-muted">/{{ r.tenant.maxUsers }}</span>}
                    </td>
                    <td class="num hidden whitespace-nowrap px-3.5 text-fg-secondary lg:table-cell">
                      @if (r.lastActive; as d) { {{ d | date: 'dd.MM.yyyy HH:mm' }} } @else { {{ x().never }} }
                    </td>
                    <td class="px-3 text-right text-fg-muted"><i class="pi pi-chevron-right text-sm" aria-hidden="true"></i></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Mobil: satırlar -->
          <ul class="m-0 list-none p-0 md:hidden">
            @for (r of filtered(); track r.tenant.id) {
              @let et = expTone(r);
              <li class="border-b border-line last:border-b-0">
                <a [routerLink]="['/admin/tenants', r.tenant.id]" class="list-row flex items-center gap-3 px-3 py-3 text-fg no-underline" [class]="rowAlert(r)">
                  <div class="min-w-0 flex-1">
                    <p class="m-0 flex items-center gap-1.5 font-semibold">
                      <span class="truncate">{{ r.tenant.name || r.tenant.id }}</span>
                      @if (!r.tenant.supportAccess) { <i class="pi pi-eye-slash text-xs text-fg-muted" [attr.aria-label]="x().supportOff"></i> }
                    </p>
                    <p class="m-0 truncate text-12.5 text-fg-muted">{{ r.ownerEmail || '-' }}</p>
                    <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <ui-status-badge size="sm" [tone]="planTone(r)">{{ planName(r) }}</ui-status-badge>
                      <ui-status-badge size="sm" [tone]="tone(r.license.state)" dot>{{ x().statusNames[r.license.state] }}</ui-status-badge>
                      @if (r.license.expiresAt; as d) {
                        <span class="num text-12.5 font-semibold" [class]="expClass(et, 'text-fg-muted')">{{ d | date: 'dd.MM.yyyy' }}</span>
                      }
                    </div>
                  </div>
                  <span class="num shrink-0 text-13 text-fg-muted"><i class="pi pi-users mr-1 text-xs" aria-hidden="true"></i>{{ r.userCount }}</span>
                  <i class="pi pi-chevron-right shrink-0 text-sm text-fg-muted" aria-hidden="true"></i>
                </a>
              </li>
            }
          </ul>
        }
      </ui-glass-card>

      <ui-glass-card data-tour="sa-audit" [title]="x().recentAudit" icon="pi-history" tone="info" padding="none">
        @if (audit().length === 0) {
          <ui-empty-state [title]="x().noAudit" icon="pi-history" compact />
        } @else {
          <ol class="m-0 list-none px-4 py-3">
            @for (log of audit(); track log.id) {
              <li class="relative flex gap-3 pb-3 last:pb-0">
                @if (!$last) { <span class="absolute bottom-0 left-[13px] top-8 w-px bg-line" aria-hidden="true"></span> }
                <span class="relative mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-token-md" [class]="logToneClass(log.action)">
                  <i class="pi text-12" [class]="logIcon(log.action)" aria-hidden="true"></i>
                </span>
                <div class="min-w-0 flex-1">
                  <p class="m-0 flex flex-wrap items-baseline gap-x-2 text-sm">
                    <a [routerLink]="['/admin/tenants', log.tenantId]" class="font-semibold text-fg no-underline hover:text-brand-text hover:underline">{{ tenantName(log.tenantId) }}</a>
                    <span class="text-fg-secondary">{{ x().actions[log.action] || log.action }}</span>
                  </p>
                  @if (log.detail) { <p class="m-0 mt-0.5 break-words text-13 text-fg-secondary">{{ log.detail }}</p> }
                  <p class="m-0 mt-0.5 text-xs text-fg-muted">
                    <span class="num">{{ log.createdAt ? (log.createdAt | date: 'dd.MM.yyyy HH:mm') : '…' }}</span> · {{ log.actorEmail }}
                  </p>
                </div>
              </li>
            }
          </ol>
        }
      </ui-glass-card>
    </div>
  `,
})
export class AdminDashboardPage implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly auditSvc = inject(AuditLogService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lang = inject(LangService);
  readonly x = computed(() => ADMIN_TEXTS[this.lang.lang()]);

  private readonly tenants = signal<Tenant[]>([]);
  private readonly users = signal<AppUser[]>([]);
  readonly audit = signal<AuditLog[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly search = signal('');
  readonly plan = signal<PlanFilter>('all');
  readonly state = signal<StateFilter>('all');

  readonly rows = computed<TenantRow[]>(() =>
    buildTenantRows(this.tenants(), this.users())
      .sort((a, b) => (b.lastActive?.getTime() ?? 0) - (a.lastActive?.getTime() ?? 0)));
  readonly filtered = computed(() => filterTenantRows(this.rows(), this.search(), this.plan(), this.state()));
  readonly stats = computed(() => computeStats(this.rows()));

  readonly planOptions = computed(() => [
    { label: this.x().allPlans, value: 'all' },
    { label: this.x().planNames['trial'], value: 'trial' },
    { label: this.x().planNames['basic'], value: 'basic' },
    { label: this.x().planNames['pro'], value: 'pro' },
    { label: this.x().legacy, value: 'legacy' },
  ]);
  /** Durum çipleri (sayı: arama + plan filtresi uygulanmış satırlarda). */
  readonly stateOptions = computed(() => {
    const base = filterTenantRows(this.rows(), this.search(), this.plan(), 'all');
    return [
      { label: this.x().allStatuses, value: 'all' as StateFilter, count: base.length },
      ...(['ok', 'warning', 'expired', 'suspended', 'legacy'] as const).map(s => ({
        label: this.x().statusNames[s], value: s as StateFilter, count: base.filter(r => r.license.state === s).length,
      })),
    ];
  });

  ngOnInit(): void {
    combineLatest([this.admin.watchTenants(), this.admin.watchAllUsers()])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([tenants, users]) => {
          this.tenants.set(tenants);
          this.users.set(users);
          this.loading.set(false);
        },
        error: err => {
          console.error('[Admin] load error', err);
          this.error.set(this.x().loadFailed);
          this.loading.set(false);
        },
      });
    this.auditSvc.watchRecent(20)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: rows => this.audit.set(rows), error: err => console.warn('[Admin] audit load', err) });
  }

  tone(s: LicenseState): UiTone {
    return stateTone(s);
  }

  planTone(r: TenantRow): UiTone {
    switch (r.license.plan) {
      case 'pro': return 'brand';
      case 'basic': return 'info';
      case 'trial': return 'accent';
      default: return 'neutral';
    }
  }

  planName(r: TenantRow): string {
    return r.license.plan ? this.x().planNames[r.license.plan] : this.x().legacy;
  }

  expTone(r: TenantRow): 'danger' | 'warning' | null {
    return expiryTone(r.license.daysLeft);
  }

  expClass(t: 'danger' | 'warning' | null, fallback: string): string {
    return t === 'danger' ? 'text-danger-text' : t === 'warning' ? 'text-warning-text' : fallback;
  }

  daysText(n: number | null): string {
    if (n === null) return '';
    return n >= 0 ? this.x().daysLeft(n) : this.x().daysOver(-n);
  }

  rowAlert(r: TenantRow): string {
    return r.license.state === 'expired' || r.license.state === 'suspended' ? 'shadow-[inset_3px_0_0_var(--danger)]' : '';
  }

  logToneClass(a: AuditAction): string {
    return TONE_SOFT[auditTone(a)];
  }

  logIcon(a: AuditAction): string {
    return auditIcon(a);
  }

  openTenant(id: string): void {
    void this.router.navigate(['/admin/tenants', id]);
  }

  tenantName(id: string): string {
    return this.tenants().find(t => t.id === id)?.name || id;
  }
}
