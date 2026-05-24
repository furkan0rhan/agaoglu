import { Routes } from '@angular/router';

export const expenseRoutes: Routes = [
  { path: '', loadComponent: () => import('./expenses.page').then(m => m.ExpensesPage) },
];
