/**
 * users/{uid} profilini geçici ağ hatalarına dayanıklı okur.
 *
 * Neden: persistentLocalCache + multi-tab manager ile ilk açılışta (WebChannel kurulmadan) getDoc sık sık
 * "Failed to get document because the client is offline" (code: unavailable) atar. Eskiden bu tek hata
 * kullanıcıyı oturumdan atıyordu. Artık: sunucudan okumayı üstel geri çekilmeyle tekrar dener
 * (varsayılan toplam ~15 sn); her başarısız denemede yerel önbelleğe bakar. Yalnızca kesin hatalar
 * (permission-denied vb.) hemen döner.
 */

/** Okunan profil dokümanının asgari biçimi (DocumentSnapshot ile uyumlu). */
export interface ProfileSnap {
  exists(): boolean;
  data(): Record<string, unknown> | undefined;
}

export type ProfileFetchResult =
  | { status: 'ok'; snap: ProfileSnap; fromCache: boolean }
  /** Kurallar okumayı reddetti (kesin). */
  | { status: 'denied'; error: unknown }
  /** Denemeler bitti, sunucuya ulaşılamadı ve önbellekte yok (geçici). */
  | { status: 'unavailable'; error: unknown };

export interface ProfileFetchOptions {
  /** Denemeler arası bekleme (ms). Varsayılan: 500, 1000, 2000, 4000, 8000 → ~15,5 sn + istek süreleri. */
  delays?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, error: unknown) => void;
}

export const PROFILE_RETRY_DELAYS: readonly number[] = [500, 1000, 2000, 4000, 8000];

/** Firestore hata kodunu çıkarır ('permission-denied', 'unavailable', ...). */
export function firestoreErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) return String((err as { code: unknown }).code);
  return '';
}

/** Tekrar denemeye değer geçici hata mı? (çevrimdışı, zaman aşımı, sunucu meşgul) */
export function isTransientFirestoreError(err: unknown): boolean {
  const code = firestoreErrorCode(err);
  if (['unavailable', 'deadline-exceeded', 'resource-exhausted', 'aborted', 'internal', 'unknown', 'cancelled'].includes(code)) return true;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /offline|network|unavailable|timeout/i.test(msg);
}

export function isPermissionDenied(err: unknown): boolean {
  return firestoreErrorCode(err) === 'permission-denied' || /permission[_ -]denied|insufficient permissions/i.test(String((err as Error)?.message ?? ''));
}

const defaultSleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * @param readServer sunucudan oku (getDocFromServer)
 * @param readCache  yalnız yerel önbellekten oku (getDocFromCache; dokümanı yoksa hata atar)
 */
export async function fetchProfileWithRetry(
  readServer: () => Promise<ProfileSnap>,
  readCache: () => Promise<ProfileSnap>,
  opts: ProfileFetchOptions = {},
): Promise<ProfileFetchResult> {
  const delays = opts.delays ?? PROFILE_RETRY_DELAYS;
  const sleep = opts.sleep ?? defaultSleep;
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return { status: 'ok', snap: await readServer(), fromCache: false };
    } catch (err) {
      lastError = err;
      if (!isTransientFirestoreError(err)) {
        return isPermissionDenied(err) ? { status: 'denied', error: err } : { status: 'unavailable', error: err };
      }
    }
    // Sunucuya ulaşılamadı: önbellekte (daha önce okunmuş) profil varsa onu kullan
    try {
      const cached = await readCache();
      if (cached.exists()) return { status: 'ok', snap: cached, fromCache: true };
    } catch { /* önbellekte yok */ }
    if (attempt < delays.length) {
      opts.onRetry?.(attempt + 1, lastError);
      await sleep(delays[attempt]);
    }
  }
  return { status: 'unavailable', error: lastError };
}
