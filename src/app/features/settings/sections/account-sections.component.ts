import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import type { Translations } from '../../../core/i18n/translations';
import { authErrorMessage } from '../../auth/auth-errors';
import { AvatarComponent, GlassCardComponent, SettingsRowComponent, StatusBadgeComponent } from '../../../shared/ui';
import { injectSettingsTexts } from '../settings.i18n';

/** Firebase profil işlem hatalarını kullanıcı metnine eşler (2.27). */
function profileError(err: unknown, t: Translations, fallback: string): string {
  const code = (err as { code?: string })?.code ?? '';
  const s = t.settings;
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
    return s.wrongPassword;
  }
  if (code === 'auth/email-already-in-use') return s.emailInUse;
  return authErrorMessage(err, t.auth, fallback);
}

/** Profilim: avatar, ad (güncellenebilir), e-posta, rol, kayıt tarihi, oturumu kapat. Tüm roller. */
@Component({
  selector: 'app-profile-section',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, GlassCardComponent, SettingsRowComponent, AvatarComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3 lg:gap-4' },
  template: `
    <ui-glass-card [title]="s().sections.profile.title" [subtitle]="s().sections.profile.desc" icon="pi-user" padding="none">
      <div class="flex items-center gap-4 border-b border-line px-3 py-4 sm:px-4">
        <ui-avatar size="lg" variant="solid" [name]="auth.currentUser()?.displayName" />
        <div class="min-w-0 flex-1">
          <p class="m-0 truncate font-display text-lg font-extrabold text-fg">{{ formattedName() }}</p>
          <p class="m-0 mt-0.5 break-all text-13 text-fg-muted">{{ auth.currentUser()?.email ?? '-' }}</p>
        </div>
        @if (roleLabel()) {
          <ui-status-badge tone="brand" size="sm" icon="pi-shield">{{ roleLabel() }}</ui-status-badge>
        }
      </div>
      <ui-settings-row [title]="t().settings.updateName" labelFor="p-name">
        <input pInputText id="p-name" class="w-full sm:w-[240px]" autocomplete="name"
          [(ngModel)]="newName" [placeholder]="t().settings.namePlaceholder" (keydown.enter)="saveName()" />
        <p-button [label]="t().settings.update" icon="pi pi-check" severity="secondary"
          [loading]="savingName()" [disabled]="!newName.trim()" (onClick)="saveName()" />
      </ui-settings-row>
      <ui-settings-row [title]="t().settings.registrationDate" inline>
        <span class="num text-sm font-semibold text-fg">{{ registered() }}</span>
      </ui-settings-row>
      <ui-settings-row [title]="t().settings.logout" [description]="t().settings.logoutDesc">
        <p-button [label]="t().settings.logoutBtn" icon="pi pi-sign-out" severity="danger" [outlined]="true" (onClick)="auth.logout()" />
      </ui-settings-row>
    </ui-glass-card>
  `,
})
export class ProfileSectionComponent {
  readonly auth = inject(AuthService);
  private readonly toast = inject(MessageService);
  readonly t = inject(LangService).t;
  readonly s = injectSettingsTexts();

  newName = '';
  readonly savingName = signal(false);

  readonly formattedName = computed(() => this.auth.formatDisplayName(this.auth.currentUser()?.displayName ?? ''));
  readonly roleLabel = computed(() => {
    const n = this.t().nav;
    const map: Record<string, string> = { admin: n.admin, cashier: n.cashier, staff: n.staff };
    return map[this.auth.currentUser()?.role ?? ''] ?? '';
  });
  readonly registered = computed(() => {
    const date = this.auth.currentUser()?.createdAt;
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date as unknown as string);
    return d.toLocaleDateString(this.t().reports.dateLocale, { day: '2-digit', month: 'long', year: 'numeric' });
  });

  async saveName(): Promise<void> {
    if (!this.newName.trim() || this.savingName()) return;
    this.savingName.set(true);
    try {
      await this.auth.updateDisplayName(this.newName.trim());
      this.toast.add({ severity: 'success', summary: '', detail: this.t().settings.nameUpdated, life: 3000 });
      this.newName = '';
    } catch (err) {
      this.toast.add({ severity: 'error', summary: '', detail: profileError(err, this.t(), this.t().settings.updateFailed), life: 3000 });
    } finally {
      this.savingName.set(false);
    }
  }
}

