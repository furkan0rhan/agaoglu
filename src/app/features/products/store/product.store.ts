import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, withHooks, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, EMPTY, timer, retry } from 'rxjs';
import { Product } from '../../../shared/models/product.model';
import { ProductService } from '../services/product.service';
import { TenantSettingsService } from '../../../core/settings/tenant-settings.service';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { userErrorMessage } from '../../../core/error/user-error';

interface ProductState {
  products: Product[];
  loading: boolean;
  /** İlk snapshot geldi mi? (onSnapshot canlı kalır; tekrar yüklemeye gerek yok) */
  loaded: boolean;
  error: string | null;
  /** Verinin ait olduğu oturum (`uid|tenantId`). Oturum değişince store sıfırlanır (Y1). */
  sessionKey: string;
  searchQuery: string;
  selectedCategory: string | null;
  showLowStockOnly: boolean;
  showExpiringOnly: boolean;
}

const initialState: ProductState = {
  products: [],
  loading: false,
  loaded: false,
  error: null,
  sessionKey: '',
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

  withMethods((store, svc = inject(ProductService), settings = inject(TenantSettingsService),
    auth = inject(AuthService), lang = inject(LangService)) => {
    const failText = () => userErrorMessage(null, lang.t().products.loadError, lang.lang());
    const errorText = (err: unknown) => userErrorMessage(err, lang.t().products.loadError, lang.lang());
    /**
     * Canlı (onSnapshot) ürün aboneliği. `true`: (yeniden) başlat · `false`: aboneliği kapat (oturum sıfırlama).
     * switchMap önceki aboneliği her çağrıda kapatır.
     */
    const subscription = rxMethod<boolean>(
      pipe(
        tap(on => { if (on) patchState(store, { loading: true, error: null }); }),
        switchMap(on => !on ? EMPTY :
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
                patchState(store, { loading: false, error: errorText(err) });
                return EMPTY;
              }
            }),
            catchError((err) => {
              patchState(store, { loading: false, error: err ? errorText(err) : failText() });
              return EMPTY;
            })
          )
        )
      )
    );
    /** Store'u boş duruma döndürür ve canlı aboneliği kapatır (çıkış / kullanıcı ya da işletme değişimi). */
    const reset = (): void => {
      subscription(false);
      patchState(store, { ...initialState });
    };
    /** Geçerli oturum için aboneliği başlatır. */
    const loadProducts = (): void => {
      if (!auth.currentTenantId()) return;
      patchState(store, { sessionKey: auth.sessionKey() });
      subscription(true);
    };
    return {
    loadProducts,
    reset,
    /**
     * Store henüz bu oturum için yüklenmediyse bir kez yükler; canlı abonelik açıkken tekrar okumaz.
     * Başka oturumun (önceki kullanıcı/işletme) verisi duruyorsa önce sıfırlar.
     */
    ensureLoaded: (): void => {
      settings.ensureLoaded(); // SKT eşikleri (idempotent)
      const key = auth.sessionKey();
      if (!key || !auth.currentTenantId()) return;
      if (store.sessionKey() === key && (store.loaded() || store.loading())) return;
      if (store.sessionKey() !== key) reset();
      loadProducts();
    },
    setSearch: (q: string) => patchState(store, { searchQuery: q }),
    setCategory: (c: string | null) => patchState(store, { selectedCategory: c }),
    toggleLowStock: () => patchState(store, { showLowStockOnly: !store.showLowStockOnly() }),
    toggleExpiring: () => patchState(store, { showExpiringOnly: !store.showExpiringOnly() }),
    findByBarcode: (barcode: string) => {
      const code = barcode?.trim();
      if (!code) return null;
      return store.products().find(p => p.barcode === code || p.batches?.some(b => b.gtsNo === code)) ?? null;
    },
    clearFilters: () =>
      patchState(store, { searchQuery: '', selectedCategory: null, showLowStockOnly: false, showExpiringOnly: false }),
    };
  }),

  withHooks({
    onInit(store, auth = inject(AuthService)) {
      // Y1: oturum (uid/tenantId) değişince önceki işletmenin ürünleri (alış fiyatlarıyla) bellekte kalmasın.
      // Abonelik açıktıysa yeni işletme için hemen yeniden başlat (açık ekranlar boş kalmasın).
      auth.onSessionChange(() => {
        const wasActive = store.loaded() || store.loading();
        store.reset();
        if (wasActive) store.ensureLoaded();
      });
    },
  })
);
