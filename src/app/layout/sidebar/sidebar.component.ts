import { Component, inject, signal, HostListener, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from '../../core/auth/services/auth.service';
import { SidebarService } from './sidebar.service';
import { CartStore } from '../../features/pos/store/cart.store';
import { filter } from 'rxjs';

interface NavItem { title: string; path: string; icon: string; roles?: string[]; }

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TooltipModule],
  template: `
    <aside
      [style.width]="asideWidth()"
      [style.transform]="asideTransform()"
      [style.position]="isMobile() ? 'fixed' : 'relative'"
      [style.height]="isMobile() ? '100vh' : '100%'"
      [style.z-index]="isMobile() ? '300' : 'auto'"
      style="
        left: 0;
        top: 0;
        display: flex;
        flex-direction: column;
        background: #fff;
        border-right: 1px solid #f1f5f9;
        box-shadow: 2px 0 16px rgba(0,0,0,0.08);
        transition: width 0.22s cubic-bezier(0.4,0,0.2,1), transform 0.26s cubic-bezier(0.4,0,0.2,1);
        overflow: hidden;
      "
    >
      <!-- Brand -->
      <div style="display:flex; align-items:center; padding:14px; border-bottom:1px solid #f8fafc; flex-shrink:0; min-height:60px; gap:10px;">
        <img
          src="assets/TarimLogo.png"
          alt="Tarım Market Logo"
          (click)="onLogoClick()"
          [style.cursor]="(!isMobile() && collapsed()) ? 'pointer' : 'default'"
          style="width:36px; height:36px; object-fit:contain; flex-shrink:0;"
        />
        <div [style.opacity]="showText() ? '1' : '0'" style="transition:opacity 0.15s; white-space:nowrap; overflow:hidden; flex:1;">
          <p style="font-size:13px; font-weight:700; color:#1e293b; line-height:1.2;">Tarım Market</p>
          <p style="font-size:10px; font-weight:600; color:#16a34a; text-transform:uppercase; letter-spacing:1px;">Pro</p>
        </div>
        @if (!isMobile() && showText()) {
          <button
            (click)="collapse()"
            style="width:28px; height:28px; border-radius:8px; border:1px solid #e2e8f0; background:#f8fafc; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; color:#64748b;"
            onmouseenter="this.style.background='#f1f5f9'"
            onmouseleave="this.style.background='#f8fafc'"
          >
            <i class="pi pi-chevron-left" style="font-size:11px;"></i>
          </button>
        }
      </div>

      <!-- Nav -->
      <nav style="flex:1; overflow-y:auto; overflow-x:hidden; padding:8px 10px; display:flex; flex-direction:column; gap:2px;">
        @for (item of visibleNavItems(); track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="nav-active"
            #rla="routerLinkActive"
            (click)="onNavClick()"
            [pTooltip]="!showText() ? item.title : ''"
            tooltipPosition="right"
            [style]="linkStyle(rla.isActive)"
          >
            <div [style]="iconStyle(rla.isActive)" style="position:relative;">
              <i [class]="'pi ' + item.icon" style="font-size:15px;"></i>
              @if (item.path === '/pos' && cart.itemCount() > 0) {
                <span style="position:absolute; top:-5px; right:-5px; background:#ef4444; color:white; border-radius:10px; font-size:9px; font-weight:700; min-width:16px; height:16px; display:flex; align-items:center; justify-content:center; padding:0 3px; line-height:1;">{{ cart.itemCount() }}</span>
              }
            </div>
            <span [style.opacity]="showText() ? '1' : '0'" style="transition:opacity 0.12s; font-size:13px; font-weight:500; white-space:nowrap;">{{ item.title }}</span>
          </a>
        }
      </nav>

      <!-- Footer -->
      <div style="border-top:1px solid #f1f5f9; padding:8px 10px; flex-shrink:0; display:flex; flex-direction:column; gap:2px;">
        <div style="display:flex; align-items:center; gap:10px; padding:8px 4px; flex-shrink:0;">
          <div
            [pTooltip]="!showText() ? formattedName() : ''"
            tooltipPosition="right"
            style="width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,#4ade80,#16a34a); display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:12px; flex-shrink:0; cursor:default; letter-spacing:0.5px;"
          >{{ initials() }}</div>
          <div [style.opacity]="showText() ? '1' : '0'" style="transition:opacity 0.15s; overflow:hidden; white-space:nowrap; min-width:0;">
            <p style="font-size:13px; font-weight:600; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0 0 1px;">{{ formattedName() }}</p>
            <p style="font-size:10px; font-weight:600; color:#16a34a; text-transform:uppercase; letter-spacing:0.5px; margin:0;">{{ roleLabel() }}</p>
          </div>
        </div>

        <button
          (click)="logout()"
          [pTooltip]="!showText() ? 'Çıkış Yap' : ''"
          tooltipPosition="right"
          style="display:flex; align-items:center; gap:10px; padding:6px 4px; border-radius:10px; border:none; background:transparent; cursor:pointer; width:100%; text-align:left;"
          onmouseenter="this.style.background='#fef2f2'"
          onmouseleave="this.style.background='transparent'"
        >
          <div style="width:36px; height:36px; border-radius:10px; background:#fef2f2; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <i class="pi pi-sign-out" style="font-size:14px; color:#ef4444;"></i>
          </div>
          <span [style.opacity]="showText() ? '1' : '0'" style="transition:opacity 0.12s; font-size:13px; font-weight:500; color:#ef4444; white-space:nowrap;">Çıkış Yap</span>
        </button>
      </div>
    </aside>
  `,
  styles: [`
    :host {
      display: block;
      flex-shrink: 0;
      transition: width 0.26s cubic-bezier(0.4,0,0.2,1);
    }
    .nav-active { background: #f0fdf4 !important; }
    nav::-webkit-scrollbar { width: 0; }
  `],
  host: {
    '[style.width]': 'hostWidth()',
  },
})
export class SidebarComponent implements OnInit {
  readonly auth    = inject(AuthService);
  readonly sidebarSvc = inject(SidebarService);
  readonly router  = inject(Router);
  readonly cart    = inject(CartStore);

