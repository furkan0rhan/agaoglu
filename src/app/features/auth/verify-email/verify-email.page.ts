import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { AuthShellComponent } from '../../../shared/ui/auth-shell.component';
import { authErrorMessage } from '../auth-errors';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [ButtonModule, AuthShellComponent],
  template: `
    <ui-auth-shell [title]="t().auth.verifyTitle" [subtitle]="t().auth.verifySubtitle" icon="pi-envelope">
      <div class="mb-5 flex justify-center">
        <span class="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface-muted px-3.5 py-1.5 text-sm font-semibold text-fg">
          <i class="pi pi-at text-xs text-fg-muted" aria-hidden="true"></i>
          <span class="truncate">{{ email() }}</span>
        </span>
      </div>

      @if (pendingInvite()) {
        <div role="status" class="mb-3 flex items-start gap-2.5 rounded-token-lg border border-info-line bg-info-soft px-3.5 py-3 text-left text-sm text-info-text">
          <i class="pi pi-info-circle mt-0.5 text-sm" aria-hidden="true"></i>
          <span>{{ t().auth.invitePending }}</span>
        </div>
      }

      @if (verified()) {
        <div role="status" class="mb-3 flex items-start gap-2.5 rounded-token-lg border border-success-line bg-success-soft px-3.5 py-3 text-left text-sm text-success-text">
          <i class="pi pi-check-circle mt-0.5 text-sm" aria-hidden="true"></i>
          <span>{{ t().auth.verifySuccess }}</span>
        </div>
      } @else {
        <p class="m-0 mb-4 flex items-center justify-center gap-2 text-xs text-fg-muted" role="status">
          <i class="pi pi-spin pi-spinner text-xs" aria-hidden="true"></i>{{ t().auth.verifyAutoCheck }}
        </p>
      }

      @if (infoMsg()) {
        <div role="status" class="mb-3 flex items-start gap-2.5 rounded-token-lg border border-success-line bg-success-soft px-3.5 py-3 text-left text-sm text-success-text">
          <i class="pi pi-envelope mt-0.5 text-sm" aria-hidden="true"></i>
          <span>{{ infoMsg() }}</span>
        </div>
      }

      @if (errorMsg()) {
        <div role="alert" class="mb-3 flex items-start gap-2.5 rounded-token-lg border border-danger-line bg-danger-soft px-3.5 py-3 text-left text-sm text-danger-text">
          <i class="pi pi-exclamation-circle mt-0.5 text-sm" aria-hidden="true"></i>
          <span>{{ errorMsg() }}</span>
        </div>
      }

      <div class="flex flex-col gap-2">
        <p-button
          [label]="t().auth.verifyConfirm"
          icon="pi pi-check-circle"
          size="large"
          styleClass="w-full"
          [loading]="checking()"
          [disabled]="verified()"
          (onClick)="checkVerification(true)"
        ></p-button>

        <p-button
          [label]="cooldown() > 0 ? t().auth.resendIn.replace('{s}', '' + cooldown()) : t().auth.resendEmail"
          icon="pi pi-refresh"
          severity="secondary"
          [outlined]="true"
          styleClass="w-full"
          [loading]="resending()"
          [disabled]="cooldown() > 0 || verified()"
          (onClick)="resend()"
        ></p-button>

        <p-button
          [label]="t().auth.otherAccount"
          icon="pi pi-sign-out"
          severity="danger"
          [text]="true"
          styleClass="w-full"
          (onClick)="logout()"
        ></p-button>
      </div>
    </ui-auth-shell>
  `,
})
export class VerifyEmailPage implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly t = inject(LangService).t;

  readonly checking = signal(false);
  readonly resending = signal(false);
  readonly verified = signal(false);
  readonly cooldown = signal(0);
  readonly errorMsg = signal('');
  readonly infoMsg = signal('');
  readonly pendingInvite = this.auth.pendingInvite;

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;
  private polling = false;

  async ngOnInit(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      await this.router.navigate(['/auth/login']);
      return;
    }
    if (this.auth.isEmailVerified() && !this.auth.pendingInvite()) {
      await this.router.navigate(['/dashboard']);
      return;
    }
    // 2.34: 5 sn'de bir otomatik kontrol
    this.pollTimer = setInterval(() => void this.checkVerification(false), 5000);
  }

  ngOnDestroy(): void {
    this.stopPolling();
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
  }

  email(): string {
    return this.auth.currentUser()?.email ?? '';
  }

  async checkVerification(manual: boolean): Promise<void> {
    if (this.polling || this.verified()) return;
    this.polling = true;
    if (manual) { this.checking.set(true); this.errorMsg.set(''); }
    try {
      await this.auth.reloadUser();
      if (this.auth.isEmailVerified()) {
        this.stopPolling();
        await this.auth.completeEmailVerification();
        this.verified.set(true);
        this.errorMsg.set('');
        setTimeout(() => void this.router.navigate(['/dashboard']), 1500);
      } else if (manual) {
        this.errorMsg.set(this.t().auth.notVerifiedYet);
      }
    } catch (err) {
      if (manual) this.errorMsg.set(authErrorMessage(err, this.t().auth, this.t().auth.errVerifyCheck));
    } finally {
      this.polling = false;
      if (manual) this.checking.set(false);
    }
  }

  async resend(): Promise<void> {
    if (this.cooldown() > 0) return;
    this.resending.set(true);
    this.errorMsg.set('');
    this.infoMsg.set('');
    try {
      await this.auth.resendVerificationEmail();
      this.infoMsg.set(this.t().auth.resendSent);
      this.startCooldown(60);
    } catch (err) {
      this.errorMsg.set(authErrorMessage(err, this.t().auth, this.t().auth.resendFailed));
      if ((err as { code?: string })?.code === 'auth/too-many-requests') this.startCooldown(60);
    } finally {
      this.resending.set(false);
    }
  }

  async logout(): Promise<void> {
    this.stopPolling();
    await this.auth.logout();
  }

  private startCooldown(seconds: number): void {
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.cooldown.set(seconds);
    this.cooldownTimer = setInterval(() => {
      const next = this.cooldown() - 1;
      this.cooldown.set(Math.max(next, 0));
      if (next <= 0 && this.cooldownTimer) { clearInterval(this.cooldownTimer); this.cooldownTimer = null; }
    }, 1000);
  }

  private stopPolling(): void {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  }
}
