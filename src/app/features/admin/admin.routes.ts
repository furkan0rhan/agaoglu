import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  { path: '', loadComponent: () => import('./admin-dashboard.page').then(m => m.AdminDashboardPage) },
  { path: 'tenants/:id', loadComponent: () => import('./tenant-detail.page').then(m => m.TenantDetailPage) },
];