/** Güvenlik: şifre değiştir, e-posta değiştir (Firebase yeniden kimlik doğrulama ile). Tüm roller. */
@Component({
  selector: 'app-security-section',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, PasswordModule, GlassCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3 lg:gap-4' },
  template: `
    <ui-glass-card [title]="t().settings.changePassword" [subtitle]="s().passwordRowDesc" icon="pi-key" tone="warning">
      <form class="grid grid-cols-1 gap-4 md:grid-cols-3" (ngSubmit)="savePassword()">
        <div class="flex flex-col gap-1.5">
          <label for="p-cur-pass" class="text-sm font-semibold text-fg-secondary">{{ t().settings.currentPassword }}</label>
          <p-password inputId="p-cur-pass" name="cur" [(ngModel)]="currentPassword" [feedback]="false" [toggleMask]="true"
            autocomplete="current-password" styleClass="w-full" inputStyleClass="w-full" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="p-new-pass" class="text-sm font-semibold text-fg-secondary">{{ t().settings.newPassword }}</label>
          <p-password inputId="p-new-pass" name="new" [(ngModel)]="newPassword" [toggleMask]="true"
            autocomplete="new-password" styleClass="w-full" inputStyleClass="w-full" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="p-confirm-pass" class="text-sm font-semibold text-fg-secondary">{{ t().settings.confirmPassword }}</label>
          <p-password inputId="p-confirm-pass" name="confirm" [(ngModel)]="confirmPassword" [feedback]="false" [toggleMask]="true"
            autocomplete="new-password" styleClass="w-full" inputStyleClass="w-full" />
          @if (newPassword && confirmPassword && newPassword !== confirmPassword) {
            <p class="m-0 text-xs text-danger-text" role="alert">{{ t().settings.passwordMismatch }}</p>
          }
        </div>
        <div class="flex justify-end md:col-span-3">
          <p-button type="submit" [label]="t().settings.changePasswordBtn" icon="pi pi-lock"
            [loading]="savingPassword()"
            [disabled]="!currentPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 6" />
        </div>
      </form>
    </ui-glass-card>

    <ui-glass-card [title]="t().settings.updateEmail" [subtitle]="s().emailRowDesc" icon="pi-envelope" tone="info">
      <form class="grid grid-cols-1 gap-4 md:grid-cols-2" (ngSubmit)="saveEmail()">
        <div class="flex flex-col gap-1.5">
          <label for="p-new-email" class="text-sm font-semibold text-fg-secondary">{{ t().settings.newEmailPlaceholder }}</label>
          <input pInputText id="p-new-email" name="email" type="email" class="w-full" autocomplete="email" [(ngModel)]="newEmail" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="p-email-pass" class="text-sm font-semibold text-fg-secondary">{{ t().settings.currentPasswordPlaceholder }}</label>
          <p-password inputId="p-email-pass" name="emailPass" [(ngModel)]="emailCurrentPassword" [feedback]="false" [toggleMask]="true"
            autocomplete="current-password" styleClass="w-full" inputStyleClass="w-full" />
        </div>
        <p class="m-0 flex items-start gap-2 rounded-token-md bg-info-soft px-3 py-2.5 text-xs leading-relaxed text-info-text md:col-span-2">
          <i class="pi pi-info-circle mt-0.5 shrink-0" aria-hidden="true"></i>{{ t().settings.verificationInfo }}
        </p>
        <div class="flex justify-end md:col-span-2">
          <p-button type="submit" [label]="t().settings.sendVerification" icon="pi pi-envelope" severity="secondary"
            [loading]="savingEmail()" [disabled]="!newEmail.trim() || !emailCurrentPassword" />
        </div>
      </form>
    </ui-glass-card>
  `,
})
export class SecuritySectionComponent {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(MessageService);
  readonly t = inject(LangService).t;
  readonly s = injectSettingsTexts();

  newEmail = '';
  emailCurrentPassword = '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  readonly savingEmail = signal(false);
  readonly savingPassword = signal(false);

  async saveEmail(): Promise<void> {
    if (!this.newEmail.trim() || !this.emailCurrentPassword || this.savingEmail()) return;
    this.savingEmail.set(true);
    try {
      await this.auth.updateEmail(this.emailCurrentPassword, this.newEmail.trim());
      this.toast.add({ severity: 'success', summary: '', detail: this.t().settings.verificationSent, life: 6000 });
      this.newEmail = '';
      this.emailCurrentPassword = '';
    } catch (err) {
      this.toast.add({ severity: 'error', summary: '', detail: profileError(err, this.t(), this.t().settings.emailUpdateFailed), life: 4000 });
    } finally {
      this.savingEmail.set(false);
    }
  }

  async savePassword(): Promise<void> {
    if (this.newPassword !== this.confirmPassword || this.newPassword.length < 6 || !this.currentPassword || this.savingPassword()) return;
    this.savingPassword.set(true);
    try {
      await this.auth.changePassword(this.currentPassword, this.newPassword);
      this.toast.add({ severity: 'success', summary: '', detail: this.t().settings.passwordChanged, life: 3000 });
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
    } catch (err) {
      this.toast.add({ severity: 'error', summary: '', detail: profileError(err, this.t(), this.t().settings.passwordFailed), life: 4000 });
    } finally {
      this.savingPassword.set(false);
    }
  }
}
