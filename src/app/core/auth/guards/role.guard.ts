import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../../../shared/models/user.model';

/**
 * route.data.roles: izinli roller.
 * route.data.fallback: yetki yoksa yönlendirilecek adres (varsayılan /dashboard).
 */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const requiredRoles: UserRole[] = route.data?.['roles'] ?? [];

  if (requiredRoles.length === 0) return true;
  if (auth.hasRole(...requiredRoles)) return true;

  const fallback: string = route.data?.['fallback'] ?? '/dashboard';
  return router.createUrlTree([fallback]);
};
