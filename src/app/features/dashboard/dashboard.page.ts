import { Component, inject, OnInit } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ChipModule } from 'primeng/chip';
import { CurrencyTrPipe } from '../../shared/pipes/currency-tr.pipe';
import { DashboardStore } from './store/dashboard.store';
import { ProductStore } from '../products/store/product.store';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CardModule, TagModule, SkeletonModule, ChipModule, CurrencyTrPipe],
  template: `
    <div class="flex flex-col h-full overflow-auto bg-gray-50">

      <!-- Page header -->
      <div class="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 class="text-xl font-bold text-gray-800">Dashboard</h1>
          <p class="text-sm text-gray-400 mt-0.5">{{ today }}</p>
        </div>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-6">

        <!-- Stat cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">

          <div class="bg-white rounded-2xl p-5 shadow-soft border border-gray-50">
            <div class="flex items-start justify-between mb-3">
              <div class="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center">
                <i class="pi pi-dollar text-green-600 text-lg"></i>
              </div>
              <span class="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Bugün</span>
            </div>
            @if (dashStore.loading()) {
              <p-skeleton height="28px" styleClass="mb-1"></p-skeleton>
              <p-skeleton height="14px" width="60%"></p-skeleton>
            } @else {
              <p class="text-2xl font-bold text-gray-800">{{ dashStore.dailySales() | currencyTr }}</p>
              <p class="text-xs text-gray-400 mt-1">{{ dashStore.todaySaleCount() }} işlem</p>
            }
            <p class="text-sm font-medium text-gray-500 mt-2">Bugünkü Satış</p>
          </div>

          <div class="bg-white rounded-2xl p-5 shadow-soft border border-gray-50">
            <div class="flex items-start justify-between mb-3">
              <div class="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
                <i class="pi pi-box text-blue-600 text-lg"></i>
              </div>
            </div>
            <p class="text-2xl font-bold text-gray-800">{{ productStore.filteredProducts().length }}</p>
            <p class="text-xs text-gray-400 mt-1">aktif ürün</p>
            <p class="text-sm font-medium text-gray-500 mt-2">Toplam Ürün</p>
          </div>

          <div class="bg-white rounded-2xl p-5 shadow-soft border border-gray-50"
            [class.border-amber-200]="productStore.lowStockCount() > 0"
            [class.bg-amber-50]="productStore.lowStockCount() > 0">
            <div class="flex items-start justify-between mb-3">
              <div class="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
                <i class="pi pi-exclamation-triangle text-amber-500 text-lg"></i>
              </div>
              @if (productStore.lowStockCount() > 0) {
                <span class="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Uyarı</span>
              }
            </div>
            <p class="text-2xl font-bold" [class.text-amber-600]="productStore.lowStockCount() > 0" [class.text-gray-800]="productStore.lowStockCount() === 0">
              {{ productStore.lowStockCount() }}
            </p>
            <p class="text-xs text-gray-400 mt-1">ürün</p>
            <p class="text-sm font-medium text-gray-500 mt-2">Kritik Stok</p>
          </div>

          <div class="bg-white rounded-2xl p-5 shadow-soft border border-gray-50"
            [class.border-red-200]="productStore.expiringProducts().length > 0"
            [class.bg-red-50]="productStore.expiringProducts().length > 0">
            <div class="flex items-start justify-between mb-3">
              <div class="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center">
                <i class="pi pi-calendar-times text-red-500 text-lg"></i>
              </div>
              @if (productStore.expiringProducts().length > 0) {
                <span class="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Dikkat</span>
              }
            </div>
            <p class="text-2xl font-bold" [class.text-red-600]="productStore.expiringProducts().length > 0" [class.text-gray-800]="productStore.expiringProducts().length === 0">
              {{ productStore.expiringProducts().length }}
            </p>
            <p class="text-xs text-gray-400 mt-1">30 gün içinde</p>
            <p class="text-sm font-medium text-gray-500 mt-2">Son Kullanma</p>
          </div>
        </div>

        <!-- Low stock warning -->
        @if (productStore.lowStockCount() > 0) {
          <div class="bg-white rounded-2xl p-5 shadow-soft border border-amber-100">
            <div class="flex items-center gap-2 mb-4">
              <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <i class="pi pi-exclamation-triangle text-amber-600 text-sm"></i>
              </div>
              <h3 class="font-semibold text-gray-800">Kritik Stok Uyarısı</h3>
            </div>
            <div class="flex flex-wrap gap-2">
              @for (p of lowStockProducts(); track p.id) {
                <p-chip
                  [label]="p.name + ' — ' + p.stock + ' adet'"
                  [class]="p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'"
                ></p-chip>
              }
            </div>
          </div>
        }

        <!-- Expiring products -->
        @if (productStore.expiringProducts().length > 0) {
          <div class="bg-white rounded-2xl p-5 shadow-soft border border-red-100">
            <div class="flex items-center gap-2 mb-4">
              <div class="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <i class="pi pi-calendar-times text-red-600 text-sm"></i>
              </div>
              <h3 class="font-semibold text-gray-800">Son Kullanma Tarihi Yaklaşan Ürünler</h3>
            </div>
            <div class="flex flex-col gap-2">
              @for (p of productStore.expiringProducts(); track p.id) {
                <div class="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                  <div>
                    <p class="text-sm font-semibold text-gray-800 m-0">{{ p.name }}</p>
                    <p class="text-xs text-gray-400 m-0">{{ p.barcode }}{{ p.brand ? ' · ' + p.brand : '' }}</p>
                  </div>
                  <span
                    class="text-xs font-bold px-2.5 py-1 rounded-lg"
                    [class.bg-red-100]="expiryUrgent(p)"
                    [class.text-red-700]="expiryUrgent(p)"
                    [class.bg-amber-100]="!expiryUrgent(p)"
                    [class.text-amber-700]="!expiryUrgent(p)"
                  >{{ expiryText(p) }}</span>
                </div>
              }
            </div>
          </div>
        }

      </div>
    </div>
  `,
})
export class DashboardPage implements OnInit {
  readonly dashStore = inject(DashboardStore);
  readonly productStore = inject(ProductStore);

  readonly today = new Date().toLocaleDateString('tr-TR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  ngOnInit(): void {
    this.dashStore.loadStats();
    this.productStore.loadProducts();
  }

  lowStockProducts() {
    return this.productStore.filteredProducts().filter(p => p.stock <= p.minStock).slice(0, 10);
  }

  expiryDays(p: { expiryDate: any }): number {
    return Math.ceil((p.expiryDate.toDate().getTime() - Date.now()) / 86400000);
  }

  expiryText(p: { expiryDate: any }): string {
    const d = this.expiryDays(p);
    if (d < 0) return 'SKT geçmiş';
    if (d === 0) return 'Bugün son';
    return `${d} gün kaldı`;
  }

  expiryUrgent(p: { expiryDate: any }): boolean {
    return this.expiryDays(p) <= 7;
  }
}
