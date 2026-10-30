import { ChangeDetectionStrategy, Component, computed, DestroyRef, DOCUMENT, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { LangService } from '../../../core/i18n/lang.service';
import { LogoMarkComponent } from '../../../shared/ui/logo-mark.component';
import { FarmerSession } from '../auth/farmer-session.service';
import { FarmerSyncTracker } from '../data/sync-tracker';
import { FarmerStore } from '../services/farmer-store.service';
import { fmt } from '../i18n/farmer.i18n';

type NavKey = 'home' | 'fields' | 'logbook' | 'dealer' | 'account';

interface NavItem { key: NavKey; link: string; icon: string; match: readonly string[]; exact: boolean }

/**
 * Çiftçi kabuğu — tasarım v2 "Saha / Komuta", mobil öncelikli, tek el:
 * koyu üst çubuk (logo + ad + senkron durumu) · kâğıt zemin içerik · koyu alt sekme çubuğu
 * (Ana sayfa · Tarlalarım · Defter · Bayim · Hesap), her sekmede ikon + kısa kelime, ≥60px dokunma alanı.
 * Cam efekti yok; düz, yüksek kontrast, ≥18px yazı. Açık/koyu tema token'larla otomatik.
 */
@Component({
  selector: 'app-farmer-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, LogoMarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh flex-col bg-page text-18 text-fg' },
  template: `
    <header class="sticky top-0 z-topbar bg-side text-side-text pt-safe-t">
      <div class="mx-auto flex h-[60px] max-w-xl items-center gap-3 px-4">
        <ui-logo-mark [size]="38" />
        <div class="min-w-0 flex-1 leading-tight">
          <p class="m-0 truncate font-display text-18 font-extrabold">{{ t().farmer.appName }}</p>
          @if (firstName()) { <p class="m-0 truncate text-13 text-side-muted">{{ firstName() }}</p> }
        </div>
        @if (sync.pending()) {
          <span role="status" [attr.aria-label]="t().farmer.common.pending" [title]="t().farmer.common.pending"
            class="flex h-9 shrink-0 items-center gap-1.5 rounded-token-md bg-warning-soft px-2.5 text-13 font-bold text-warning-text">
            <i class="pi pi-clock text-13" aria-hidden="true"></i>{{ t().farmer.common.pendingShort }}
          </span>
        } @else {
          <span class="flex h-9 shrink-0 items-center gap-2 rounded-token-md border border-side-line px-2.5 text-13 text-side-muted" aria-hidden="true">
            <span class="h-2 w-2 rounded-full" [class]="online() ? 'bg-side-hi' : 'bg-warning'"></span>
            <i class="pi text-14" [class]="online() ? 'pi-cloud' : 'pi-wifi'"></i>
          </span>
        }
      </div>
      @if (!online()) {
        <div class="flex items-center gap-2 border-b border-warning-line bg-warning-soft px-4 py-2 text-15 font-semibold text-warning-text" role="status">
          <i class="pi pi-wifi shrink-0" aria-hidden="true"></i><span>{{ t().farmer.common.offline }}</span>
        </div>
      }
      @if (sync.lastError()) {
        <button type="button" class="flex w-full cursor-pointer items-center justify-center gap-2 border-0 bg-danger-soft px-4 py-2 text-15 font-semibold text-danger-text" (click)="sync.clearError()">
          <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>{{ t().farmer.common.syncError }}
          <i class="pi pi-times ml-1 text-13" aria-hidden="true"></i><span class="sr-only">{{ t().farmer.common.close }}</span>
        </button>
      }
    </header>

    <main id="main-content" class="mx-auto w-full max-w-xl flex-1 px-4 pb-[calc(96px+var(--safe-bottom))] pt-4">
      <router-outlet />
    </main>

    <nav class="fixed inset-x-0 bottom-0 z-nav border-t border-side-line bg-side pb-safe-b" [attr.aria-label]="t().farmer.nav.menu">
      <div class="mx-auto grid max-w-xl grid-cols-5 gap-0.5 px-1 pb-1.5 pt-1.5">
        @for (item of nav; track item.key) {
          @let active = isActive(item);
          <a [routerLink]="item.link" [attr.aria-current]="active ? 'page' : null" [attr.data-tour]="'farmer-nav-' + item.key"
             class="relative flex min-h-[60px] min-w-0 flex-col items-center justify-center gap-1 rounded-token-lg text-13 font-semibold no-underline transition-colors"
             [class]="active ? 'bg-side-active text-side-active-text' : 'text-side-muted hover:bg-side-2 hover:text-side-text'">
            @if (active) { <span class="absolute -top-1.5 left-[28%] right-[28%] h-[3px] rounded-b-[3px] bg-side-hi" aria-hidden="true"></span> }
            <i class="pi text-22" [class]="item.icon + (active ? ' text-side-active-text' : '')" aria-hidden="true"></i>
            @if (item.key === 'dealer' && store.unseenRecCount(); as n) {
              <span class="num absolute right-[18%] top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-danger px-1 text-12 font-bold text-fg-inverse">{{ n }}</span>
              <span class="sr-only">{{ newRecs(n) }}</span>
            }
            <span class="max-w-full truncate px-0.5">{{ t().farmer.nav[item.key] }}</span>
          </a>
        }
      </div>
    </nav>
  `,
})
export class FarmerLayoutComponent implements OnInit {
  readonly t = inject(LangService).t;
  readonly sync = inject(FarmerSyncTracker);
  private readonly session = inject(FarmerSession);
  readonly store = inject(FarmerStore);
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);

  private readonly url = toSignal(
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), map(e => e.urlAfterRedirects)),
    { initialValue: this.router.url },
  );
  readonly firstName = computed(() => this.session.farmer()?.displayName ?? '');

  readonly nav: readonly NavItem[] = [
    { key: 'home', link: '/ciftci', icon: 'pi-home', match: ['/ciftci'], exact: true },
    { key: 'fields', link: '/ciftci/tarlalar', icon: 'pi-map', match: ['/ciftci/tarlalar'], exact: false },
    { key: 'logbook', link: '/ciftci/defter', icon: 'pi-book', match: ['/ciftci/defter', '/ciftci/kayit'], exact: false },
    { key: 'dealer', link: '/ciftci/borc', icon: 'pi-shop', match: ['/ciftci/borc', '/ciftci/oneriler', '/ciftci/ambar'], exact: false },
    { key: 'account', link: '/ciftci/ayarlar', icon: 'pi-user', match: ['/ciftci/ayarlar', '/ciftci/izinler'], exact: false },
  ];

  isActive(item: NavItem): boolean {
    const path = this.url().split(/[?#]/)[0];
    return item.match.some(m => (item.exact ? path === m || path === m + '/' : path === m || path.startsWith(m + '/')));
  }

  newRecs(n: number): string { return fmt(this.t().farmer.home.newRecs, { n }); }

  /**
   * Kaydırma kabı `app-root` (bkz. styles/_base.scss); Angular'ın kaydırma geri yüklemesi yalnız `window`'u sıfırlar.
   * Sayfa değişince en üstten açılsın (rapor #11).
   */
  private scrollTop(): void {
    this.doc.querySelector('app-root')?.scrollTo?.({ top: 0 });
    this.doc.defaultView?.scrollTo?.({ top: 0 });
  }

  ngOnInit(): void {
    void this.store.load();
    this.scrollTop();
    const nav = this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(() => this.scrollTop());
    const up = () => { this.online.set(true); this.store.refreshIfStale(); };
    const down = () => this.online.set(false);
    // Uygulama öne gelince bayinin yeni yazdıkları (satış, borç, öneri) kendiliğinden gelir (rapor #4)
    const wake = () => { if (this.doc.visibilityState === 'visible') this.store.refreshIfStale(); };
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    window.addEventListener('focus', wake);
    this.doc.addEventListener('visibilitychange', wake);
    // PWA: çiftçi alanına özel manifest (start_url /ciftci). Service worker MVP'de yok (bkz. rapor).
    const link = this.doc.createElement('link');
    link.rel = 'manifest';
    link.href = '/ciftci.webmanifest';
    this.doc.head.appendChild(link);
    this.destroyRef.onDestroy(() => {
      nav.unsubscribe();
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      window.removeEventListener('focus', wake);
      this.doc.removeEventListener('visibilitychange', wake);
      link.remove();
    });
  }
}
