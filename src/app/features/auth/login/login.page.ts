import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CheckboxModule } from 'primeng/checkbox';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { AuthShellComponent } from '../../../shared/ui/auth-shell.component';
import { authErrorMessage } from '../auth-errors';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, PasswordModule, CheckboxModule, IconFieldModule, InputIconModule, AuthShellComponent],
  template: `
    <ui-auth-shell [title]="t().auth.login" [subtitle]="t().auth.loginTitle">
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4" novalidate>
        <div class="flex flex-col gap-1.5">
          <label for="login-email" class="text-sm font-semibold text-fg-secondary">{{ t().auth.email }}</label>
          <p-iconfield class="w-full">
            <p-inputicon styleClass="pi pi-envelope" />
            <input pInputText id="login-email" type="email" formControlName="email" [placeholder]="t().auth.emailPlaceholder" class="w-full" autocomplete="email" />
          </p-iconfield>
          @if (form.get('email')?.invalid && form.get('email')?.touched) {
            <p class="m-0 text-xs font-medium text-danger">{{ t().auth.emailInvalid }}</p>
          }
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="login-password" class="text-sm font-semibold text-fg-secondary">{{ t().auth.password }}</label>
          <p-password
            inputId="login-password"
            formControlName="password"
            [feedback]="false"
            [toggleMask]="true"
            [placeholder]="t().auth.passwordPlaceholder"
            styleClass="w-full"
            inputStyleClass="w-full"
            autocomplete="current-password"
          ></p-password>
          @if (form.get('password')?.invalid && form.get('password')?.touched) {
            <p class="m-0 text-xs font-medium text-danger">{{ t().auth.passwordRequired }}</p>
          }
        </div>

        <div class="flex items-center justify-between gap-3">
          <div class="flex min-h-[44px] items-center gap-2">
            <p-checkbox formControlName="rememberMe" [binary]="true" inputId="remember"></p-checkbox>
            <label for="remember" class="cursor-pointer select-none text-sm text-fg-secondary">{{ t().auth.rememberMe }}</label>
          </div>
          <a [routerLink]="['/auth/forgot-password']" class="text-sm font-semibold text-brand no-underline hover:underline">
            {{ t().auth.forgotPassword }}
          </a>
        </div>

      @if (error()) {
        <div role="alert" class="mb-4 flex items-start gap-2.5 rounded-token-lg border border-danger-line bg-danger-soft px-3.5 py-3 text-sm text-danger">
          <i class="pi pi-exclamation-circle mt-0.5 text-sm" aria-hidden="true"></i>
          <span class="flex-1">{{ error() }}</span>
          @if (canRetry()) {
            <p-button type="button" [label]="t().auth.retryProfile" icon="pi pi-refresh" size="small" severity="danger"
              [outlined]="true" [loading]="retrying()" (onClick)="retry()"></p-button>
          }
        </div>
      }
        <p-button
          type="submit"
          [label]="t().auth.login"
          icon="pi pi-sign-in"
          size="large"
          [loading]="loading()"
          [disabled]="form.invalid"
          styleClass="w-full"
        ></p-button>
      </form>

      <div auth-footer class="flex flex-wrap justify-center gap-1.5">
        <span>{{ t().auth.noAccount }}</span>
        <a [routerLink]="['/auth/register']" class="font-semibold text-brand no-underline hover:underline">{{ t().auth.register }}</a>
      </div>
    </ui-auth-shell>
  `,
})
export class LoginPage {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  readonly t = inject(LangService).t;

  readonly loading = signal(false);
  readonly retrying = signal(false);
  readonly error = signal(this.noticeMessage());
  /** Oturum açık ama profil geçici hatayla yüklenemedi: "Tekrar dene" göster. */
  readonly canRetry = signal(this.authService.authNotice() === 'profile-retry');

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    rememberMe: [false],
  });

  /** Oturum zorla kapatıldıysa (pasif hesap / profil okunamadı) nedenini göster (2.36, 2.39). */
  private noticeMessage(): string {
    const notice = this.authService.authNotice();
    if (notice === 'inactive') return this.t().auth.errAccountInactive;
    if (notice === 'profile-unavailable') return this.t().auth.errProfileUnavailable;
    if (notice === 'profile-retry') return this.t().auth.errProfileRetry;
    return '';
  }

  async retry(): Promise<void> {
    this.retrying.set(true);
    try {
      if (await this.authService.retryProfileLoad()) { this.error.set(''); this.canRetry.set(false); return; }
      const notice = this.authService.authNotice();
      this.canRetry.set(notice === 'profile-retry' && this.authService.hasFirebaseSession());
      this.error.set(this.noticeMessage() || this.t().auth.errProfileUnavailable);
    } catch (err: unknown) {
      this.error.set(authErrorMessage(err, this.t().auth));
    } finally {
      this.retrying.set(false);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');
    this.canRetry.set(false);
    try {
      const { email, password, rememberMe } = this.form.value;
      await this.authService.login(email!, password!, rememberMe ?? false);
    } catch (err: unknown) {
      this.error.set(authErrorMessage(err, this.t().auth));
      this.canRetry.set(this.authService.authNotice() === 'profile-retry' && this.authService.hasFirebaseSession());
    } finally {
      this.loading.set(false);
    }
  }
}
