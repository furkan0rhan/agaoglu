import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { AuthService } from '../../../core/auth/services/auth.service';

const passwordMatchValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const pass = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return pass === confirm ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, PasswordModule, IconFieldModule, InputIconModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <div class="bg-white rounded-3xl shadow-card p-8 border border-gray-100">

          <!-- Brand -->
          <div class="text-center mb-8">
            <img src="assets/TarimLogo.png" alt="Tarım Market Logo" class="w-20 h-20 mx-auto mb-4 object-contain" />
            <h1 class="text-2xl font-bold text-gray-800">Kayıt Ol</h1>
            <p class="text-gray-400 text-sm mt-1">Yeni hesap oluşturun</p>
          </div>

          <!-- Form -->
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">

            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-gray-700">Ad Soyad</label>
              <p-iconfield class="w-full">
                <p-inputicon styleClass="pi pi-user" />
                <input pInputText type="text" formControlName="displayName" placeholder="Adınız Soyadınız" class="w-full" autocomplete="name" />
              </p-iconfield>
              @if (form.get('displayName')?.invalid && form.get('displayName')?.touched) {
                <p class="text-xs text-red-500">Ad soyad gerekli</p>
              }
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-gray-700">E-posta</label>
              <p-iconfield class="w-full">
                <p-inputicon styleClass="pi pi-envelope" />
                <input pInputText type="email" formControlName="email" placeholder="ornek@email.com" class="w-full" autocomplete="email" />
              </p-iconfield>
              @if (form.get('email')?.invalid && form.get('email')?.touched) {
                <p class="text-xs text-red-500">Geçerli bir e-posta girin</p>
              }
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-gray-700">Şifre</label>
              <p-password
                formControlName="password"
                [feedback]="true"
                [toggleMask]="true"
                placeholder="En az 6 karakter"
                styleClass="w-full"
                inputStyleClass="w-full"
                autocomplete="new-password"
                promptLabel="Şifre gücü"
                weakLabel="Zayıf"
                mediumLabel="Orta"
                strongLabel="Güçlü"
              ></p-password>
              @if (form.get('password')?.invalid && form.get('password')?.touched) {
                <p class="text-xs text-red-500">Şifre en az 6 karakter olmalı</p>
              }
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-gray-700">Şifre Tekrarı</label>
              <p-password
                formControlName="confirmPassword"
                [feedback]="false"
                [toggleMask]="true"
                placeholder="Şifrenizi tekrar girin"
                styleClass="w-full"
                inputStyleClass="w-full"
                autocomplete="new-password"
              ></p-password>
              @if (form.get('confirmPassword')?.touched && form.hasError('passwordMismatch')) {
                <p class="text-xs text-red-500">Şifreler eşleşmiyor</p>
              }
            </div>

            @if (error()) {
              <div class="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center gap-2">
                <i class="pi pi-exclamation-circle text-red-500 text-sm"></i>
                <span class="text-sm text-red-600">{{ error() }}</span>
              </div>
            }

            <p-button
              type="submit"
              label="Kayıt Ol"
              icon="pi pi-user-plus"
              [loading]="loading()"
              [disabled]="form.invalid"
              styleClass="w-full mt-2"
              severity="success"
            ></p-button>

          </form>

          <div class="flex justify-center gap-2 mt-6 text-sm text-gray-400">
            <span>Hesabınız var mı?</span>
            <a [routerLink]="['/auth/login']" class="text-green-600 font-semibold hover:text-green-700 transition-colors">Giriş yapın</a>
          </div>

        </div>
      </div>
    </div>
  `,
})
export class RegisterPage {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

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
    } catch {
      this.error.set('Kayıt başarısız. E-posta zaten kullanılıyor olabilir.');
    } finally {
      this.loading.set(false);
    }
  }
}
