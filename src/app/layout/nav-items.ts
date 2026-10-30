import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import type { Translations } from '../core/i18n/translations';
import type { UserRole } from '../shared/models/user.model';

/** Sidebar grubu (C: OPERASYON / ANALİZ / YÖNETİM). */
export type NavGroup = 'ops' | 'analysis' | 'manage';

export interface NavItem {
  title: string;
  /** Alt navigasyon için kısa ad. */
  short: string;
  path: string;
  icon: string;
  roles?: UserRole[];
  /** Yalnız platform yöneticisi (superadmin) görür. */
  superAdminOnly?: boolean;
  group: NavGroup;
}

/** Ana menü (sıra ve roller app.routes.ts ile uyumlu olmalı). */
export function buildNavItems(t: Translations): NavItem[] {
  const n = t.nav;
  return [
    { title: n.dashboard, short: n.home, path: '/dashboard', icon: 'pi-home', group: 'ops' },
    { title: n.pos, short: t.shell.quickSale, path: '/pos', icon: 'pi-shopping-cart', roles: ['admin', 'cashier'], group: 'ops' },
    { title: n.products, short: n.products, path: '/products', icon: 'pi-box', group: 'ops' },
    { title: t.sales.title, short: t.sales.title, path: '/sales', icon: 'pi-receipt', roles: ['admin', 'cashier'], group: 'ops' },
    { title: n.credit, short: n.credit, path: '/credit', icon: 'pi-book', roles: ['admin', 'cashier'], group: 'ops' },
    { title: n.customers, short: n.customers, path: '/customers', icon: 'pi-users', roles: ['admin', 'cashier'], group: 'ops' },
    { title: n.suppliers, short: n.suppliers, path: '/suppliers', icon: 'pi-truck', roles: ['admin'], group: 'ops' },
    { title: t.purchases.title, short: t.purchases.title, path: '/purchases', icon: 'pi-download', roles: ['admin'], group: 'ops' },
    { title: n.expenses, short: n.expenses, path: '/expenses', icon: 'pi-wallet', roles: ['admin'], group: 'ops' },
    { title: n.reports, short: n.reports, path: '/reports', icon: 'pi-chart-bar', roles: ['admin'], group: 'analysis' },
    { title: n.stockCount, short: n.stockCount, path: '/stock-count', icon: 'pi-barcode', roles: ['admin'], group: 'analysis' },
    { title: n.team, short: n.team, path: '/settings/team', icon: 'pi-id-card', roles: ['admin'], group: 'manage' },
    { title: n.settings, short: n.settings, path: '/settings', icon: 'pi-sliders-h', roles: ['admin'], group: 'manage' },
    { title: n.adminPanel, short: n.adminPanel, path: '/admin', icon: 'pi-shield', superAdminOnly: true, group: 'manage' },
  ];
}

/** Rol filtresi. Kullanıcı henüz yüklenmediyse tüm öğeler (eski davranış). */
export function filterByRole(items: NavItem[], role: UserRole | undefined | null, isSuperAdmin = false): NavItem[] {
  const visible = items.filter(i => !i.superAdminOnly || isSuperAdmin);
  if (!role) return visible;
  return visible.filter(i => !i.roles || i.roles.includes(role));
}

/** Rotaya göre aktiflik: tam eşleşme ya da alt yol. */
export function isPathActive(url: string, path: string): boolean {
  const clean = url.split(/[?#]/)[0];
  return clean === path || clean.startsWith(path + '/');
}

/** URL'ye en uzun eşleşen öğe (ör. /settings/team → "Ekip", "Ayarlar" değil). */
export function bestMatch(items: NavItem[], url: string): NavItem | null {
  let best: NavItem | null = null;
  for (const i of items) {
    if (isPathActive(url, i.path) && (!best || i.path.length > best.path.length)) best = i;
  }
  return best;
}

/** Sidebar grupları sırasıyla (boş grup atlanır). */
export function groupNavItems(items: NavItem[], t: Translations): { key: NavGroup; label: string; items: NavItem[] }[] {
  const labels: Record<NavGroup, string> = { ops: t.shell.groupOps, analysis: t.shell.groupAnalysis, manage: t.shell.groupManage };
  return (['ops', 'analysis', 'manage'] as NavGroup[])
    .map(key => ({ key, label: labels[key], items: items.filter(i => i.group === key) }))
    .filter(g => g.items.length > 0);
}

/** Router URL'sini sinyal olarak verir (injection context içinde çağırın). */
export function injectCurrentUrl() {
  const router = inject(Router);
  return toSignal(
    router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
    ),
    { initialValue: router.url },
  );
}

/** Rol adı (çeviri). */
export function roleLabel(t: Translations, role: UserRole | undefined | null): string {
  const n = t.nav;
  const map: Record<UserRole, string> = { admin: n.admin, cashier: n.cashier, staff: n.staff };
  return role ? map[role] ?? '' : '';
}

/** "ali VELİ" → "Ali Veli" (Türkçe kurallarıyla). */
export function formatDisplayName(name: string | null | undefined): string {
  return (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toLocaleUpperCase('tr') + w.slice(1).toLocaleLowerCase('tr'))
    .join(' ');
}
