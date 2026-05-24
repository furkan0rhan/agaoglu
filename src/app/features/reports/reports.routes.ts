import { Routes } from '@angular/router';

export const reportRoutes: Routes = [
  { path: '', loadComponent: () => import('./sales-report/sales-report.page').then(m => m.SalesReportPage) },
];
