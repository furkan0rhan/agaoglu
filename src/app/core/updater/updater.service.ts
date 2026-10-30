import { DestroyRef, Injectable, computed, signal } from '@angular/core';
import type { Update } from '@tauri-apps/plugin-updater';
import {
  CHECK_INTERVAL_MS, FIRST_CHECK_DELAY_MS, bannerMode, canInstallNow, isCheckDue, isTauriDesktop, progressPercent,
} from './update-policy';

const LAST_CHECK_KEY = 'tm.updater.lastCheckedAt';

export type UpdateCheckResult = 'available' | 'up-to-date' | 'offline' | 'error' | 'unsupported';

/**
 * Masaüstü (Tauri EXE/MSI) otomatik güncelleme.
 * - GitHub Releases'teki latest.json'u denetler (tauri.conf.json > plugins.updater).
 * - Açılıştan kısa süre sonra ve uygulama açık kaldıkça birkaç saatte bir denetler.
 * - Asla kendiliğinden kurmaz; kullanıcı "Şimdi güncelle" der ve POS sepeti boşsa kurar.
 * - Eklenti modülleri dinamik import ile yüklenir: web/APK paketi büyümez.
 */
@Injectable({ providedIn: 'root' })
export class UpdaterService {
  /** Web ve Android'de false: hiçbir şey yapılmaz, ayarlarda bölüm görünmez. */
  supported = isTauriDesktop();

  readonly availableVersion = signal<string | null>(null);
  readonly checking = signal(false);
  readonly installing = signal(false);
  /** 0–100; toplam boyut bilinmiyorsa null. */
  readonly progress = signal<number | null>(null);
  readonly downloaded = signal(false);
  readonly lastCheckedAt = signal<number | null>(readLastCheck());
  readonly lastResult = signal<UpdateCheckResult | null>(null);
  readonly installError = signal(false);
  readonly dismissedVersion = signal<string | null>(null);

  private saleInProgressFn: () => boolean = () => false;
  private readonly busyVersion = signal(0);
  /** Satış sürüyor mu (bağlanan fonksiyon sinyal okuyorsa reaktif). */
  readonly saleInProgress = computed(() => { this.busyVersion(); return this.saleInProgressFn(); });

  readonly mode = computed(() =>
    bannerMode({
      version: this.availableVersion(),
      saleInProgress: this.saleInProgress(),
      dismissedVersion: this.dismissedVersion(),
      installing: this.installing(),
    }));

  /** Eklenti yükleyicileri (dinamik import; testlerde sahtesiyle değiştirilir). */
  loadUpdater = () => import('@tauri-apps/plugin-updater');
  loadProcess = () => import('@tauri-apps/plugin-process');

  private pending: Update | null = null;
  private started = false;
  private timers: ReturnType<typeof setTimeout>[] = [];

  /**
   * Satış sürüyor mu bilgisini verir (ör. POS sepeti dolu). Ana kabuk bağlar; çekirdek
   * servis POS'a bağımlı olmasın diye fonksiyon olarak alınır. Dönen fonksiyon bağı çözer.
   */
  registerSaleInProgress(fn: () => boolean): () => void {
    this.saleInProgressFn = fn;
    this.busyVersion.update(v => v + 1);
    return () => {
      if (this.saleInProgressFn === fn) {
        this.saleInProgressFn = () => false;
        this.busyVersion.update(v => v + 1);
      }
    };
  }

  /** Otomatik denetimi başlatır (bir kez). Kabuk bileşeni çağırır. */
  start(destroyRef?: DestroyRef): void {
    if (!this.supported || this.started) return;
    this.started = true;
    this.timers.push(setTimeout(() => void this.check(false), FIRST_CHECK_DELAY_MS));
    const interval = setInterval(() => {
      if (isCheckDue(this.lastCheckedAt(), Date.now(), CHECK_INTERVAL_MS - 60_000)) void this.check(false);
    }, CHECK_INTERVAL_MS);
    destroyRef?.onDestroy(() => this.stop(interval));
  }

  private stop(interval: ReturnType<typeof setInterval>): void {
    clearInterval(interval);
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
    this.started = false;
  }

  /**
   * Güncelleme denetimi. manual=true (ayarlardaki buton) ise "Sonra" denmiş sürüm de yeniden gösterilir.
   */
  async check(manual: boolean): Promise<UpdateCheckResult> {
    if (!this.supported) return 'unsupported';
    if (this.checking() || this.installing()) return this.lastResult() ?? 'up-to-date';
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.lastResult.set('offline');
      return 'offline';
    }
    this.checking.set(true);
    try {
      const { check } = await this.loadUpdater();
      const update = await check({ timeout: 30_000 });
      this.markChecked();
      if (update) {
        await this.replacePending(update);
        this.availableVersion.set(update.version);
        if (manual) this.dismissedVersion.set(null);
        this.lastResult.set('available');
        return 'available';
      }
      await this.replacePending(null);
      this.availableVersion.set(null);
      this.lastResult.set('up-to-date');
      return 'up-to-date';
    } catch (e) {
      console.warn('Güncelleme denetimi başarısız:', e);
      this.lastResult.set('error');
      return 'error';
    } finally {
      this.checking.set(false);
    }
  }

  /** "Sonra": bu sürüm için bu oturumda bir daha sorma (ayarlardan elle denetlenebilir). */
  dismiss(): void {
    this.dismissedVersion.set(this.availableVersion());
  }

  /** İndirir, kurar ve yeniden başlatır. Satış sürerken çalışmaz. */
  async install(): Promise<boolean> {
    const update = this.pending;
    if (!update || !canInstallNow(this.availableVersion(), this.saleInProgressFn(), this.installing())) return false;
    this.installing.set(true);
    this.installError.set(false);
    this.progress.set(null);
    this.downloaded.set(false);
    let total: number | null = null;
    let received = 0;
    try {
      await update.downloadAndInstall(ev => {
        if (ev.event === 'Started') {
          total = ev.data.contentLength ?? null;
          this.progress.set(progressPercent(0, total));
        } else if (ev.event === 'Progress') {
          received += ev.data.chunkLength;
          this.progress.set(progressPercent(received, total));
        } else if (ev.event === 'Finished') {
          this.downloaded.set(true);
        }
      });
      // Windows'ta kurulum (passive) uygulamayı zaten kapatır; diğer durumlarda yeniden başlat.
      const { relaunch } = await this.loadProcess();
      await relaunch();
      return true;
    } catch (e) {
      console.warn('Güncelleme kurulamadı:', e);
      this.installError.set(true);
      this.installing.set(false);
      return false;
    }
  }

  private async replacePending(next: Update | null): Promise<void> {
    const prev = this.pending;
    this.pending = next;
    if (prev && prev !== next) {
      try { await prev.close(); } catch { /* kaynak zaten kapalı */ }
    }
  }

  private markChecked(): void {
    const now = Date.now();
    this.lastCheckedAt.set(now);
    try { localStorage.setItem(LAST_CHECK_KEY, String(now)); } catch { /* depolama yok */ }
  }
}

function readLastCheck(): number | null {
  try {
    const v = Number(localStorage.getItem(LAST_CHECK_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}
