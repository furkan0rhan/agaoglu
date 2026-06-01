import { Component, inject, signal, HostListener, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { SidebarService } from '../sidebar/sidebar.service';
import { AuthService } from '../../core/auth/services/auth.service';
import { CartStore } from '../../features/pos/store/cart.store';
import { NotificationService } from '../../core/notifications/notification.service';
import { ProductStore } from '../../features/products/store/product.store';
import { ThemeService } from '../../core/theme/theme.service';
import { LangService } from '../../core/i18n/lang.service';
import { NetworkService } from '../../core/offline/network.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, SidebarComponent],
  template: `
    @if (!isMobile()) {
      <app-sidebar></app-sidebar>
    }

    <div class="main-content" [style.padding-bottom]="isMobile() ? 'calc(72px + env(safe-area-inset-bottom, 0px))' : '0'">
      @if (!network.isOnline()) {
        <div style="background:#f59e0b; color:#fff; padding:8px 16px; display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; flex-shrink:0;">
          <i class="pi pi-wifi" style="font-size:14px;"></i>
          <span>{{ t().nav.offline }}</span>
          <span style="font-weight:400; font-size:12px; opacity:0.9;">— {{ t().nav.offlineDesc }}</span>
        </div>
      }
      <router-outlet></router-outlet>
    </div>

    @if (isMobile()) {

      <!-- "Diğer" backdrop -->
      @if (showMore()) {
        <div (click)="showMore.set(false)"
          style="position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:310; backdrop-filter:blur(3px);">
        </div>

        <!-- "Diğer" sheet -->
        <div style="position:fixed; left:12px; right:12px; background:var(--bg-surface); border-radius:24px; z-index:320; box-shadow:0 -2px 40px rgba(0,0,0,0.15); padding:16px;"
          [style.bottom]="'calc(64px + env(safe-area-inset-bottom, 0px) + 8px)'">
          <div style="width:36px; height:4px; background:var(--border-mid); border-radius:2px; margin:0 auto 16px;"></div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <a routerLink="/customers" (click)="showMore.set(false)"
                style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:16px; text-decoration:none;"
                [style.background]="sItemBg('/customers')"
                [style.border]="sItemBorder('/customers')">
                <div style="width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;"
                  [style.background]="sIconBg('/customers')">
                  <i class="pi pi-users" style="font-size:15px;" [style.color]="sIconColor('/customers')"></i>
                </div>
                <span style="font-size:13px; font-weight:600;" [style.color]="sTextColor('/customers')">{{ t().nav.customers }}</span>
              </a>
            @if (isAdmin()) {
              <a routerLink="/credit" (click)="showMore.set(false)"
                style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:16px; text-decoration:none;"
                [style.background]="sItemBg('/credit')"
                [style.border]="sItemBorder('/credit')">
                <div style="width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;"
                  [style.background]="sIconBg('/credit')">
                  <i class="pi pi-credit-card" style="font-size:15px;" [style.color]="sIconColor('/credit')"></i>
                </div>
                <span style="font-size:13px; font-weight:600;" [style.color]="sTextColor('/credit')">{{ t().nav.credit }}</span>
              </a>
              <a routerLink="/expenses" (click)="showMore.set(false)"
                style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:16px; text-decoration:none;"
                [style.background]="sItemBg('/expenses')"
                [style.border]="sItemBorder('/expenses')">
                <div style="width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;"
                  [style.background]="sIconBg('/expenses')">
                  <i class="pi pi-wallet" style="font-size:15px;" [style.color]="sIconColor('/expenses')"></i>
                </div>
                <span style="font-size:13px; font-weight:600;" [style.color]="sTextColor('/expenses')">{{ t().nav.expenses }}</span>
              </a>
              <a routerLink="/stock-count" (click)="showMore.set(false)"
                style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:16px; text-decoration:none;"
                [style.background]="sItemBg('/stock-count')"
                [style.border]="sItemBorder('/stock-count')">
                <div style="width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;"
                  [style.background]="sIconBg('/stock-count')">
                  <i class="pi pi-barcode" style="font-size:15px;" [style.color]="sIconColor('/stock-count')"></i>
                </div>
                <span style="font-size:13px; font-weight:600;" [style.color]="sTextColor('/stock-count')">{{ t().nav.stockCount }}</span>
              </a>
              <a routerLink="/suppliers" (click)="showMore.set(false)"
                style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:16px; text-decoration:none;"
                [style.background]="sItemBg('/suppliers')"
                [style.border]="sItemBorder('/suppliers')">
                <div style="width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;"
                  [style.background]="sIconBg('/suppliers')">
                  <i class="pi pi-truck" style="font-size:15px;" [style.color]="sIconColor('/suppliers')"></i>
                </div>
                <span style="font-size:13px; font-weight:600;" [style.color]="sTextColor('/suppliers')">{{ t().nav.suppliers }}</span>
              </a>
              <a routerLink="/settings" (click)="showMore.set(false)"
                style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:16px; text-decoration:none;"
                [style.background]="sItemBg('/settings')"
                [style.border]="sItemBorder('/settings')">
                <div style="width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;"
                  [style.background]="sIconBg('/settings')">
                  <i class="pi pi-cog" style="font-size:15px;" [style.color]="sIconColor('/settings')"></i>
                </div>
                <span style="font-size:13px; font-weight:600;" [style.color]="sTextColor('/settings')">{{ t().nav.settings }}</span>
              </a>
            }
          </div>
          <div style="margin-top:10px; display:flex; gap:10px;">
            <button (click)="themeSvc.toggle()"
              style="flex:1; display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:16px; border:1.5px solid var(--border); background:var(--bg-muted); cursor:pointer;">
              <div style="width:36px; height:36px; border-radius:10px; background:var(--bg-page); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i [class]="'pi ' + (themeSvc.isDark() ? 'pi-sun' : 'pi-moon')" style="font-size:15px; color:var(--text-secondary);"></i>
              </div>
              <span style="font-size:13px; font-weight:600; color:var(--text-secondary);">{{ themeSvc.isDark() ? t().nav.lightMode : t().nav.darkMode }}</span>
            </button>
            <button (click)="langSvc.toggle()"
              style="flex:1; display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:16px; border:1.5px solid var(--border); background:var(--bg-muted); cursor:pointer;">
              <div style="width:36px; height:36px; border-radius:10px; background:var(--bg-page); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:11px; font-weight:800; color:var(--text-secondary);">
                {{ langSvc.lang() === 'tr' ? 'EN' : 'TR' }}
              </div>
              <span style="font-size:13px; font-weight:600; color:var(--text-secondary);">{{ langSvc.lang() === 'tr' ? t().nav.switchToEn : t().nav.switchToTr }}</span>
            </button>
            <button (click)="logout()"
              style="flex:1; display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:16px; border:1.5px solid #fee2e2; background:#fef2f2; cursor:pointer;">
              <div style="width:36px; height:36px; border-radius:10px; background:#fee2e2; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i class="pi pi-sign-out" style="font-size:15px; color:#ef4444;"></i>
              </div>
              <span style="font-size:13px; font-weight:600; color:#ef4444;">{{ t().settings.logoutBtn }}</span>
            </button>
          </div>
        </div>
      }

      <!-- Bottom Nav -->
      <nav style="position:fixed; bottom:0; left:0; right:0; background:var(--bg-surface); border-top:1px solid var(--border); box-shadow:0 -2px 16px rgba(0,0,0,0.07); z-index:300; display:flex; align-items:center; padding:0 6px; padding-bottom:env(safe-area-inset-bottom, 0px); height:calc(64px + env(safe-area-inset-bottom, 0px));">

        <!-- Dashboard -->
        <a routerLink="/dashboard" (click)="showMore.set(false)" style="flex:1; display:flex; justify-content:center; align-items:center; text-decoration:none;">
          <div style="display:flex; align-items:center; gap:0; border-radius:20px; padding:8px 12px; transition:background 0.2s;"
            [style.background]="isActive('/dashboard') ? '#f0fdf4' : 'transparent'">
            <i class="pi pi-home" style="font-size:22px; flex-shrink:0; transition:color 0.2s;"
              [style.color]="isActive('/dashboard') ? '#16a34a' : '#94a3b8'"></i>
            <span style="white-space:nowrap; font-size:12px; font-weight:700; color:#16a34a; margin-left:6px; overflow:hidden; transition:max-width 0.3s ease, opacity 0.25s ease;"
              [style.max-width]="isActive('/dashboard') && !showMore() ? '80px' : '0px'"
              [style.opacity]="isActive('/dashboard') && !showMore() ? '1' : '0'">
              {{ t().nav.home }}
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
              {{ t().nav.products }}
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
              {{ t().nav.cart }}
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
              {{ t().nav.reports }}
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
              {{ t().nav.other }}
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
export class MainLayoutComponent implements OnInit {
  readonly sidebarSvc   = inject(SidebarService);
  readonly auth         = inject(AuthService);
  readonly cart         = inject(CartStore);
  readonly themeSvc     = inject(ThemeService);
  readonly langSvc      = inject(LangService);
  readonly network      = inject(NetworkService);
  readonly t            = this.langSvc.t;
  private readonly router         = inject(Router);
  private readonly notifSvc       = inject(NotificationService);
  private readonly productStore   = inject(ProductStore);

  readonly isMobile = signal(false);
  readonly showMore = signal(false);

  constructor() { this.checkMobile(); }

  ngOnInit(): void {
    this.productStore.loadProducts(undefined as any);
    setTimeout(() => this.notifSvc.checkAndNotify(), 4000);
  }

  @HostListener('window:resize')
  checkMobile(): void {
    this.isMobile.set(window.innerWidth < 1024);
    if (!this.isMobile()) this.showMore.set(false);
  }

  isActive(path: string): boolean {
    return this.router.url.startsWith(path);
  }

  sItemBg(path: string): string {
    return this.isActive(path) ? 'var(--nav-active-bg)' : 'var(--bg-muted)';
  }
  sItemBorder(path: string): string {
    return this.isActive(path) ? '1.5px solid #bbf7d0' : '1.5px solid var(--border)';
  }
  sIconBg(path: string): string {
    return this.isActive(path) ? '#16a34a' : 'var(--icon-bg)';
  }
  sIconColor(path: string): string {
    return this.isActive(path) ? 'white' : 'var(--icon-color)';
  }
  sTextColor(path: string): string {
    return this.isActive(path) ? '#16a34a' : 'var(--text-primary)';
  }

  isAdmin(): boolean {
    return (this.auth.currentUser()?.role ?? 'admin') === 'admin';
  }

  logout(): void {
    this.showMore.set(false);
    this.auth.logout();
  }
}
