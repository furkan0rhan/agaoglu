import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { AuthService, emailVerificationRequired } from '../services/auth.service';

/**
 * Oturum + e-posta doğrulaması (2.34).
 * Doğrulanmamış hesaplar yalnızca /verify-email sayfasını açabilir (kapatmak: environment.requireEmailVerification = false).
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return toObservable(auth.isLoading).pipe(
    filter(loading => !loading),
    take(1),
    map(() => {
      if (!auth.isAuthenticated()) return router.createUrlTree(['/auth/login']);
      if (auth.currentUser()?.accountType === 'farmer') return router.createUrlTree(['/ciftci']); // çiftçi modülü
      // Superadmin: işletmesi yoksa ve destek modunda değilse yönetim paneline
      if (auth.isSuperAdmin()) {
        return auth.currentTenantId() ? true : router.createUrlTree(['/admin']);
      }
      const onVerifyPage = state.url.startsWith('/verify-email');
      // environment.requireEmailVerification=false ile eski doğrulanmamış hesaplar geçebilir; davet yine doğrulama ister
      const needsVerification = (emailVerificationRequired() && !auth.isEmailVerified()) || auth.pendingInvite();
      if (needsVerification && !onVerifyPage) return router.createUrlTree(['/verify-email']);
      return true;
    })
  );
};
