import type { TourDef, TourId } from './onboarding.model';

/**
 * Tur tanımları. Metinler `onboarding.i18n.ts` → `tours[id][step.key]`.
 * `target` = ekrandaki `data-tour="..."` adı; dizi verilirse ilk görünen (masaüstü sidebar ↔ mobil alt çubuk).
 * Adım ekleyince turun `version`'ını artırın ve yeni adıma `since: <yeni sürüm>` yazın.
 */
export const TOURS: Record<TourId, TourDef> = {
  'welcome-admin': {
    id: 'welcome-admin', version: 1, area: 'dealer', audience: ['admin'], route: '/dashboard', pages: ['/dashboard'],
    steps: [
      { key: 'hello' },
      { key: 'menu', target: ['sidebar', 'bottom-nav'], side: 'right' },
      { key: 'pos', target: 'nav-pos', side: 'right' },
      { key: 'products', target: 'nav-products', side: 'right' },
      { key: 'credit', target: 'nav-credit', side: 'right' },
      { key: 'reports', target: ['nav-reports', 'nav-more'], side: 'right' },
      { key: 'settings', target: ['nav-settings', 'nav-more'], side: 'right' },
      { key: 'help', target: ['user-menu', 'nav-more'], side: 'bottom', align: 'end' },
    ],
  },
  'welcome-cashier': {
    id: 'welcome-cashier', version: 1, area: 'dealer', audience: ['cashier', 'staff'], route: '/pos', pages: [],
    steps: [
      { key: 'hello' },
      { key: 'search', target: 'pos-search', side: 'bottom' },
      { key: 'cart', target: 'pos-cart', side: 'left' },
      { key: 'pay', target: 'pos-pay', side: 'top' },
      { key: 'credit', target: 'pos-customer', side: 'left' },
      { key: 'help', target: ['user-menu', 'nav-more'], side: 'bottom', align: 'end' },
    ],
  },
  pos: {
    id: 'pos', version: 1, area: 'dealer', audience: ['admin', 'cashier', 'staff'], route: '/pos', pages: ['/pos'],
    steps: [
      { key: 'search', target: 'pos-search', side: 'bottom' },
      { key: 'favorites', target: 'pos-favorites', side: 'bottom' },
      { key: 'cart', target: 'pos-cart', side: 'left' },
      { key: 'pay', target: 'pos-pay', side: 'top' },
      { key: 'credit', target: 'pos-customer', side: 'left' },
      { key: 'receipt', target: 'pos-receipt', side: 'bottom', align: 'start' },
    ],
  },
  farmer: {
    id: 'farmer', version: 1, area: 'farmer', audience: ['farmer'], route: '/ciftci', pages: ['/ciftci'],
    steps: [
      { key: 'hello' },
      { key: 'fields', target: 'farmer-nav-fields', side: 'top' },
      { key: 'logbook', target: 'farmer-nav-logbook', side: 'top' },
      { key: 'dealer', target: 'farmer-nav-dealer', side: 'top' },
      { key: 'account', target: 'farmer-nav-account', side: 'top' },
    ],
  },
  superadmin: {
    id: 'superadmin', version: 1, area: 'admin', audience: ['superadmin'], route: '/admin', pages: ['/admin'],
    steps: [
      { key: 'hello' },
      { key: 'stats', target: 'sa-stats', side: 'bottom' },
      { key: 'tenants', target: 'sa-tenants', side: 'top' },
      { key: 'filters', target: 'sa-filters', side: 'bottom' },
      { key: 'support' },
      { key: 'audit', target: 'sa-audit', side: 'top' },
    ],
  },
};

export const TOUR_LIST: TourDef[] = Object.values(TOURS);
