import { Routes } from '@angular/router';

export const reportRoutes: Routes = [
  { path: '', loadComponent: () => import('./sales-report/sales-report.page').then(m => m.SalesReportPage) },
  // 5.7 Alacak yaşlandırma (yönetici; üst rota roleGuard)
  { path: 'credit-aging', loadComponent: () => import('./credit-aging/credit-aging.page').then(m => m.CreditAgingPage) },
];
