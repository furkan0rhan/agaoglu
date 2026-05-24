import { Routes } from '@angular/router';

export const settingRoutes: Routes = [
  { path: '', loadComponent: () => import('./profile/profile.page').then(m => m.ProfilePage) },
];
