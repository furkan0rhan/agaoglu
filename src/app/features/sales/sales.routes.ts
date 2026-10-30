import { Routes } from '@angular/router';

export const salesRoutes: Routes = [
  { path: '', loadComponent: () => import('./sale-list/sale-list.page').then(m => m.SaleListPage) },
  { path: ':id', loadComponent: () => import('./sale-detail/sale-detail.page').then(m => m.SaleDetailPage) },
];
