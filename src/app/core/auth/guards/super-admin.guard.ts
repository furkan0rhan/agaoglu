import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Yalnız platform yöneticisi (platformAdmins/{uid}). Asıl koruma Firestore kurallarındadır;
 * bu guard yalnızca arayüzü gizler.
 */
export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return toObservable(auth.isLoading).pipe(
    filter(loading => !loading),
    take(1),
    map(() => {
      if (!auth.isAuthenticated()) return router.createUrlTree(['/auth/login']);
      return auth.isSuperAdmin() ? true : router.createUrlTree(['/dashboard']);
    }),
  );
};
