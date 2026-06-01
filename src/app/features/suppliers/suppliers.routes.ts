import { Routes } from '@angular/router';

export const supplierRoutes: Routes = [
  { path: '', loadComponent: () => import('./supplier-list/supplier-list.page').then(m => m.SupplierListPage) },
  { path: 'new', loadComponent: () => import('./supplier-form/supplier-form.page').then(m => m.SupplierFormPage) },
  { path: ':id', loadComponent: () => import('./supplier-detail/supplier-detail.page').then(m => m.SupplierDetailPage) },
  { path: ':id/edit', loadComponent: () => import('./supplier-form/supplier-form.page').then(m => m.SupplierFormPage) },
];
