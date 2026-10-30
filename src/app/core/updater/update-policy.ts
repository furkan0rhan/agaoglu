/**
 * Otomatik güncelleme kararları (saf fonksiyonlar — birim testli).
 * Kural: açık bir satış (POS sepeti dolu) asla kesilmez; güncelleme yalnız kullanıcı
 * "Şimdi güncelle" dediğinde ve sepet boşken kurulur.
 */

/** İlk denetim: açılıştan bu kadar sonra (oturum/ilk ekran yüklensin, açılışı yavaşlatmasın). */
export const FIRST_CHECK_DELAY_MS = 8_000;
/** Sonraki denetimler: uygulama açık kaldıkça bu aralıkla. */
export const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

/** Tauri masaüstü (Windows EXE/MSI) mi? Web ve Android/iOS'ta güncelleyici yok. */
export function isTauriDesktop(win: Window | undefined = typeof window === 'undefined' ? undefined : window): boolean {
  if (!win || !('__TAURI_INTERNALS__' in win)) return false;
  return !/Android|iPhone|iPad|iPod/i.test(win.navigator?.userAgent ?? '');
}

/** Periyodik denetim zamanı geldi mi (son denetimden bu yana aralık doldu mu)? */
export function isCheckDue(lastCheckedAt: number | null, now: number, intervalMs = CHECK_INTERVAL_MS): boolean {
  return lastCheckedAt == null || now - lastCheckedAt >= intervalMs;
}

export interface UpdateBannerInput {
  /** Bulunan yeni sürüm (yoksa null). */
  version: string | null;
  /** POS sepetinde ürün var mı (satış sürüyor). */
  saleInProgress: boolean;
  /** Kullanıcının "Sonra" dediği sürüm (bu oturumda o sürüm için bir daha sorma). */
  dismissedVersion: string | null;
  /** İndirme/kurulum sürüyor mu. */
  installing: boolean;
}

/**
 * Banner ne göstersin:
 * - 'hidden' : güncelleme yok ya da kullanıcı bu sürümü erteledi.
 * - 'notice' : güncelleme var ama satış sürüyor → yalnız bilgi ("satış bitince"), buton yok.
 * - 'prompt' : "Şimdi güncelle / Sonra".
 * - 'progress': indiriliyor/kuruluyor.
 */
export type UpdateBannerMode = 'hidden' | 'notice' | 'prompt' | 'progress';

export function bannerMode(i: UpdateBannerInput): UpdateBannerMode {
  if (i.installing) return 'progress';
  if (!i.version || i.version === i.dismissedVersion) return 'hidden';
  return i.saleInProgress ? 'notice' : 'prompt';
}

/** Kurulum başlatılabilir mi? Satış sürerken asla. */
export function canInstallNow(version: string | null, saleInProgress: boolean, installing: boolean): boolean {
  return !!version && !saleInProgress && !installing;
}

/** İndirme yüzdesi (toplam boyut bilinmiyorsa null → belirsiz çubuk). */
export function progressPercent(downloaded: number, total: number | null | undefined): number | null {
  if (!total || total <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((downloaded / total) * 100)));
}
