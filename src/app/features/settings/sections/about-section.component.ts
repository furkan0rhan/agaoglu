import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { SUPPORT_CONTACT } from '../../../core/license/license.config';
import { environment } from '../../../../environments/environment';
import { GlassCardComponent, LogoMarkComponent, SettingsRowComponent, StatusBadgeComponent } from '../../../shared/ui';
import { injectSettingsTexts } from '../settings.i18n';
import { TourService } from '../../../core/onboarding/tour.service';
import { injectOnboardingTexts } from '../../../core/onboarding/onboarding.i18n';

export type AppPlatform = 'android' | 'desktop' | 'web';

/** Çalışma ortamı: Android (Tauri mobil dahil) → user agent; Tauri masaüstü → __TAURI_INTERNALS__; aksi halde Web. */
export function detectPlatform(win: Window | undefined = typeof window === 'undefined' ? undefined : window): AppPlatform {
  if (!win) return 'web';
  if (/Android/i.test(win.navigator?.userAgent ?? '')) return 'android';
  if ('__TAURI_INTERNALS__' in win) return 'desktop';
  return 'web';
}

/** Uygulamada kullanılan başlıca açık kaynak bileşenler ve lisansları (package.json). */
const OPEN_SOURCE: { name: string; license: string }[] = [
  { name: 'Angular', license: 'MIT' },
  { name: 'PrimeNG / PrimeIcons', license: 'MIT' },
  { name: 'Firebase JS SDK, AngularFire', license: 'Apache-2.0 / MIT' },
  { name: 'Tauri', license: 'MIT / Apache-2.0' },
  { name: 'Chart.js', license: 'MIT' },
  { name: 'ZXing (barkod)', license: 'Apache-2.0' },
  { name: 'SheetJS (xlsx)', license: 'Apache-2.0' },
  { name: 'jsPDF, jspdf-autotable', license: 'MIT' },
  { name: 'fflate', license: 'MIT' },
  { name: 'driver.js (ürün turu)', license: 'MIT' },
  { name: 'RxJS, NgRx Signals', license: 'Apache-2.0 / MIT' },
  { name: 'Tailwind CSS', license: 'MIT' },
  { name: 'Inter, Manrope (Fontsource)', license: 'OFL-1.1' },
];

/** Hakkında: sürüm, platform, ortam, destek hattı, yasal metinler, açık kaynak lisansları. Tüm roller. */
@Component({
  selector: 'app-about-section',
  standalone: true,
  imports: [RouterLink, GlassCardComponent, SettingsRowComponent, StatusBadgeComponent, LogoMarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3 lg:gap-4' },
  template: `
    <ui-glass-card [title]="s().sections.about.title" [subtitle]="s().sections.about.desc" icon="pi-info-circle" padding="none">
      <div class="flex flex-wrap items-center gap-3 border-b border-line px-3 py-4 sm:px-4">
        <ui-logo-mark [size]="44" />
        <div class="min-w-0 flex-1">
          <p class="m-0 font-display text-17 font-extrabold text-fg">{{ appName }}</p>
          <p class="m-0 text-13.5 text-fg-muted">{{ s().build }} <span class="num">{{ version }}</span> · {{ platformLabel() }}</p>
        </div>
        <ui-status-badge [tone]="emulator ? 'warning' : 'success'" dot>{{ emulator ? s().emulator : s().live }}</ui-status-badge>
      </div>
      <ui-settings-row [title]="s().supportLine" [description]="s().supportLineDesc">
        <a class="tap num inline-flex items-center gap-2 rounded-token-md border border-line-strong bg-surface px-3 text-sm font-semibold text-fg no-underline hover:bg-surface-hover"
          [href]="'tel:' + contact.phone"><i class="pi pi-phone" aria-hidden="true"></i>{{ contact.phone }}</a>
        <a class="tap inline-flex items-center gap-2 rounded-token-md border border-line-strong bg-surface px-3 text-sm font-semibold text-fg no-underline hover:bg-surface-hover"
          [href]="'mailto:' + contact.email"><i class="pi pi-envelope" aria-hidden="true"></i>{{ contact.email }}</a>
      </ui-settings-row>
      <ui-settings-row [title]="ob().replayTitle" [description]="ob().replayDesc">
        <button type="button" (click)="tour.restartWelcome()"
          class="tap inline-flex cursor-pointer items-center gap-2 rounded-token-md border border-brand-line bg-brand-soft px-3 text-sm font-semibold text-brand-text hover:bg-brand-soft-hover">
          <i class="pi pi-compass" aria-hidden="true"></i>{{ ob().replayBtn }}</button>
      </ui-settings-row>
      @if (canSeeKvkk()) {
        <ui-settings-row [title]="s().legal">
          <a routerLink="/customers/kvkk" class="tap inline-flex items-center gap-1.5 text-13.5 font-semibold text-brand-text no-underline hover:underline">
            <i class="pi pi-file" aria-hidden="true"></i>{{ s().kvkkText }} ›</a>
        </ui-settings-row>
      }
    </ui-glass-card>

    <ui-glass-card [title]="s().openSource" [subtitle]="s().openSourceDesc" icon="pi-code" tone="neutral" padding="none" clip>
      <ul class="m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-2">
        @for (o of openSource; track o.name) {
          <li class="flex items-center justify-between gap-3 border-b border-line px-3 py-2.5 text-sm sm:px-4">
            <span class="min-w-0 truncate text-fg">{{ o.name }}</span>
            <span class="shrink-0 rounded-token-sm bg-surface-muted px-2 py-0.5 font-mono text-12 text-fg-secondary">{{ o.license }}</span>
          </li>
        }
      </ul>
    </ui-glass-card>
  `,
})
export class AboutSectionComponent {
  readonly tour = inject(TourService);
  readonly ob = injectOnboardingTexts();
  private readonly auth = inject(AuthService);
  readonly t = inject(LangService).t;
  readonly s = injectSettingsTexts();
  readonly contact = SUPPORT_CONTACT;
  readonly openSource = OPEN_SOURCE;
  readonly appName = environment.appName;
  readonly version = environment.appVersion;
  readonly emulator = 'useEmulators' in environment && !!(environment as { useEmulators?: boolean }).useEmulators;
  private readonly platform = detectPlatform();

  readonly platformLabel = computed(() => {
    const st = this.t().settings;
    return { android: st.platformAndroid, desktop: st.platformDesktop, web: st.platformWeb }[this.platform];
  });
  /** Aydınlatma metni sayfası müşteriler modülünde (admin + kasiyer). */
  readonly canSeeKvkk = computed(() => this.auth.hasRole('admin', 'cashier'));
}
