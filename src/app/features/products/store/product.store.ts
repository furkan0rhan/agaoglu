import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, EMPTY, timer, retry } from 'rxjs';
import { Product } from '../../../shared/models/product.model';
import { ProductService } from '../services/product.service';

interface ProductState {
  products: Product[];
  selectedProduct: Product | null;
  loading: boolean;
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
  error: null,
  searchQuery: '',
  selectedCategory: null,
  showLowStockOnly: false,
  showExpiringOnly: false,
};

export const ProductStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({ products, searchQuery, selectedCategory, showLowStockOnly, showExpiringOnly }) => ({
    filteredProducts: computed(() => {
      let list = products();
      const q = searchQuery().toLowerCase().trim();
      if (q) {
        list = list.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.barcode.includes(q) ||
          (p.brand?.toLowerCase().includes(q) ?? false) ||
          (p.batches?.some(b => b.gtsNo?.includes(q)) ?? false)
        );
      }
      if (selectedCategory()) {
        list = list.filter(p => p.category === selectedCategory());
      }
      if (showLowStockOnly()) {
        list = list.filter(p => p.stock <= p.minStock);
      }
      if (showExpiringOnly()) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + 30);
        list = list.filter(p => p.expiryDate && p.expiryDate.toDate() <= cutoff);
      }
      return list;
    }),

    lowStockCount: computed(() => products().filter(p => p.stock <= p.minStock).length),

    expiringProducts: computed(() => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + 30);
      return products().filter(p =>
        p.expiryDate && p.expiryDate.toDate() <= cutoff
      );
    }),

    totalInventoryValue: computed(() =>
      products().reduce((sum, p) => sum + p.purchasePrice * p.stock, 0)
    ),
  })),

  withMethods((store, svc = inject(ProductService)) => ({
    loadProducts: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          svc.getAll$().pipe(
            tap(products => patchState(store, { products, loading: false })),
            retry({
              count: 20,
              delay: (err, attempt) => {
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
    ),
    setSearch: (q: string) => patchState(store, { searchQuery: q }),
    setCategory: (c: string | null) => patchState(store, { selectedCategory: c }),
    toggleLowStock: () => patchState(store, { showLowStockOnly: !store.showLowStockOnly() }),
    toggleExpiring: () => patchState(store, { showExpiringOnly: !store.showExpiringOnly() }),
    selectProduct: (p: Product | null) => patchState(store, { selectedProduct: p }),
    findByBarcode: (barcode: string) =>
      store.products().find(p => p.barcode === barcode || p.batches?.some(b => b.gtsNo === barcode)) ?? null,
    clearFilters: () =>
      patchState(store, { searchQuery: '', selectedCategory: null, showLowStockOnly: false, showExpiringOnly: false }),
  }))
);
