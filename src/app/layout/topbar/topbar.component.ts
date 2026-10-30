import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MenuModule } from 'primeng/menu';
import { TooltipModule } from 'primeng/tooltip';
import type { MenuItem } from 'primeng/api';
import { AuthService } from '../../core/auth/services/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { LangService } from '../../core/i18n/lang.service';
import { NetworkService } from '../../core/offline/network.service';
import { CartStore } from '../../features/pos/store/cart.store';
import { ProductStore } from '../../features/products/store/product.store';
import { AvatarComponent } from '../../shared/ui/avatar.component';
import { IconButtonComponent } from '../../shared/ui/icon-button.component';
import { KbdComponent } from '../../shared/ui/kbd.component';
import { PageTitleService } from '../../shared/ui/page-title.service';
import { NotificationBellComponent } from './notification-bell.component';
import { TourService } from '../../core/onboarding/tour.service';
import { injectOnboardingTexts } from '../../core/onboarding/onboarding.i18n';
import { bestMatch, buildNavItems, formatDisplayName, injectCurrentUrl, roleLabel } from '../nav-items';

/**
 * Masaüstü üst çubuğu (C "Saha / Komuta"): sayfa başlığı + tarih (ya da alt başlık), global arama
 * (Ctrl+K), durum rozeti (çevrimdışı / açık sepet), uyarı zili, tema/dil, kullanıcı menüsü.
 * Başlığı `<ui-page-header>` PageTitleService ile verir; yoksa `fallbackTitle`.
 */
