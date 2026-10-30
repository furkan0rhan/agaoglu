import { Translations } from '../../core/i18n/translations';

type AuthT = Translations['auth'];

/** Firebase Auth / uygulama hata kodunu kullanıcı mesajına çevirir (2.27). */
export function authErrorMessage(err: unknown, a: AuthT, fallback: string = a.errDefault): string {
  const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
  const map: Record<string, string> = {
    'auth/user-not-found': a.errUserNotFound,
    'auth/wrong-password': a.errWrongPassword,
    'auth/invalid-credential': a.errInvalidCredential,
    'auth/invalid-login-credentials': a.errInvalidCredential,
    'auth/too-many-requests': a.errTooManyRequests,
    'auth/user-disabled': a.errUserDisabled,
    'auth/network-request-failed': a.errNetwork,
    'auth/email-already-in-use': a.errEmailInUse,
    'auth/weak-password': a.errWeakPassword,
    'auth/invalid-email': a.errInvalidEmail,
    'auth/missing-email': a.errInvalidEmail,
    'auth/requires-recent-login': a.errRecentLogin,
    'app/user-inactive': a.errAccountInactive,
    'app/profile-unavailable': a.errProfileUnavailable,
    'app/profile-retry': a.errProfileRetry,
    'unavailable': a.errNetwork,
  };
  return map[code] ?? fallback;
}
