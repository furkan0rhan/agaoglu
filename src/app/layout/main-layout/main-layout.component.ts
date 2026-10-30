import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { NotificationBellComponent } from '../topbar/notification-bell.component';
import { AuthService } from '../../core/auth/services/auth.service';
import { CartStore } from '../../features/pos/store/cart.store';
import { NotificationService } from '../../core/notifications/notification.service';
import { ProductStore } from '../../features/products/store/product.store';
import { ThemeService } from '../../core/theme/theme.service';
import { LangService } from '../../core/i18n/lang.service';
import { NetworkService } from '../../core/offline/network.service';
import { LicenseService } from '../../core/license/license.service';
import { AvatarComponent } from '../../shared/ui/avatar.component';
import { LogoMarkComponent } from '../../shared/ui/logo-mark.component';
import { PageTitleService } from '../../shared/ui/page-title.service';
import { SupportBannerComponent } from '../../features/admin/components/support-banner.component';
import { ShellStatusService } from '../shell-status.service';
import { FarmerLinkWatcher } from '../../features/farmers/farmer-link-watcher.service';
import {
  NavItem, bestMatch, buildNavItems, filterByRole, formatDisplayName, injectCurrentUrl, isPathActive, roleLabel, tourKey,
} from '../nav-items';
import { TourService } from '../../core/onboarding/tour.service';
import { injectOnboardingTexts } from '../../core/onboarding/onboarding.i18n';

/** Alt navigasyonda sabit duran rotalar (rolü uygun olanlar). Kalanlar "Diğer" sheet'inde. */
const BOTTOM_PATHS = ['/dashboard', '/products', '/pos', '/credit'];

/**
 * Uygulama kabuğu — tasarım v2 "Saha / Komuta".
 * - ≥1024px: kalıcı koyu sidebar + üst çubuk (sayfa başlığı, arama, zil, tema/dil, kullanıcı) + içerik.
 * - <1024px: koyu üst çubuk (başlık + arama + zil) + içerik + koyu alt navigasyon (ortada turuncu
 *   Satış) + "Diğer" sheet'i (safe-area uyumlu).
 * - F2: her sayfadan Hızlı Satış'a (POS içinde F2 = kart ödemesi, POS'un kendisi yönetir).
 * - Sayfa başlığı `<ui-page-header>` → PageTitleService → topbar / mobil üst çubuk.
 */