@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [
    RouterLink, MenuModule, TooltipModule, AvatarComponent, IconButtonComponent, KbdComponent, NotificationBellComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block shrink-0' },
  template: `
    <header class="flex h-16 items-center gap-3 border-b border-line bg-surface px-4 xl:gap-3.5 xl:px-6">
      @if (page()?.backLink; as back) {
        <a [routerLink]="back" [attr.aria-label]="page()?.backLabel || t().common.back"
          class="-ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-token-md text-fg-secondary no-underline transition-colors hover:bg-surface-muted hover:text-fg">
          <i class="pi pi-arrow-left text-base" aria-hidden="true"></i>
        </a>
      }
      <div class="min-w-0 flex-1 leading-tight">
        <h1 class="m-0 truncate font-display text-[1.3125rem] font-extrabold text-fg">{{ title() }}</h1>
        <p class="m-0 mt-0.5 truncate text-13 text-fg-muted">{{ crumb() }}</p>
      </div>

      <!-- Global arama: Enter → Ürünler (arama uygulanmış) -->
      <label class="hidden h-[42px] w-[240px] shrink-0 items-center gap-2 rounded-[9px] border border-line-strong bg-page pl-3 pr-2 text-fg-muted focus-within:border-brand focus-within:shadow-focus lg:flex xl:w-[320px]">
        <i class="pi pi-search text-sm" aria-hidden="true"></i>
        <input #search type="search" [placeholder]="t().shell.searchPlaceholder" [attr.aria-label]="t().common.search"
          (keydown.enter)="runSearch(search.value); search.value = ''" enterkeyhint="search" aria-keyshortcuts="Control+K"
          class="h-full min-w-0 flex-1 border-0 bg-transparent text-14.5 text-fg outline-none placeholder:text-fg-muted" />
        <ui-kbd class="hidden xl:inline-grid">Ctrl K</ui-kbd>
      </label>

      @if (!network.isOnline()) {
        <span role="status" [pTooltip]="t().nav.offlineDesc" tooltipPosition="bottom"
          class="flex h-[42px] shrink-0 items-center gap-2 rounded-[9px] bg-warning-soft px-3 text-13.5 font-semibold text-warning-text">
          <i class="pi pi-wifi text-sm" aria-hidden="true"></i>{{ t().nav.offline }}
        </span>
      } @else if (cart.itemCount() > 0 && !onPos()) {
        <a routerLink="/pos"
          class="hidden h-[42px] shrink-0 items-center gap-2 rounded-[9px] bg-accent-soft px-3 text-13.5 font-semibold text-accent-text no-underline hover:underline xl:flex">
          <i class="pi pi-shopping-cart text-sm" aria-hidden="true"></i>{{ t().shell.openCart }} · {{ t().shell.cartItems(cart.itemCount()) }}
        </a>
      }

      @if (pageTour()) {
        <ui-icon-button variant="outline" icon="pi-question-circle" [ariaLabel]="ob().pageTour" [pTooltip]="ob().pageTour"
          tooltipPosition="bottom" (click)="tour.startPageTour()" />
      }
      <app-notification-bell />

      <ui-icon-button variant="outline" [icon]="theme.isDark() ? 'pi-sun' : 'pi-moon'" [pressed]="theme.isDark()"
        [ariaLabel]="theme.isDark() ? t().nav.lightMode : t().nav.darkMode" (click)="theme.toggle()" />

      <button type="button" (click)="lang.toggle()"
        class="hidden h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-token-md border border-line bg-surface px-3 text-xs font-bold text-fg-secondary transition-colors hover:bg-surface-muted hover:text-fg xl:flex"
        [attr.aria-label]="t().nav.language + ': ' + (lang.lang() === 'tr' ? t().nav.switchToEn : t().nav.switchToTr)">
        <i class="pi pi-globe text-sm" aria-hidden="true"></i>{{ lang.lang() === 'tr' ? 'EN' : 'TR' }}
      </button>

      <button type="button" (click)="menu.toggle($event)" data-tour="user-menu"
        aria-haspopup="menu" [attr.aria-label]="t().nav.userMenu"
        class="flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-token-md border border-line bg-surface pl-1 pr-2.5 transition-colors hover:bg-surface-muted">
        <ui-avatar [name]="userName()" variant="solid" size="sm" />
        <i class="pi pi-chevron-down text-10 text-fg-muted" aria-hidden="true"></i>
      </button>
      <p-menu #menu [model]="menuItems()" [popup]="true" appendTo="body" />
    </header>
  `,
})
export class TopbarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly products = inject(ProductStore);
  private readonly pageTitle = inject(PageTitleService);
  readonly theme = inject(ThemeService);
  readonly lang = inject(LangService);
  readonly network = inject(NetworkService);
  readonly cart = inject(CartStore);
  readonly t = this.lang.t;
  readonly tour = inject(TourService);
  readonly ob = injectOnboardingTexts();

  private readonly url = injectCurrentUrl();
  private readonly searchEl = viewChild<ElementRef<HTMLInputElement>>('search');

  readonly page = this.pageTitle.current;
  readonly onPos = computed(() => this.url().startsWith('/pos'));

  readonly pageTour = computed(() => this.tour.hasPageTour(this.url()));
  readonly title = computed(() => this.page()?.title || this.navTitle());
  readonly crumb = computed(() => this.page()?.subtitle || this.today());

  readonly userName = computed(() => formatDisplayName(this.auth.currentUser()?.displayName));
  readonly role = computed(() => roleLabel(this.t(), this.auth.currentUser()?.role));

  /** Sayfa ui-page-header vermezse: aktif menü öğesinin adı (POS, Ayarlar…). */
  private readonly navTitle = computed(() => {
    const t = this.t();
    if (this.url().startsWith('/account')) return t.nav.account;
    if (this.url().startsWith('/license')) return t.nav.settings;
    return bestMatch(buildNavItems(t), this.url())?.title ?? 'Tarım Market Pro';
  });

  today(): string {
    return new Date().toLocaleDateString(this.t().dashboard.dateFormat, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  readonly menuItems = computed<MenuItem[]>(() => {
    const t = this.t();
    const isAdmin = (this.auth.currentUser()?.role ?? 'admin') === 'admin';
    const ob = this.ob();
    const hasPageTour = this.tour.hasPageTour(this.url());
    const items: MenuItem[] = [
      { label: [this.userName() || t.nav.account, this.role()].filter(Boolean).join(' · '), items: [
        isAdmin
          ? { label: t.nav.settings, icon: 'pi pi-cog', routerLink: '/settings' }
          : { label: t.nav.account, icon: 'pi pi-user', routerLink: '/account' },
        ...(isAdmin ? [{ label: t.nav.team, icon: 'pi pi-id-card', routerLink: '/settings/team' }] : []),
        { label: this.lang.lang() === 'tr' ? t.nav.switchToEn : t.nav.switchToTr, icon: 'pi pi-globe', command: () => this.lang.toggle() },
        { separator: true },
        { label: ob.startTour, icon: 'pi pi-compass', command: () => this.tour.restartWelcome() },
        ...(hasPageTour ? [{ label: ob.pageTour, icon: 'pi pi-question-circle', command: () => this.tour.startPageTour() }] : []),
        { separator: true },
        { label: t.nav.logout, icon: 'pi pi-sign-out', styleClass: 'menu-danger', command: () => void this.auth.logout() },
      ] },
    ];
    return items;
  });

  runSearch(q: string): void {
    this.products.setSearch(q.trim());
    void this.router.navigate(['/products']);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const el = this.searchEl()?.nativeElement;
      if (el && el.offsetParent !== null) el.focus();
      else void this.router.navigate(['/products']);
    }
  }
}
