import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { SUPPORT_CONTACT } from '../../../core/license/license.config';
import { environment } from '../../../../environments/environment';
import { GlassCardComponent, LogoMarkComponent, SettingsRowComponent, StatusBadgeComponent } from '../../../shared/ui';
import { injectSettingsTexts } from '../settings.i18n';
import { TourService } from '../../../core/onboarding/tour.service';
import { injectOnboardingTexts } from '../../../core/onboarding/onboarding.i18n';
import { UpdaterService } from '../../../core/updater/updater.service';
import { injectUpdaterTexts } from '../../../core/updater/updater.i18n';

export type AppPlatform = 'android' | 'desktop' | 'web';

/** Çalışma ortamı: Android (Tauri mobil dahil) → user agent; Tauri masaüstü → __TAURI_INTERNALS__; aksi halde Web. */
export function detectPlatform(win: Window | undefined = typeof window === 'undefined' ? undefined : window): AppPlatform {
  if (!win) return 'web';
  if (/Android/i.test(win.navigator?.userAgent ?? '')) return 'android';
  if ('__TAURI_INTERNALS__' in win) return 'desktop';
  return 'web';
}

/** Hakkında: sürüm, platform, ortam, destek hattı, yasal metinler. Tüm roller. */
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

    @if (updater.supported) {
      <!-- Masaüstü (EXE) güncellemeleri: yüklü sürüm, elle denetim, son denetim zamanı -->
      <ui-glass-card [title]="u().sectionTitle" [subtitle]="u().sectionDesc" icon="pi-sync" padding="none">
        <ui-settings-row [title]="u().currentVersion" [description]="lastCheckedLabel()">
          <span class="num text-sm font-semibold text-fg">{{ version }}</span>
          <button type="button" (click)="checkUpdates()" [disabled]="updater.checking() || updater.installing()"
            class="tap inline-flex cursor-pointer items-center gap-2 rounded-token-md border border-brand-line bg-brand-soft px-3 text-sm font-semibold text-brand-text hover:bg-brand-soft-hover disabled:cursor-default disabled:opacity-60">
            <i class="pi" [class]="updater.checking() ? 'pi-spin pi-spinner' : 'pi-refresh'" aria-hidden="true"></i>
            {{ updater.checking() ? u().checking : u().checkNow }}</button>
        </ui-settings-row>
        @if (updateStatus(); as st) {
          <p role="status" class="m-0 border-t border-line px-3 py-2.5 text-13.5 sm:px-4"
            [class]="st.tone === 'danger' ? 'text-danger-text' : st.tone === 'brand' ? 'font-semibold text-brand-text' : 'text-fg-muted'">{{ st.text }}</p>
        }
      </ui-glass-card>
    }
  `,
})
export class AboutSectionComponent {
  readonly tour = inject(TourService);
  readonly ob = injectOnboardingTexts();
  private readonly auth = inject(AuthService);
  readonly t = inject(LangService).t;
  readonly s = injectSettingsTexts();
  readonly contact = SUPPORT_CONTACT;
  readonly appName = environment.appName;
  readonly version = environment.appVersion;
  readonly emulator = 'useEmulators' in environment && !!(environment as { useEmulators?: boolean }).useEmulators;
  private readonly platform = detectPlatform();

  readonly updater = inject(UpdaterService);
  readonly u = injectUpdaterTexts();
  private readonly lang = inject(LangService).lang;
  /** Elle denetim yapıldı mı (sonuç satırı yalnız o zaman ya da güncelleme varken görünür). */
  private readonly manualChecked = signal(false);

  readonly lastCheckedLabel = computed(() => {
    const at = this.updater.lastCheckedAt();
    const label = at ? new Date(at).toLocaleString(this.lang() === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }) : this.u().never;
    return `${this.u().lastChecked}: ${label}`;
  });

  readonly updateStatus = computed<{ text: string; tone: 'brand' | 'muted' | 'danger' } | null>(() => {
    const v = this.updater.availableVersion();
    if (v) return { text: this.u().available(v), tone: 'brand' };
    if (!this.manualChecked() || this.updater.checking()) return null;
    switch (this.updater.lastResult()) {
      case 'up-to-date': return { text: this.u().upToDate, tone: 'muted' };
      case 'offline': return { text: this.u().offline, tone: 'muted' };
      case 'error': return { text: this.u().checkFailed, tone: 'danger' };
      default: return null;
    }
  });

  /** Elle denetim; güncelleme varsa sağ alttaki bildirim (Şimdi güncelle / Sonra) yeniden görünür. */
  async checkUpdates(): Promise<void> {
    await this.updater.check(true);
    this.manualChecked.set(true);
  }

  readonly platformLabel = computed(() => {
    const st = this.t().settings;
    return { android: st.platformAndroid, desktop: st.platformDesktop, web: st.platformWeb }[this.platform];
  });
  /** Aydınlatma metni sayfası müşteriler modülünde (admin + kasiyer). */
  readonly canSeeKvkk = computed(() => this.auth.hasRole('admin', 'cashier'));
}
