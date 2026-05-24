import { Routes } from '@angular/router';
import { authGuard } from './core/auth/guards/auth.guard';
import { guestGuard } from './core/auth/guards/guest.guard';
import { roleGuard } from './core/auth/guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.authRoutes),
  },
  {
    path: 'verify-email',
    canActivate: [authGuard],
    loadComponent: () => import('./features/auth/verify-email/verify-email.page').then(m => m.VerifyEmailPage),
  },

  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.page').then(m => m.DashboardPage),
      },
      {
        path: 'products',
        loadChildren: () => import('./features/products/products.routes').then(m => m.productRoutes),
      },
      {
        path: 'pos',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'cashier'] },
        loadComponent: () => import('./features/pos/pos.page').then(m => m.PosPage),
      },
      {
        path: 'customers',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'cashier'] },
        loadChildren: () => import('./features/customers/customers.routes').then(m => m.customerRoutes),
      },
      {
        path: 'credit',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadChildren: () => import('./features/credit/credit.routes').then(m => m.creditRoutes),
      },
      {
        path: 'reports',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadChildren: () => import('./features/reports/reports.routes').then(m => m.reportRoutes),
      },
      {
        path: 'expenses',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadChildren: () => import('./features/expenses/expenses.routes').then(m => m.expenseRoutes),
      },
      {
        path: 'settings',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadChildren: () => import('./features/settings/settings.routes').then(m => m.settingRoutes),
      },
    ],
  },

  { path: '**', redirectTo: 'dashboard' },
];
