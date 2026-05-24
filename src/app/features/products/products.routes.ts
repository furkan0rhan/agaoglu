import { Routes } from '@angular/router';

export const productRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./product-list/product-list.page').then(m => m.ProductListPage),
  },
  {
    path: 'new',
    loadComponent: () => import('./product-form/product-form.page').then(m => m.ProductFormPage),
  },
  {
    path: ':id',
    loadComponent: () => import('./product-detail/product-detail.page').then(m => m.ProductDetailPage),
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./product-form/product-form.page').then(m => m.ProductFormPage),
  },
  {
    path: ':id/movements',
    loadComponent: () => import('./stock-movements/stock-movements.page').then(m => m.StockMovementsPage),
  },
];
