import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LangService } from '../../../core/i18n/lang.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, PasswordModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast position="top-right"></p-toast>
    <div style="display:flex; flex-direction:column; height:100%; background:var(--bg-page); overflow:hidden;">

      <!-- Header -->
      <div style="background:var(--bg-surface); border-bottom:1px solid var(--border); padding:16px 24px; display:flex; align-items:center; gap:12px; flex-shrink:0;">
        <div style="width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg,#8b5cf6,#6d28d9); display:flex; align-items:center; justify-content:center;">
          <i class="pi pi-cog" style="color:white; font-size:16px;"></i>
        </div>
        <div>
          <h1 style="font-size:18px; font-weight:700; color:var(--text-primary); margin:0;">{{ t().settings.title }}</h1>
          <p style="font-size:12px; color:var(--text-secondary); margin:0;">{{ t().settings.subtitle }}</p>
        </div>
      </div>

      <!-- Content -->
      <div style="flex:1; overflow-y:auto; padding:24px; display:flex; flex-direction:column; gap:16px; max-width:560px;">

        <!-- Profile card -->
        <div style="background:var(--bg-surface); border-radius:16px; border:1px solid var(--border); box-shadow:0 2px 12px rgba(0,0,0,0.04); overflow:hidden;">

          <!-- Avatar -->
          <div style="padding:20px; display:flex; align-items:center; gap:16px; border-bottom:1px solid var(--border);">
            <div style="width:60px; height:60px; border-radius:16px; background:linear-gradient(135deg,#4ade80,#16a34a); display:flex; align-items:center; justify-content:center; color:white; font-size:24px; font-weight:700; flex-shrink:0;">
              {{ userInitial() }}
            </div>
            <div style="flex:1;">
              <p style="font-size:17px; font-weight:700; color:var(--text-primary); margin:0 0 4px;">{{ formattedName() }}</p>
              <span style="display:inline-block; background:#f0fdf4; color:#16a34a; font-size:11px; font-weight:700; border-radius:20px; padding:3px 10px; text-transform:uppercase; letter-spacing:0.5px;">
                {{ roleLabel() }}
              </span>
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:12px; padding:14px 20px; border-bottom:1px solid var(--border);">
            <div style="width:34px; height:34px; border-radius:9px; background:var(--bg-muted); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <i class="pi pi-envelope" style="font-size:14px; color:var(--text-secondary);"></i>
            </div>
            <div style="flex:1;">
              <p style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin:0 0 2px;">{{ t().settings.email }}</p>
              <p style="font-size:14px; font-weight:500; color:var(--text-primary); margin:0;">{{ auth.currentUser()?.email ?? '-' }}</p>
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:12px; padding:14px 20px; border-bottom:1px solid var(--border);">
            <div style="width:34px; height:34px; border-radius:9px; background:var(--bg-muted); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <i class="pi pi-calendar" style="font-size:14px; color:var(--text-secondary);"></i>
            </div>
            <div style="flex:1;">
              <p style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin:0 0 2px;">{{ t().settings.registrationDate }}</p>
              <p style="font-size:14px; font-weight:500; color:var(--text-primary); margin:0;">{{ formatDate(auth.currentUser()?.createdAt) }}</p>
            </div>
          </div>
        </div>

        <!-- Update Name -->
        <div style="background:var(--bg-surface); border-radius:16px; border:1px solid var(--border); box-shadow:0 2px 12px rgba(0,0,0,0.04); padding:20px;">
          <p style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.8px; margin:0 0 14px;">{{ t().settings.updateName }}</p>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <input pInputText [(ngModel)]="newName" [placeholder]="t().settings.namePlaceholder" style="width:100%;" />
            <p-button
              [label]="t().settings.update"
              icon="pi pi-check"
              severity="success"
              size="small"
              [loading]="savingName()"
              [disabled]="!newName.trim()"
              (onClick)="saveName()"
            ></p-button>
          </div>
        </div>

        <!-- Update Email -->
        <div style="background:var(--bg-surface); border-radius:16px; border:1px solid var(--border); box-shadow:0 2px 12px rgba(0,0,0,0.04); padding:20px;">
          <p style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.8px; margin:0 0 14px;">{{ t().settings.updateEmail }}</p>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <input pInputText [(ngModel)]="newEmail" [placeholder]="t().settings.newEmailPlaceholder" type="email" style="width:100%;" />
            <p-password
              [(ngModel)]="emailCurrentPassword"
              [placeholder]="t().settings.currentPasswordPlaceholder"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
            ></p-password>
            <div style="display:flex; align-items:flex-start; gap:8px; background:#eff6ff; border-radius:10px; padding:10px 12px;">
              <i class="pi pi-info-circle" style="color:#3b82f6; font-size:13px; margin-top:1px; flex-shrink:0;"></i>
              <p style="font-size:12px; color:#3b82f6; margin:0; line-height:1.5;">{{ t().settings.verificationInfo }}</p>
            </div>
            <p-button
              [label]="t().settings.sendVerification"
              icon="pi pi-envelope"
              severity="info"
              size="small"
              [loading]="savingEmail()"
              [disabled]="!newEmail.trim() || !emailCurrentPassword"
              (onClick)="saveEmail()"
            ></p-button>
          </div>
        </div>

        <!-- Change Password -->
        <div style="background:var(--bg-surface); border-radius:16px; border:1px solid var(--border); box-shadow:0 2px 12px rgba(0,0,0,0.04); padding:20px;">
          <p style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.8px; margin:0 0 14px;">{{ t().settings.changePassword }}</p>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <p-password
              [(ngModel)]="currentPassword"
              [placeholder]="t().settings.currentPassword"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
            ></p-password>
            <p-password
              [(ngModel)]="newPassword"
              [placeholder]="t().settings.newPassword"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
            ></p-password>
            <p-password
              [(ngModel)]="confirmPassword"
              [placeholder]="t().settings.confirmPassword"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
            ></p-password>
            @if (newPassword && confirmPassword && newPassword !== confirmPassword) {
              <p style="font-size:12px; color:#ef4444; margin:0;">{{ t().settings.passwordMismatch }}</p>
            }
            <p-button
              [label]="t().settings.changePasswordBtn"
              icon="pi pi-lock"
              severity="info"
              size="small"
              [loading]="savingPassword()"
              [disabled]="!currentPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 6"
              (onClick)="savePassword()"
            ></p-button>
          </div>
        </div>

        <!-- App info -->
        <div style="background:var(--bg-surface); border-radius:16px; border:1px solid var(--border); box-shadow:0 2px 12px rgba(0,0,0,0.04); padding:20px;">
          <p style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.8px; margin:0 0 14px;">{{ t().settings.appInfo }}</p>
          @for (item of appInfo(); track item.label) {
            <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 0; border-bottom:1px solid var(--border);">
              <span style="font-size:13px; color:var(--text-secondary);">{{ item.label }}</span>
              <span style="font-size:13px; font-weight:600; color:var(--text-primary);">{{ item.value }}</span>
            </div>
          }
        </div>

        <!-- Logout -->
        <div style="background:#fff; border-radius:16px; border:1px solid #fee2e2; box-shadow:0 2px 12px rgba(0,0,0,0.04); padding:16px 20px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div>
            <p style="font-size:14px; font-weight:600; color:var(--text-primary); margin:0 0 2px;">{{ t().settings.logout }}</p>
            <p style="font-size:12px; color:var(--text-muted); margin:0;">{{ t().settings.logoutDesc }}</p>
          </div>
          <p-button [label]="t().settings.logoutBtn" icon="pi pi-sign-out" severity="danger" size="small" (onClick)="auth.logout()"></p-button>
        </div>

      </div>
    </div>
  `,
})
export class ProfilePage {
  readonly auth = inject(AuthService);
  private readonly toast = inject(MessageService);
  readonly t = inject(LangService).t;

  newName = '';
  newEmail = '';
  emailCurrentPassword = '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  readonly savingName = signal(false);
  readonly savingEmail = signal(false);
  readonly savingPassword = signal(false);

  appInfo() {
    return [
      { label: this.t().settings.appName, value: 'Tarım Market Pro' },
      { label: this.t().settings.version, value: '1.0.0' },
      { label: this.t().settings.platform, value: 'Desktop' },
    ];
  }

  async saveName(): Promise<void> {
    if (!this.newName.trim()) return;
    this.savingName.set(true);
    try {
      await this.auth.updateDisplayName(this.newName.trim());
      this.toast.add({ severity: 'success', summary: '', detail: this.t().settings.nameUpdated, life: 3000 });
      this.newName = '';
    } catch {
      this.toast.add({ severity: 'error', summary: '', detail: this.t().settings.updateFailed, life: 3000 });
    } finally {
      this.savingName.set(false);
    }
  }

  async saveEmail(): Promise<void> {
    if (!this.newEmail.trim() || !this.emailCurrentPassword) return;
    this.savingEmail.set(true);
    try {
      await this.auth.updateEmail(this.emailCurrentPassword, this.newEmail.trim());
      this.toast.add({ severity: 'success', summary: '', detail: this.t().settings.verificationSent, life: 6000 });
      this.newEmail = '';
      this.emailCurrentPassword = '';
    } catch (err: any) {
      const msg = err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential'
        ? this.t().settings.wrongPassword
        : this.t().settings.emailUpdateFailed;
      this.toast.add({ severity: 'error', summary: '', detail: msg, life: 4000 });
    } finally {
      this.savingEmail.set(false);
    }
  }

  async savePassword(): Promise<void> {
    if (this.newPassword !== this.confirmPassword || this.newPassword.length < 6) return;
    this.savingPassword.set(true);
    try {
      await this.auth.changePassword(this.currentPassword, this.newPassword);
      this.toast.add({ severity: 'success', summary: '', detail: this.t().settings.passwordChanged, life: 3000 });
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
    } catch (err: any) {
      const msg = err?.code === 'auth/wrong-password' ? this.t().settings.wrongPassword : this.t().settings.passwordFailed;
      this.toast.add({ severity: 'error', summary: '', detail: msg, life: 3000 });
    } finally {
      this.savingPassword.set(false);
    }
  }

  formattedName(): string {
    const name = this.auth.currentUser()?.displayName ?? '';
    return name.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  userInitial(): string {
    const name = this.auth.currentUser()?.displayName ?? '';
    return name.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase()).join('').slice(0, 2) || 'U';
  }

  roleLabel(): string {
    const n = this.t().nav;
    const map: Record<string, string> = { admin: n.admin, cashier: n.cashier, staff: n.staff };
    return map[this.auth.currentUser()?.role ?? ''] ?? '';
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date as string);
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  }
}
