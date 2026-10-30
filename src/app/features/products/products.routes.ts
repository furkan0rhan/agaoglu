import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/guards/role.guard';

/** Y5: ürün ekleme / düzenleme (fiyat) yalnız yönetici; diğer roller listeye döner. */
const adminOnly = { canActivate: [roleGuard], data: { roles: ['admin'], fallback: '/products' } };

export const productRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./product-list/product-list.page').then(m => m.ProductListPage),
  },
  {
    path: 'new',
    ...adminOnly,
    loadComponent: () => import('./product-form/product-form.page').then(m => m.ProductFormPage),
  },
  {
    path: ':id',
    loadComponent: () => import('./product-detail/product-detail.page').then(m => m.ProductDetailPage),
  },
  {
    path: ':id/edit',
    ...adminOnly,
    loadComponent: () => import('./product-form/product-form.page').then(m => m.ProductFormPage),
  },
  {
    path: ':id/movements',
    loadComponent: () => import('./stock-movements/stock-movements.page').then(m => m.StockMovementsPage),
  },
];
