import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { LicenseService } from '../../../core/license/license.service';
import { injectSettingsTexts } from '../settings.i18n';
import { AppUser, UserRole } from '../../../shared/models/user.model';
import { InviteRow, TeamService } from './team.service';
import {
  AvatarComponent, EmptyStateComponent, GlassCardComponent, IconButtonComponent, StatusBadgeComponent, UiTone,
} from '../../../shared/ui';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Ayarlar → Kullanıcılar & roller: davet, bekleyen davetler, üyeler (rol / pasif) ve salt okunur rol yetki matrisi.
 * Toast ve onay pencereleri ebeveyn sayfanın MessageService / ConfirmationService'ini kullanır.
 */
@Component({
  selector: 'app-team-panel',
  standalone: true,
  imports: [
    FormsModule, ButtonModule, InputTextModule, SelectModule,
    GlassCardComponent, AvatarComponent, StatusBadgeComponent, IconButtonComponent, EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
      <div class="flex w-full flex-col gap-3 lg:gap-4">

        @if (loadError()) {
          <p class="m-0 flex items-center gap-2 rounded-token-lg border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger-text" role="alert">
            <i class="pi pi-exclamation-circle" aria-hidden="true"></i>{{ loadError() }}
          </p>
        }

        <!-- Davet -->
        <ui-glass-card [title]="t().team.inviteTitle" [subtitle]="usersText()" icon="pi-user-plus" iconTone="brand">
          <form class="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end" (ngSubmit)="invite()">
            <div class="flex flex-col gap-1.5">
              <label for="inv-email" class="text-sm font-semibold text-fg-secondary">{{ t().settings.email }}</label>
              <input pInputText id="inv-email" name="inviteEmail" type="email" class="w-full" autocomplete="off"
                [(ngModel)]="inviteEmail" [placeholder]="t().team.inviteEmailPlaceholder" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="inv-role" class="text-sm font-semibold text-fg-secondary">{{ t().team.role }}</label>
              <p-select inputId="inv-role" name="inviteRole" [(ngModel)]="inviteRole" [options]="roleOptions()"
                optionLabel="label" optionValue="value" appendTo="body" styleClass="w-full" />
            </div>
            <p-button type="submit" [label]="t().team.inviteBtn" icon="pi pi-send" styleClass="w-full sm:w-auto"
              [loading]="inviting()" [disabled]="!validInviteEmail()" />
          </form>
          <p class="m-0 mt-4 flex items-start gap-2 rounded-token-md bg-info-soft px-3 py-2.5 text-xs leading-relaxed text-info-text">
            <i class="pi pi-info-circle mt-0.5 shrink-0" aria-hidden="true"></i>{{ t().team.inviteInfo }}
          </p>
        </ui-glass-card>

        <!-- Bekleyen davetler -->
        @if (invites().length > 0) {
          <ui-glass-card [title]="t().team.pendingInvites" [subtitle]="invites().length + ''" icon="pi-clock" iconTone="warning"
            padding="none" clip>
            <ul class="m-0 flex list-none flex-col p-0">
              @for (inv of invites(); track inv.id) {
                <li class="list-row flex items-center gap-3 border-0 border-b border-solid border-line px-4 py-2.5 last:border-b-0">
                  <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-token-md bg-warning-soft text-warning-text" aria-hidden="true">
                    <i class="pi pi-envelope"></i>
                  </span>
                  <span class="min-w-0 flex-1 break-all text-sm text-fg">{{ inv.email || inv.id }}</span>
                  <ui-status-badge size="sm" [tone]="roleTone(inv.role)">{{ roleLabel(inv.role) }}</ui-status-badge>
                  <ui-icon-button icon="pi-times" tone="danger" [ariaLabel]="t().team.cancelInvite" (click)="cancelInvite(inv)" />
                </li>
              }
            </ul>
          </ui-glass-card>
        }

        <!-- Kullanıcılar -->
        <ui-glass-card [title]="t().team.members" [subtitle]="members().length + ''" icon="pi-users" iconTone="info"
          padding="none" clip>
          @if (loading()) {
            <div class="flex flex-col gap-3 p-4" aria-hidden="true">
              @for (i of [1, 2, 3]; track i) {
                <div class="flex items-center gap-3">
                  <div class="h-10 w-10 animate-pulse rounded-token-md bg-surface-muted"></div>
                  <div class="h-4 flex-1 animate-pulse rounded bg-surface-muted"></div>
                </div>
              }
            </div>
          } @else if (members().length === 0) {
            <ui-empty-state compact icon="pi-users" [title]="t().common.noInfo" />
          } @else {
            <ul class="m-0 flex list-none flex-col p-0">
              @for (m of members(); track m.id) {
                <li class="list-row flex flex-wrap items-center gap-x-3 gap-y-2 border-0 border-b border-solid border-line px-4 py-3 last:border-b-0"
                  [class.opacity-60]="!m.isActive">
                  <ui-avatar [name]="m.displayName || m.email" />
                  <div class="min-w-0 flex-1 basis-40">
                    <p class="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-fg">
                      <span class="truncate">{{ m.displayName || m.email }}</span>
                      @if (isOwner(m)) { <ui-status-badge size="sm" tone="brand" icon="pi-star">{{ t().team.owner }}</ui-status-badge> }
                      @if (isSelf(m)) { <span class="text-xs font-normal text-fg-muted">({{ t().team.you }})</span> }
                    </p>
                    <p class="m-0 mt-0.5 break-all text-xs text-fg-muted">{{ m.email }}</p>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    @if (!m.isActive) { <ui-status-badge size="sm" tone="danger" dot>{{ t().team.inactive }}</ui-status-badge> }
                    @if (canEdit(m)) {
                      <p-select [ngModel]="m.role" (ngModelChange)="changeRole(m, $event)" [options]="roleOptions()"
                        optionLabel="label" optionValue="value" appendTo="body" size="small"
                        [ariaLabel]="t().team.role + ': ' + (m.displayName || m.email)" [disabled]="busyId() === m.id" />
                      <p-button [label]="m.isActive ? t().team.deactivate : t().team.activate"
                        [icon]="m.isActive ? 'pi pi-ban' : 'pi pi-check'"
                        [severity]="m.isActive ? 'danger' : 'success'" [outlined]="true" size="small"
                        [loading]="busyId() === m.id" (onClick)="toggleActive(m)" />
                    } @else {
                      <ui-status-badge size="sm" [tone]="roleTone(m.role)">{{ roleLabel(m.role) }}</ui-status-badge>
                    }
                  </div>
                </li>
              }
            </ul>
          }
        </ui-glass-card>

        <!-- Rol yetki matrisi (salt okunur; app.routes.ts rol korumalarıyla uyumlu) -->
        <ui-glass-card [title]="s().permTitle" [subtitle]="s().permDesc" icon="pi-shield" tone="neutral" padding="none" clip>
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="bg-surface-muted">
                  <th scope="col" class="border-b border-line px-4 py-2.5 text-left text-12.5 font-semibold uppercase tracking-wide text-fg-muted">{{ s().permission }}</th>
                  @for (r of roleOptions(); track r.value) {
                    <th scope="col" class="border-b border-line px-3 py-2.5 text-center text-12.5 font-semibold uppercase tracking-wide text-fg-muted">{{ r.label }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (p of s().perms; track p.label) {
                  <tr class="list-row">
                    <th scope="row" class="border-b border-line px-4 py-2.5 text-left font-medium text-fg">{{ p.label }}</th>
                    @for (r of roleOptions(); track r.value) {
                      @let ok = p.roles.includes(r.value);
                      <td class="border-b border-line px-3 py-2.5 text-center">
                        <span class="inline-flex h-7 w-7 items-center justify-center rounded-token-sm"
                          [class]="ok ? 'bg-brand-soft text-brand-text' : 'bg-surface-muted text-fg-muted'">
                          <i class="pi text-xs" [class]="ok ? 'pi-check' : 'pi-minus'" aria-hidden="true"></i>
                          <span class="sr-only">{{ ok ? s().allowed : s().denied }}</span>
                        </span>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </ui-glass-card>
      </div>
  `,
})
export class TeamPanelComponent implements OnInit {
  private readonly team = inject(TeamService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly license = inject(LicenseService);
  readonly t = inject(LangService).t;
  readonly s = injectSettingsTexts();

  readonly members = signal<AppUser[]>([]);
  readonly invites = signal<InviteRow[]>([]);
  readonly loadError = signal('');
  readonly inviting = signal(false);
  readonly busyId = signal<string | null>(null);
  readonly loading = signal(true);

  /** "3 / 5 kullanıcı" (aktif üyeler / lisans sınırı). */
  readonly usersText = computed(() => {
    const max = this.license.maxUsers();
    return this.s().usersCount(this.members().filter(m => m.isActive).length, Number.isFinite(max) ? max : null);
  });

  inviteEmail = '';
  inviteRole: UserRole = 'cashier';

  readonly roleOptions = computed(() => {
    const n = this.t().nav;
    return [
      { label: n.admin, value: 'admin' as UserRole },
      { label: n.cashier, value: 'cashier' as UserRole },
      { label: n.staff, value: 'staff' as UserRole },
    ];
  });

  ngOnInit(): void {
    this.team.watchMembers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => {
        this.loading.set(false);
        this.members.set(list.sort((a, b) => Number(this.isOwner(b)) - Number(this.isOwner(a)) || a.displayName.localeCompare(b.displayName, 'tr')));
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t().team.loadFailed);
      },
    });
    this.team.watchInvites().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => this.invites.set(list),
      error: () => this.loadError.set(this.t().team.loadFailed),
    });
  }

  validInviteEmail(): boolean {
    return EMAIL_RE.test(this.inviteEmail.trim());
  }

  isOwner(m: AppUser): boolean { return m.id === m.tenantId; }
  isSelf(m: AppUser): boolean { return m.id === this.auth.currentUserId(); }
  /** Kurallarla aynı: sahip ve kendi hesabı düzenlenemez. */
  canEdit(m: AppUser): boolean { return !this.isOwner(m) && !this.isSelf(m); }

  roleTone(role: string): UiTone {
    return role === 'admin' ? 'brand' : role === 'cashier' ? 'accent' : 'neutral';
  }

  roleLabel(role: string): string {
    return this.roleOptions().find(o => o.value === role)?.label ?? role;
  }


  async invite(): Promise<void> {
    if (!this.validInviteEmail()) return;
    const email = this.inviteEmail.trim().toLocaleLowerCase('en');
    if (this.members().some(m => m.email.toLocaleLowerCase('en') === email)) {
      this.toast.add({ severity: 'warn', summary: '', detail: this.t().team.alreadyMember, life: 4000 });
      return;
    }
    this.inviting.set(true);
    try {
      await this.team.createInvite(email, this.inviteRole);
      this.toast.add({ severity: 'success', summary: '', detail: this.t().team.inviteCreated, life: 5000 });
      this.inviteEmail = '';
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const msg = code === 'license/max-users' ? this.t().team.maxUsersReached
        : code === 'license/read-only' ? this.t().team.licenseReadOnly
        : code === 'permission-denied' ? this.t().team.inviteExists : this.t().team.inviteFailed;
      this.toast.add({ severity: 'error', summary: '', detail: msg, life: 5000 });
    } finally {
      this.inviting.set(false);
    }
  }

  cancelInvite(inv: InviteRow): void {
    this.confirm.confirm({
      message: this.t().team.cancelInviteConfirm.replace('{email}', inv.email || inv.id),
      acceptLabel: this.t().common.yes,
      rejectLabel: this.t().common.no,
      accept: async () => {
        try {
          await this.team.deleteInvite(inv.id);
        } catch {
          this.toast.add({ severity: 'error', summary: '', detail: this.t().team.actionFailed, life: 4000 });
        }
      },
    });
  }

  async changeRole(m: AppUser, role: UserRole): Promise<void> {
    if (role === m.role) return;
    this.busyId.set(m.id);
    try {
      await this.team.setRole(m.id, role);
      this.toast.add({ severity: 'success', summary: '', detail: this.t().team.roleChanged, life: 3000 });
    } catch {
      this.toast.add({ severity: 'error', summary: '', detail: this.t().team.actionFailed, life: 4000 });
      this.members.update(list => [...list]); // select'i eski değere döndür
    } finally {
      this.busyId.set(null);
    }
  }

  toggleActive(m: AppUser): void {
    const deactivate = m.isActive;
    const run = async () => {
      this.busyId.set(m.id);
      try {
        await this.team.setActive(m.id, !deactivate);
        this.toast.add({ severity: 'success', summary: '', detail: deactivate ? this.t().team.deactivated : this.t().team.activated, life: 3000 });
      } catch {
        this.toast.add({ severity: 'error', summary: '', detail: this.t().team.actionFailed, life: 4000 });
      } finally {
        this.busyId.set(null);
      }
    };
    if (!deactivate) { void run(); return; }
    this.confirm.confirm({
      message: this.t().team.deactivateConfirm.replace('{name}', m.displayName || m.email),
      acceptLabel: this.t().common.yes,
      rejectLabel: this.t().common.no,
      accept: () => void run(),
    });
  }
}
