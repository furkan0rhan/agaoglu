import { Routes } from '@angular/router';

export const customerRoutes: Routes = [
  { path: '', loadComponent: () => import('./customer-list/customer-list.page').then(m => m.CustomerListPage) },
  { path: 'new', loadComponent: () => import('./customer-form/customer-form.page').then(m => m.CustomerFormPage) },
  { path: ':id', loadComponent: () => import('./customer-detail/customer-detail.page').then(m => m.CustomerDetailPage) },
  { path: ':id/edit', loadComponent: () => import('./customer-form/customer-form.page').then(m => m.CustomerFormPage) },
];
