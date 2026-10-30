import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { injectPermissions } from '../../../core/auth/permissions';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TableModule } from 'primeng/table';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProductStore } from '../store/product.store';
import { ProductService } from '../services/product.service';
import { AddItemResult, CartStore } from '../../pos/store/cart.store';
import { cartItemFromProduct, findByCode } from '../../pos/services/cart-item.utils';
import { isPlantProtection } from '../../../shared/utils/regulatory.utils';
import { BarcodeInputDirective } from '../../../shared/directives/barcode-input.directive';
import { gtinMatches, ScanButtonComponent, ScanResult } from '../../../shared/scanner';
import { Product } from '../../../shared/models/product.model';
import { LangService } from '../../../core/i18n/lang.service';
import { daysUntilExpiry, expiryInfo } from '../../../shared/utils/batch.utils';
import { formatQty } from '../../../shared/utils/product-form.utils';
import {
  EmptyStateComponent, IconButtonComponent, MoneyComponent, PageHeaderComponent, StatusBadgeComponent, UiTone,
} from '../../../shared/ui';
import { qtyWithUnit, unitText } from '../product-unit';
import { productUnit } from '../../../shared/models/product.model';
import { AuthService } from '../../../core/auth/services/auth.service';
import { SumStripComponent, SumStripItem } from '../components/sum-strip.component';
import {
  chipClass, chipCountClass, CRIT_EDGE, formatPct, isCritical, markupPct, productIcon, stockBarClass, stockPct,
} from '../inventory-ui';

