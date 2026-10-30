import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LicenseService } from './license.service';

/**
 * Yazma ağırlıklı ekranlar (POS vb.) için: lisans dolmuş/askıdaysa "Lisans" ekranına yönlendirir.
 * Asıl koruma Firestore kurallarındadır (licenseOk); bu guard yalnız kullanıcıyı bilgilendirir.
 */
export const licenseGuard: CanActivateFn = () => {
  const license = inject(LicenseService);
  const router = inject(Router);
  return license.readOnly() ? router.createUrlTree(['/license']) : true;
};
