import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FarmerSession } from './farmer-session.service';

/**
 * /ciftci/** kabuğu: yalnızca çiftçi hesabı (users/{uid}.accountType == 'farmer' ve profilin sahibi).
 * Bayi hesabı → /dashboard; oturum yok / PIN sıfırlama sonrası eski hesap → /ciftci/giris.
 */
export const farmerGuard: CanActivateFn = async () => {
  const session = inject(FarmerSession);
  const router = inject(Router);
  const state = await session.ensureLoaded();
  switch (state) {
    case 'ready': return true;
    case 'dealer': return router.createUrlTree(['/dashboard']);
    case 'not-owner': return router.createUrlTree(['/ciftci/giris'], { queryParams: { r: 'not-owner' } });
    case 'error': return router.createUrlTree(['/ciftci/giris'], { queryParams: { r: 'error' } });
    default: return router.createUrlTree(['/ciftci/giris']);
  }
};

/** Giriş/davet sayfaları: oturumu hazır çiftçiyi ana sayfaya, bayiyi kendi paneline gönderir. */
export const farmerGuestGuard: CanActivateFn = async () => {
  const session = inject(FarmerSession);
  const router = inject(Router);
  const state = await session.ensureLoaded();
  if (state === 'ready') return router.createUrlTree(['/ciftci']);
  if (state === 'dealer') return router.createUrlTree(['/dashboard']);
  return true;
};
