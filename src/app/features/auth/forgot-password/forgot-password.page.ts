import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LangService } from '../../../core/i18n/lang.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [RouterLink, FormsModule, ButtonModule, InputTextModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <div class="bg-white rounded-3xl shadow-card p-8 border border-gray-100 text-center">

          <div style="width:72px; height:72px; border-radius:20px; background:linear-gradient(135deg,#4ade80,#16a34a); display:flex; align-items:center; justify-content:center; margin:0 auto 20px;">
            <i class="pi pi-lock" style="color:white; font-size:28px;"></i>
          </div>

          <h1 class="text-2xl font-bold text-gray-800 mb-2">{{ t().auth.forgotTitle }}</h1>
          <p class="text-gray-400 text-sm mb-8">{{ t().auth.forgotSubtitle }}</p>

          @if (!sent()) {
            <div class="flex flex-col gap-4 text-left">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-semibold text-gray-700">{{ t().auth.email }}</label>
                <input
                  pInputText
                  [(ngModel)]="email"
                  type="email"
                  [placeholder]="t().auth.emailPlaceholder"
                  class="w-full"
                />
              </div>
              <p-button
                [label]="t().auth.sendReset"
                icon="pi pi-send"
                severity="success"
                styleClass="w-full"
                [loading]="loading()"
                [disabled]="!email.trim()"
                (onClick)="onSubmit()"
              ></p-button>
            </div>
          } @else {
            <div class="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center gap-3 text-left mb-4">
              <i class="pi pi-check-circle text-green-500 text-xl flex-shrink-0"></i>
              <span class="text-sm text-green-700 font-medium">{{ t().auth.resetSent }}</span>
            </div>
          }

          <div class="flex items-center justify-center gap-2 mt-6">
            <i class="pi pi-arrow-left text-sm text-gray-400"></i>
            <a [routerLink]="['/auth/login']" class="text-sm text-green-600 font-semibold hover:text-green-700">
              {{ t().auth.backToLogin }}
            </a>
          </div>

        </div>
      </div>
    </div>
  `,
})
export class ForgotPasswordPage {
  private readonly authService = inject(AuthService);
  readonly t = inject(LangService).t;

  email = '';
  readonly loading = signal(false);
  readonly sent = signal(false);

  async onSubmit(): Promise<void> {
    if (!this.email.trim()) return;
    this.loading.set(true);
    try {
      await this.authService.resetPassword(this.email.trim());
      this.sent.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
