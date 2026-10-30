import { Routes } from '@angular/router';

export const purchaseRoutes: Routes = [
  { path: '', loadComponent: () => import('./purchase-list/purchase-list.page').then(m => m.PurchaseListPage) },
  // 11.13 Firmaya iade (SKT geçmiş BKÜ, 30 gün)
  { path: 'returns', loadComponent: () => import('./returns/supplier-returns.page').then(m => m.SupplierReturnsPage) },
  { path: 'new', loadComponent: () => import('./purchase-form/purchase-form.page').then(m => m.PurchaseFormPage) },
  { path: ':id', loadComponent: () => import('./purchase-detail/purchase-detail.page').then(m => m.PurchaseDetailPage) },
];
