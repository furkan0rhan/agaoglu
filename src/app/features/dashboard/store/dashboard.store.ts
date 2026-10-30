import { signalStore, withState, withComputed, withMethods, withHooks, patchState } from '@ngrx/signals';
import { computed, inject } from '@angular/core';
import { Sale } from '../../../shared/models/sale.model';
import { ProductStore } from '../../products/store/product.store';
import { getPeriodRange, isInRange, endOfDay } from '../../../shared/utils/date-range.util';
import { ReportDataService } from '../../reports/services/report-data.service';
import { summarizeSales, productMap, toDate } from '../../reports/services/report-calc';
import { AuthService } from '../../../core/auth/services/auth.service';
import { userErrorMessage } from '../../../core/error/user-error';

interface DashboardState {
  /** Bu hafta + bu ay aralığındaki tamamlanmış satışlar (yeniden eskiye). */
  sales: Sale[];
  loadedAt: number;
  loading: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  sales: [],
  loadedAt: 0,
  loading: false,
  error: null,
};

function salesIn(sales: Sale[], period: 'today' | 'week' | 'month', now: Date): Sale[] {
  const range = getPeriodRange(period, now);
  return sales.filter(s => {
    const d = toDate(s.createdAt);
    return !!d && isInRange(d, range);
  });
}

export const DashboardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ sales, loadedAt }, productStore = inject(ProductStore)) => {
    const now = computed(() => new Date(loadedAt() || Date.now()));
    const products = computed(() => productMap(productStore.products()));
    const today = computed(() => summarizeSales(salesIn(sales(), 'today', now()), products()));
    const week = computed(() => summarizeSales(salesIn(sales(), 'week', now()), products()));
    const month = computed(() => summarizeSales(salesIn(sales(), 'month', now()), products()));
    return {
      dailySales: computed(() => today().revenue),
      todaySaleCount: computed(() => today().saleCount),
      todayGrossProfit: computed(() => today().grossProfit),
      /** Bugünkü net satış (KDV hariç) — brüt marj paydası. */
      todayNetSales: computed(() => today().netRevenue),
      todayCostEstimated: computed(() => today().costEstimated),
      weeklySales: computed(() => week().revenue),
      monthlySales: computed(() => month().revenue),
      recentSales: computed(() => sales().slice(0, 5)),
      // Sayaçlar her zaman filtresiz ürün listesinden (ürün sayfası filtreleri sızmasın)
      totalProductCount: computed(() => productStore.products().length),
      lowStockCount: computed(() => productStore.products().filter(p => p.stock <= p.minStock).length),
      expiringCount: computed(() => productStore.expiringProducts().length),
    };
  }),
  withMethods((store, data = inject(ReportDataService), auth = inject(AuthService)) => ({
    async loadStats(): Promise<void> {
      const key = auth.sessionKey();
      if (!auth.currentTenantId()) return;
      patchState(store, { loading: true, error: null });
      try {
        const now = new Date();
        const week = getPeriodRange('week', now);
        const month = getPeriodRange('month', now);
        const start = week.start < month.start ? week.start : month.start;
        const sales = await data.getSales({ start, end: endOfDay(now) });
        // Bu arada oturum değiştiyse (çıkış / başka işletme) eski işletmenin satışlarını yazma (Y1)
        if (auth.sessionKey() !== key) return;
        patchState(store, { sales, loadedAt: now.getTime(), loading: false });
      } catch (e) {
        console.error('[Dashboard] loadStats hatası:', e);
        if (auth.sessionKey() !== key) return;
        patchState(store, { loading: false, error: userErrorMessage(e, 'error') });
      }
    },
    reset(): void {
      patchState(store, { ...initialState });
    },
  })),
  withHooks({
    onInit(store, auth = inject(AuthService)) {
      auth.onSessionChange(() => store.reset());
    },
  })
);
