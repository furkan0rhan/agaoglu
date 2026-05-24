import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonButton, IonContent, IonIcon, IonInput,
  IonItem, IonLabel, IonSpinner, IonText,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { leafOutline, mailOutline, arrowBackOutline } from 'ionicons/icons';
import { AuthService } from '../../../core/auth/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink,
    IonContent, IonItem, IonLabel, IonInput,
    IonButton, IonIcon, IonText, IonSpinner,
  ],
  template: `
    <ion-content class="auth-content">
      <div class="auth-container">
        <div class="auth-card">
          <div class="auth-header">
            <ion-icon name="leaf-outline" class="brand-icon"></ion-icon>
            <h1>Şifremi Unuttum</h1>
            <p>E-postanıza sıfırlama bağlantısı gönderilecek</p>
          </div>

          @if (!sent()) {
            <form [formGroup]="form" (ngSubmit)="onSubmit()">
              <ion-item>
                <ion-icon name="mail-outline" slot="start"></ion-icon>
                <ion-label position="floating">E-posta</ion-label>
                <ion-input formControlName="email" type="email"></ion-input>
              </ion-item>

              <ion-button expand="block" type="submit" [disabled]="form.invalid || loading()" class="submit-btn">
                @if (loading()) { <ion-spinner name="crescent"></ion-spinner> }
                @else { Sıfırlama Gönder }
              </ion-button>
            </form>
          } @else {
            <div class="success-msg">
              <ion-text color="success">
                <p>✓ Sıfırlama bağlantısı e-postanıza gönderildi.</p>
              </ion-text>
            </div>
          }

          <div class="auth-links">
            <ion-icon name="arrow-back-outline"></ion-icon>
            <a [routerLink]="['/auth/login']">Giriş sayfasına dön</a>
          </div>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .auth-content { --background: linear-gradient(135deg, #1a472a 0%, #2d6a4f 100%); }
    .auth-container { display: flex; align-items: center; justify-content: center; min-height: 100%; padding: 24px; }
    .auth-card { background: white; border-radius: 20px; padding: 40px 32px; width: 100%; max-width: 420px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .auth-header { text-align: center; margin-bottom: 32px; }
    .brand-icon { font-size: 3rem; color: var(--ion-color-primary); }
    .auth-header h1 { font-size: 1.6rem; font-weight: 700; margin: 8px 0 4px; }
    .auth-header p { color: #666; margin: 0; font-size: 0.9rem; }
    ion-item { --border-radius: 10px; --background: #f8f9fa; margin-bottom: 12px; }
    .submit-btn { margin-top: 20px; --border-radius: 10px; height: 48px; }
    .success-msg { padding: 16px; background: #f0fff4; border-radius: 10px; text-align: center; }
    .auth-links { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 20px; font-size: 0.9rem; }
    .auth-links a { color: var(--ion-color-primary); text-decoration: none; }
  `],
})
export class ForgotPasswordPage {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly sent = signal(false);

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    addIcons({ leafOutline, mailOutline, arrowBackOutline });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    try {
      await this.authService.resetPassword(this.form.value.email!);
      this.sent.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