/** Telefonda kart listesinde ilk etapta gösterilen ürün sayısı ("Daha fazla göster" ile artar) */
const MOBILE_PAGE = 30;

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    RouterLink, NgTemplateOutlet, FormsModule, BarcodeInputDirective, ScanButtonComponent,
    ButtonModule, InputTextModule, SkeletonModule, IconFieldModule, InputIconModule, ToastModule,
    TableModule, MultiSelectModule,
    PageHeaderComponent, EmptyStateComponent, StatusBadgeComponent, IconButtonComponent, MoneyComponent, SumStripComponent,
  ],
  providers: [MessageService],
  host: { class: 'block' },
  template: `
    <p-toast position="top-right" />
    <div class="flex flex-col" appBarcodeInput (barcodeDetected)="onBarcode($event)">

      <ui-page-header [title]="t().products.title" icon="pi-box" [subtitle]="headerSubtitle()">
        @if (isAdmin) {
          <p-button [label]="inv().stockCount" icon="pi pi-check-square" severity="secondary" routerLink="/stock-count" class="hidden lg:inline-flex" />
          <p-button [label]="inv().stockEntry" icon="pi pi-truck" severity="secondary" routerLink="/purchases/new" class="hidden sm:inline-flex" />
        }
        @if (isAdmin) {
          <p-button [label]="t().products.newProduct" icon="pi pi-plus" routerLink="new" />
        }
      </ui-page-header>

      <div class="page-body">

        <!-- C özet şeridi -->
        <app-sum-strip [items]="summary()" [ariaLabel]="t().products.title" />

        @if (store.error()) {
          <div class="flex items-center gap-3 rounded-token-lg border border-danger-line bg-danger-soft p-4" role="alert">
            <i class="pi pi-exclamation-circle text-lg text-danger-text" aria-hidden="true"></i>
            <div class="min-w-0">
              <p class="m-0 text-sm font-semibold text-danger-text">{{ t().products.loadError }}</p>
              <p class="m-0 break-words text-xs text-fg-secondary">{{ store.error() }}</p>
            </div>
          </div>
        }

        <div class="ui-card overflow-hidden">
          <!-- Filtreler: arama + durum çipleri / kategori çipleri -->
          <div class="flex flex-col gap-2.5 border-b border-line p-3 sm:px-4 sm:py-3.5">
            <div class="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center">
              <div class="flex w-full items-center gap-2 md:w-auto">
              <p-iconfield class="block min-w-0 flex-1 md:w-80 xl:w-96 md:flex-none">
                <p-inputicon styleClass="pi pi-search" />
                <input pInputText type="search" [(ngModel)]="searchVal" (ngModelChange)="store.setSearch($event)"
                       (keydown.enter)="onSearchEnter($event)" enterkeyhint="search"
                       [placeholder]="inv().searchPlaceholder" [attr.aria-label]="t().common.search" class="w-full min-w-0" />
              </p-iconfield>
              <ui-scan-button (scanned)="onCameraScan($event)" />
              </div>
              <div class="-mx-3 flex gap-2 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0"
                   role="toolbar" [attr.aria-label]="inv().statusFilters">
                <button type="button" [class]="chip(store.showLowStockOnly(), true)" [attr.aria-pressed]="store.showLowStockOnly()"
                        (click)="store.toggleLowStock()">
                  <i class="pi pi-exclamation-triangle text-13" aria-hidden="true"></i>{{ inv().criticalStock }}
                  <b [class]="chipCount(store.showLowStockOnly())">{{ store.lowStockCount() }}</b>
                </button>
                <button type="button" [class]="chip(store.showExpiringOnly())" [attr.aria-pressed]="store.showExpiringOnly()"
                        (click)="store.toggleExpiring()">
                  <i class="pi pi-clock text-13" aria-hidden="true"></i>{{ inv().expiringChip }}
                  <b [class]="chipCount(store.showExpiringOnly())">{{ store.expiringProducts().length }}</b>
                </button>
                <button type="button" [class]="chip(noBarcodeOnly())" [attr.aria-pressed]="noBarcodeOnly()" (click)="noBarcodeOnly.set(!noBarcodeOnly())">
                  <i class="pi pi-barcode text-13" aria-hidden="true"></i>{{ inv().noBarcode }}
                  <b [class]="chipCount(noBarcodeOnly())">{{ noBarcodeCount() }}</b>
                </button>
                <button type="button" [class]="chip(showPassive())" [attr.aria-pressed]="showPassive()" (click)="togglePassive()">
                  <i class="pi pi-ban text-13" aria-hidden="true"></i>{{ t().products.showPassive }}
                </button>
                <button type="button" [class]="chip(showFilters()) + ' hidden md:inline-flex'" [attr.aria-pressed]="showFilters()"
                        (click)="showFilters.set(!showFilters())">
                  <i class="pi pi-filter text-13" aria-hidden="true"></i>{{ inv().columnFilters }}
                </button>
              </div>
            </div>
            <div class="-mx-3 flex gap-2 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0"
                 role="toolbar" [attr.aria-label]="inv().categoryFilters">
              <button type="button" [class]="chip(!store.selectedCategory())" [attr.aria-pressed]="!store.selectedCategory()"
                      (click)="store.setCategory(null)">
                {{ t().common.all }} <b [class]="chipCount(!store.selectedCategory())">{{ store.products().length }}</b>
              </button>
              @for (cat of categoryChips(); track cat.name) {
                <button type="button" [class]="chip(store.selectedCategory() === cat.name)" [attr.aria-pressed]="store.selectedCategory() === cat.name"
                        (click)="store.setCategory(store.selectedCategory() === cat.name ? null : cat.name)">
                  <i class="pi text-13" [class]="cat.icon" aria-hidden="true"></i>{{ cat.name }}
                  <b [class]="chipCount(store.selectedCategory() === cat.name)">{{ cat.count }}</b>
                </button>
              }
            </div>
          </div>

          @if (store.loading()) {
            <div class="flex flex-col gap-3 p-4" aria-hidden="true">
              @for (i of [1,2,3,4,5,6,7,8]; track i) {
                <p-skeleton height="44px" styleClass="rounded-lg" />
              }
            </div>
          } @else if (tableData().length === 0) {
            <ui-empty-state icon="pi-box" tone="brand" [title]="t().products.noProducts">
              @if (!showPassive()) {
                <p-button [label]="t().products.addFirst" icon="pi pi-plus" routerLink="new" />
              }
            </ui-empty-state>
          } @else {

            <!-- Telefon: kart listesi -->
            <ul class="m-0 flex list-none flex-col p-0 md:hidden">
              @for (product of mobileRows(); track product.id) {
                <li class="grid grid-cols-[40px_minmax(0,1fr)_auto] gap-2.5 border-b border-line px-3 py-3 last:border-b-0"
                    [class]="critical(product) && !showPassive() ? critEdge : ''">
                  <span class="flex h-10 w-10 items-center justify-center rounded-token-md bg-surface-muted text-fg-secondary" aria-hidden="true">
                    <i class="pi text-base" [class]="icon(product)"></i>
                  </span>
                  <a [routerLink]="['/products', product.id]" class="min-w-0 text-inherit no-underline">
                    <span class="block text-15 font-semibold leading-snug text-fg">{{ product.name }}</span>
                    @if (metaText(product)) {
                      <span class="mt-0.5 block truncate text-12.5 text-fg-muted">{{ metaText(product) }}</span>
                    }
                    <span class="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <ui-status-badge size="sm" [tone]="badgeTone(product)"><span class="num">{{ stockText(product) }}</span></ui-status-badge>
                      @if (expiryText(product); as ex) {
                        <ui-status-badge size="sm" icon="pi-clock" [tone]="expiryUrgent(product) ? 'danger' : 'warning'">{{ ex }}</ui-status-badge>
                      }
                    </span>
                  </a>
                  <div class="flex flex-col items-end justify-between gap-1.5">
                    <ui-money class="num text-base font-extrabold text-fg" [value]="product.salePrice" />
                    @if (showPassive()) {
                      <p-button [label]="t().products.makeActive" icon="pi pi-check-circle" size="small" (onClick)="reactivate(product, $event)" />
                    } @else {
                      <ng-container [ngTemplateOutlet]="cartAction" [ngTemplateOutletContext]="{ $implicit: product, large: true }" />
                    }
                  </div>
                </li>
              }
            </ul>
            @if (tableData().length > mobileRows().length) {
              <div class="flex justify-center border-t border-line p-3 md:hidden">
                <p-button [label]="t().products.loadMore + ' (' + (tableData().length - mobileRows().length) + ')'" icon="pi pi-angle-down"
                          severity="secondary" (onClick)="mobileLimit.set(mobileLimit() + mobilePage)" />
              </div>
            }

            <!-- Masaüstü: C tablosu -->
            <div class="hidden md:block">
              <p-table [value]="tableData()" dataKey="id" [rowHover]="true" [paginator]="true" [rows]="25" [rowsPerPageOptions]="[25, 50, 100]"
                       currentPageReportTemplate="{first}-{last} / {totalRecords}" [showCurrentPageReport]="true">
                <ng-template pTemplate="header">
                  <tr>
                    <th pSortableColumn="name" class="min-w-60">{{ inv().colProduct }} <p-sortIcon field="name" /></th>
                    <th pSortableColumn="category" class="hidden 2xl:table-cell">{{ inv().colCategory }} <p-sortIcon field="category" /></th>
                    <th pSortableColumn="stock">{{ inv().colStock }} <p-sortIcon field="stock" /></th>
                    <th>{{ inv().colExpiry }}</th>
                    @if (seeCosts()) {
                      <th pSortableColumn="purchasePrice" class="hidden text-right lg:table-cell">{{ inv().colPurchase }} <p-sortIcon field="purchasePrice" /></th>
                    }
                    <th pSortableColumn="salePrice" class="text-right">{{ inv().colSale }} <p-sortIcon field="salePrice" /></th>
                    @if (seeCosts()) {
                      <th class="hidden text-right lg:table-cell">{{ inv().colMarkup }}</th>
                    }
                    <th class="w-40 text-right"><span class="sr-only">{{ t().products.addToCart }}</span></th>
                  </tr>
                  @if (showFilters()) {
                    <tr>
                      <th><p-columnFilter type="text" field="name" matchMode="contains" [showMenu]="false" [showClearButton]="false" /></th>
                      <th class="hidden 2xl:table-cell">
                        <p-columnFilter field="category" matchMode="in" [showMenu]="false">
                          <ng-template pTemplate="filter" let-value let-filter="filterCallback">
                            <p-multiSelect [ngModel]="value" [options]="uniqueCategories()" (onChange)="filter($event.value)"
                                           [placeholder]="t().common.all" [showClear]="true" styleClass="w-full text-xs" appendTo="body" />
                          </ng-template>
                        </p-columnFilter>
                      </th>
                      <th><p-columnFilter type="numeric" field="stock" [showMenu]="true" [showClearButton]="false" /></th>
                      <th></th>
                      @if (seeCosts()) { <th class="hidden lg:table-cell"></th> }
                      <th><p-columnFilter type="numeric" field="salePrice" [showMenu]="true" [showClearButton]="false" /></th>
                      @if (seeCosts()) { <th class="hidden lg:table-cell"></th> }
                      <th></th>
                    </tr>
                  }
                </ng-template>
                <ng-template pTemplate="body" let-product>
                  <tr class="cursor-pointer" tabindex="0" (click)="goToDetail(product)" (keydown.enter)="goToDetail(product)">
                    <td [class]="critical(product) && !showPassive() ? critEdge : ''">
                      <div class="flex items-center gap-3">
                        <span class="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-token-md bg-surface-muted text-fg-secondary" aria-hidden="true">
                          <i class="pi text-15" [class]="icon(product)"></i>
                        </span>
                        <div class="min-w-0">
                          <div class="flex flex-wrap items-center gap-1.5">
                            <span class="text-sm font-semibold text-fg">{{ product.name }}</span>
                            @if (!showPassive() && product.stock <= 0) {
                              <ui-status-badge tone="danger" size="sm">{{ t().products.outOfStock }}</ui-status-badge>
                            } @else if (!showPassive() && critical(product)) {
                              <ui-status-badge tone="danger" size="sm">{{ inv().critical }}</ui-status-badge>
                            }
                          </div>
                          @if (product.barcode) {
                            <span class="num block text-xs text-fg-muted">{{ product.barcode }}{{ product.brand ? ' · ' + product.brand : '' }}<span class="2xl:hidden">{{ product.category ? ' · ' + product.category : '' }}</span></span>
                          } @else {
                            <span class="block text-xs font-semibold text-warning-text">{{ inv().noBarcode }}{{ product.brand ? ' · ' + product.brand : '' }}</span>
                          }
                        </div>
                      </div>
                    </td>
                    <td class="hidden text-sm text-fg-secondary 2xl:table-cell">{{ product.category || '—' }}</td>
                    <td>
                      <div class="flex min-w-[110px] flex-col gap-1.5">
                        <b class="num text-15 font-extrabold text-fg">{{ qtyNum(product.stock) }} <small class="font-sans text-12.5 font-medium text-fg-muted">{{ unitOf(product) }}</small></b>
                        <div class="h-1.5 overflow-hidden rounded-full bg-surface-strong" aria-hidden="true">
                          <div class="h-full rounded-full" [class]="barClass(product)" [style.width.%]="barPct(product)"></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      @if (expiryText(product); as ex) {
                        <ui-status-badge size="sm" icon="pi-clock" [tone]="expiryUrgent(product) ? 'danger' : 'warning'">{{ ex }}</ui-status-badge>
                        @if (nextExpiryDate(product); as d) { <span class="num mt-0.5 block text-xs text-fg-muted">{{ d }}</span> }
                      } @else if (nextExpiryDate(product); as d) {
                        <span class="num text-sm text-fg-secondary">{{ d }}</span>
                      } @else {
                        <span class="text-fg-muted">—</span>
                      }
                    </td>
                    @if (seeCosts()) {
                      <td class="hidden text-right lg:table-cell"><ui-money class="num text-sm text-fg-secondary" [value]="product.purchasePrice" /></td>
                    }
                    <td class="text-right"><ui-money class="num text-sm font-extrabold text-fg" [value]="product.salePrice" /></td>
                    @if (seeCosts()) {
                      <td class="num hidden text-right text-sm text-fg-secondary lg:table-cell">{{ markup(product) }}</td>
                    }
                    <td class="text-right">
                      <div class="flex justify-end">
                        @if (showPassive()) {
                          <p-button [label]="t().products.makeActive" icon="pi pi-check-circle" size="small" (onClick)="reactivate(product, $event)" />
                        } @else {
                          <ng-container [ngTemplateOutlet]="cartAction" [ngTemplateOutletContext]="{ $implicit: product, large: false }" />
                        }
                      </div>
                    </td>
                  </tr>
                </ng-template>
              </p-table>
            </div>
          }
        </div>
      </div>
    </div>

    <!-- Sepete ekle / miktar kontrolü (large: telefon kartı, 44px dokunma hedefi) -->
    <ng-template #cartAction let-product let-large="large">
      @if (cartQty(product.id) === 0) {
        @if (large) {
          <ui-icon-button icon="pi-cart-plus" variant="solid" tone="accent" [disabled]="product.stock <= 0"
                          [ariaLabel]="t().products.addToCart + ': ' + product.name" (click)="addToCart(product, $event)" />
        } @else {
          <p-button [label]="t().products.addToCart" icon="pi pi-cart-plus" severity="secondary" size="small" styleClass="whitespace-nowrap"
                    [disabled]="product.stock <= 0" (onClick)="addToCart(product, $event)" />
        }
      } @else {
        <div class="flex items-center gap-1.5" role="group" [attr.aria-label]="t().products.inCart + ': ' + product.name">
          <ui-icon-button icon="pi-minus" variant="soft" tone="accent" [size]="large ? 'md' : 'sm'"
                          [ariaLabel]="t().products.cartDecrease" (click)="decrease(product, $event)" />
          <span class="num min-w-[2.5rem] text-center text-sm font-bold text-accent-text" aria-live="polite">{{ cartQtyText(product) }}</span>
          <ui-icon-button icon="pi-plus" variant="solid" tone="accent" [size]="large ? 'md' : 'sm'"
                          [disabled]="cartQty(product.id) >= product.stock"
                          [ariaLabel]="t().products.cartIncrease" (click)="increase(product, $event)" />
        </div>
      }
    </ng-template>
  `,
})
export class ProductListPage implements OnInit {
  readonly store = inject(ProductStore);
  private readonly svc = inject(ProductService);
  private readonly cart = inject(CartStore);
  private readonly toast = inject(MessageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly t = inject(LangService).t;
  readonly inv = computed(() => this.t().inventory);
  readonly isAdmin = inject(AuthService).hasRole('admin');
  /** Y5: alış fiyatı / kâr oranı / stok değeri — yönetici ya da yetki verilmiş kullanıcı. */
  private readonly can = injectPermissions();
  readonly seeCosts = computed(() => this.can().seeCosts);
  readonly critEdge = CRIT_EDGE;
  /** Yalnız barkodsuz ürünler (sayfa içi filtre; store filtrelerinin üstüne) */
  readonly noBarcodeOnly = signal(false);
  readonly noBarcodeCount = computed(() => this.store.products().filter(p => !p.barcode?.trim()).length);

  readonly headerSubtitle = computed(() => {
    if (this.store.loading()) return '';
    const n = this.noBarcodeCount();
    return `${this.tableData().length} ${this.t().products.productCount}` + (n ? ` · ${n} ${this.inv().barcodeCount}` : '');
  });

  /** C özet şeridi: toplam ürün, kritik stok, SKT ≤ uyarı eşiği (Ayarlar), stok değeri (alış) */
  readonly summary = computed<SumStripItem[]>(() => {
    const i = this.inv();
    const crit = this.store.lowStockCount();
    const exp = this.store.expiringProducts().length;
    const items: SumStripItem[] = [
      { icon: 'pi-box', tone: 'success', label: i.totalProducts, value: this.store.products().length },
      { icon: 'pi-exclamation-triangle', tone: 'danger', label: i.criticalStock, value: crit, valueTone: crit ? 'danger' : null },
      { icon: 'pi-clock', tone: 'warning', label: i.expiringSoon(this.store.expiryWarnDays()), value: exp, valueTone: exp ? 'warning' : null },
    ];
    // Y5: stok değeri (alış) yalnız yöneticiye
    if (this.seeCosts()) {
      items.push({ icon: 'pi-wallet', tone: 'accent', label: i.stockValue, value: new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(this.store.totalInventoryValue()) + ' ₺' });
    }
    return items;
  });

  /** Kategori çipleri (ada göre, sayaçlı) */
  readonly categoryChips = computed(() => {
    const map = new Map<string, { name: string; count: number; icon: string }>();
    for (const p of this.store.products()) {
      if (!p.category) continue;
      const e = map.get(p.category);
      if (e) e.count++;
      else map.set(p.category, { name: p.category, count: 1, icon: productIcon(p) });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'));
  });

  readonly uniqueCategories = computed(() =>
    [...new Set(this.store.products().map(p => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr-TR'))
  );
  searchVal = '';
  readonly showFilters = signal(false);
  readonly showPassive = signal(false);
  readonly passiveProducts = signal<Product[]>([]);
  private passiveLoaded = false;

  readonly mobilePage = MOBILE_PAGE;
  readonly mobileLimit = signal(MOBILE_PAGE);

  // Aktif liste (store, filtreli) veya pasif liste — tabloya verilecek veri
  readonly tableData = computed(() => {
    if (!this.showPassive()) {
      const list = this.store.filteredProducts();
      return this.noBarcodeOnly() ? list.filter(p => !p.barcode?.trim()) : list;
    }
    const q = this.store.searchQuery().toLowerCase().trim();
    let list = this.passiveProducts();
    if (q) {
      list = list.filter(p =>
        (p.name ?? '').toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q) ||
        (p.brand ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  });

  readonly mobileRows = computed(() => this.tableData().slice(0, this.mobileLimit()));

  /** Store canlı (onSnapshot) — sadece henüz yüklenmediyse yükle (3.2) */
  ngOnInit(): void {
    this.store.ensureLoaded();
    // Bulgu 28: store'daki arama ile kutu senkron (sayfaya dönünce boş kutu + süzülmüş liste olmasın)
    this.searchVal = this.store.searchQuery();
  }

  /** Bulgu 29: arama kutusunda tam barkod / GTS eşleşmesi + Enter → sepete ekle ve kutuyu temizle. */
  onSearchEnter(event: Event): void {
    const hit = this.showPassive() ? null : findByCode(this.store.products(), this.searchVal);
    if (!hit) return;
    event.preventDefault();
    this.addCode(hit.product, hit.gtsNo);
    this.searchVal = '';
    this.store.setSearch('');
  }

  chip(active: boolean, danger = false): string { return chipClass(active, danger); }
  chipCount(active: boolean): string { return chipCountClass(active); }
  icon(p: Product): string { return productIcon(p); }
  critical(p: Product): boolean { return isCritical(p); }
  barClass(p: Product): string { return stockBarClass(p); }
  barPct(p: Product): number { return stockPct(p); }
  unitOf(p: Product): string { return unitText(productUnit(p), this.t().products); }
  qtyNum(n: number): string { return formatQty(n, this.t().products.locale); }

  markup(p: Product): string {
    return formatPct(markupPct(p), this.t().products.locale);
  }

  /** Henüz geçmemiş en yakın SKT tarihi (gg.aa.yyyy) */
  nextExpiryDate(p: Product): string | null {
    const ts = p.batches?.length ? expiryInfo(p.batches).nearestValid : p.expiryDate;
    return ts?.toDate ? ts.toDate().toLocaleDateString(this.t().products.locale) : null;
  }

  togglePassive(): void {
    const next = !this.showPassive();
    this.showPassive.set(next);
    this.mobileLimit.set(MOBILE_PAGE);
    if (next && !this.passiveLoaded) {
      this.passiveLoaded = true;
      this.svc.getPassive$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(p => this.passiveProducts.set(p));
    }
  }

  async reactivate(product: Product, event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    try {
      await this.svc.setActive(product.id, true);
      this.passiveProducts.set(this.passiveProducts().filter(p => p.id !== product.id));
      // Aktif ürün listesi canlı abonelikle zaten güncellenir; yeniden yüklemeye gerek yok.
      this.toast.add({ severity: 'success', summary: '', detail: this.t().products.statusUpdated, life: 2500 });
    } catch {
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().products.statusFailed, life: 3000 });
    }
  }

  goToDetail(product: Product): void { this.router.navigate(['/products', product.id]); }

  /** Okuyucu: barkod/GTS bir ürüne tam eşleşiyorsa sepete ekle, değilse aramaya yaz. */
  /** Kamerayla okut → aramaya yaz: kayıtlı GTS/barkod ise kendisi, karekodsa GTIN'e uyan ürünün barkodu. */
  onCameraScan(r: ScanResult): void {
    const products = this.store.products();
    const gtin = r.gs1?.gtin ?? null;
    const q = findByCode(products, r.code) || !gtin
      ? r.code
      : products.find(p => gtinMatches(p.barcode, gtin))?.barcode ?? r.gs1?.ean13 ?? gtin;
    this.searchVal = q;
    this.store.setSearch(q);
  }

  onBarcode(barcode: string): void {
    const hit = this.showPassive() ? null : findByCode(this.store.products(), barcode);
    if (!hit) {
      this.searchVal = barcode;
      this.store.setSearch(barcode);
      return;
    }
    this.addCode(hit.product, hit.gtsNo);
  }

  private addCode(product: Product, gtsNo: string | null): void {
    if (product.stock <= 0) {
      this.toast.add({ severity: 'warn', summary: '', detail: `${product.name}: ${this.t().products.outOfStock}`, life: 2500 });
      return;
    }
    this.notifyAdd(product, this.cart.addItem(cartItemFromProduct(product, gtsNo)), gtsNo);
  }

  private notifyAdd(product: Product, result: AddItemResult, gtsNo: string | null = null): void {
    const p = this.t().pos;
    if (result === 'added') {
      this.toast.add({ severity: 'success', summary: '', detail: `${product.name} ${p.added}${gtsNo ? ' (' + gtsNo + ')' : ''}`, life: 2000 });
    } else if (result === 'duplicate') {
      this.toast.add({ severity: 'warn', summary: '', detail: `${this.t().compliance.gtsAlreadyInCart}: ${gtsNo}`, life: 2500 });
    } else if (result === 'outOfStock' && isPlantProtection(product)) {
      this.toast.add({ severity: 'error', summary: '', detail: `${product.name}: ${this.t().compliance.expiredBlocked}`, life: 3000 });
    } else {
      this.toast.add({ severity: 'warn', summary: '', detail: `${product.name}: ${p.stockLimit}`, life: 2500 });
    }
  }

  cartQty(productId: string): number {
    return this.cart.items().find(i => i.productId === productId)?.quantity ?? 0;
  }

  cartQtyText(product: Product): string {
    return formatQty(this.cartQty(product.id), this.t().products.locale);
  }

  addToCart(product: Product, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (product.stock <= 0) return;
    this.notifyAdd(product, this.cart.addItem(cartItemFromProduct(product)));
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

  metaText(product: Product): string {
    return [product.brand, product.category].filter(Boolean).join(' · ');
  }

  stockText(product: Product): string {
    return product.stock <= 0 && !this.showPassive()
      ? this.t().products.outOfStock
      : qtyWithUnit(product.stock, product, this.t().products);
  }

  badgeTone(product: Product): UiTone {
    if (this.showPassive()) return 'neutral';
    if (product.stock <= 0 || isCritical(product)) return 'danger';
    return 'neutral';
  }

  /** Süresi geçmiş birim sayısı (2.15: geçmiş SKT'ler ayrıca işaretlenir) */
  private expiredQty(product: Product): number {
    if (product.batches?.length) return expiryInfo(product.batches).expiredQty;
    // Partisiz eski kayıtlar: ürün düzeyindeki SKT'ye bak
    const d = product.expiryDate ? daysUntilExpiry({ expiryDate: product.expiryDate }) : null;
    return d !== null && d < 0 ? product.stock : 0;
  }

  /** Henüz geçmemiş en yakın SKT'ye kalan gün (≤ uyarı eşiği ise), yoksa null — asla negatif değil */
  private expiryDays(product: Product): number | null {
    const next = product.batches?.length ? expiryInfo(product.batches).nearestValid : product.expiryDate;
    if (!next) return null;
    const days = daysUntilExpiry({ expiryDate: next });
    return days !== null && days >= 0 && days <= this.store.expiryWarnDays() ? days : null;
  }

  expiryText(product: Product): string | null {
    const p = this.t().products;
    const expired = this.expiredQty(product);
    if (expired > 0) return `${p.expired} (${qtyWithUnit(expired, product, p)})`;
    const d = this.expiryDays(product);
    if (d === null) return null;
    if (d === 0) return p.expiresToday;
    return `${p.daysLeftPrefix} ${d} ${p.dayShort}`;
  }

  expiryUrgent(product: Product): boolean {
    if (this.expiredQty(product) > 0) return true;
    const d = this.expiryDays(product);
    return d !== null && d <= this.store.expiryCriticalDays();
  }
}
