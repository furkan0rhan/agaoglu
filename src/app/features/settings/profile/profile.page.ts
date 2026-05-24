import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, PasswordModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast position="top-right"></p-toast>
    <div style="display:flex; flex-direction:column; height:100%; background:#f8fafc; overflow:hidden;">

      <!-- Header -->
      <div style="background:#fff; border-bottom:1px solid #f1f5f9; padding:16px 24px; display:flex; align-items:center; gap:12px; flex-shrink:0;">
        <div style="width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg,#8b5cf6,#6d28d9); display:flex; align-items:center; justify-content:center;">
          <i class="pi pi-cog" style="color:white; font-size:16px;"></i>
        </div>
        <div>
          <h1 style="font-size:18px; font-weight:700; color:#1e293b; margin:0;">Ayarlar & Profil</h1>
          <p style="font-size:12px; color:#64748b; margin:0;">Hesap bilgileri ve uygulama ayarları</p>
        </div>
      </div>

      <!-- Content -->
      <div style="flex:1; overflow-y:auto; padding:24px; display:flex; flex-direction:column; gap:16px; max-width:560px;">

        <!-- Profil kartı -->
        <div style="background:#fff; border-radius:16px; border:1px solid #f1f5f9; box-shadow:0 2px 12px rgba(0,0,0,0.04); overflow:hidden;">

          <!-- Avatar + isim -->
          <div style="padding:20px; display:flex; align-items:center; gap:16px; border-bottom:1px solid #f8fafc;">
            <div style="width:60px; height:60px; border-radius:16px; background:linear-gradient(135deg,#4ade80,#16a34a); display:flex; align-items:center; justify-content:center; color:white; font-size:24px; font-weight:700; flex-shrink:0;">
              {{ userInitial() }}
            </div>
            <div style="flex:1;">
              <p style="font-size:17px; font-weight:700; color:#1e293b; margin:0 0 4px;">{{ formattedName() }}</p>
              <span style="display:inline-block; background:#f0fdf4; color:#16a34a; font-size:11px; font-weight:700; border-radius:20px; padding:3px 10px; text-transform:uppercase; letter-spacing:0.5px;">
                {{ roleLabel() }}
              </span>
            </div>
          </div>

          <!-- Bilgi satırları -->
          <div style="display:flex; align-items:center; gap:12px; padding:14px 20px; border-bottom:1px solid #f8fafc;">
            <div style="width:34px; height:34px; border-radius:9px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <i class="pi pi-envelope" style="font-size:14px; color:#64748b;"></i>
            </div>
            <div style="flex:1;">
              <p style="font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 2px;">E-posta</p>
              <p style="font-size:14px; font-weight:500; color:#1e293b; margin:0;">{{ auth.currentUser()?.email ?? '-' }}</p>
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:12px; padding:14px 20px; border-bottom:1px solid #f8fafc;">
            <div style="width:34px; height:34px; border-radius:9px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <i class="pi pi-calendar" style="font-size:14px; color:#64748b;"></i>
            </div>
            <div style="flex:1;">
              <p style="font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 2px;">Kayıt Tarihi</p>
              <p style="font-size:14px; font-weight:500; color:#1e293b; margin:0;">{{ formatDate(auth.currentUser()?.createdAt) }}</p>
            </div>
          </div>
        </div>

        <!-- Ad Soyad Düzenle -->
        <div style="background:#fff; border-radius:16px; border:1px solid #f1f5f9; box-shadow:0 2px 12px rgba(0,0,0,0.04); padding:20px;">
          <p style="font-size:12px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.8px; margin:0 0 14px;">Ad Soyad Güncelle</p>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <input
              pInputText
              [(ngModel)]="newName"
              placeholder="Ad Soyad"
              style="width:100%;"
            />
            <p-button
              label="Güncelle"
              icon="pi pi-check"
              severity="success"
              size="small"
              [loading]="savingName()"
              [disabled]="!newName.trim()"
              (onClick)="saveName()"
            ></p-button>
          </div>
        </div>

        <!-- E-posta Güncelle -->
        <div style="background:#fff; border-radius:16px; border:1px solid #f1f5f9; box-shadow:0 2px 12px rgba(0,0,0,0.04); padding:20px;">
          <p style="font-size:12px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.8px; margin:0 0 14px;">E-posta Güncelle</p>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <input
              pInputText
              [(ngModel)]="newEmail"
              placeholder="Yeni e-posta adresi"
              type="email"
              style="width:100%;"
            />
            <p-password
              [(ngModel)]="emailCurrentPassword"
              placeholder="Mevcut şifreniz"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
            ></p-password>
            <div style="display:flex; align-items:flex-start; gap:8px; background:#eff6ff; border-radius:10px; padding:10px 12px;">
              <i class="pi pi-info-circle" style="color:#3b82f6; font-size:13px; margin-top:1px; flex-shrink:0;"></i>
              <p style="font-size:12px; color:#3b82f6; margin:0; line-height:1.5;">Yeni adrese doğrulama e-postası gönderilir. Linke tıkladıktan sonra e-postanız güncellenir.</p>
            </div>
            <p-button
              label="Doğrulama Gönder"
              icon="pi pi-envelope"
              severity="info"
              size="small"
              [loading]="savingEmail()"
              [disabled]="!newEmail.trim() || !emailCurrentPassword"
              (onClick)="saveEmail()"
            ></p-button>
          </div>
        </div>

        <!-- Şifre Değiştir -->
        <div style="background:#fff; border-radius:16px; border:1px solid #f1f5f9; box-shadow:0 2px 12px rgba(0,0,0,0.04); padding:20px;">
          <p style="font-size:12px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.8px; margin:0 0 14px;">Şifre Değiştir</p>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <p-password
              [(ngModel)]="currentPassword"
              placeholder="Mevcut şifre"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
            ></p-password>
            <p-password
              [(ngModel)]="newPassword"
              placeholder="Yeni şifre"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
            ></p-password>
            <p-password
              [(ngModel)]="confirmPassword"
              placeholder="Yeni şifre tekrar"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
            ></p-password>
            @if (newPassword && confirmPassword && newPassword !== confirmPassword) {
              <p style="font-size:12px; color:#ef4444; margin:0;">Şifreler eşleşmiyor</p>
            }
            <p-button
              label="Şifreyi Değiştir"
              icon="pi pi-lock"
              severity="info"
              size="small"
              [loading]="savingPassword()"
              [disabled]="!currentPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 6"
              (onClick)="savePassword()"
            ></p-button>
          </div>
        </div>

        <!-- Uygulama bilgileri -->
        <div style="background:#fff; border-radius:16px; border:1px solid #f1f5f9; box-shadow:0 2px 12px rgba(0,0,0,0.04); padding:20px;">
          <p style="font-size:12px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.8px; margin:0 0 14px;">Uygulama</p>
          @for (item of appInfo; track item.label) {
            <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 0; border-bottom:1px solid #f8fafc;">
              <span style="font-size:13px; color:#64748b;">{{ item.label }}</span>
              <span style="font-size:13px; font-weight:600; color:#1e293b;">{{ item.value }}</span>
            </div>
          }
        </div>

        <!-- Çıkış -->
        <div style="background:#fff; border-radius:16px; border:1px solid #fee2e2; box-shadow:0 2px 12px rgba(0,0,0,0.04); padding:16px 20px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div>
            <p style="font-size:14px; font-weight:600; color:#1e293b; margin:0 0 2px;">Oturumu Kapat</p>
            <p style="font-size:12px; color:#94a3b8; margin:0;">Hesabınızdan güvenli çıkış yapın</p>
          </div>
          <p-button label="Çıkış Yap" icon="pi pi-sign-out" severity="danger" size="small" (onClick)="auth.logout()"></p-button>
        </div>

      </div>
    </div>
  `,
})
export class ProfilePage {
  readonly auth = inject(AuthService);
  private readonly toast = inject(MessageService);

  newName = '';
  newEmail = '';
  emailCurrentPassword = '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  readonly savingName = signal(false);
  readonly savingEmail = signal(false);
  readonly savingPassword = signal(false);

  readonly appInfo = [
    { label: 'Uygulama Adı', value: 'Tarım Market Pro' },
    { label: 'Sürüm', value: '1.0.0' },
    { label: 'Platform', value: 'Desktop' },
  ];

  async saveName(): Promise<void> {
    if (!this.newName.trim()) return;
    this.savingName.set(true);
    try {
      await this.auth.updateDisplayName(this.newName.trim());
      this.toast.add({ severity: 'success', summary: '', detail: 'Ad soyad güncellendi', life: 3000 });
      this.newName = '';
    } catch {
      this.toast.add({ severity: 'error', summary: '', detail: 'Güncelleme başarısız', life: 3000 });
    } finally {
      this.savingName.set(false);
    }
  }

  async saveEmail(): Promise<void> {
    if (!this.newEmail.trim() || !this.emailCurrentPassword) return;
    this.savingEmail.set(true);
    try {
      await this.auth.updateEmail(this.emailCurrentPassword, this.newEmail.trim());
      this.toast.add({ severity: 'success', summary: '', detail: 'Doğrulama e-postası gönderildi. Linke tıklayınca e-postanız güncellenir.', life: 6000 });
      this.newEmail = '';
      this.emailCurrentPassword = '';
    } catch (err: any) {
      const msg = err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential'
        ? 'Mevcut şifre yanlış'
        : 'E-posta güncellenemedi';
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
      this.toast.add({ severity: 'success', summary: '', detail: 'Şifre değiştirildi', life: 3000 });
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
    } catch (err: any) {
      const msg = err?.code === 'auth/wrong-password' ? 'Mevcut şifre yanlış' : 'Şifre değiştirilemedi';
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
    const map: Record<string, string> = { admin: 'Yönetici', cashier: 'Kasiyer', staff: 'Personel' };
    return map[this.auth.currentUser()?.role ?? ''] ?? '';
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date as string);
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  }
}
