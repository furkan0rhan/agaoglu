import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { MessageService } from 'primeng/api';
import { ProductStore } from '../store/product.store';
import { ProductService } from '../services/product.service';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { Batch, Product, StockMovement } from '../../../shared/models/product.model';
import { SupplierService } from '../../suppliers/services/supplier.service';
import { Supplier } from '../../../shared/models/supplier.model';
import { LangService } from '../../../core/i18n/lang.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    RouterLink, DatePipe, FormsModule, CurrencyTrPipe,
    ButtonModule, TagModule, DialogModule, InputNumberModule,
    InputTextModule, SelectModule, DatePickerModule, ToastModule, SkeletonModule, AutoCompleteModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast position="top-right" />

    <div class="flex flex-col h-full bg-gray-50">

      <!-- Header -->
      <div class="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3 flex-shrink-0">
        <a routerLink="/products"
           class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-500">
          <i class="pi pi-arrow-left text-sm"></i>
        </a>
        <h1 class="text-xl font-bold text-gray-800 flex-1 truncate">{{ product()?.name ?? t().products.detail }}</h1>
        @if (product() && !isEditing()) {
          <p-button icon="pi pi-pencil" [label]="t().common.edit" severity="secondary" size="small" (onClick)="startEdit()" />
        }
        @if (isEditing()) {
          <p-button icon="pi pi-times" [label]="t().common.cancel" severity="secondary" [outlined]="true" size="small" (onClick)="cancelEdit()" />
          <p-button icon="pi pi-check" [label]="t().common.save" severity="success" size="small" [loading]="saving()" (onClick)="saveEdit()" />
        }
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto min-h-0 p-6">
        @if (!product()) {
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-2 bg-white rounded-2xl p-6 shadow-soft border border-gray-50 space-y-4">
              @for (i of [1,2,3,4,5]; track i) { <p-skeleton height="20px" /> }
            </div>
            <div class="bg-white rounded-2xl p-6 shadow-soft border border-gray-50 space-y-3">
              @for (i of [1,2,3]; track i) { <p-skeleton height="56px" /> }
            </div>
          </div>
        } @else {
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <!-- Sol -->
            <div class="lg:col-span-2 space-y-6">

              <!-- Stok banner -->
              <div class="rounded-2xl p-5 flex items-center gap-4" [class]="stockBannerClass()">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" [class]="stockIconBgClass()">
                  <i [class]="'pi text-xl ' + stockIcon()"></i>
                </div>
                <div>
                  <p class="text-sm font-medium opacity-80">{{ t().products.currentStock }}</p>
                  <p class="text-3xl font-bold">{{ product()!.stock }} <span class="text-base font-medium">{{ t().products.piece }}</span></p>
                  @if (product()!.stock <= product()!.minStock && product()!.stock > 0) {
                    <p class="text-xs font-semibold mt-0.5 opacity-80">
                      <i class="pi pi-exclamation-triangle mr-1"></i>{{ t().products.minStockWarn }} {{ product()!.minStock }} {{ t().products.piece }}
                    </p>
                  }
                </div>
              </div>

              <!-- Bilgi kartı -->
              <div class="bg-white rounded-2xl shadow-soft border border-gray-50 overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-50">
                  <h2 class="text-sm font-bold text-gray-500 uppercase tracking-wider">{{ t().products.productInfo }}</h2>
                </div>

                @if (!isEditing()) {
                  <div class="divide-y divide-gray-50">
                    @for (row of infoRows(); track row.label) {
                      <div class="flex items-center px-6 py-3">
                        <span class="text-sm text-gray-500 w-40 flex-shrink-0">{{ row.label }}</span>
                        <span class="text-sm font-semibold text-gray-800" [class]="row.class ?? ''">{{ row.value }}</span>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">

                    <div class="md:col-span-2 flex flex-col gap-1.5">
                      <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ t().products.infoName }}</label>
                      <input pInputText [(ngModel)]="editForm.name" class="w-full" />
                    </div>

                    <div class="flex flex-col gap-1.5">
                      <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ t().products.infoBarcode }}</label>
                      <input pInputText [(ngModel)]="editForm.barcode" class="w-full font-mono" />
                    </div>

                    <div class="flex flex-col gap-1.5">
                      <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ t().products.infoBrand }}</label>
                      <input pInputText [(ngModel)]="editForm.brand" class="w-full" />
                    </div>

                    <div class="flex flex-col gap-1.5">
                      <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ t().products.infoCategory }}</label>
                      <p-autocomplete
                        [(ngModel)]="editForm.category"
                        [suggestions]="categorySuggestions"
                        (completeMethod)="searchCategory($event)"
                        [forceSelection]="false"
                        [dropdown]="true"
                        [placeholder]="t().products.formCategoryPlaceholder"
                        styleClass="w-full"
                      />
                    </div>

                    <div class="flex flex-col gap-1.5">
                      <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ t().products.infoMinStock }}</label>
                      <p-inputNumber [(ngModel)]="editForm.minStock" [min]="0" styleClass="w-full" />
                    </div>

                    <div class="flex flex-col gap-1.5">
                      <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ t().products.purchasePrice }} (₺)</label>
                      <p-inputNumber [(ngModel)]="editForm.purchasePrice" [minFractionDigits]="2" [maxFractionDigits]="2" mode="decimal" locale="tr-TR" styleClass="w-full" />
                    </div>

                    <div class="flex flex-col gap-1.5">
                      <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ t().products.salePrice }} (₺)</label>
                      <p-inputNumber [(ngModel)]="editForm.salePrice" [minFractionDigits]="2" [maxFractionDigits]="2" mode="decimal" locale="tr-TR" styleClass="w-full" />
                    </div>

                    <div class="flex flex-col gap-1.5">
                      <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ t().products.infoVat }} (%)</label>
                      <p-autocomplete
                        [(ngModel)]="editForm.vatRateStr"
                        [suggestions]="vatSuggestions"
                        (completeMethod)="searchVat($event)"
                        [forceSelection]="false"
                        [dropdown]="true"
                        [placeholder]="t().products.formVatPlaceholder"
                        styleClass="w-full"
                      />
                    </div>

                    <div class="md:col-span-2 flex flex-col gap-1.5">
                      <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ t().products.infoDescription }}</label>
                      <input pInputText [(ngModel)]="editForm.description" class="w-full" [placeholder]="t().common.optional" />
                    </div>

                  </div>
                }
              </div>

              <!-- Stok hareketleri -->
              <div class="bg-white rounded-2xl shadow-soft border border-gray-50 overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                  <h2 class="text-sm font-bold text-gray-500 uppercase tracking-wider">{{ t().products.stockMovements }}</h2>
                  <a [routerLink]="['/products', productId(), 'movements']"
                     class="text-xs text-green-600 font-semibold hover:text-green-700 flex items-center gap-1">
                    {{ t().products.viewAll }} <i class="pi pi-arrow-right text-xs"></i>
                  </a>
                </div>
                @if (movements().length === 0) {
                  <div class="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
                    <i class="pi pi-history text-3xl opacity-30"></i>
                    <p class="text-sm">{{ t().products.noMovements }}</p>
                  </div>
                } @else {
                  <div class="divide-y divide-gray-50">
                    @for (m of movements().slice(0, 8); track m.id) {
                      <div class="flex items-center px-6 py-3 gap-3">
                        <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                             [class]="m.type === 'in' ? 'bg-green-50' : 'bg-red-50'">
                          <i [class]="'pi text-sm ' + (m.type === 'in' ? 'pi-arrow-down text-green-600' : 'pi-arrow-up text-red-500')"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium text-gray-800">{{ m.reason }}</p>
                          <p class="text-xs text-gray-400">{{ m.createdAt.toDate() | date:'dd.MM.yyyy HH:mm' }}</p>
                        </div>
                        <div class="text-right flex-shrink-0">
                          <p class="text-sm font-bold" [class]="m.type === 'in' ? 'text-green-600' : 'text-red-500'">
                            {{ m.type === 'in' ? '+' : '-' }}{{ m.quantity }}
                          </p>
                          <p class="text-xs text-gray-400">{{ m.newStock }} {{ t().products.piece }}</p>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>

            </div>

            <!-- Sağ -->
            <div class="space-y-4">

              <!-- Stok işlemleri -->
              <div class="bg-white rounded-2xl shadow-soft border border-gray-50 p-5">
                <h2 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">{{ t().products.stockActions }}</h2>
                <div class="flex gap-3">
                  <button
                    (click)="openDialog('in')"
                    class="flex-1 flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 border-green-100 bg-green-50 hover:bg-green-100 hover:border-green-200 transition-all duration-200 cursor-pointer group"
                  >
                    <div class="w-11 h-11 rounded-xl bg-green-500 group-hover:bg-green-600 flex items-center justify-center transition-colors shadow-sm">
                      <i class="pi pi-plus text-white text-lg"></i>
                    </div>
                    <span class="text-sm font-bold text-green-700">{{ t().products.addStock }}</span>
                  </button>
                  <button
                    (click)="openDialog('out')"
                    [disabled]="product()!.stock === 0"
                    class="flex-1 flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 border-orange-100 bg-orange-50 hover:bg-orange-100 hover:border-orange-200 transition-all duration-200 cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div class="w-11 h-11 rounded-xl bg-orange-500 group-hover:bg-orange-600 flex items-center justify-center transition-colors shadow-sm">
                      <i class="pi pi-minus text-white text-lg"></i>
                    </div>
                    <span class="text-sm font-bold text-orange-700">{{ t().products.removeStock }}</span>
                  </button>
                </div>
                <div class="mt-3">
                  <button
                    [routerLink]="['/products', productId(), 'movements']"
                    class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-600"
                  >
                    <i class="pi pi-history text-sm"></i> {{ t().products.viewMovements }}
                  </button>
                </div>
              </div>

              <!-- Fiyat özeti -->
              <div class="bg-white rounded-2xl shadow-soft border border-gray-50 p-5">
                <h2 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">{{ t().products.prices }}</h2>
                <div class="space-y-3">
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-500">{{ t().products.purchasePrice }}</span>
                    <span class="text-sm font-semibold text-gray-700">{{ product()!.purchasePrice | currencyTr }}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-500">{{ t().products.salePrice }}</span>
                    <span class="text-base font-bold text-green-700">{{ product()!.salePrice | currencyTr }}</span>
                  </div>
                  @if (product()!.vatRate != null) {
                    <div class="flex justify-between items-center">
                      <span class="text-sm text-gray-500">{{ t().products.vat }}</span>
                      <span class="text-sm font-semibold text-gray-700">%{{ product()!.vatRate }}</span>
                    </div>
                  }
                  <div class="border-t border-gray-100 pt-3 flex justify-between items-center">
                    <span class="text-sm text-gray-500">{{ t().products.margin }}</span>
                    <span class="text-sm font-bold text-blue-600">%{{ marginPercent() }}</span>
                  </div>
                </div>
              </div>

              <!-- Partiler -->
              <div class="bg-white rounded-2xl shadow-soft border border-gray-50 overflow-hidden">
                <div class="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                  <h2 class="text-sm font-bold text-gray-500 uppercase tracking-wider">{{ t().products.batches }}</h2>
                  @if (activeBatches().length > 0) {
                    <span class="text-xs font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{{ activeBatches().length }} {{ t().products.batchCount }}</span>
                  }
                </div>
                @if (activeBatches().length === 0) {
                  <div class="flex flex-col items-center justify-center py-8 text-gray-400 gap-1.5">
                    <i class="pi pi-box text-2xl opacity-30"></i>
                    <p class="text-xs">{{ t().products.noBatches }}</p>
                  </div>
                } @else {
                  <div class="divide-y divide-gray-50">
                    @for (b of activeBatches(); track b.id) {
                      <div class="flex items-start px-5 py-3 gap-3">
                        <div class="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" [class]="batchDotClass(b)"></div>
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-semibold text-gray-800">{{ b.quantity }} {{ t().products.piece }}</p>
                          @if (b.gtsNo) {
                            <p class="text-xs text-gray-500 font-mono">GTS: {{ b.gtsNo }}</p>
                          }
                          @if (supplierName(b)) {
                            <p class="text-xs text-blue-500"><i class="pi pi-truck mr-1" style="font-size:10px;"></i>{{ supplierName(b) }}</p>
                          }
                          <p class="text-xs" [class]="batchDateClass(b)">
                            @if (b.expiryDate) {
                              {{ t().products.formExpiry }}: {{ b.expiryDate.toDate() | date:'dd.MM.yyyy' }}
                              <span class="text-gray-400 ml-1">({{ daysLeft(b) }} {{ t().common.piece === 'pcs' ? 'd' : 'gün' }})</span>
                            } @else {
                              <span class="text-gray-400">{{ t().products.noExpiry }}</span>
                            }
                          </p>
                        </div>
                        <p class="text-xs text-gray-400 flex-shrink-0">{{ b.addedAt.toDate() | date:'dd.MM' }}</p>
                      </div>
                    }
                  </div>
                }
              </div>

            </div>
          </div>
        }
      </div>
    </div>

    <!-- Stok Dialog -->
    <p-dialog
      [(visible)]="dialogVisible"
      [header]="dialogMode() === 'in' ? t().products.dialogAddStock : t().products.dialogRemoveStock"
      [modal]="true"
      [style]="{ width: '360px' }"
      [draggable]="false"
    >
      <div class="flex flex-col gap-4 py-2">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-semibold text-gray-700">{{ t().products.dialogQty }}</label>
          <p-inputNumber
            [(ngModel)]="dialogQty"
            [min]="1"
            [max]="dialogMode() === 'out' ? product()?.stock : 99999"
            [showButtons]="true"
            buttonLayout="horizontal"
            incrementButtonIcon="pi pi-plus"
            decrementButtonIcon="pi pi-minus"
            styleClass="w-full"
            inputStyleClass="w-full text-center"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-semibold text-gray-700">{{ t().products.dialogReason }} <span class="text-gray-400 font-normal">({{ t().common.optional }})</span></label>
          <input pInputText [(ngModel)]="dialogReason" [placeholder]="t().products.dialogReasonPlaceholder" class="w-full" />
        </div>
        @if (dialogMode() === 'in') {
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-semibold text-gray-700">{{ t().products.dialogSupplier }} <span class="text-gray-400 font-normal">({{ t().common.optional }})</span></label>
            <p-select
              [(ngModel)]="dialogSupplierId"
              [options]="suppliers()"
              optionLabel="name"
              optionValue="id"
              [placeholder]="t().products.dialogSelectSupplier"
              [showClear]="true"
              styleClass="w-full"
              appendTo="body"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-semibold text-gray-700">{{ t().products.dialogGts }} <span class="text-gray-400 font-normal">({{ t().common.optional }})</span></label>
            <input pInputText [(ngModel)]="dialogGtsNo" [placeholder]="t().products.dialogGtsPlaceholder" class="w-full font-mono" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-semibold text-gray-700">{{ t().products.dialogExpiry }} <span class="text-gray-400 font-normal">({{ t().common.optional }})</span></label>
            <p-datepicker
              [(ngModel)]="dialogExpiryDate"
              dateFormat="dd.mm.yy"
              [showIcon]="true"
              [showButtonBar]="true"
              [placeholder]="t().products.dialogExpiryPlaceholder"
              styleClass="w-full"
              appendTo="body"
            />
          </div>
        }
      </div>
      <ng-template pTemplate="footer">
        <p-button [label]="t().common.cancel" severity="secondary" [outlined]="true" (onClick)="dialogVisible = false" />
        <p-button
          [label]="dialogMode() === 'in' ? t().products.dialogAdd : t().products.dialogRemove"
          [severity]="dialogMode() === 'in' ? 'success' : 'warn'"
          [loading]="saving()"
          (onClick)="confirmAdjust()"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class ProductDetailPage implements OnInit {
  private readonly store = inject(ProductStore);
  private readonly svc = inject(ProductService);
  private readonly supplierSvc = inject(SupplierService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(MessageService);
  readonly t = inject(LangService).t;

  readonly product = signal<Product | null>(null);
  readonly movements = signal<StockMovement[]>([]);
  readonly saving = signal(false);
  readonly dialogMode = signal<'in' | 'out'>('in');
  readonly isEditing = signal(false);
  readonly suppliers = signal<Supplier[]>([]);
  editForm = { name: '', barcode: '', brand: '', category: '', minStock: 0, purchasePrice: 0, salePrice: 0, vatRateStr: '', description: '' };

  vatSuggestions: string[] = [];
  categorySuggestions: string[] = [];

  private get allVatRates(): string[] {
    return [...new Set(
      this.store.products()
        .map(p => p.vatRate)
        .filter((v): v is number => v != null)
        .map(String)
    )].sort((a, b) => Number(a) - Number(b));
  }

  private get allCategories(): string[] {
    return [...new Set(this.store.products().map(p => p.category).filter(Boolean))].sort();
  }

  searchCategory(event: { query: string }): void {
    const q = event.query.trim().toLowerCase();
    const all = this.allCategories;
    if (!q) {
      this.categorySuggestions = all;
    } else {
      const filtered = all.filter(v => v.toLowerCase().includes(q));
      if (!filtered.some(v => v.toLowerCase() === q) && event.query.trim()) {
        filtered.push(event.query.trim());
      }
      this.categorySuggestions = filtered;
    }
  }

  searchVat(event: { query: string }): void {
    const q = event.query.trim();
    const all = this.allVatRates;
    if (!q) {
      this.vatSuggestions = all;
    } else {
      const filtered = all.filter(v => v.startsWith(q));
      if (!filtered.includes(q) && !isNaN(Number(q)) && q !== '') {
        filtered.unshift(q);
      }
      this.vatSuggestions = filtered;
    }
  }

  readonly productId = signal('');
  dialogVisible = false;
  dialogQty = 1;
  dialogReason = '';
  dialogGtsNo = '';
  dialogExpiryDate: Date | null = null;
  dialogSupplierId: string | null = null;

  constructor() {
    effect(() => {
      const id = this.productId();
      const found = this.store.products().find(p => p.id === id);
      if (found) this.product.set(found);
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.productId.set(id);

    if (!id) return;

    const fromStore = this.store.products().find(p => p.id === id);
    if (!fromStore) {
      this.svc.getById$(id).subscribe(p => { if (p) this.product.set(p); });
    }

    this.svc.getMovements$(id).subscribe(m => this.movements.set(m));
    this.supplierSvc.getAll$().subscribe(s => this.suppliers.set(s));
  }

  startEdit(): void {
    const p = this.product();
    if (!p) return;
    this.editForm = {
      name: p.name,
      barcode: p.barcode ?? '',
      brand: p.brand ?? '',
      category: p.category ?? '',
      minStock: p.minStock,
      purchasePrice: p.purchasePrice,
      salePrice: p.salePrice,
      vatRateStr: p.vatRate != null ? p.vatRate.toString() : '',
      description: p.description ?? '',
    };
    this.isEditing.set(true);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
  }

  async saveEdit(): Promise<void> {
    const p = this.product();
    if (!p) return;
    this.saving.set(true);
    try {
      const changes = {
        name: this.editForm.name.trim(),
        barcode: this.editForm.barcode.trim(),
        brand: this.editForm.brand.trim() || null,
        category: this.editForm.category || 'Diğer',
        minStock: this.editForm.minStock,
        purchasePrice: this.editForm.purchasePrice,
        salePrice: this.editForm.salePrice,
        vatRate: this.editForm.vatRateStr ? Number(this.editForm.vatRateStr) : null,
        description: this.editForm.description.trim() || null,
      };
      await this.svc.update(p.id, changes);
      this.product.set({ ...p, ...changes });
      this.isEditing.set(false);
      this.toast.add({ severity: 'success', summary: '', detail: this.t().products.updated, life: 2500 });
    } catch {
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().products.updateFailed, life: 3000 });
    } finally {
      this.saving.set(false);
    }
  }

  openDialog(mode: 'in' | 'out'): void {
    this.dialogMode.set(mode);
    this.dialogQty = 1;
    this.dialogReason = '';
    this.dialogGtsNo = '';
    this.dialogExpiryDate = null;
    this.dialogSupplierId = null;
    this.dialogVisible = true;
  }

  async confirmAdjust(): Promise<void> {
    const p = this.product();
    if (!p || this.dialogQty <= 0) return;
    this.saving.set(true);
    try {
      const delta = this.dialogMode() === 'in' ? this.dialogQty : -this.dialogQty;
      const reason = this.dialogReason.trim() || (this.dialogMode() === 'in' ? this.t().products.stockIn : this.t().products.stockOut);
      const expiryDate = this.dialogMode() === 'in' ? this.dialogExpiryDate : null;
      const gtsNo = this.dialogMode() === 'in' ? this.dialogGtsNo.trim() || null : null;
      const supplierId = this.dialogMode() === 'in' ? this.dialogSupplierId : null;
      await this.svc.adjustStock(p, delta, reason, null, expiryDate, gtsNo, supplierId);
      this.dialogVisible = false;
      this.toast.add({ severity: 'success', summary: this.t().common.success, detail: `${this.t().products.stockUpdated}: ${p.stock + delta} ${this.t().products.piece}`, life: 3000 });
      this.svc.getById$(p.id).subscribe(updated => { if (updated) this.product.set(updated); });
    } catch {
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().products.stockFailed, life: 3000 });
    } finally {
      this.saving.set(false);
    }
  }

  infoRows(): { label: string; value: string; class?: string }[] {
    const p = this.product();
    if (!p) return [];
    const pr = this.t().products;
    return [
      { label: pr.infoCategory, value: p.category || '-' },
      { label: pr.infoBarcode, value: p.barcode || '-', class: 'font-mono' },
      { label: pr.infoBrand, value: p.brand || '-' },
      { label: pr.infoMinStock, value: p.minStock + ' ' + pr.piece },
      ...(p.vatRate != null ? [{ label: pr.infoVat, value: '%' + p.vatRate }] : []),
      ...(p.expiryDate ? [{ label: pr.infoExpiry, value: p.expiryDate.toDate().toLocaleDateString('tr-TR') }] : []),
      ...(p.description ? [{ label: pr.infoDescription, value: p.description }] : []),
    ];
  }

  marginPercent(): string {
    const p = this.product();
    if (!p || p.purchasePrice === 0) return '0';
    return (((p.salePrice - p.purchasePrice) / p.purchasePrice) * 100).toFixed(1);
  }

  stockBannerClass(): string {
    const p = this.product();
    if (!p) return '';
    if (p.stock === 0) return 'bg-red-50 text-red-700';
    if (p.stock <= p.minStock) return 'bg-amber-50 text-amber-700';
    return 'bg-green-50 text-green-700';
  }

  stockIconBgClass(): string {
    const p = this.product();
    if (!p) return '';
    if (p.stock === 0) return 'bg-red-100 text-red-600';
    if (p.stock <= p.minStock) return 'bg-amber-100 text-amber-600';
    return 'bg-green-100 text-green-600';
  }

  stockIcon(): string {
    const p = this.product();
    if (!p) return 'pi-box';
    if (p.stock === 0) return 'pi-times-circle';
    if (p.stock <= p.minStock) return 'pi-exclamation-triangle';
    return 'pi-check-circle';
  }

  readonly activeBatches = computed(() => {
    const p = this.product();
    if (!p?.batches?.length) return [];
    return [...p.batches]
      .filter(b => b.quantity > 0)
      .sort((a, b) => {
        if (!a.expiryDate && !b.expiryDate) return 0;
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return a.expiryDate.toMillis() - b.expiryDate.toMillis();
      });
  });

  daysLeft(b: Batch): number {
    if (!b.expiryDate) return Infinity;
    return Math.ceil((b.expiryDate.toMillis() - Date.now()) / 86_400_000);
  }

  batchDotClass(b: Batch): string {
    if (!b.expiryDate) return 'bg-gray-300';
    const d = this.daysLeft(b);
    if (d <= 0) return 'bg-gray-400';
    if (d <= 7) return 'bg-red-500';
    if (d <= 30) return 'bg-amber-400';
    return 'bg-green-500';
  }

  supplierName(b: Batch): string | null {
    const sid = (b as any).supplierId;
    if (!sid) return null;
    return this.suppliers().find(s => s.id === sid)?.name ?? null;
  }

  batchDateClass(b: Batch): string {
    if (!b.expiryDate) return '';
    const d = this.daysLeft(b);
    if (d <= 0) return 'text-gray-400 line-through';
    if (d <= 7) return 'text-red-500 font-semibold';
    if (d <= 30) return 'text-amber-600 font-medium';
    return 'text-gray-500';
  }
}
