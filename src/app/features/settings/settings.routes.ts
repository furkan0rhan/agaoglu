import { Routes } from '@angular/router';

/**
 * /settings (admin; üst rota roleGuard) — Ayarlar merkezi. Bölüm URL'de: /settings/business, /settings/team,
 * /settings/backup … (eski /settings/team ve /settings/backup bağlantıları ilgili bölümü açar).
 */
export const settingRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'business' },
  { path: ':section', loadComponent: () => import('./settings-center.page').then(m => m.SettingsCenterPage) },
];
