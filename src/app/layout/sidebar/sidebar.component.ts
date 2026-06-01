import { Component, inject, signal, HostListener, OnInit, computed } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from '../../core/auth/services/auth.service';
import { SidebarService } from './sidebar.service';
import { CartStore } from '../../features/pos/store/cart.store';
import { ThemeService } from '../../core/theme/theme.service';
import { LangService } from '../../core/i18n/lang.service';
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
        background: var(--bg-surface);
        border-right: 1px solid var(--border);
        box-shadow: 2px 0 16px rgba(0,0,0,0.08);
        transition: width 0.22s cubic-bezier(0.4,0,0.2,1), transform 0.26s cubic-bezier(0.4,0,0.2,1);
        overflow: hidden;
      "
    >
      <!-- Brand -->
      <div style="display:flex; align-items:center; padding:14px; border-bottom:1px solid var(--border); flex-shrink:0; min-height:60px; gap:10px;">
        <img
          src="assets/TarimLogo.png"
          alt="Tarım Market Logo"
          (click)="onLogoClick()"
          [style.cursor]="(!isMobile() && collapsed()) ? 'pointer' : 'default'"
          style="width:36px; height:36px; object-fit:contain; flex-shrink:0;"
        />
        <div [style.opacity]="showText() ? '1' : '0'" style="transition:opacity 0.15s; white-space:nowrap; overflow:hidden; flex:1;">
          <p style="font-size:13px; font-weight:700; color:var(--text-primary); line-height:1.2;">Tarım Market</p>
          <p style="font-size:10px; font-weight:600; color:#16a34a; text-transform:uppercase; letter-spacing:1px;">Pro</p>
        </div>
        @if (!isMobile() && showText()) {
          <button
            (click)="collapse()"
            style="width:28px; height:28px; border-radius:8px; border:1px solid var(--border-mid); background:var(--bg-muted); display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; color:var(--text-secondary);"
            onmouseenter="this.style.background='var(--bg-page)'"
            onmouseleave="this.style.background='var(--bg-muted)'"
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
      <div style="border-top:1px solid var(--border); padding:8px 10px; flex-shrink:0; display:flex; flex-direction:column; gap:4px;">

        <!-- User + dark toggle + lang toggle yan yana (expanded) -->
        <div style="display:flex; align-items:center; gap:6px;">
          <a
            routerLink="/settings"
            (click)="onNavClick()"
            [pTooltip]="!showText() ? t().nav.settings : ''"
            tooltipPosition="right"
            style="flex:1; min-width:0; display:flex; align-items:center; gap:10px; padding:6px 4px; border-radius:10px; text-decoration:none; transition:background 0.15s; overflow:hidden;"
            onmouseenter="this.style.background='var(--bg-muted)'"
            onmouseleave="this.style.background='transparent'"
          >
            <div style="width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,#4ade80,#16a34a); display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:12px; flex-shrink:0; letter-spacing:0.5px;">{{ initials() }}</div>
            <div [style.opacity]="showText() ? '1' : '0'" style="transition:opacity 0.15s; overflow:hidden; white-space:nowrap; min-width:0; flex:1;">
              <p style="font-size:13px; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0 0 1px;">{{ formattedName() }}</p>
              <p style="font-size:10px; font-weight:600; color:#16a34a; text-transform:uppercase; letter-spacing:0.5px; margin:0;">{{ roleLabel() }} · {{ t().nav.settings }}</p>
            </div>
          </a>

          @if (showText()) {
            <button
              (click)="themeSvc.toggle()"
              [pTooltip]="themeSvc.isDark() ? t().nav.lightMode : t().nav.darkMode"
              tooltipPosition="top"
              style="width:36px; height:36px; border-radius:10px; border:none; background:var(--bg-muted); display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; transition:background 0.15s;"
              onmouseenter="this.style.background='var(--border-mid)'"
              onmouseleave="this.style.background='var(--bg-muted)'"
            >
              <i [class]="'pi ' + (themeSvc.isDark() ? 'pi-sun' : 'pi-moon')" style="font-size:15px; color:var(--text-secondary);"></i>
            </button>
            <button
              (click)="langSvc.toggle()"
              pTooltip="TR / EN"
              tooltipPosition="top"
              style="width:36px; height:36px; border-radius:10px; border:none; background:var(--bg-muted); display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; font-size:10px; font-weight:700; color:var(--text-secondary); transition:background 0.15s;"
              onmouseenter="this.style.background='var(--border-mid)'"
              onmouseleave="this.style.background='var(--bg-muted)'"
            >{{ langSvc.lang() === 'tr' ? 'EN' : 'TR' }}</button>
          }
        </div>

        <!-- Dark + lang toggle collapsed modunda ayrı satır -->
        @if (!showText()) {
          <button
            (click)="themeSvc.toggle()"
            [pTooltip]="themeSvc.isDark() ? t().nav.lightMode : t().nav.darkMode"
            tooltipPosition="right"
            style="width:36px; height:36px; border-radius:10px; border:none; background:var(--bg-muted); display:flex; align-items:center; justify-content:center; cursor:pointer; margin:0 auto; transition:background 0.15s;"
            onmouseenter="this.style.background='var(--border-mid)'"
            onmouseleave="this.style.background='var(--bg-muted)'"
          >
            <i [class]="'pi ' + (themeSvc.isDark() ? 'pi-sun' : 'pi-moon')" style="font-size:14px; color:var(--text-secondary);"></i>
          </button>
          <button
            (click)="langSvc.toggle()"
            pTooltip="TR / EN"
            tooltipPosition="right"
            style="width:36px; height:36px; border-radius:10px; border:none; background:var(--bg-muted); display:flex; align-items:center; justify-content:center; cursor:pointer; margin:0 auto; font-size:10px; font-weight:700; color:var(--text-secondary); transition:background 0.15s;"
            onmouseenter="this.style.background='var(--border-mid)'"
            onmouseleave="this.style.background='var(--bg-muted)'"
          >{{ langSvc.lang() === 'tr' ? 'EN' : 'TR' }}</button>
        }

      </div>
    </aside>
  `,
  styles: [`
    :host {
      display: block;
      flex-shrink: 0;
      transition: width 0.26s cubic-bezier(0.4,0,0.2,1);
    }
    .nav-active { background: var(--nav-active-bg) !important; }
    nav::-webkit-scrollbar { width: 0; }
  `],
  host: {
    '[style.width]': 'hostWidth()',
  },
})
export class SidebarComponent implements OnInit {
  readonly auth       = inject(AuthService);
  readonly sidebarSvc = inject(SidebarService);
  readonly router     = inject(Router);
  readonly cart       = inject(CartStore);
  readonly themeSvc   = inject(ThemeService);
  readonly langSvc    = inject(LangService);
  readonly t          = this.langSvc.t;

  readonly collapsed = signal(false);
  readonly isMobile = signal(false);

  private readonly navItems = computed<NavItem[]>(() => {
    const n = this.t().nav;
    return [
      { title: n.dashboard,   path: '/dashboard',   icon: 'pi-home' },
      { title: n.products,    path: '/products',    icon: 'pi-box' },
      { title: n.pos,         path: '/pos',         icon: 'pi-shopping-cart', roles: ['admin', 'cashier'] },
      { title: n.customers,   path: '/customers',   icon: 'pi-users',         roles: ['admin', 'cashier'] },
      { title: n.credit,      path: '/credit',      icon: 'pi-credit-card',   roles: ['admin'] },
      { title: n.reports,     path: '/reports',     icon: 'pi-chart-bar',     roles: ['admin'] },
      { title: n.expenses,    path: '/expenses',    icon: 'pi-wallet',        roles: ['admin'] },
      { title: n.suppliers,   path: '/suppliers',   icon: 'pi-truck',         roles: ['admin'] },
      { title: n.stockCount,  path: '/stock-count', icon: 'pi-barcode',       roles: ['admin'] },
    ];
  });

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
    const items = this.navItems();
    if (!user) return items;
    return items.filter(i => !i.roles || i.roles.includes(user.role));
  }

  linkStyle(active: boolean): string {
    return `display:flex; align-items:center; gap:10px; padding:8px 6px; border-radius:10px; text-decoration:none; color:var(--text-primary); background:${active ? 'var(--nav-active-bg)' : 'transparent'}; transition:background 0.15s;`;
  }

  iconStyle(active: boolean): string {
    return `width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; background:${active ? '#16a34a' : 'var(--icon-bg)'}; color:${active ? 'white' : 'var(--icon-color)'}; transition:background 0.15s;`;
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
    const n = this.t().nav;
    const map: Record<string, string> = { admin: n.admin, cashier: n.cashier, staff: n.staff };
    return map[this.auth.currentUser()?.role ?? ''] ?? '';
  }

}

