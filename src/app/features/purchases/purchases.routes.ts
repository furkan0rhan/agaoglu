import { Routes } from '@angular/router';

export const purchaseRoutes: Routes = [
  { path: '', loadComponent: () => import('./purchase-list/purchase-list.page').then(m => m.PurchaseListPage) },
  { path: 'new', loadComponent: () => import('./purchase-form/purchase-form.page').then(m => m.PurchaseFormPage) },
  { path: ':id', loadComponent: () => import('./purchase-detail/purchase-detail.page').then(m => m.PurchaseDetailPage) },
];
