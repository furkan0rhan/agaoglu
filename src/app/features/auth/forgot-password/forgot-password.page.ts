import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { AuthShellComponent } from '../../../shared/ui/auth-shell.component';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { authErrorMessage } from '../auth-errors';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [RouterLink, FormsModule, ButtonModule, InputTextModule, IconFieldModule, InputIconModule, AuthShellComponent],
  template: `
    <ui-auth-shell [title]="t().auth.forgotTitle" [subtitle]="t().auth.forgotSubtitle" icon="pi-lock">
      @if (!sent()) {
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <label for="forgot-email" class="text-sm font-semibold text-fg-secondary">{{ t().auth.email }}</label>
            <p-iconfield class="w-full">
              <p-inputicon styleClass="pi pi-envelope" />
              <input
                pInputText
                id="forgot-email"
                [(ngModel)]="email"
                type="email"
                autocomplete="email"
                [placeholder]="t().auth.emailPlaceholder"
                class="w-full"
              />
            </p-iconfield>
          </div>
      @if (error()) {
        <div role="alert" class="flex items-start gap-2.5 rounded-token-lg border border-danger-line bg-danger-soft px-3.5 py-3 text-sm text-danger-text">
          <i class="pi pi-exclamation-circle mt-0.5 text-sm" aria-hidden="true"></i>
          <span>{{ error() }}</span>
        </div>
      }
          <p-button
            [label]="t().auth.sendReset"
            icon="pi pi-send"
            size="large"
            styleClass="w-full"
            [loading]="loading()"
            [disabled]="!email.trim()"
            (onClick)="onSubmit()"
          ></p-button>
        </div>
      } @else {
        <div role="status" class="flex items-center gap-3 rounded-token-lg border border-success-line bg-success-soft p-4 text-sm font-medium text-success-text">
          <i class="pi pi-check-circle text-xl" aria-hidden="true"></i>
          <span>{{ t().auth.resetSent }}</span>
        </div>
      }

      <div auth-footer>
        <a [routerLink]="['/auth/login']" class="inline-flex min-h-[44px] items-center gap-2 font-semibold text-brand-text no-underline hover:underline">
          <i class="pi pi-arrow-left text-xs" aria-hidden="true"></i>{{ t().auth.backToLogin }}
        </a>
      </div>
    </ui-auth-shell>
  `,
})
export class ForgotPasswordPage {
  private readonly authService = inject(AuthService);
  readonly t = inject(LangService).t;

  email = '';
  readonly loading = signal(false);
  readonly sent = signal(false);
  readonly error = signal('');

  async onSubmit(): Promise<void> {
    if (!this.email.trim()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.authService.resetPassword(this.email.trim());
      this.sent.set(true);
    } catch (err) {
      // E-posta numaralandırma koruması açıkken user-not-found dönmez; dönerse de varlığı sızdırmamak için başarı göster.
      if ((err as { code?: string })?.code === 'auth/user-not-found') {
        this.sent.set(true);
      } else {
        this.error.set(authErrorMessage(err, this.t().auth, this.t().auth.errResetDefault));
      }
    } finally {
      this.loading.set(false);
    }
  }
}
