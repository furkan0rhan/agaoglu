import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from '../../core/auth/services/auth.service';
import { CartStore } from '../../features/pos/store/cart.store';
import { ProductStore } from '../../features/products/store/product.store';
import { LangService } from '../../core/i18n/lang.service';
import { NetworkService } from '../../core/offline/network.service';
import { LicenseService } from '../../core/license/license.service';
import { AvatarComponent } from '../../shared/ui/avatar.component';
import { KbdComponent } from '../../shared/ui/kbd.component';
import { LogoMarkComponent } from '../../shared/ui/logo-mark.component';
import { ShellStatusService } from '../shell-status.service';
import {
  NavItem, bestMatch, buildNavItems, filterByRole, formatDisplayName, groupNavItems, injectCurrentUrl, roleLabel,
} from '../nav-items';

const COLLAPSE_KEY = 'sidebarCollapsed';

/**
 * Masaüstü (≥1024px) kalıcı koyu kenar menüsü (C "Saha / Komuta"): logo + işletme adı, turuncu
 * "Hızlı Satış F2", gruplu menü (Operasyon / Analiz / Yönetim) + sayaç rozetleri, altta çevrimiçi
 * durumu ve kullanıcı. Daraltılabilir (ikon modu; 1366×768'de yer açar). Her iki temada koyu.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, TooltipModule, AvatarComponent, KbdComponent, LogoMarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full shrink-0' },
  template: `
    <aside
      class="flex h-full flex-col gap-1 overflow-hidden border-r border-side-line bg-side bg-side-pattern pb-3 pt-3.5 text-side-text transition-[width] duration-200 ease-out"
      [class]="collapsed() ? 'w-[4.5rem] px-2.5' : 'w-[14.75rem] px-3'"
      [attr.aria-label]="t().nav.mainMenu">

      <!-- Marka -->
      <div class="flex items-center gap-[11px] pb-2.5" [class]="collapsed() ? 'justify-center px-0' : 'px-1.5'">
        <ui-logo-mark [size]="collapsed() ? 40 : 40" />
        @if (!collapsed()) {
          <div class="min-w-0 leading-tight">
            <p class="m-0 truncate font-display text-15.5 font-extrabold tracking-tight">Tarım Market Pro</p>
            <p class="m-0 truncate text-12.5 text-side-muted">{{ tenantName() || t().shell.heroTagline }}</p>
          </div>
        }
      </div>

      <!-- Hızlı Satış -->
      @if (canSell()) {
        <a routerLink="/pos" aria-keyshortcuts="F2"
          [attr.aria-label]="collapsed() ? t().shell.quickSale + ' (F2)' : null"
          [attr.aria-current]="onPos() ? 'page' : null"
          [pTooltip]="collapsed() ? t().shell.quickSale + ' · F2' : ''" tooltipPosition="right"
          class="relative mb-1.5 mt-0.5 flex h-12 shrink-0 items-center gap-2.5 rounded-[9px] bg-sale font-display text-15 font-bold text-sale-text no-underline shadow-accent transition-[filter] hover:brightness-110"
          [class]="collapsed() ? 'justify-center px-0' : 'px-3.5'"
          [class.ring-2]="onPos()" [class.ring-side-hi]="onPos()">
          <i class="pi pi-shopping-cart text-17" aria-hidden="true"></i>
          @if (!collapsed()) {
            <span class="truncate">{{ t().shell.quickSale }}</span>
            <ui-kbd tone="inverse" class="ml-auto">F2</ui-kbd>
          }
          @if (cart.itemCount() > 0) {
            <span class="num absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-token-sm bg-side-count px-1 text-11 font-bold leading-none text-white">
              {{ cart.itemCount() }}
            </span>
          }
        </a>
      }

      <!-- Menü (sığmazsa yalnız bu bölüm kayar; alt kısım sabit) -->
      <div class="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-1 [scrollbar-width:thin]">
      @for (g of groups(); track g.key) {
        @if (collapsed()) {
          <div class="mx-2 my-2 h-px shrink-0 bg-side-line" aria-hidden="true"></div>
        } @else {
          <p class="eyebrow m-0 px-2.5 pb-1 pt-2.5 text-side-muted">{{ g.label }}</p>
        }
        <nav class="flex flex-col gap-0.5" [attr.aria-label]="g.label">
          @for (item of g.items; track item.path) {
            @let active = activePath() === item.path;
            @let count = countFor(item);
            <a [routerLink]="item.path"
               [attr.aria-current]="active ? 'page' : null"
               [attr.aria-label]="collapsed() ? item.title + (count ? ' (' + count + ')' : '') : null"
               [pTooltip]="collapsed() ? item.title : ''" tooltipPosition="right"
               class="relative flex h-10 shrink-0 items-center gap-3 rounded-token-md text-14.5 no-underline transition-colors duration-150"
               [class]="linkClass(active)">
              <i class="pi text-16" [class]="item.icon + (active ? ' text-side-hi' : ' text-side-muted')" aria-hidden="true"></i>
              @if (!collapsed()) {
                <span class="min-w-0 flex-1 truncate">{{ item.title }}</span>
              }
              @if (count) {
                <span class="num flex h-[22px] min-w-[22px] items-center justify-center rounded-token-sm px-1.5 text-11.5 font-bold leading-none text-white"
                  [class]="(item.path === '/credit' ? 'bg-side-count-alt' : 'bg-side-count') + (collapsed() ? ' absolute -right-1 -top-1 h-[18px] min-w-[18px] text-10' : '')">
                  {{ count > 99 ? '99+' : count }}
                </span>
              }
            </a>
          }
        </nav>
      }

      </div>

      <!-- Alt: durum + kullanıcı + daralt -->
      <div class="flex shrink-0 flex-col gap-1.5 border-t border-side-line pt-2.5">
        @if (!collapsed()) {
          <div role="status" class="flex items-center gap-2 rounded-token-md border border-side-line px-2.5 py-1.5 text-xs text-side-muted">
            <span class="h-2 w-2 shrink-0 rounded-full" [class]="network.isOnline() ? 'bg-side-hi shadow-[0_0_0_3px_rgba(52,211,153,0.18)]' : 'bg-warning shadow-[0_0_0_3px_rgba(251,191,36,0.2)]'" aria-hidden="true"></span>
            <span class="truncate">{{ network.isOnline() ? t().shell.syncOnline : t().shell.syncOffline }}</span>
          </div>
        }
        <div class="flex items-center gap-2.5 rounded-token-md bg-side-2 p-2" [class.flex-col]="collapsed()" [class.px-1]="collapsed()">
          <a [routerLink]="accountLink()" [attr.aria-label]="t().nav.account + ': ' + userName()"
            [pTooltip]="collapsed() ? userName() : ''" tooltipPosition="right"
            class="flex min-w-0 flex-1 items-center gap-2.5 rounded-token-sm text-side-text no-underline">
            <ui-avatar [name]="userName()" variant="solid" size="md" />
            @if (!collapsed()) {
              <span class="min-w-0 flex-1 leading-tight">
                <span class="block truncate text-13.5 font-semibold">{{ userName() || t().nav.account }}</span>
                <span class="block truncate text-xs text-side-muted">{{ role() }}</span>
              </span>
            }
          </a>
          <button type="button" (click)="logout()" [attr.aria-label]="t().nav.logout"
            [pTooltip]="t().nav.logout" tooltipPosition="right"
            class="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-token-md border-0 bg-transparent text-side-muted transition-colors hover:bg-side-line hover:text-white">
            <i class="pi pi-sign-out text-15" aria-hidden="true"></i>
          </button>
        </div>
        <button type="button" (click)="toggle()"
          [attr.aria-label]="collapsed() ? t().nav.expandMenu : t().nav.collapseMenu"
          [attr.aria-expanded]="!collapsed()"
          [pTooltip]="collapsed() ? t().nav.expandMenu : ''" tooltipPosition="right"
          class="flex h-9 cursor-pointer items-center gap-2.5 rounded-token-md border-0 bg-transparent px-2.5 text-xs font-medium text-side-muted transition-colors hover:bg-side-2 hover:text-side-text"
          [class.justify-center]="collapsed()">
          <i class="pi text-sm" [class]="collapsed() ? 'pi-angle-double-right' : 'pi-angle-double-left'" aria-hidden="true"></i>
          @if (!collapsed()) { <span>{{ t().nav.collapseMenu }}</span> }
        </button>
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  private readonly auth = inject(AuthService);
  private readonly products = inject(ProductStore);
  private readonly status = inject(ShellStatusService);
  private readonly license = inject(LicenseService);
  readonly cart = inject(CartStore);
  readonly network = inject(NetworkService);
  readonly t = inject(LangService).t;
  private readonly url = injectCurrentUrl();

  readonly collapsed = signal(readCollapsed());

  private readonly all = computed(() => filterByRole(buildNavItems(this.t()), this.auth.currentUser()?.role, this.auth.isSuperAdmin()));
  /** POS büyük turuncu butonda; listede tekrar etmez. */
  readonly groups = computed(() => groupNavItems(this.all().filter(i => i.path !== '/pos'), this.t()));
  readonly activePath = computed(() => bestMatch(this.all(), this.url())?.path ?? '');
  readonly onPos = computed(() => this.activePath() === '/pos');
  readonly canSell = computed(() => this.all().some(i => i.path === '/pos'));

  readonly userName = computed(() => formatDisplayName(this.auth.currentUser()?.displayName));
  readonly role = computed(() => roleLabel(this.t(), this.auth.currentUser()?.role));
  readonly tenantName = computed(() => this.license.tenant()?.name ?? '');
  readonly accountLink = computed(() => (this.auth.currentUser()?.role ?? 'admin') === 'admin' ? '/settings' : '/account');

  private readonly lowStock = computed(() => this.products.lowStockCount());

  countFor(item: NavItem): number {
    if (item.path === '/products') return this.lowStock();
    if (item.path === '/credit') return this.status.overdueCustomers() ?? 0;
    return 0;
  }

  toggle(): void {
    this.collapsed.update(v => !v);
    try { localStorage.setItem(COLLAPSE_KEY, this.collapsed() ? '1' : '0'); } catch { /* yoksay */ }
  }

  logout(): void { void this.auth.logout(); }

  linkClass(active: boolean): string {
    const pad = this.collapsed() ? 'justify-center px-0' : 'pl-3 pr-2.5';
    return active
      ? `${pad} bg-side-active font-semibold text-side-active-text shadow-[inset_3px_0_0_var(--side-hi)]`
      : `${pad} font-medium text-side-text hover:bg-side-2`;
  }
}

/** Kayıtlı tercih yoksa dar ekranlarda (1366×768 vb.) daraltılmış başlar. */
function readCollapsed(): boolean {
  try {
    const v = localStorage.getItem(COLLAPSE_KEY);
    if (v !== null) return v === '1';
  } catch { /* yoksay */ }
  return typeof window !== 'undefined' && window.innerWidth < 1280;
}
