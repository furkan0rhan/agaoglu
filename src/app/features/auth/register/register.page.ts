import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { AuthShellComponent } from '../../../shared/ui/auth-shell.component';
import { authErrorMessage } from '../auth-errors';

const passwordMatchValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const pass = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return pass === confirm ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, PasswordModule, IconFieldModule, InputIconModule, AuthShellComponent],
  template: `
    <ui-auth-shell [title]="t().auth.registerTitle" [subtitle]="t().auth.registerSubtitle" eyebrow="Tarım Market Pro">
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4" novalidate>
        <div class="flex flex-col gap-1.5">
          <label for="reg-name" class="text-sm font-semibold text-fg-secondary">{{ t().auth.displayName }}</label>
          <p-iconfield class="w-full">
            <p-inputicon styleClass="pi pi-user" />
            <input pInputText id="reg-name" type="text" formControlName="displayName" [placeholder]="t().auth.displayNamePlaceholder" class="w-full" autocomplete="name" />
          </p-iconfield>
          @if (form.get('displayName')?.invalid && form.get('displayName')?.touched) {
            <p class="m-0 text-xs font-medium text-danger-text">{{ t().auth.displayNameRequired }}</p>
          }
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="reg-email" class="text-sm font-semibold text-fg-secondary">{{ t().auth.email }}</label>
          <p-iconfield class="w-full">
            <p-inputicon styleClass="pi pi-envelope" />
            <input pInputText id="reg-email" type="email" formControlName="email" [placeholder]="t().auth.emailPlaceholder" class="w-full" autocomplete="email" />
          </p-iconfield>
          @if (form.get('email')?.invalid && form.get('email')?.touched) {
            <p class="m-0 text-xs font-medium text-danger-text">{{ t().auth.emailInvalid }}</p>
          }
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="reg-password" class="text-sm font-semibold text-fg-secondary">{{ t().auth.password }}</label>
          <p-password
            inputId="reg-password"
            formControlName="password"
            [feedback]="true"
            [toggleMask]="true"
            [placeholder]="t().auth.passwordTooShort"
            styleClass="w-full"
            inputStyleClass="w-full"
            autocomplete="new-password"
          ></p-password>
          @if (form.get('password')?.invalid && form.get('password')?.touched) {
            <p class="m-0 text-xs font-medium text-danger-text">{{ t().auth.passwordTooShort }}</p>
          }
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="reg-confirm" class="text-sm font-semibold text-fg-secondary">{{ t().auth.confirmPassword }}</label>
          <p-password
            inputId="reg-confirm"
            formControlName="confirmPassword"
            [feedback]="false"
            [toggleMask]="true"
            [placeholder]="t().auth.confirmPasswordPlaceholder"
            styleClass="w-full"
            inputStyleClass="w-full"
            autocomplete="new-password"
          ></p-password>
          @if (form.get('confirmPassword')?.touched && form.hasError('passwordMismatch')) {
            <p class="m-0 text-xs font-medium text-danger-text">{{ t().auth.passwordMismatch }}</p>
          }
        </div>

      @if (error()) {
        <div role="alert" class="mb-4 flex items-start gap-2.5 rounded-token-lg border border-danger-line bg-danger-soft px-3.5 py-3 text-sm text-danger-text">
          <i class="pi pi-exclamation-circle mt-0.5 text-sm" aria-hidden="true"></i>
          <span>{{ error() }}</span>
        </div>
      }
        <p-button
          type="submit"
          [label]="t().auth.registerTitle"
          icon="pi pi-user-plus"
          size="large"
          [loading]="loading()"
          [disabled]="form.invalid"
          styleClass="w-full mt-1"
        ></p-button>
      </form>

      <div auth-footer class="flex flex-wrap justify-center gap-1.5">
        <span>{{ t().auth.hasAccount }}</span>
        <a [routerLink]="['/auth/login']" class="font-semibold text-brand-text no-underline hover:underline">{{ t().auth.goLogin }}</a>
      </div>
    </ui-auth-shell>
  `,
})
export class RegisterPage {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  readonly t = inject(LangService).t;

  readonly loading = signal(false);
  readonly error = signal('');

  readonly form = this.fb.group({
    displayName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
  }, { validators: passwordMatchValidator });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');
    try {
      const { email, password, displayName } = this.form.value;
      await this.authService.register(email!, password!, displayName!);
    } catch (err) {
      this.error.set(authErrorMessage(err, this.t().auth, this.t().auth.errRegisterDefault));
    } finally {
      this.loading.set(false);
    }
  }
}
