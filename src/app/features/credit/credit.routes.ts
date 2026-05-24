import { Routes } from '@angular/router';

export const creditRoutes: Routes = [
  { path: '', loadComponent: () => import('./credit-list/credit-list.page').then(m => m.CreditListPage) },
  { path: ':customerId', loadComponent: () => import('./credit-detail/credit-detail.page').then(m => m.CreditDetailPage) },
];
