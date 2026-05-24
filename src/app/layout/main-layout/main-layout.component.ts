import { Component, inject, signal, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { SidebarService } from '../sidebar/sidebar.service';
import { AuthService } from '../../core/auth/services/auth.service';
import { CartStore } from '../../features/pos/store/cart.store';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, SidebarComponent],
  template: `
    @if (!isMobile()) {
      <app-sidebar></app-sidebar>
    }

    <div class="main-content" [style.padding-bottom]="isMobile() ? 'calc(72px + env(safe-area-inset-bottom, 0px))' : '0'">
      <router-outlet></router-outlet>
    </div>

    @if (isMobile()) {

      <!-- "Diğer" backdrop -->
      @if (showMore()) {
        <div (click)="showMore.set(false)"
          style="position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:310; backdrop-filter:blur(3px);">
        </div>

        <!-- "Diğer" sheet -->
        <div style="position:fixed; left:12px; right:12px; background:#fff; border-radius:24px; z-index:320; box-shadow:0 -2px 40px rgba(0,0,0,0.15); padding:16px;"
          [style.bottom]="'calc(64px + env(safe-area-inset-bottom, 0px) + 8px)'">
          <div style="width:36px; height:4px; background:#e2e8f0; border-radius:2px; margin:0 auto 16px;"></div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <a routerLink="/customers" (click)="showMore.set(false)"
                style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:16px; text-decoration:none;"
                [style.background]="isActive('/customers') ? '#f0fdf4' : '#f8fafc'"
                [style.border]="isActive('/customers') ? '1.5px solid #bbf7d0' : '1.5px solid #f1f5f9'">
                <div style="width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;"
                  [style.background]="isActive('/customers') ? '#16a34a' : '#f1f5f9'">
                  <i class="pi pi-users" style="font-size:15px;" [style.color]="isActive('/customers') ? 'white' : '#64748b'"></i>
                </div>
                <span style="font-size:13px; font-weight:600;" [style.color]="isActive('/customers') ? '#16a34a' : '#1e293b'">Müşteriler</span>
              </a>
            @if (isAdmin()) {
              <a routerLink="/credit" (click)="showMore.set(false)"
                style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:16px; text-decoration:none;"
                [style.background]="isActive('/credit') ? '#f0fdf4' : '#f8fafc'"
                [style.border]="isActive('/credit') ? '1.5px solid #bbf7d0' : '1.5px solid #f1f5f9'">
                <div style="width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;"
                  [style.background]="isActive('/credit') ? '#16a34a' : '#f1f5f9'">
                  <i class="pi pi-credit-card" style="font-size:15px;" [style.color]="isActive('/credit') ? 'white' : '#64748b'"></i>
                </div>
                <span style="font-size:13px; font-weight:600;" [style.color]="isActive('/credit') ? '#16a34a' : '#1e293b'">Veresiye</span>
              </a>
              <a routerLink="/expenses" (click)="showMore.set(false)"
                style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:16px; text-decoration:none;"
                [style.background]="isActive('/expenses') ? '#f0fdf4' : '#f8fafc'"
                [style.border]="isActive('/expenses') ? '1.5px solid #bbf7d0' : '1.5px solid #f1f5f9'">
                <div style="width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;"
                  [style.background]="isActive('/expenses') ? '#16a34a' : '#f1f5f9'">
                  <i class="pi pi-wallet" style="font-size:15px;" [style.color]="isActive('/expenses') ? 'white' : '#64748b'"></i>
                </div>
                <span style="font-size:13px; font-weight:600;" [style.color]="isActive('/expenses') ? '#16a34a' : '#1e293b'">Giderler</span>
              </a>
              <a routerLink="/settings" (click)="showMore.set(false)"
                style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:16px; text-decoration:none;"
                [style.background]="isActive('/settings') ? '#f0fdf4' : '#f8fafc'"
                [style.border]="isActive('/settings') ? '1.5px solid #bbf7d0' : '1.5px solid #f1f5f9'">
                <div style="width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;"
                  [style.background]="isActive('/settings') ? '#16a34a' : '#f1f5f9'">
                  <i class="pi pi-cog" style="font-size:15px;" [style.color]="isActive('/settings') ? 'white' : '#64748b'"></i>
                </div>
                <span style="font-size:13px; font-weight:600;" [style.color]="isActive('/settings') ? '#16a34a' : '#1e293b'">Ayarlar</span>
              </a>
            }
          </div>
          <button (click)="logout()"
            style="margin-top:10px; width:100%; display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:16px; border:1.5px solid #fee2e2; background:#fef2f2; cursor:pointer;">
            <div style="width:36px; height:36px; border-radius:10px; background:#fee2e2; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <i class="pi pi-sign-out" style="font-size:15px; color:#ef4444;"></i>
            </div>
            <span style="font-size:13px; font-weight:600; color:#ef4444;">Çıkış Yap</span>
          </button>
        </div>
      }

      <!-- Bottom Nav -->
      <nav style="position:fixed; bottom:0; left:0; right:0; background:#fff; border-top:1px solid #f1f5f9; box-shadow:0 -2px 16px rgba(0,0,0,0.07); z-index:300; display:flex; align-items:center; padding:0 6px; padding-bottom:env(safe-area-inset-bottom, 0px); height:calc(64px + env(safe-area-inset-bottom, 0px));">

        <!-- Dashboard -->
        <a routerLink="/dashboard" (click)="showMore.set(false)" style="flex:1; display:flex; justify-content:center; align-items:center; text-decoration:none;">
          <div style="display:flex; align-items:center; gap:0; border-radius:20px; padding:8px 12px; transition:background 0.2s;"
            [style.background]="isActive('/dashboard') ? '#f0fdf4' : 'transparent'">
            <i class="pi pi-home" style="font-size:22px; flex-shrink:0; transition:color 0.2s;"
              [style.color]="isActive('/dashboard') ? '#16a34a' : '#94a3b8'"></i>
            <span style="white-space:nowrap; font-size:12px; font-weight:700; color:#16a34a; margin-left:6px; overflow:hidden; transition:max-width 0.3s ease, opacity 0.25s ease;"
              [style.max-width]="isActive('/dashboard') && !showMore() ? '80px' : '0px'"
              [style.opacity]="isActive('/dashboard') && !showMore() ? '1' : '0'">
              Ana Sayfa
            </span>
          </div>
        </a>

        <!-- Ürünler -->
        <a routerLink="/products" (click)="showMore.set(false)" style="flex:1; display:flex; justify-content:center; align-items:center; text-decoration:none;">
          <div style="display:flex; align-items:center; border-radius:20px; padding:8px 12px; transition:background 0.2s;"
            [style.background]="isActive('/products') && !showMore() ? '#f0fdf4' : 'transparent'">
            <i class="pi pi-box" style="font-size:22px; flex-shrink:0; transition:color 0.2s;"
              [style.color]="isActive('/products') && !showMore() ? '#16a34a' : '#94a3b8'"></i>
            <span style="white-space:nowrap; font-size:12px; font-weight:700; color:#16a34a; margin-left:6px; overflow:hidden; transition:max-width 0.3s ease, opacity 0.25s ease;"
              [style.max-width]="isActive('/products') && !showMore() ? '60px' : '0px'"
              [style.opacity]="isActive('/products') && !showMore() ? '1' : '0'">
              Ürünler
            </span>
          </div>
        </a>

        <!-- Sepet (POS) -->
        <a routerLink="/pos" (click)="showMore.set(false)" style="flex:1; display:flex; justify-content:center; align-items:center; text-decoration:none;">
          <div style="display:flex; align-items:center; border-radius:20px; padding:8px 12px; transition:background 0.2s; position:relative;"
            [style.background]="isActive('/pos') && !showMore() ? '#fff7ed' : 'transparent'">
            <i class="pi pi-shopping-cart" style="font-size:22px; flex-shrink:0; transition:color 0.2s;"
              [style.color]="isActive('/pos') && !showMore() ? '#ea580c' : '#94a3b8'"></i>
            @if (cart.itemCount() > 0) {
              <span style="position:absolute; top:2px; right:6px; background:#ef4444; color:white; border-radius:10px; font-size:9px; font-weight:800; min-width:16px; height:16px; display:flex; align-items:center; justify-content:center; padding:0 3px; border:1.5px solid white;">
                {{ cart.itemCount() }}
              </span>
            }
            <span style="white-space:nowrap; font-size:12px; font-weight:700; color:#ea580c; margin-left:6px; overflow:hidden; transition:max-width 0.3s ease, opacity 0.25s ease;"
              [style.max-width]="isActive('/pos') && !showMore() ? '50px' : '0px'"
              [style.opacity]="isActive('/pos') && !showMore() ? '1' : '0'">
              Sepet
            </span>
          </div>
        </a>

        <!-- Raporlar -->
        <a routerLink="/reports" (click)="showMore.set(false)" style="flex:1; display:flex; justify-content:center; align-items:center; text-decoration:none;">
          <div style="display:flex; align-items:center; border-radius:20px; padding:8px 12px; transition:background 0.2s;"
            [style.background]="isActive('/reports') && !showMore() ? '#f0fdf4' : 'transparent'">
            <i class="pi pi-chart-bar" style="font-size:22px; flex-shrink:0; transition:color 0.2s;"
              [style.color]="isActive('/reports') && !showMore() ? '#16a34a' : '#94a3b8'"></i>
            <span style="white-space:nowrap; font-size:12px; font-weight:700; color:#16a34a; margin-left:6px; overflow:hidden; transition:max-width 0.3s ease, opacity 0.25s ease;"
              [style.max-width]="isActive('/reports') && !showMore() ? '65px' : '0px'"
              [style.opacity]="isActive('/reports') && !showMore() ? '1' : '0'">
              Raporlar
            </span>
          </div>
        </a>

        <!-- Diğer -->
        <button (click)="showMore.set(!showMore())"
          style="flex:1; display:flex; justify-content:center; align-items:center; border:none; background:transparent; cursor:pointer;">
          <div style="display:flex; align-items:center; border-radius:20px; padding:8px 12px; transition:background 0.2s;"
            [style.background]="showMore() ? '#f1f5f9' : 'transparent'">
            <i class="pi pi-ellipsis-h" style="font-size:22px; transition:color 0.2s;"
              [style.color]="showMore() ? '#475569' : '#94a3b8'"></i>
            <span style="white-space:nowrap; font-size:12px; font-weight:700; color:#475569; margin-left:6px; overflow:hidden; transition:max-width 0.3s ease, opacity 0.25s ease;"
              [style.max-width]="showMore() ? '45px' : '0px'"
              [style.opacity]="showMore() ? '1' : '0'">
              Diğer
            </span>
          </div>
        </button>

      </nav>
    }
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: row;
      height: 100%;
      overflow: hidden;
      padding-top: env(safe-area-inset-top, 0px);
      box-sizing: border-box;
    }
    .main-content {
      flex: 1;
      min-width: 0;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
    }
  `],
})
export class MainLayoutComponent {
  readonly sidebarSvc = inject(SidebarService);
  readonly auth       = inject(AuthService);
  readonly cart       = inject(CartStore);
  private readonly router = inject(Router);

  readonly isMobile = signal(false);
  readonly showMore = signal(false);

  constructor() { this.checkMobile(); }

  @HostListener('window:resize')
  checkMobile(): void {
    this.isMobile.set(window.innerWidth < 1024);
    if (!this.isMobile()) this.showMore.set(false);
  }

  isActive(path: string): boolean {
    return this.router.url.startsWith(path);
  }

  isAdmin(): boolean {
    return (this.auth.currentUser()?.role ?? 'admin') === 'admin';
  }

  logout(): void {
    this.showMore.set(false);
    this.auth.logout();
  }
}