@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, SidebarComponent, TopbarComponent, NotificationBellComponent, AvatarComponent,
    LogoMarkComponent, SupportBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-full overflow-hidden bg-page' },
  template: `
    @if (!isMobile()) {
      <app-sidebar />
    }

    <div class="flex min-w-0 flex-1 flex-col">
      @if (isMobile()) {
        <!-- Mobil koyu üst çubuk -->
        <header class="flex shrink-0 items-center gap-2.5 bg-side pb-1.5 pl-3 pr-2 pt-[calc(6px+var(--safe-top))] text-side-text">
          @if (page()?.backLink; as back) {
            <a [routerLink]="back" [attr.aria-label]="page()?.backLabel || t().common.back"
              class="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[9px] text-side-text no-underline hover:bg-side-2">
              <i class="pi pi-arrow-left text-base" aria-hidden="true"></i>
            </a>
          } @else {
            <ui-logo-mark [size]="34" />
          }
          <div class="min-w-0 flex-1 leading-tight">
            <p class="m-0 truncate font-display text-17 font-extrabold">{{ mobileTitle() }}</p>
            <p class="m-0 truncate text-11.5" [class]="network.isOnline() ? 'text-side-muted' : 'text-warning-text'">{{ mobileSub() }}</p>
          </div>
          <a routerLink="/products" [attr.aria-label]="t().common.search"
            class="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[9px] text-side-text no-underline hover:bg-side-2">
            <i class="pi pi-search text-17" aria-hidden="true"></i>
          </a>
          <app-notification-bell [dark]="true" />
        </header>
      }

      <app-support-banner />

      @if (!isMobile()) {
        <app-topbar />
      } @else if (!network.isOnline()) {
        <div role="status" class="flex shrink-0 items-center gap-2 border-b border-warning-line bg-warning-soft px-3 py-2 text-xs font-semibold text-warning-text">
          <i class="pi pi-wifi text-sm" aria-hidden="true"></i>
          <span class="shrink-0">{{ t().nav.offline }}</span>
          <span class="truncate font-normal">— {{ t().nav.offlineDesc }}</span>
        </div>
      }

      <main id="main-content" class="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <router-outlet />
      </main>

      @if (isMobile()) {
        <!-- Alt navigasyon (koyu) -->
        <nav [attr.aria-label]="t().nav.mainMenu" data-tour="bottom-nav"
          class="relative z-nav flex shrink-0 items-stretch gap-0.5 border-t border-side-line bg-side px-1 pb-[calc(8px+var(--safe-bottom))] pt-1.5">
          @for (item of bottomItems(); track item.path) {
            @let active = activePath() === item.path && !showMore();
            @let count = countFor(item);
            @if (item.path === '/pos') {
              <a routerLink="/pos" (click)="closeMore()" [attr.aria-current]="active ? 'page' : null" data-tour="nav-pos"
                class="relative mx-1 flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-[10px] bg-sale text-11.5 font-semibold text-sale-text no-underline shadow-accent active:brightness-95"
                [class.ring-2]="active" [class.ring-side-hi]="active">
                <i class="pi pi-shopping-cart text-[1.3125rem]" aria-hidden="true"></i>
                <span class="max-w-full truncate px-0.5">{{ item.short }}</span>
                @if (cart.itemCount() > 0) {
                  <span class="num absolute right-1 top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-[5px] bg-side-count px-[3px] text-[0.65625rem] font-bold leading-none text-white">{{ cart.itemCount() }}</span>
                }
              </a>
            } @else {
              <a [routerLink]="item.path" (click)="closeMore()" [attr.aria-current]="active ? 'page' : null" [attr.data-tour]="tourKey(item.path)"
                class="relative flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-[10px] text-11.5 font-semibold no-underline"
                [class]="active ? 'text-side-active-text' : 'text-side-muted'">
                @if (active) {
                  <span class="absolute -top-1.5 left-[30%] right-[30%] h-[3px] rounded-b-[3px] bg-side-hi" aria-hidden="true"></span>
                }
                <i class="pi text-20" [class]="item.icon" aria-hidden="true"></i>
                <span class="max-w-full truncate px-0.5">{{ item.short }}</span>
                @if (count) {
                  <span class="num absolute right-[calc(50%-24px)] top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-[5px] bg-side-count px-[3px] text-[0.65625rem] font-bold leading-none text-white">{{ count > 99 ? '99+' : count }}</span>
                }
              </a>
            }
          }
          <button type="button" (click)="toggleMore()" [attr.aria-expanded]="showMore()" aria-haspopup="dialog" data-tour="nav-more"
            class="relative flex min-h-[52px] min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-[3px] rounded-[10px] border-0 bg-transparent text-11.5 font-semibold"
            [class]="showMore() || moreActive() ? 'text-side-active-text' : 'text-side-muted'">
            @if (moreActive() && !showMore()) {
              <span class="absolute -top-1.5 left-[30%] right-[30%] h-[3px] rounded-b-[3px] bg-side-hi" aria-hidden="true"></span>
            }
            <i class="pi text-20" [class]="showMore() ? 'pi-times' : 'pi-ellipsis-h'" aria-hidden="true"></i>
            <span class="max-w-full truncate px-0.5">{{ t().nav.other }}</span>
          </button>
        </nav>
      }
    </div>

    @if (isMobile() && showMore()) {
      <!-- "Diğer" sheet -->
      <button type="button" tabindex="-1" (click)="closeMore()" [attr.aria-label]="t().common.close"
        class="fixed inset-0 z-sheet-backdrop animate-fade-in cursor-default border-0 bg-black/35"></button>

      <div role="dialog" aria-modal="true" [attr.aria-label]="t().nav.other"
        class="fixed inset-x-2 bottom-[calc(72px+var(--safe-bottom))] z-sheet max-h-[72vh] animate-sheet-up overflow-y-auto rounded-token-2xl border border-line bg-surface shadow-overlay">

        <a [routerLink]="accountLink()" (click)="closeMore()"
          class="card-head min-h-[60px] gap-3 no-underline">
          <ui-avatar [name]="userName()" variant="solid" />
          <span class="min-w-0 flex-1 leading-tight">
            <span class="block truncate text-sm font-semibold text-fg">{{ userName() || t().nav.account }}</span>
            <span class="mt-0.5 block truncate text-xs text-fg-muted">{{ role() }} · {{ tenantName() || t().nav.account }}</span>
          </span>
          <i class="pi pi-chevron-right text-xs text-fg-muted" aria-hidden="true"></i>
        </a>

        <div class="p-3">
          @if (sheetItems().length) {
            <div class="grid grid-cols-3 gap-2">
              @for (item of sheetItems(); track item.path) {
                @let active = activePath() === item.path;
                <a [routerLink]="item.path" (click)="closeMore()" [attr.aria-current]="active ? 'page' : null"
                  class="flex min-h-[80px] flex-col items-center justify-center gap-1.5 rounded-token-lg border px-1 py-2.5 text-center text-xs font-semibold no-underline transition-colors"
                  [class]="active ? 'border-brand-line bg-brand-soft text-brand-text' : 'border-line bg-surface-muted text-fg-secondary hover:text-fg'">
                  <span class="flex h-9 w-9 items-center justify-center rounded-token-md"
                    [class]="active ? 'bg-brand text-brand-contrast' : 'bg-surface text-fg-secondary'">
                    <i class="pi text-15" [class]="item.icon" aria-hidden="true"></i>
                  </span>
                  <span class="line-clamp-2 leading-tight">{{ item.short }}</span>
                </a>
              }
            </div>
            <div class="my-3 h-px bg-line"></div>
          }
          <!-- Ürün turu -->
          <div class="mb-2 grid gap-2" [class]="pageTour() ? 'grid-cols-2' : 'grid-cols-1'">
            <button type="button" (click)="startTour()"
              class="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-token-lg border border-brand-line bg-brand-soft px-2 text-13 font-semibold text-brand-text">
              <i class="pi pi-compass text-base" aria-hidden="true"></i><span class="line-clamp-1">{{ ob().startTour }}</span>
            </button>
            @if (pageTour()) {
              <button type="button" (click)="startPageTour()"
                class="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-token-lg border border-line bg-surface px-2 text-13 font-semibold text-fg-secondary">
                <i class="pi pi-question-circle text-base" aria-hidden="true"></i><span class="line-clamp-1">{{ ob().pageTour }}</span>
              </button>
            }
          </div>
          <div class="grid grid-cols-3 gap-2">
            <button type="button" (click)="themeSvc.toggle()" [attr.aria-pressed]="themeSvc.isDark()"
              class="flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-1 rounded-token-lg border border-line bg-surface px-1 text-xs font-semibold text-fg-secondary">
              <i class="pi text-base" [class]="themeSvc.isDark() ? 'pi-sun' : 'pi-moon'" aria-hidden="true"></i>
              <span class="line-clamp-1">{{ themeSvc.isDark() ? t().nav.lightMode : t().nav.darkMode }}</span>
            </button>
            <button type="button" (click)="langSvc.toggle()"
              class="flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-1 rounded-token-lg border border-line bg-surface px-1 text-xs font-semibold text-fg-secondary">
              <i class="pi pi-globe text-base" aria-hidden="true"></i>
              <span class="line-clamp-1">{{ langSvc.lang() === 'tr' ? t().nav.switchToEn : t().nav.switchToTr }}</span>
            </button>
            <button type="button" (click)="logout()"
              class="flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-1 rounded-token-lg border border-danger-line bg-danger-soft px-1 text-xs font-semibold text-danger-text">
              <i class="pi pi-sign-out text-base" aria-hidden="true"></i>
              <span class="line-clamp-1">{{ t().nav.logout }}</span>
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class MainLayoutComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly cart = inject(CartStore);
  readonly themeSvc = inject(ThemeService);
  readonly langSvc = inject(LangService);
  readonly network = inject(NetworkService);
  private readonly license = inject(LicenseService);
  private readonly status = inject(ShellStatusService);
  readonly t = this.langSvc.t;
  private readonly notifSvc = inject(NotificationService);
  private readonly productStore = inject(ProductStore);
  private readonly pageTitle = inject(PageTitleService);
  private readonly url = injectCurrentUrl();

  private readonly tour = inject(TourService);
  readonly ob = injectOnboardingTexts();
  readonly tourKey = tourKey;
  /** Bu sayfaya özgü tur var mı ("Bu sayfayı tanı"). */
  readonly pageTour = computed(() => { this.auth.currentUser(); return this.tour.hasPageTour(this.url()); });

  readonly isMobile = signal(false);
  readonly showMore = signal(false);
  readonly page = this.pageTitle.current;

  private readonly items = computed(() => filterByRole(buildNavItems(this.t()), this.auth.currentUser()?.role, this.auth.isSuperAdmin()));
  readonly bottomItems = computed(() => this.items()
    .filter(i => BOTTOM_PATHS.includes(i.path))
    .sort((a, b) => BOTTOM_PATHS.indexOf(a.path) - BOTTOM_PATHS.indexOf(b.path)));
  readonly sheetItems = computed(() => this.items().filter(i => !BOTTOM_PATHS.includes(i.path)));
  readonly activePath = computed(() => bestMatch(this.items(), this.url())?.path ?? '');
  readonly moreActive = computed(() => this.sheetItems().some(i => i.path === this.activePath())
    || isPathActive(this.url(), '/account') || isPathActive(this.url(), '/license'));
  private readonly canSell = computed(() => this.items().some(i => i.path === '/pos'));

  readonly userName = computed(() => formatDisplayName(this.auth.currentUser()?.displayName));
  readonly role = computed(() => roleLabel(this.t(), this.auth.currentUser()?.role));
  readonly tenantName = computed(() => this.license.tenant()?.name ?? '');
  readonly accountLink = computed(() => (this.auth.currentUser()?.role ?? 'admin') === 'admin' ? '/settings' : '/account');

  readonly mobileTitle = computed(() => this.page()?.title
    || bestMatch(buildNavItems(this.t()), this.url())?.title
    || (isPathActive(this.url(), '/account') ? this.t().nav.account : 'Tarım Market Pro'));
  readonly mobileSub = computed(() => {
    if (!this.network.isOnline()) return this.t().shell.syncOffline;
    const sub = this.page()?.subtitle;
    if (sub) return sub;
    return [this.tenantName(), this.t().nav.online].filter(Boolean).join(' · ');
  });

  constructor() {
    this.checkMobile();
    const detach = this.pageTitle.attachHost();
    inject(DestroyRef).onDestroy(detach);
    // Çiftçi bağlantıları: yeni bağlanan çiftçiye ilk senkron + bakiye değişince güncelleme (rapor #1, Y6)
    inject(DestroyRef).onDestroy(inject(FarmerLinkWatcher).attachToSession());
    // Sayfa değişince sheet'i kapat
    effect(() => { this.url(); this.showMore.set(false); });
  }

  ngOnInit(): void {
    this.productStore.ensureLoaded();
    setTimeout(() => this.notifSvc.checkAndNotify(), 4000);
  }

  @HostListener('window:resize')
  checkMobile(): void {
    this.isMobile.set(window.innerWidth < 1024);
    if (!this.isMobile()) this.showMore.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.closeMore(); }

  /** F2: her sayfadan Hızlı Satış. POS içinde F2 kart ödemesidir (POS yönetir). */
  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key !== 'F2' || e.ctrlKey || e.altKey || e.metaKey) return;
    if (isPathActive(this.url(), '/pos') || !this.canSell()) return;
    if (document.querySelector('.p-dialog-mask')) return; // açık dialog varken sayfadan çıkma
    e.preventDefault();
    void this.router.navigate(['/pos']);
  }

  countFor(item: NavItem): number {
    if (item.path === '/products') return this.productStore.lowStockCount();
    if (item.path === '/credit') return this.status.overdueCustomers() ?? 0;
    return 0;
  }

  startTour(): void { this.showMore.set(false); this.tour.restartWelcome(); }
  startPageTour(): void { this.showMore.set(false); this.tour.startPageTour(); }

  toggleMore(): void { this.showMore.update(v => !v); }
  closeMore(): void { this.showMore.set(false); }

  logout(): void {
    this.showMore.set(false);
    void this.auth.logout();
  }
}
