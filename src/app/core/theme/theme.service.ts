import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { AuthService } from '../auth/services/auth.service';

/** Tema tercihi: açık, koyu ya da işletim sistemine uy. */
export type ThemeMode = 'light' | 'dark' | 'system';
/** Yoğunluk: `compact` = daha alçak satır/kontrol (1366×768 ekranda daha çok satır). */
export type Density = 'normal' | 'compact';
/** Yazı boyutu ölçeği: `html { font-size }` + gövde yazısı bu oranla büyür. */
export type FontScale = 'normal' | 'large' | 'xlarge';

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];
export const DENSITIES: readonly Density[] = ['normal', 'compact'];
export const FONT_SCALES: readonly FontScale[] = ['normal', 'large', 'xlarge'];
/** `--font-scale` değerleri (src/styles/_base.scss bu değişkeni kullanır). */
export const FONT_SCALE_FACTOR: Record<FontScale, number> = { normal: 1, large: 1.125, xlarge: 1.25 };

export interface UiPrefs {
  theme: ThemeMode;
  density: Density;
  fontScale: FontScale;
}

export const DEFAULT_UI_PREFS: UiPrefs = { theme: 'system', density: 'normal', fontScale: 'normal' };

/** localStorage'daki ham değeri doğrular (bilinmeyen alan → varsayılan). */
export function parseUiPrefs(raw: string | null, legacyTheme: string | null = null): UiPrefs {
  let o: Record<string, unknown> = {};
  try { o = raw ? (JSON.parse(raw) as Record<string, unknown>) ?? {} : {}; } catch { o = {}; }
  const pick = <T extends string>(v: unknown, list: readonly T[], def: T): T =>
    typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : def;
  const legacy = legacyTheme === 'dark' || legacyTheme === 'light' ? legacyTheme : null;
  return {
    theme: pick(o['theme'], THEME_MODES, legacy ?? DEFAULT_UI_PREFS.theme),
    density: pick(o['density'], DENSITIES, DEFAULT_UI_PREFS.density),
    fontScale: pick(o['fontScale'], FONT_SCALES, DEFAULT_UI_PREFS.fontScale),
  };
}

/**
 * Görünüm tercihleri (tema, yoğunluk, yazı boyutu). Cihazda, **kullanıcı bazlı** saklanır:
 * `localStorage['ui-prefs:<uid>']`; giriş öncesi (giriş ekranı) için son kullanılan `ui-prefs` anahtarı.
 * Uygulama: `html.dark`, `html.density-compact`, `html[style --font-scale]` (stiller: src/styles/_base.scss, _primeng.scss).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly auth = inject(AuthService);
  private static readonly KEY = 'ui-prefs';
  /** Eski sürümün anahtarı ('light' | 'dark'); ilk açılışta tercihe dönüştürülür. */
  private static readonly LEGACY_KEY = 'theme';

  private readonly media = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  private readonly systemDark = signal(this.media?.matches ?? false);

  private readonly prefs = signal<UiPrefs>(this.read(null));
  private loadedFor: string | null = null;

  readonly mode = computed(() => this.prefs().theme);
  readonly density = computed(() => this.prefs().density);
  readonly fontScale = computed(() => this.prefs().fontScale);
  readonly isDark = computed(() => this.mode() === 'dark' || (this.mode() === 'system' && this.systemDark()));

  constructor() {
    this.media?.addEventListener?.('change', e => this.systemDark.set(e.matches));
    // Kullanıcı değişince (giriş / çıkış) o kullanıcının tercihlerini yükle
    effect(() => {
      const uid = this.auth.currentUser()?.id ?? null;
      if (uid === this.loadedFor) return;
      this.loadedFor = uid;
      if (uid) this.prefs.set(this.read(uid));
    });
    effect(() => this.apply(this.prefs(), this.isDark()));
  }

  /** Topbar düğmesi: açık ↔ koyu (sistem modundaysa şu anki görünümün tersine sabitlenir). */
  toggle(): void { this.setMode(this.isDark() ? 'light' : 'dark'); }

  setMode(theme: ThemeMode): void { this.update({ theme }); }
  setDensity(density: Density): void { this.update({ density }); }
  setFontScale(fontScale: FontScale): void { this.update({ fontScale }); }

  private update(patch: Partial<UiPrefs>): void {
    const next = { ...this.prefs(), ...patch };
    this.prefs.set(next);
    this.write(next);
  }

  private apply(p: UiPrefs, dark: boolean): void {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.classList.toggle('density-compact', p.density === 'compact');
    root.style.setProperty('--font-scale', String(FONT_SCALE_FACTOR[p.fontScale]));
    root.dataset['fontScale'] = p.fontScale;
  }

  private read(uid: string | null): UiPrefs {
    try {
      const own = uid ? localStorage.getItem(`${ThemeService.KEY}:${uid}`) : null;
      if (own) return parseUiPrefs(own);
      // Kullanıcının kaydı yoksa cihazdaki son tercih (ya da eski 'theme' anahtarı)
      return parseUiPrefs(localStorage.getItem(ThemeService.KEY), localStorage.getItem(ThemeService.LEGACY_KEY));
    } catch {
      return DEFAULT_UI_PREFS;
    }
  }

  private write(p: UiPrefs): void {
    try {
      const json = JSON.stringify(p);
      localStorage.setItem(ThemeService.KEY, json);
      if (this.loadedFor) localStorage.setItem(`${ThemeService.KEY}:${this.loadedFor}`, json);
    } catch { /* depolama kapalı: yalnız bu oturumda geçerli */ }
  }
}
