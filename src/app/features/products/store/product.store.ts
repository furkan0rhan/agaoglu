import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, EMPTY, timer, retry } from 'rxjs';
import { Product } from '../../../shared/models/product.model';
import { ProductService } from '../services/product.service';
import { TenantSettingsService } from '../../../core/settings/tenant-settings.service';

interface ProductState {
  products: Product[];
  selectedProduct: Product | null;
  loading: boolean;
  /** İlk snapshot geldi mi? (onSnapshot canlı kalır; tekrar yüklemeye gerek yok) */
  loaded: boolean;
  error: string | null;
  searchQuery: string;
  selectedCategory: string | null;
  showLowStockOnly: boolean;
  showExpiringOnly: boolean;
}

const initialState: ProductState = {
  products: [],
  selectedProduct: null,
  loading: false,
  loaded: false,
  error: null,
  searchQuery: '',
  selectedCategory: null,
  showLowStockOnly: false,
  showExpiringOnly: false,
};

export const ProductStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({ products, searchQuery, selectedCategory, showLowStockOnly, showExpiringOnly }, settings = inject(TenantSettingsService)) => {
  /** SKT "yakın" sınırı: bugün + Ayarlar → Satış "SKT uyarı eşiği" (varsayılan 30 gün). Tek kaynak. */
  const expiryCutoff = (): Date => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + settings.expiryWarnDays());
    return cutoff;
  };
  return {
    filteredProducts: computed(() => {
      let list = products();
      const q = searchQuery().toLowerCase().trim();
      if (q) {
        list = list.filter(p =>
          (p.name ?? '').toLowerCase().includes(q) ||
          (p.barcode ?? '').toLowerCase().includes(q) ||
          (p.brand ?? '').toLowerCase().includes(q) ||
          (p.batches ?? []).some(b => (b.gtsNo ?? '').toLowerCase().includes(q))
        );
      }
      if (selectedCategory()) {
        list = list.filter(p => p.category === selectedCategory());
      }
      if (showLowStockOnly()) {
        list = list.filter(p => (p.stock ?? 0) <= (p.minStock ?? 0));
      }
      if (showExpiringOnly()) {
        const cutoff = expiryCutoff();
        list = list.filter(p => !!p.expiryDate?.toDate && p.expiryDate.toDate() <= cutoff);
      }
      return list;
    }),

    lowStockCount: computed(() => products().filter(p => (p.stock ?? 0) <= (p.minStock ?? 0)).length),

    expiringProducts: computed(() => {
      const cutoff = expiryCutoff();
      return products().filter(p =>
        !!p.expiryDate?.toDate && p.expiryDate.toDate() <= cutoff
      );
    }),

    totalInventoryValue: computed(() =>
      products().reduce((sum, p) => sum + p.purchasePrice * p.stock, 0)
    ),
    /** SKT eşikleri (gün) — ürün listesi, dashboard, zil, bildirimler buradan okur. */
    expiryWarnDays: computed(() => settings.expiryWarnDays()),
    expiryCriticalDays: computed(() => settings.expiryCriticalDays()),
  };
  }),

  withMethods((store, svc = inject(ProductService), settings = inject(TenantSettingsService)) => {
    /** Canlı (onSnapshot) ürün aboneliğini (yeniden) başlatır. Mümkünse ensureLoaded() kullanın. */
    const loadProducts = rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          svc.getAll$().pipe(
            tap(products => patchState(store, { products, loading: false, loaded: true })),
            retry({
              count: 20,
              delay: (err, _attempt) => {
                const isBuilding = err?.message?.includes('currently building');
                if (isBuilding) {
                  patchState(store, { loading: true, error: null });
                  return timer(5000);
                }
                patchState(store, { loading: false, error: err?.message ?? 'Ürünler yüklenemedi.' });
                return EMPTY;
              }
            }),
            catchError((err) => {
              patchState(store, { loading: false, error: err?.message ?? 'Ürünler yüklenemedi.' });
              return EMPTY;
            })
          )
        )
      )
    );
    return {
    loadProducts,
    /** Store henüz yüklenmediyse ve yüklenmiyorsa bir kez yükler; canlı abonelik açıkken tekrar okumaz. */
    ensureLoaded: (): void => {
      settings.ensureLoaded(); // SKT eşikleri (idempotent)
      if (store.loaded() || store.loading()) return;
      loadProducts();
    },
    setSearch: (q: string) => patchState(store, { searchQuery: q }),
    setCategory: (c: string | null) => patchState(store, { selectedCategory: c }),
    toggleLowStock: () => patchState(store, { showLowStockOnly: !store.showLowStockOnly() }),
    toggleExpiring: () => patchState(store, { showExpiringOnly: !store.showExpiringOnly() }),
    selectProduct: (p: Product | null) => patchState(store, { selectedProduct: p }),
    findByBarcode: (barcode: string) => {
      const code = barcode?.trim();
      if (!code) return null;
      return store.products().find(p => p.barcode === code || p.batches?.some(b => b.gtsNo === code)) ?? null;
    },
    clearFilters: () =>
      patchState(store, { searchQuery: '', selectedCategory: null, showLowStockOnly: false, showExpiringOnly: false }),
    };
  })
);
