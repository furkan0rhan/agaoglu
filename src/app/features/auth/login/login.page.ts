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

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, PasswordModule, CheckboxModule, IconFieldModule, InputIconModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <div class="bg-white rounded-3xl shadow-card p-8 border border-gray-100">

          <!-- Brand -->
          <div class="text-center mb-8">
            <img src="assets/TarimLogo.png" alt="Tarım Market Logo" class="w-20 h-20 mx-auto mb-4 object-contain" />
            <h1 class="text-2xl font-bold text-gray-800">Tarım Market Pro</h1>
            <p class="text-gray-400 text-sm mt-1">{{ t().auth.loginTitle }}</p>
          </div>

          <!-- Form -->
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">

            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-gray-700">{{ t().auth.email }}</label>
              <p-iconfield class="w-full">
                <p-inputicon styleClass="pi pi-envelope" />
                <input pInputText type="email" formControlName="email" [placeholder]="t().auth.emailPlaceholder" class="w-full" autocomplete="email" />
              </p-iconfield>
              @if (form.get('email')?.invalid && form.get('email')?.touched) {
                <p class="text-xs text-red-500">{{ t().auth.emailInvalid }}</p>
              }
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-gray-700">{{ t().auth.password }}</label>
              <p-password
                formControlName="password"
                [feedback]="false"
                [toggleMask]="true"
                [placeholder]="t().auth.passwordPlaceholder"
                styleClass="w-full"
                inputStyleClass="w-full"
                autocomplete="current-password"
              ></p-password>
              @if (form.get('password')?.invalid && form.get('password')?.touched) {
                <p class="text-xs text-red-500">{{ t().auth.passwordRequired }}</p>
              }
            </div>

            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <p-checkbox formControlName="rememberMe" [binary]="true" inputId="remember"></p-checkbox>
                <label for="remember" class="text-sm text-gray-600 cursor-pointer select-none">{{ t().auth.rememberMe }}</label>
              </div>
              <a [routerLink]="['/auth/forgot-password']" class="text-sm text-green-600 font-medium hover:text-green-700 transition-colors">
                {{ t().auth.forgotPassword }}
              </a>
            </div>

            @if (error()) {
              <div class="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center gap-2">
                <i class="pi pi-exclamation-circle text-red-500 text-sm"></i>
                <span class="text-sm text-red-600">{{ error() }}</span>
              </div>
            }

            <p-button
              type="submit"
              [label]="t().auth.login"
              icon="pi pi-sign-in"
              [loading]="loading()"
              [disabled]="form.invalid"
              styleClass="w-full mt-2"
              severity="success"
            ></p-button>

          </form>

          <div class="flex justify-center gap-2 mt-6 text-sm text-gray-400">
            <span>{{ t().auth.noAccount }}</span>
            <a [routerLink]="['/auth/register']" class="text-green-600 font-semibold hover:text-green-700 transition-colors">{{ t().auth.register }}</a>
          </div>

        </div>
      </div>
    </div>
  `,
})
export class LoginPage {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  readonly t = inject(LangService).t;

  readonly loading = signal(false);
  readonly error = signal('');

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    rememberMe: [false],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');
    try {
      const { email, password, rememberMe } = this.form.value;
      await this.authService.login(email!, password!, rememberMe ?? false);
    } catch (err: unknown) {
      this.error.set(this.getErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  private getErrorMessage(err: unknown): string {
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code;
      const a = this.t().auth;
      const messages: Record<string, string> = {
        'auth/user-not-found': a.errUserNotFound,
        'auth/wrong-password': a.errWrongPassword,
        'auth/too-many-requests': a.errTooManyRequests,
        'auth/invalid-credential': a.errInvalidCredential,
      };
      return messages[code] ?? a.errDefault;
    }
    return this.t().auth.errDefault;
  }
}
