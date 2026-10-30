import { Routes } from '@angular/router';
import { authGuard } from './core/auth/guards/auth.guard';
import { guestGuard } from './core/auth/guards/guest.guard';
import { roleGuard } from './core/auth/guards/role.guard';
import { superAdminGuard } from './core/auth/guards/super-admin.guard';
import { licenseGuard } from './core/license/license.guard';

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
  // Çiftçi modülü: ayrı kabuk + kendi guard'ları (features/farmer/farmer.routes.ts)
  { path: 'ciftci', loadChildren: () => import('./features/farmer/farmer.routes').then(m => m.farmerRoutes) },

  {
    // Platform yöneticisi (superadmin) paneli: kendi yalın kabuğu, işletme verisi yüklemez
    path: 'admin',
    canActivate: [superAdminGuard],
    loadComponent: () => import('./features/admin/admin-shell.component').then(m => m.AdminShellComponent),
    loadChildren: () => import('./features/admin/admin.routes').then(m => m.adminRoutes),
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
        canActivate: [roleGuard, licenseGuard],
        data: { roles: ['admin', 'cashier'] },
        loadComponent: () => import('./features/pos/pos.page').then(m => m.PosPage),
      },
      {
        path: 'sales',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'cashier'] },
        loadChildren: () => import('./features/sales/sales.routes').then(m => m.salesRoutes),
      },
      {
        path: 'customers',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'cashier'] },
        loadChildren: () => import('./features/customers/customers.routes').then(m => m.customerRoutes),
      },
      { path: 'farmers', canActivate: [roleGuard], data: { roles: ['admin', 'cashier'] }, loadComponent: () => import('./features/farmers/farmers.page').then(m => m.FarmersPage) },
      {
        path: 'credit',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'cashier'] },
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
        path: 'suppliers',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadChildren: () => import('./features/suppliers/suppliers.routes').then(m => m.supplierRoutes),
      },
      {
        path: 'purchases',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadChildren: () => import('./features/purchases/purchases.routes').then(m => m.purchaseRoutes),
      },
      {
        path: 'stock-count',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('./features/stock-count/stock-count.page').then(m => m.StockCountPage),
      },
      {
        path: 'settings',
        canActivate: [roleGuard],
        data: { roles: ['admin'], fallback: '/account' },
        loadChildren: () => import('./features/settings/settings.routes').then(m => m.settingRoutes),
      },
      {
        // Lisans durumu / süresi doldu ekranı
        path: 'license',
        loadComponent: () => import('./core/license/license-expired.page').then(m => m.LicenseExpiredPage),
      },
      {
        // Tüm roller: kendi profil/şifre (5.2)
        path: 'account',
        loadComponent: () => import('./features/settings/settings-center.page').then(m => m.SettingsCenterPage),
      },
    ],
  },

  { path: '**', redirectTo: 'dashboard' },
];
