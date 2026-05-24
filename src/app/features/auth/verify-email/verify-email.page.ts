import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../../core/auth/services/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [ButtonModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <div class="bg-white rounded-3xl shadow-card p-8 border border-gray-100 text-center">

          <div style="width:72px; height:72px; border-radius:20px; background:linear-gradient(135deg,#4ade80,#16a34a); display:flex; align-items:center; justify-content:center; margin:0 auto 20px;">
            <i class="pi pi-envelope" style="color:white; font-size:28px;"></i>
          </div>

          <h1 class="text-2xl font-bold text-gray-800 mb-2">E-postanı Doğrula</h1>
          <p class="text-gray-400 text-sm mb-2">
            <strong class="text-gray-600">{{ email() }}</strong> adresine doğrulama maili gönderdik.
          </p>
          <p class="text-gray-400 text-sm mb-8">Maildeki linke tıkladıktan sonra aşağıdaki butona bas.</p>

          @if (errorMsg()) {
            <div class="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center gap-2 mb-4 text-left">
              <i class="pi pi-exclamation-circle text-red-500 text-sm"></i>
              <span class="text-sm text-red-600">{{ errorMsg() }}</span>
            </div>
          }

          <div class="flex flex-col gap-3">
            <p-button
              label="Doğruladım, Devam Et"
              icon="pi pi-check-circle"
              severity="success"
              styleClass="w-full"
              [loading]="checking()"
              (onClick)="checkVerification()"
            ></p-button>

            <p-button
              label="Tekrar Gönder"
              icon="pi pi-refresh"
              severity="secondary"
              [text]="true"
              styleClass="w-full"
              [loading]="resending()"
              (onClick)="resend()"
            ></p-button>

            <p-button
              label="Farklı hesapla giriş yap"
              icon="pi pi-sign-out"
              severity="danger"
              [text]="true"
              styleClass="w-full"
              (onClick)="logout()"
            ></p-button>
          </div>

        </div>
      </div>
    </div>
  `,
})
export class VerifyEmailPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly checking = signal(false);
  readonly resending = signal(false);
  readonly errorMsg = signal('');

  async ngOnInit(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      await this.router.navigate(['/auth/login']);
      return;
    }
    if (this.auth.isEmailVerified()) {
      await this.router.navigate(['/dashboard']);
    }
  }

  email(): string {
    return this.auth.currentUser()?.email ?? '';
  }

  async checkVerification(): Promise<void> {
    this.checking.set(true);
    this.errorMsg.set('');
    try {
      await this.auth.reloadUser();
      if (this.auth.isEmailVerified()) {
        await this.router.navigate(['/dashboard']);
      } else {
        this.errorMsg.set('E-posta henüz doğrulanmadı. Maildeki linke tıkladıktan sonra tekrar dene.');
      }
    } finally {
      this.checking.set(false);
    }
  }

  async resend(): Promise<void> {
    this.resending.set(true);
    this.errorMsg.set('');
    try {
      await this.auth.resendVerificationEmail();
    } catch {
      this.errorMsg.set('Mail gönderilemedi, biraz bekleyip tekrar dene.');
    } finally {
      this.resending.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
  }
}
