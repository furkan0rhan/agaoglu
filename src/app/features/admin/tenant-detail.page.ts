import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuthService } from '../../core/auth/services/auth.service';
import { LangService } from '../../core/i18n/lang.service';
import { computeLicense, extendFrom } from '../../core/license/license.util';
import {
  AppUser, DEFAULT_MAX_USERS, Tenant, TENANT_PLANS, TenantPlan, USER_ROLES, UserRole,
} from '../../shared/models/user.model';
import { AvatarComponent, GlassCardComponent, PageHeaderComponent, StatusBadgeComponent } from '../../shared/ui';
import { SupportAccessLogComponent } from './components/support-access-log.component';
import { ADMIN_TEXTS } from './admin.i18n';
import { AdminService, LicensePatch } from './admin.service';
import { stateTone } from './admin-dashboard.page';
import { expiryTone } from './admin.util';

function fmt(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString('tr-TR') : '-';
}

/** /admin/tenants/:id — işletme bilgileri, lisans, kullanıcılar, destek modu (onaylı), denetim kaydı. */
@Component({
  selector: 'app-tenant-detail',
  standalone: true,
  imports: [
    DatePipe, FormsModule, ButtonModule, SelectModule, InputNumberModule, TooltipModule,
    PageHeaderComponent, GlassCardComponent, StatusBadgeComponent, AvatarComponent, SupportAccessLogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ui-page-header [title]="tenant()?.name || tenantId" [subtitle]="tenantId" icon="pi-building" iconTone="brand"
      backLink="/admin" [backLabel]="x().back" [sticky]="false">
      <p-button [label]="x().openSupport" icon="pi pi-sign-in" severity="danger" [loading]="opening()"
        [disabled]="!tenant() || !tenant()!.supportAccess" (onClick)="confirmSupport()" />
    </ui-page-header>

    <div class="page-body">
      @if (error()) {
        <div role="alert" class="flex items-start gap-3 rounded-token-lg border border-danger-line bg-danger-soft p-3 text-danger-text">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-token-md bg-danger text-fg-inverse"><i class="pi pi-exclamation-circle" aria-hidden="true"></i></span>
          <p class="m-0 self-center text-sm font-semibold">{{ error() }}</p>
        </div>
      }
      @if (tenant() && !tenant()!.supportAccess) {
        <div role="status" class="flex items-start gap-3 rounded-token-lg border border-warning-line bg-warning-soft p-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-token-md bg-warning text-fg-inverse"><i class="pi pi-eye-slash" aria-hidden="true"></i></span>
          <p class="m-0 self-center text-sm text-warning-text"><b class="font-semibold">{{ x().supportAccess }}: {{ x().supportOff }}.</b> {{ x().supportDisabledMsg }}</p>
        </div>
      }

      @if (tenant(); as t) {
        <div class="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-4">
          <div class="flex min-w-0 flex-col gap-3 lg:gap-4">
            <!-- Lisans -->
            <ui-glass-card [title]="x().license" icon="pi-key" [tone]="tone()" padding="none" clip>
              <ui-status-badge card-actions [tone]="tone()" dot>{{ x().statusNames[license().state] }}</ui-status-badge>
              <div class="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div class="field-dark flex flex-col gap-2 p-5">
                  <p class="eyebrow m-0 text-side-soft">{{ x().plan }}</p>
                  <p class="m-0 flex items-center gap-2.5 font-display text-2xl font-extrabold">
                    <i class="pi pi-crown text-xl text-side-em" aria-hidden="true"></i>{{ planName() }}
                  </p>
                  <p class="m-0 mt-2 text-13.5 text-side-soft">{{ x().expires }}</p>
                  <p class="num m-0 font-display text-22 font-extrabold" [class]="expTone() === 'danger' ? 'text-side-danger' : 'text-side-text'">
                    @if (license().expiresAt; as d) { {{ d | date: 'dd.MM.yyyy' }} } @else { {{ license().plan ? x().unlimited : '-' }} }
                  </p>
                  @if (license().daysLeft !== null) {
                    <span class="inline-flex h-6 items-center self-start rounded-token-sm px-2 text-12.5 font-semibold"
                      [class]="expTone() === 'danger' ? 'bg-side-danger-soft text-side-danger' : expTone() === 'warning' ? 'bg-warning-soft text-warning-text' : 'bg-side-2 text-side-soft'">
                      {{ daysText() }}
                    </span>
                  }
                  <p class="m-0 mt-2 text-13.5 text-side-soft">{{ x().users }}:
                    <b class="num text-side-text">{{ activeUsers() }} / {{ t.maxUsers ?? '-' }}</b></p>
                </div>

                <div class="flex flex-col gap-4 p-4 sm:p-5">
                  <div>
                    <p class="eyebrow m-0 mb-2 text-fg-muted">{{ x().quickExtend }}</p>
                    <div class="flex flex-wrap gap-2">
                      <p-button [label]="x().extend30" icon="pi pi-calendar-plus" [disabled]="busy()" (onClick)="extend(30)" />
                      <p-button [label]="x().extend365" icon="pi pi-calendar-plus" severity="secondary" [disabled]="busy()" (onClick)="extend(365)" />
                    </div>
                  </div>
                  <div class="border-t border-line pt-4">
                    <p class="eyebrow m-0 mb-2 text-fg-muted">{{ x().planSettings }}</p>
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                      <div class="flex min-w-0 flex-col gap-1.5">
                        <label for="lic-plan" class="text-sm font-semibold text-fg-secondary">{{ x().plan }}</label>
                        <p-select inputId="lic-plan" [options]="planOptions()" optionLabel="label" optionValue="value"
                          [(ngModel)]="draftPlan" styleClass="w-full" appendTo="body" />
                      </div>
                      <div class="flex min-w-0 flex-col gap-1.5">
                        <label for="lic-max" class="text-sm font-semibold text-fg-secondary">{{ x().maxUsers }}</label>
                        <p-inputnumber inputId="lic-max" [(ngModel)]="draftMaxUsers" [min]="1" [max]="500" [showButtons]="true" styleClass="w-full" inputStyleClass="w-full min-w-0" />
                      </div>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <p-button [label]="x().saveLicense" icon="pi pi-check" severity="secondary" [loading]="busy()" (onClick)="saveLicense()" />
                      @if (t.status === 'suspended') {
                        <p-button [label]="x().activate" icon="pi pi-play" severity="success" [disabled]="busy()" (onClick)="setStatus('active')" />
                      } @else {
                        <p-button [label]="x().suspend" icon="pi pi-ban" severity="danger" [outlined]="true" [disabled]="busy()" (onClick)="setStatus('suspended')" />
                      }
                    </div>
                  </div>
                </div>
              </div>
            </ui-glass-card>

            <!-- Kullanıcılar -->
            <ui-glass-card [title]="x().users" icon="pi-users" padding="none" clip>
              <span card-actions class="num text-13 text-fg-muted">{{ activeUsers() }} / {{ users().length }}</span>
              @if (users().length === 0) {
                <p class="m-0 p-4 text-sm text-fg-muted">{{ x().noUsers }}</p>
              }
              <ul class="m-0 list-none p-0">
                @for (u of users(); track u.id) {
                  <li class="list-row flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0">
                    <ui-avatar [name]="u.displayName || u.email" />
                    <div class="min-w-0 flex-1 basis-[180px]">
                      <p class="m-0 flex items-center gap-1.5 text-sm font-semibold text-fg">
                        <span class="truncate">{{ u.displayName || '-' }}</span>
                        @if (u.id === t.ownerId) { <ui-status-badge size="sm" tone="brand" icon="pi-star">{{ x().owner }}</ui-status-badge> }
                      </p>
                      <p class="m-0 truncate text-xs text-fg-muted">{{ u.email }} ·
                        <span class="num">@if (u.lastLogin; as d) { {{ d | date: 'dd.MM.yyyy HH:mm' }} } @else { {{ x().never }} }</span></p>
                    </div>
                    <ui-status-badge size="sm" [tone]="u.isActive ? 'success' : 'neutral'" dot>{{ u.isActive ? x().activeUser : x().passiveUser }}</ui-status-badge>
                    <div class="flex items-center gap-2">
                      <p-select [options]="roleOptions()" optionLabel="label" optionValue="value" [ngModel]="u.role"
                        (ngModelChange)="changeRole(u, $event)" [disabled]="u.id === t.ownerId || busy()" appendTo="body"
                        styleClass="w-[136px]" [ariaLabel]="x().role" />
                      <p-button [label]="u.isActive ? x().makePassive : x().makeActive" size="small" [outlined]="true"
                        [severity]="u.isActive ? 'danger' : 'success'" [disabled]="busy()" (onClick)="toggleActive(u)" />
                      <p-button icon="pi pi-envelope" size="small" severity="secondary" [disabled]="busy() || !u.email"
                        [ariaLabel]="x().resetPassword" [pTooltip]="x().resetPassword" tooltipPosition="top" (onClick)="sendReset(u)" />
                    </div>
                  </li>
                }
              </ul>
            </ui-glass-card>
          </div>

          <div class="flex min-w-0 flex-col gap-3 lg:gap-4">
            <!-- Destek modu -->
            <ui-glass-card [title]="x().supportAccess" icon="pi-shield" tone="danger">
              <p class="m-0 text-sm leading-relaxed text-fg-secondary">{{ x().supportHint }}</p>
              <div class="mt-3 flex items-center justify-between gap-2 rounded-token-md bg-surface-muted px-3 py-2 text-sm">
                <span class="text-fg-secondary">{{ x().supportAccess }}</span>
                <ui-status-badge [tone]="t.supportAccess ? 'success' : 'warning'" [icon]="t.supportAccess ? 'pi-eye' : 'pi-eye-slash'">
                  {{ t.supportAccess ? x().supportOn : x().supportOff }}</ui-status-badge>
              </div>
            </ui-glass-card>

            <!-- Bilgiler -->
            <ui-glass-card [title]="x().info" icon="pi-info-circle" tone="info">
              <dl class="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
                <dt class="text-fg-muted">{{ x().tenantId }}</dt><dd class="m-0 break-all font-mono text-xs text-fg">{{ t.id }}</dd>
                <dt class="text-fg-muted">{{ x().owner }}</dt><dd class="m-0 break-all text-fg">{{ ownerEmail() || '-' }}</dd>
                <dt class="text-fg-muted">{{ x().createdAt }}</dt><dd class="num m-0 text-fg">{{ t.createdAt | date: 'dd.MM.yyyy' }}</dd>
                <dt class="text-fg-muted">{{ x().lastActivity }}</dt>
                <dd class="num m-0 text-fg">@if (t.lastActiveAt; as d) { {{ d | date: 'dd.MM.yyyy HH:mm' }} } @else { {{ x().never }} }</dd>
              </dl>
            </ui-glass-card>

            <!-- Denetim kaydı -->
            <app-support-access-log [tenantId]="tenantId" [showToggle]="false" />
          </div>
        </div>
      }
    </div>
  `,
})
export class TenantDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly admin = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lang = inject(LangService);
  readonly x = computed(() => ADMIN_TEXTS[this.lang.lang()]);

  readonly tenantId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly tenant = signal<Tenant | null>(null);
  readonly users = signal<AppUser[]>([]);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly opening = signal(false);

  draftPlan: TenantPlan = 'trial';
  draftMaxUsers = DEFAULT_MAX_USERS.trial;

  readonly license = computed(() => computeLicense(this.tenant()));
  readonly tone = computed(() => stateTone(this.license().state));
  readonly expTone = computed(() => expiryTone(this.license().daysLeft));
  readonly planName = computed(() => {
    const p = this.license().plan;
    return p ? this.x().planNames[p] : this.x().legacy;
  });
  readonly daysText = computed(() => {
    const n = this.license().daysLeft;
    if (n === null) return '';
    return n >= 0 ? this.x().daysLeft(n) : this.x().daysOver(-n);
  });
  readonly activeUsers = computed(() => this.users().filter(u => u.isActive).length);
  readonly ownerEmail = computed(() => this.users().find(u => u.id === this.tenant()?.ownerId)?.email ?? '');
  readonly planOptions = computed(() => TENANT_PLANS.map(p => ({ label: this.x().planNames[p], value: p })));
  readonly roleOptions = computed(() => USER_ROLES.map(r => ({ label: this.x().roleNames[r], value: r })));

  ngOnInit(): void {
    this.admin.watchTenant(this.tenantId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: t => {
          const first = this.tenant() === null;
          this.tenant.set(t);
          if (t && first) {
            this.draftPlan = t.plan ?? 'basic';
            this.draftMaxUsers = t.maxUsers ?? DEFAULT_MAX_USERS[this.draftPlan];
          }
        },
        error: () => this.error.set(this.x().loadFailed),
      });
    this.admin.watchTenantUsers(this.tenantId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: u => this.users.set(u), error: () => this.error.set(this.x().loadFailed) });
  }

  async saveLicense(): Promise<void> {
    const t = this.tenant();
    if (!t) return;
    const patch: LicensePatch = { plan: this.draftPlan, maxUsers: this.draftMaxUsers };
    if (this.draftPlan === 'trial' && !t.trialEndsAt) patch.trialEndsAt = extendFrom(null, 30);
    // Ücretli plana geçişte bitiş yoksa yanlışlıkla süresiz kalmasın: denemenin bitişinden +30 gün
    if (this.draftPlan !== 'trial' && !t.licenseExpiresAt) patch.licenseExpiresAt = extendFrom(t.trialEndsAt, 30);
    const detail = `Plan: ${t.plan ?? 'yok'} → ${this.draftPlan}, azami kullanıcı: ${t.maxUsers ?? '-'} → ${this.draftMaxUsers}`
      + (patch.licenseExpiresAt ? `, bitiş: ${fmt(patch.licenseExpiresAt)}` : '');
    await this.run(() => this.admin.updateLicense(t, patch, detail), this.x().licenseSaved);
  }

  async extend(days: number): Promise<void> {
    const t = this.tenant();
    if (!t) return;
    const plan = t.plan ?? this.draftPlan;
    const patch: LicensePatch = {};
    let end: Date;
    if (plan === 'trial') {
      end = extendFrom(t.trialEndsAt, days);
      patch.trialEndsAt = end;
    } else {
      end = extendFrom(t.licenseExpiresAt, days);
      patch.licenseExpiresAt = end;
    }
    if (!t.plan) patch.plan = plan;
    await this.run(
      () => this.admin.updateLicense(t, patch, `+${days} gün uzatıldı (${plan}), yeni bitiş: ${fmt(end)}`),
      this.x().licenseSaved,
    );
  }

  setStatus(status: 'active' | 'suspended'): void {
    const t = this.tenant();
    if (!t) return;
    const go = () => this.run(
      () => this.admin.updateLicense(t, { status }, status === 'suspended' ? 'İşletme askıya alındı' : 'İşletme aktifleştirildi'),
      this.x().licenseSaved,
    );
    if (status === 'active') { void go(); return; }
    this.confirm.confirm({
      message: this.x().confirmSuspend,
      header: this.x().suspend,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { severity: 'danger', label: this.x().suspend },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => void go(),
    });
  }

  changeRole(u: AppUser, role: UserRole): void {
    if (role === u.role) return;
    void this.run(() => this.admin.setUserRole(u, role), this.x().userUpdated);
  }

  toggleActive(u: AppUser): void {
    void this.run(() => this.admin.setUserActive(u, !u.isActive), this.x().userUpdated);
  }

  sendReset(u: AppUser): void {
    void this.run(() => this.admin.sendPasswordReset(u), this.x().resetSent);
  }

  /** Destek modu verilere yönetici yetkisiyle erişir: her zaman onay ister. */
  confirmSupport(): void {
    const t = this.tenant();
    if (!t) return;
    if (!t.supportAccess) { void this.openSupport(); return; }
    this.confirm.confirm({
      header: this.x().supportConfirmTitle,
      message: this.x().supportConfirm(t.name || t.id),
      icon: 'pi pi-shield',
      acceptButtonProps: { severity: 'danger', label: this.x().openSupport, icon: 'pi pi-sign-in' },
      rejectButtonProps: { severity: 'secondary', label: this.lang.t().common.cancel },
      accept: () => void this.openSupport(),
    });
  }

  async openSupport(): Promise<void> {
    const t = this.tenant();
    if (!t || !t.supportAccess) {
      this.toast.add({ severity: 'warn', summary: '', detail: this.x().supportDisabledMsg, life: 5000 });
      return;
    }
    this.opening.set(true);
    try {
      await this.auth.enterSupportMode(t.id, t.name || t.id);
    } catch (err) {
      console.error('[Admin] support mode', err);
      const code = (err as { code?: string })?.code ?? '';
      this.toast.add({
        severity: 'error', summary: '',
        detail: code === 'app/support-disabled' ? this.x().supportDisabledMsg : this.x().actionFailed, life: 5000,
      });
      this.opening.set(false);
    }
  }

  private async run(fn: () => Promise<void>, okMsg: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await fn();
      this.toast.add({ severity: 'success', summary: '', detail: okMsg, life: 3000 });
    } catch (err) {
      console.error('[Admin] action failed', err);
      this.toast.add({ severity: 'error', summary: '', detail: this.x().actionFailed, life: 4000 });
    } finally {
      this.busy.set(false);
    }
  }
}
