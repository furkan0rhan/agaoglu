/**
 * Kullanıcıya gösterilecek hata metni. Ham Firestore/Firebase mesajları ("false for 'list' @ L267",
 * "Missing or insufficient permissions") ASLA ekrana basılmaz; koduna göre anlaşılır bir metne çevrilir.
 * Uygulamanın kendi ürettiği (kodsuz) Error mesajları olduğu gibi döner.
 */
export type ErrorLang = 'tr' | 'en';

const TEXTS: Record<ErrorLang, Record<'permission' | 'offline' | 'building' | 'notFound', string>> = {
  tr: {
    permission: 'Bu veriye erişim yetkiniz yok ya da oturumunuz değişti. Sayfayı yenileyip tekrar deneyin.',
    offline: 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.',
    building: 'Veriler hazırlanıyor, birkaç dakika sonra tekrar deneyin.',
    notFound: 'Kayıt bulunamadı.',
  },
  en: {
    permission: 'You do not have access to this data or your session changed. Refresh the page and try again.',
    offline: 'Could not reach the server. Check your connection and try again.',
    building: 'Data is being prepared, try again in a few minutes.',
    notFound: 'Record not found.',
  },
};

const FIRESTORE_CODES = new Set([
  'cancelled', 'unknown', 'invalid-argument', 'deadline-exceeded', 'not-found', 'already-exists', 'permission-denied',
  'resource-exhausted', 'failed-precondition', 'aborted', 'out-of-range', 'unimplemented', 'internal', 'unavailable',
  'data-loss', 'unauthenticated',
]);

function errCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) return String((err as { code: unknown }).code ?? '');
  return '';
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message ?? '');
  return typeof err === 'string' ? err : '';
}

/** Firebase/Firestore kaynaklı mı? (kodlu hata ya da kural/izin metni) */
export function isBackendError(err: unknown): boolean {
  const code = errCode(err).replace(/^firestore\//, '');
  const name = (err as { name?: string } | null)?.name ?? '';
  return FIRESTORE_CODES.has(code) || code.startsWith('auth/') || name === 'FirebaseError' || /@ L\d+|insufficient permissions|PERMISSION_DENIED|client is offline/i.test(errMessage(err));
}

/**
 * @param fallback Firebase hatası tanınmazsa gösterilecek genel metin (ör. "Ürünler yüklenemedi").
 */
export function userErrorMessage(err: unknown, fallback: string, lang: ErrorLang = 'tr'): string {
  const t = TEXTS[lang] ?? TEXTS.tr;
  const code = errCode(err).replace(/^firestore\//, '');
  const msg = errMessage(err);
  if (code === 'permission-denied' || /insufficient permissions|PERMISSION_DENIED|false for '/i.test(msg)) return t.permission;
  if (code === 'unavailable' || code === 'deadline-exceeded' || /client is offline/i.test(msg)) return t.offline;
  if (code === 'failed-precondition' && /index/i.test(msg)) return t.building;
  if (/currently building/i.test(msg)) return t.building;
  if (code === 'not-found') return t.notFound;
  if (isBackendError(err)) return fallback;
  return msg.trim() || fallback;
}
