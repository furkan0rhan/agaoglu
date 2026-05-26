import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProductStore } from '../store/product.store';
import { CartStore } from '../../pos/store/cart.store';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { BarcodeInputDirective } from '../../../shared/directives/barcode-input.directive';
import { Product } from '../../../shared/models/product.model';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    RouterLink, FormsModule, CurrencyTrPipe, BarcodeInputDirective,
    ButtonModule, InputTextModule, TagModule, SkeletonModule,
    IconFieldModule, InputIconModule, SelectButtonModule, ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast position="top-right"></p-toast>
    <div class="flex flex-col h-full bg-gray-50" appBarcodeInput (barcodeDetected)="onBarcode($event)">

      <!-- Header -->
      <div class="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <h1 class="text-xl font-bold text-gray-800">Ürünler</h1>
        <p-button label="Yeni Ürün" icon="pi pi-plus" [routerLink]="['new']" severity="success" size="small"></p-button>
      </div>

      <!-- Filters -->
      <div class="bg-white border-b border-gray-100 px-6 py-3 flex flex-wrap items-center gap-3 flex-shrink-0">
        <p-iconfield class="flex-1 min-w-52">
          <p-inputicon styleClass="pi pi-search" />
          <input
            pInputText
            [(ngModel)]="searchVal"
            (ngModelChange)="store.setSearch($event)"
            placeholder="Ürün adı, barkod veya marka ara..."
            class="w-full text-sm"
          />
        </p-iconfield>

        <div class="flex items-center gap-2 flex-wrap">
          <button
            (click)="store.setCategory(null)"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            [class.bg-green-600]="!store.selectedCategory()"
            [class.text-white]="!store.selectedCategory()"
            [class.bg-gray-100]="store.selectedCategory()"
            [class.text-gray-600]="store.selectedCategory()"
          >Tümü</button>
          @for (cat of uniqueCategories(); track cat) {
            <button
              (click)="store.setCategory(cat)"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              [class.bg-green-600]="store.selectedCategory() === cat"
              [class.text-white]="store.selectedCategory() === cat"
              [class.bg-gray-100]="store.selectedCategory() !== cat"
              [class.text-gray-600]="store.selectedCategory() !== cat"
            >{{ cat }}</button>
          }
          <button
            (click)="store.toggleLowStock()"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
            [class.bg-amber-500]="store.showLowStockOnly()"
            [class.text-white]="store.showLowStockOnly()"
            [class.bg-gray-100]="!store.showLowStockOnly()"
            [class.text-gray-600]="!store.showLowStockOnly()"
          >
            <i class="pi pi-exclamation-triangle text-xs"></i> Kritik Stok
          </button>
          <button
            (click)="store.toggleExpiring()"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
            [class.bg-red-500]="store.showExpiringOnly()"
            [class.text-white]="store.showExpiringOnly()"
            [class.bg-gray-100]="!store.showExpiringOnly()"
            [class.text-gray-600]="!store.showExpiringOnly()"
          >
            <i class="pi pi-calendar-times text-xs"></i> Yakın SKT
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-auto p-6">
        @if (store.error()) {
          <div class="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <i class="pi pi-exclamation-circle text-red-500 text-lg"></i>
            <div>
              <p class="text-sm font-semibold text-red-700 m-0">Ürünler yüklenemedi</p>
              <p class="text-xs text-red-500 m-0">{{ store.error() }}</p>
            </div>
          </div>
        }
        @if (store.loading()) {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            @for (i of [1,2,3,4,5,6,7,8]; track i) {
              <div class="bg-white rounded-2xl p-4 shadow-soft border border-gray-50">
                <p-skeleton height="16px" styleClass="mb-3"></p-skeleton>
                <p-skeleton height="12px" width="60%" styleClass="mb-2"></p-skeleton>
                <p-skeleton height="12px" width="40%"></p-skeleton>
              </div>
            }
          </div>
        } @else if (store.filteredProducts().length === 0) {
          <div class="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
            <i class="pi pi-box text-5xl opacity-30"></i>
            <p class="text-base">Ürün bulunamadı</p>
            <p-button label="Ürün Ekle" icon="pi pi-plus" [routerLink]="['new']" severity="success" outlined size="small"></p-button>
          </div>
        } @else {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            @for (product of store.filteredProducts(); track product.id) {
              <a
                [routerLink]="[product.id]"
                class="product-card bg-white rounded-2xl p-4 shadow-soft border border-gray-50 hover:shadow-card hover:-translate-y-0.5 transition-all duration-200 cursor-pointer block"
                [class.border-l-4]="product.stock <= product.minStock"
                [class.border-l-amber-400]="product.stock > 0 && product.stock <= product.minStock"
                [class.border-l-red-400]="product.stock === 0"
              >
                <div class="flex items-start justify-between mb-2">
                  <p class="font-semibold text-gray-800 text-sm leading-snug">{{ product.name }}</p>
                  <p-tag
                    [value]="product.stock + ' adet'"
                    [severity]="getTagSeverity(product.stock, product.minStock)"
                    styleClass="text-xs ml-2 flex-shrink-0"
                  ></p-tag>
                </div>
                <p class="text-xs text-gray-400 font-mono mb-1">{{ product.barcode }}</p>
                @if (product.brand) {
                  <p class="text-xs text-gray-500 mb-1">{{ product.brand }}</p>
                }
                @if (expiryText(product)) {
                  <span
                    class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md mb-1"
                    [class.bg-red-100]="expiryUrgent(product)"
                    [class.text-red-700]="expiryUrgent(product)"
                    [class.bg-amber-100]="!expiryUrgent(product)"
                    [class.text-amber-700]="!expiryUrgent(product)"
                  >
                    <i class="pi pi-calendar-times" style="font-size:10px;"></i>
                    {{ expiryText(product) }}
                  </span>
                }
                <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <div class="flex flex-col">
                    <span class="text-xs text-gray-400">Satış Fiyatı</span>
                    <span class="text-sm font-bold text-green-700">{{ product.salePrice | currencyTr }}</span>
                  </div>
                  @if (cartQty(product.id) === 0) {
                    <button
                      (click)="addToCart(product, $event)"
                      [disabled]="product.stock <= 0"
                      class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      [class.bg-orange-500]="product.stock > 0"
                      [class.text-white]="product.stock > 0"
                      [class.bg-gray-100]="product.stock <= 0"
                      [class.text-gray-400]="product.stock <= 0"
                      [class.cursor-not-allowed]="product.stock <= 0"
                    >
                      <i class="pi pi-cart-plus text-xs"></i>
                      Sepete Ekle
                    </button>
                  } @else {
                    <div
                      (click)="$event.preventDefault(); $event.stopPropagation()"
                      class="flex items-center gap-1"
                    >
                      <button
                        (click)="decrease(product, $event)"
                        class="w-7 h-7 rounded-lg border border-orange-200 bg-orange-50 text-orange-600 flex items-center justify-center hover:bg-orange-100 transition-colors"
                      ><i class="pi pi-minus" style="font-size:10px;"></i></button>
                      <span class="text-sm font-bold text-orange-600 min-w-6 text-center">{{ cartQty(product.id) }}</span>
                      <button
                        (click)="increase(product, $event)"
                        [disabled]="cartQty(product.id) >= product.stock"
                        class="w-7 h-7 rounded-lg border flex items-center justify-center transition-colors"
                        [class.border-orange-200]="cartQty(product.id) < product.stock"
                        [class.bg-orange-500]="cartQty(product.id) < product.stock"
                        [class.text-white]="cartQty(product.id) < product.stock"
                        [class.hover:bg-orange-600]="cartQty(product.id) < product.stock"
                        [class.border-gray-200]="cartQty(product.id) >= product.stock"
                        [class.bg-gray-100]="cartQty(product.id) >= product.stock"
                        [class.text-gray-300]="cartQty(product.id) >= product.stock"
                        [class.cursor-not-allowed]="cartQty(product.id) >= product.stock"
                      ><i class="pi pi-plus" style="font-size:10px;"></i></button>
                    </div>
                  }
                </div>
                @if (product.stock <= product.minStock) {
                  <div class="flex items-center gap-1 mt-2 text-amber-600 text-xs font-semibold">
                    <i class="pi pi-exclamation-triangle text-xs"></i> Kritik stok
                  </div>
                }
              </a>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class ProductListPage implements OnInit {
  readonly store = inject(ProductStore);
  private readonly cart = inject(CartStore);
  private readonly toast = inject(MessageService);
  readonly uniqueCategories = computed(() =>
    [...new Set(this.store.products().map(p => p.category).filter(Boolean))].sort()
  );
  searchVal = '';

  ngOnInit(): void { this.store.loadProducts(); }

  onBarcode(barcode: string): void { this.store.setSearch(barcode); }

  cartQty(productId: string): number {
    return this.cart.items().find(i => i.productId === productId)?.quantity ?? 0;
  }

  addToCart(product: Product, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (product.stock <= 0) return;
    this.cart.addItem({
      productId: product.id,
      productName: product.name,
      barcode: product.barcode,
      quantity: 1,
      unitPrice: product.salePrice,
      discount: 0,
      discountType: 'percent',
      totalPrice: product.salePrice,
      stock: product.stock,
    });
    this.toast.add({ severity: 'success', summary: '', detail: `${product.name} sepete eklendi`, life: 2000 });
  }

  increase(product: Product, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const item = this.cart.items().find(i => i.productId === product.id);
    if (!item || item.quantity >= product.stock) return;
    this.cart.updateQuantity(item._tempId, item.quantity + 1);
  }

  decrease(product: Product, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const item = this.cart.items().find(i => i.productId === product.id);
    if (!item) return;
    this.cart.updateQuantity(item._tempId, item.quantity - 1);
  }

  private expiryDays(product: Product): number | null {
    if (!product.expiryDate) return null;
    const days = Math.ceil((product.expiryDate.toDate().getTime() - Date.now()) / 86400000);
    return days <= 30 ? days : null;
  }

  expiryText(product: Product): string | null {
    const d = this.expiryDays(product);
    if (d === null) return null;
    if (d < 0) return 'SKT geçmiş';
    if (d === 0) return 'Bugün son';
    return `SKT: ${d} gün`;
  }

  expiryUrgent(product: Product): boolean {
    const d = this.expiryDays(product);
    return d !== null && d <= 7;
  }

  getTagSeverity(stock: number, minStock: number): 'danger' | 'warn' | 'success' {
    if (stock === 0) return 'danger';
    if (stock <= minStock) return 'warn';
    return 'success';
  }
}
