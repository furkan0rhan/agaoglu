import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { Firestore, collection, query, where, limit, getDocs } from '@angular/fire/firestore';
import { AuthService } from '../../../core/auth/services/auth.service';

interface DashboardState {
  dailySales: number;
  weeklySales: number;
  monthlySales: number;
  totalRevenue: number;
  lowStockCount: number;
  expiringCount: number;
  todaySaleCount: number;
  loading: boolean;
}

const initialState: DashboardState = {
  dailySales: 0,
  weeklySales: 0,
  monthlySales: 0,
  totalRevenue: 0,
  lowStockCount: 0,
  expiringCount: 0,
  todaySaleCount: 0,
  loading: false,
};

export const DashboardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, firestore = inject(Firestore), auth = inject(AuthService)) => ({
    async loadStats(): Promise<void> {
      patchState(store, { loading: true });
      try {
        const tenantId = auth.currentTenantId();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayMs = todayStart.getTime();

        const salesSnap = await getDocs(
          query(
            collection(firestore, 'sales'),
            where('tenantId', '==', tenantId),
            limit(500)
          )
        );

        let daily = 0;
        let count = 0;
        salesSnap.forEach(d => {
          const data = d.data();
          const saleMs = data['createdAt']?.toMillis?.() ?? 0;
          if (saleMs >= todayMs) {
            daily += data['totalAmount'] ?? 0;
            count++;
          }
        });

        patchState(store, { dailySales: daily, todaySaleCount: count, loading: false });
      } catch (e) {
        console.error('[Dashboard] loadStats hatası:', e);
        patchState(store, { loading: false });
      }
    },
  }))
);