  readonly collapsed = signal(false);
  readonly isMobile = signal(false);

  private readonly navItems: NavItem[] = [
    { title: 'Dashboard',   path: '/dashboard', icon: 'pi-home' },
    { title: 'Ürünler',     path: '/products',  icon: 'pi-box' },
    { title: 'Satış / POS', path: '/pos',       icon: 'pi-shopping-cart', roles: ['admin', 'cashier'] },
    { title: 'Müşteriler',  path: '/customers', icon: 'pi-users',         roles: ['admin', 'cashier'] },
    { title: 'Veresiye',    path: '/credit',    icon: 'pi-credit-card',   roles: ['admin'] },
    { title: 'Raporlar',    path: '/reports',   icon: 'pi-chart-bar',     roles: ['admin'] },
    { title: 'Giderler',    path: '/expenses',  icon: 'pi-wallet',        roles: ['admin'] },
    { title: 'Ayarlar',     path: '/settings',  icon: 'pi-cog',           roles: ['admin'] },
  ];

  ngOnInit(): void {
    this.checkMobile();
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => { if (this.isMobile()) this.sidebarSvc.close(); });
  }

  @HostListener('window:resize')
  checkMobile(): void {
    this.isMobile.set(window.innerWidth < 1024);
  }

  collapse():     void { this.collapsed.set(true); }
  onLogoClick():  void { if (!this.isMobile() && this.collapsed()) this.collapsed.set(false); }
  onNavClick():   void { if (this.isMobile()) this.sidebarSvc.close(); }

  showText(): boolean {
    return this.isMobile() ? this.sidebarSvc.mobileOpen() : !this.collapsed();
  }

  asideWidth(): string {
    if (this.isMobile()) return '260px';
    return this.collapsed() ? '64px' : '230px';
  }

  asideTransform(): string {
    if (this.isMobile()) {
      return this.sidebarSvc.mobileOpen() ? 'translateX(0)' : 'translateX(-100%)';
    }
    return 'translateX(0)';
  }

  hostWidth(): string {
    if (this.isMobile()) return '0px';
    return this.collapsed() ? '64px' : '230px';
  }

  visibleNavItems(): NavItem[] {
    const user = this.auth.currentUser();
    if (!user) return this.navItems;
    return this.navItems.filter(i => !i.roles || i.roles.includes(user.role));
  }

  linkStyle(active: boolean): string {
    return `display:flex; align-items:center; gap:10px; padding:8px 6px; border-radius:10px; text-decoration:none; background:${active ? '#f0fdf4' : 'transparent'}; transition:background 0.15s;`;
  }

  iconStyle(active: boolean): string {
    return `width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; background:${active ? '#16a34a' : '#f1f5f9'}; color:${active ? 'white' : '#64748b'}; transition:background 0.15s;`;
  }

  formattedName(): string {
    const name = this.auth.currentUser()?.displayName ?? '';
    return name.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  initials(): string {
    const name = this.auth.currentUser()?.displayName ?? '';
    return name.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase()).join('').slice(0, 2) || 'U';
  }

  roleLabel(): string {
    const map: Record<string, string> = { admin: 'Yönetici', cashier: 'Kasiyer', staff: 'Personel' };
    return map[this.auth.currentUser()?.role ?? ''] ?? '';
  }

  logout() { this.auth.logout(); }
}
