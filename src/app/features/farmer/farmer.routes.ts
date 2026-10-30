import { Routes } from '@angular/router';
import { farmerGuard, farmerGuestGuard } from './auth/farmer.guard';

/**
 * /ciftci/** — çiftçi alanı (ayrı lazy chunk; bayi uygulamasının kodunu indirmez, bayi kabuğunu yüklemez).
 * Ekranlar: docs/CIFTCI-MODULU.md §6.2.
 */
export const farmerRoutes: Routes = [
  {
    path: 'giris',
    canActivate: [farmerGuestGuard],
    loadComponent: () => import('./pages/login.page').then(m => m.FarmerLoginPage),
  },
  {
    // Davet sayfası korumasız: oturumu açık çiftçi de ikinci bayinin davetini kabul edebilir
    path: 'davet/:code',
    loadComponent: () => import('./pages/invite.page').then(m => m.FarmerInvitePage),
  },
  {
    path: '',
    canActivate: [farmerGuard],
    loadComponent: () => import('./layout/farmer-layout.component').then(m => m.FarmerLayoutComponent),
    children: [
      { path: '', loadComponent: () => import('./pages/home.page').then(m => m.FarmerHomePage) },
      { path: 'tarlalar', loadComponent: () => import('./pages/fields.page').then(m => m.FarmerFieldsPage) },
      { path: 'tarlalar/yeni', loadComponent: () => import('./pages/field-form.page').then(m => m.FarmerFieldFormPage) },
      { path: 'tarlalar/:id', loadComponent: () => import('./pages/fields.page').then(m => m.FarmerFieldDetailPage) },
      { path: 'tarlalar/:id/duzenle', loadComponent: () => import('./pages/field-form.page').then(m => m.FarmerFieldFormPage) },
      { path: 'tarlalar/:id/sezon/yeni', loadComponent: () => import('./pages/season-form.page').then(m => m.FarmerSeasonFormPage) },
      { path: 'tarlalar/:id/sezon/:sid', loadComponent: () => import('./pages/season-form.page').then(m => m.FarmerSeasonFormPage) },
      { path: 'kayit/yeni', loadComponent: () => import('./pages/log-form.page').then(m => m.FarmerLogFormPage) },
      { path: 'defter', loadComponent: () => import('./pages/logbook.page').then(m => m.FarmerLogbookPage) },
      { path: 'ambar', loadComponent: () => import('./pages/barn.page').then(m => m.FarmerBarnPage) },
      { path: 'borc', loadComponent: () => import('./pages/debts.page').then(m => m.FarmerDebtsPage) },
      { path: 'borc/:tenantId', loadComponent: () => import('./pages/debts.page').then(m => m.FarmerDebtDetailPage) },
      { path: 'oneriler', loadComponent: () => import('./pages/recommendations.page').then(m => m.FarmerRecommendationsPage) },
      { path: 'ayarlar', loadComponent: () => import('./pages/settings.page').then(m => m.FarmerSettingsPage) },
      { path: 'izinler', redirectTo: 'ayarlar' },
      { path: '**', redirectTo: '' },
    ],
  },
];
