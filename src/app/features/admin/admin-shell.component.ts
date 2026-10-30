import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuthService } from '../../core/auth/services/auth.service';
import { LangService } from '../../core/i18n/lang.service';
import { ThemeService } from '../../core/theme/theme.service';
import { AvatarComponent, IconButtonComponent } from '../../shared/ui';
import { PageTitleService } from '../../shared/ui/page-title.service';
import { formatDisplayName, injectCurrentUrl } from '../../layout/nav-items';
import { ADMIN_TEXTS } from './admin.i18n';

/**
 * /admin kabuğu (tasarım v2 "Saha / Komuta", platform kimliği): işletme verisi yüklemeyen yalın düzen.
 * Bayi uygulamasından ayırt edilsin diye koyu sidebar'da kırmızı vurgu (aktif çizgi, kalkan logosu,
 * "SUPERADMIN" rozeti). Başlık `<ui-page-header>` → PageTitleService → topbar (mobilde koyu üst çubuk).
 * Superadmin bir işletmeye bağlı olmak zorunda değildir.
 */
@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, ToastModule, ConfirmDialogModule, TooltipModule, AvatarComponent, IconButtonComponent],
  providers: [MessageService, ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-full overflow-hidden bg-page' },
  template: `
    <p-toast position="top-right" />
    <p-confirmdialog [style]="{ width: 'min(520px, 94vw)' }" />

    @if (!isMobile()) {
      <aside class="relative flex h-full w-[236px] shrink-0 flex-col gap-1 overflow-hidden border-r border-side-line bg-side bg-side-pattern px-3 pb-3 pt-3.5 text-side-text"
        [attr.aria-label]="x().navMenu">
        <span class="absolute inset-x-0 top-0 h-[3px] bg-side-count" aria-hidden="true"></span>

        <!-- Platform kimliği -->
        <a routerLink="/admin" class="flex items-center gap-[11px] px-1.5 pb-2.5 text-side-text no-underline">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-side-count text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)]">
            <i class="pi pi-shield text-19" aria-hidden="true"></i>
          </span>
          <span class="min-w-0 leading-tight">
            <span class="block truncate font-display text-15.5 font-extrabold tracking-tight">{{ x().platform }}</span>
            <span class="block truncate text-12.5 text-side-muted">Tarım Market Pro</span>
          </span>
        </a>
        <span class="eyebrow mb-1.5 ml-1.5 inline-flex h-6 items-center gap-1.5 self-start rounded-token-sm bg-side-danger-soft px-2 text-side-danger">
          <i class="pi pi-lock text-10" aria-hidden="true"></i>{{ x().badge }}
        </span>

        <p class="eyebrow m-0 px-2.5 pb-1 pt-2.5 text-side-muted">{{ x().overview }}</p>
        <nav class="flex flex-col gap-0.5" [attr.aria-label]="x().navMenu">
          <a routerLink="/admin" [attr.aria-current]="onList() ? 'page' : null"
            class="flex h-10 items-center gap-3 rounded-token-md pl-3 pr-2.5 text-14.5 no-underline transition-colors"
            [class]="linkClass(onList())">
            <i class="pi pi-th-large text-16" [class]="onList() ? 'text-side-danger' : 'text-side-muted'" aria-hidden="true"></i>
            <span class="min-w-0 flex-1 truncate">{{ x().navTenants }}</span>
          </a>
          @if (onDetail()) {
            <span aria-current="page" class="flex h-10 items-center gap-3 rounded-token-md pl-3 pr-2.5 text-14.5" [class]="linkClass(true)">
              <i class="pi pi-building text-16 text-side-danger" aria-hidden="true"></i>
              <span class="min-w-0 flex-1 truncate">{{ page()?.title }}</span>
            </span>
          }
        </nav>

        @if (hasOwnTenant()) {
          <div class="mx-2 my-2 h-px shrink-0 bg-side-line" aria-hidden="true"></div>
          <a routerLink="/dashboard" class="flex h-10 items-center gap-3 rounded-token-md pl-3 pr-2.5 text-14.5 font-medium text-side-text no-underline hover:bg-side-2">
            <i class="pi pi-home text-16 text-side-muted" aria-hidden="true"></i>
            <span class="min-w-0 flex-1 truncate">{{ x().backToApp }}</span>
          </a>
        }

        <div class="mt-auto flex shrink-0 flex-col gap-1.5 border-t border-side-line pt-2.5">
          <div class="flex gap-1.5">
            <button type="button" (click)="theme.toggle()" [attr.aria-pressed]="theme.isDark()"
              class="flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-token-md border border-side-line bg-transparent text-xs font-semibold text-side-muted hover:bg-side-2 hover:text-side-text"
              [attr.aria-label]="theme.isDark() ? t().nav.lightMode : t().nav.darkMode">
              <i class="pi text-sm" [class]="theme.isDark() ? 'pi-sun' : 'pi-moon'" aria-hidden="true"></i>
              {{ theme.isDark() ? t().nav.lightMode : t().nav.darkMode }}
            </button>
            <button type="button" (click)="lang.toggle()" [attr.aria-label]="t().nav.language"
              class="h-9 w-11 shrink-0 cursor-pointer rounded-token-md border border-side-line bg-transparent text-xs font-bold text-side-muted hover:bg-side-2 hover:text-side-text">
              {{ lang.lang() === 'tr' ? 'EN' : 'TR' }}
            </button>
          </div>
          <div class="flex items-center gap-2.5 rounded-token-md bg-side-2 p-2">
            <ui-avatar [name]="userName()" variant="solid" size="md" />
            <span class="min-w-0 flex-1 leading-tight">
              <span class="block truncate text-13.5 font-semibold">{{ userName() }}</span>
              <span class="block truncate text-xs text-side-muted">{{ auth.currentUser()?.email }}</span>
            </span>
            <button type="button" (click)="logout()" [attr.aria-label]="x().logout" [pTooltip]="x().logout" tooltipPosition="right"
              class="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-token-md border-0 bg-transparent text-side-muted transition-colors hover:bg-side-line hover:text-white">
              <i class="pi pi-sign-out text-15" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </aside>
    }

    <div class="flex min-w-0 flex-1 flex-col">
      @if (isMobile()) {
        <header class="relative flex shrink-0 items-center gap-2.5 bg-side pb-1.5 pl-3 pr-2 pt-[calc(6px+var(--safe-top))] text-side-text">
          <span class="absolute inset-x-0 top-0 h-[3px] bg-side-count" aria-hidden="true"></span>
          @if (page()?.backLink; as back) {
            <a [routerLink]="back" [attr.aria-label]="page()?.backLabel || x().back"
              class="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[9px] text-side-text no-underline hover:bg-side-2">
              <i class="pi pi-arrow-left text-base" aria-hidden="true"></i>
            </a>
          } @else {
            <span class="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-side-count text-white">
              <i class="pi pi-shield text-16" aria-hidden="true"></i>
            </span>
          }
          <div class="min-w-0 flex-1 leading-tight">
            <p class="m-0 truncate font-display text-17 font-extrabold">{{ page()?.title || x().platform }}</p>
            <p class="m-0 flex items-center gap-1.5 truncate text-11.5 text-side-muted">
              <span class="font-display font-bold tracking-wider text-side-danger">{{ x().badge }}</span>
              @if (page()?.subtitle; as s) { <span class="truncate">· {{ s }}</span> }
            </p>
          </div>
          <button type="button" (click)="theme.toggle()" [attr.aria-label]="theme.isDark() ? t().nav.lightMode : t().nav.darkMode"
            class="grid h-[42px] w-[42px] shrink-0 cursor-pointer place-items-center rounded-[9px] border-0 bg-transparent text-side-text hover:bg-side-2">
            <i class="pi text-17" [class]="theme.isDark() ? 'pi-sun' : 'pi-moon'" aria-hidden="true"></i>
          </button>
          <button type="button" (click)="logout()" [attr.aria-label]="x().logout"
            class="grid h-[42px] w-[42px] shrink-0 cursor-pointer place-items-center rounded-[9px] border-0 bg-transparent text-side-text hover:bg-side-2">
            <i class="pi pi-sign-out text-17" aria-hidden="true"></i>
          </button>
        </header>
      } @else {
        <header class="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 xl:px-6">
          @if (page()?.backLink; as back) {
            <a [routerLink]="back" [attr.aria-label]="page()?.backLabel || x().back"
              class="-ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-token-md text-fg-secondary no-underline transition-colors hover:bg-surface-muted hover:text-fg">
              <i class="pi pi-arrow-left text-base" aria-hidden="true"></i>
            </a>
          }
          <div class="min-w-0 flex-1 leading-tight">
            <h1 class="m-0 truncate font-display text-[1.3125rem] font-extrabold text-fg">{{ page()?.title || x().platform }}</h1>
            <p class="m-0 mt-0.5 truncate text-13 text-fg-muted">{{ page()?.subtitle || x().subtitle }}</p>
          </div>
          <ui-icon-button variant="outline" [icon]="theme.isDark() ? 'pi-sun' : 'pi-moon'" [pressed]="theme.isDark()"
            [ariaLabel]="theme.isDark() ? t().nav.lightMode : t().nav.darkMode" (click)="theme.toggle()" />
        </header>
      }

      <main id="main-content" class="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-6">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AdminShellComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly lang = inject(LangService);
  readonly t = this.lang.t;
  readonly x = computed(() => ADMIN_TEXTS[this.lang.lang()]);
  private readonly pageTitle = inject(PageTitleService);
  private readonly url = injectCurrentUrl();

  readonly page = this.pageTitle.current;
  readonly isMobile = signal(typeof window !== 'undefined' && window.innerWidth < 1024);
  /** Superadmin'in kendi işletmesi varsa uygulamaya dönüş bağlantısı. */
  readonly hasOwnTenant = computed(() => !!this.auth.currentTenantId());
  readonly onDetail = computed(() => this.url().startsWith('/admin/tenants/'));
  readonly onList = computed(() => !this.onDetail());
  readonly userName = computed(() => formatDisplayName(this.auth.currentUser()?.displayName) || this.auth.currentUser()?.email || '');

  constructor() {
    const detach = this.pageTitle.attachHost();
    inject(DestroyRef).onDestroy(detach);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile.set(window.innerWidth < 1024);
  }

  linkClass(active: boolean): string {
    return active
      ? 'bg-side-danger-soft font-semibold text-side-text shadow-[inset_3px_0_0_var(--side-danger)]'
      : 'font-medium text-side-text hover:bg-side-2';
  }

  logout(): void {
    void this.auth.logout();
  }
}
