import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Permissions, permissionsFor } from '../permissions';

/**
 * route.data.permission: gereken yetki (permissions.ts, ör. 'seeCosts'). Yönetici her zaman geçer.
 * route.data.fallback: yetki yoksa yönlendirilecek adres (varsayılan /dashboard).
 */
export const permissionGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const key = route.data?.['permission'] as keyof Permissions | undefined;
  const u = auth.currentUser();
  if (!key || permissionsFor(u?.role, u?.permissions)[key]) return true;
  return inject(Router).createUrlTree([route.data?.['fallback'] ?? '/dashboard']);
};
