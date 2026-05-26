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
        <h1 class="text-xl font-bold text-gray-800 flex-1 truncate">{{ product()?.name ?? 'Ürün Detayı' }}</h1>
        @if (product() && !isEditing()) {
          <p-button icon="pi pi-pencil" label="Düzenle" severity="secondary" size="small" (onClick)="startEdit()" />
        }
        @if (isEditing()) {
          <p-button icon="pi pi-times" label="İptal" severity="secondary" [outlined]="true" size="small" (onClick)="cancelEdit()" />
          <p-button icon="pi pi-check" label="Kaydet" severity="success" size="small" [loading]="saving()" (onClick)="saveEdit()" />
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
                  <p class="text-sm font-medium opacity-80">Mevcut Stok</p>
                  <p class="text-3xl font-bold">{{ product()!.stock }} <span class="text-base font-medium">adet</span></p>
                  @if (product()!.stock <= product()!.minStock && product()!.stock > 0) {
                    <p class="text-xs font-semibold mt-0.5 opacity-80">
                      <i class="pi pi-exclamation-triangle mr-1"></i>Min. stok: {{ product()!.minStock }} adet
                    </p>
                  }
                </div>
              </div>

              <!-- Bilgi kartı -->
              <div class="bg-white rounded-2xl shadow-soft border border-gray-50 overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-50">
                  <h2 class="text-sm font-bold text-gray-500 uppercase tracking-wider">Ürün Bilgileri</h2>
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
                      <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ürün Adı</label>
                      <input pInputText [(ngModel)]="editForm.name" class="w-full" />
                    </div>

                    <div class="flex flex-col gap-1.5">
                      <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Barkod</label>
                      <input pInputText [(ngModel)]="editForm.barcode" class="w-full font-mono" />
                    </div>

                    <div class="flex flex-col gap-1.5">
                      <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Marka</label>
                      <input pInputText [(ngModel)]="editForm.brand" class="w-full" />
                    </div>

                    <div class="flex flex-col gap-1.5">
                      <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kategori</label>
                      <p-autocomplete
                        [(ngModel)]="editForm.category"
                        [suggestions]="categorySuggestions"
                        (completeMethod)="searchCategory($event)"
                        [forceSelection]="false"
                        [dropdown]="true"
                        placeholder="Kategori seçin veya yazın"
                        styleClass="w-full"
                      />
                    </div>

                    <div class="flex flex-col gap-1.5">
                      <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Min. Stok</label>
                      <p-inputNumber [(ngModel)]="editForm.minStock" [min]="0" styleClass="w-full" />
                    </div>

                    <div class="flex flex-col gap-1.5">
                      <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Alış Fiyatı (₺)</label>
                      <p-inputNumber [(ngModel)]="editForm.purchasePrice" [minFractionDigits]="2" [maxFractionDigits]="2" mode="decimal" locale="tr-TR" styleClass="w-full" />
                    </div>

                    <div class="flex flex-col gap-1.5">
                      <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Satış Fiyatı (₺)</label>
                      <p-inputNumber [(ngModel)]="editForm.salePrice" [minFractionDigits]="2" [maxFractionDigits]="2" mode="decimal" locale="tr-TR" styleClass="w-full" />
                    </div>

                    <div class="flex flex-col gap-1.5">
                      <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">KDV Oranı (%)</label>
                      <p-autocomplete
                        [(ngModel)]="editForm.vatRateStr"
                        [suggestions]="vatSuggestions"
                        (completeMethod)="searchVat($event)"
                        [forceSelection]="false"
                        [dropdown]="true"
                        placeholder="Örn: 8, 18, 20"
                        styleClass="w-full"
                      />
                    </div>

                    <div class="md:col-span-2 flex flex-col gap-1.5">
                      <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Açıklama</label>
                      <input pInputText [(ngModel)]="editForm.description" class="w-full" placeholder="Opsiyonel" />
                    </div>

                  </div>
                }
              </div>

              <!-- Stok hareketleri -->
              <div class="bg-white rounded-2xl shadow-soft border border-gray-50 overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                  <h2 class="text-sm font-bold text-gray-500 uppercase tracking-wider">Son Stok Hareketleri</h2>
                  <a [routerLink]="['/products', productId(), 'movements']"
                     class="text-xs text-green-600 font-semibold hover:text-green-700 flex items-center gap-1">
                    Tümünü gör <i class="pi pi-arrow-right text-xs"></i>
                  </a>
                </div>
                @if (movements().length === 0) {
                  <div class="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
                    <i class="pi pi-history text-3xl opacity-30"></i>
                    <p class="text-sm">Henüz stok hareketi yok</p>
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
                          <p class="text-xs text-gray-400">{{ m.newStock }} adet</p>
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
                <h2 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Stok İşlemleri</h2>
                <div class="flex gap-3">
                  <!-- Stok Ekle -->
                  <button
                    (click)="openDialog('in')"
                    class="flex-1 flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 border-green-100 bg-green-50 hover:bg-green-100 hover:border-green-200 transition-all duration-200 cursor-pointer group"
                  >
                    <div class="w-11 h-11 rounded-xl bg-green-500 group-hover:bg-green-600 flex items-center justify-center transition-colors shadow-sm">
                      <i class="pi pi-plus text-white text-lg"></i>
                    </div>
                    <span class="text-sm font-bold text-green-700">Stok Ekle</span>
                  </button>
                  <!-- Stok Çıkar -->
                  <button
                    (click)="openDialog('out')"
                    [disabled]="product()!.stock === 0"
                    class="flex-1 flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 border-orange-100 bg-orange-50 hover:bg-orange-100 hover:border-orange-200 transition-all duration-200 cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div class="w-11 h-11 rounded-xl bg-orange-500 group-hover:bg-orange-600 flex items-center justify-center transition-colors shadow-sm">
                      <i class="pi pi-minus text-white text-lg"></i>
                    </div>
                    <span class="text-sm font-bold text-orange-700">Stok Çıkar</span>
                  </button>
                </div>
                <div class="mt-3">
                  <button
                    [routerLink]="['/products', productId(), 'movements']"
                    class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-600"
                  >
                    <i class="pi pi-history text-sm"></i> Stok Hareketleri
                  </button>
                </div>
              </div>

              <!-- Fiyat özeti -->
              <div class="bg-white rounded-2xl shadow-soft border border-gray-50 p-5">
                <h2 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Fiyatlar</h2>
                <div class="space-y-3">
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-500">Alış Fiyatı</span>
                    <span class="text-sm font-semibold text-gray-700">{{ product()!.purchasePrice | currencyTr }}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-500">Satış Fiyatı</span>
                    <span class="text-base font-bold text-green-700">{{ product()!.salePrice | currencyTr }}</span>
                  </div>
                  @if (product()!.vatRate != null) {
                    <div class="flex justify-between items-center">
                      <span class="text-sm text-gray-500">KDV</span>
                      <span class="text-sm font-semibold text-gray-700">%{{ product()!.vatRate }}</span>
                    </div>
                  }
                  <div class="border-t border-gray-100 pt-3 flex justify-between items-center">
                    <span class="text-sm text-gray-500">Kâr Marjı</span>
                    <span class="text-sm font-bold text-blue-600">%{{ marginPercent() }}</span>
                  </div>
                </div>
              </div>

              <!-- Partiler (Lot Takibi) -->
              <div class="bg-white rounded-2xl shadow-soft border border-gray-50 overflow-hidden">
                <div class="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                  <h2 class="text-sm font-bold text-gray-500 uppercase tracking-wider">Partiler</h2>
                  @if (activeBatches().length > 0) {
                    <span class="text-xs font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{{ activeBatches().length }} parti</span>
                  }
                </div>
                @if (activeBatches().length === 0) {
                  <div class="flex flex-col items-center justify-center py-8 text-gray-400 gap-1.5">
                    <i class="pi pi-box text-2xl opacity-30"></i>
                    <p class="text-xs">Parti kaydı yok</p>
                  </div>
                } @else {
                  <div class="divide-y divide-gray-50">
                    @for (b of activeBatches(); track b.id) {
                      <div class="flex items-start px-5 py-3 gap-3">
                        <div class="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" [class]="batchDotClass(b)"></div>
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-semibold text-gray-800">{{ b.quantity }} adet</p>
                          @if (b.gtsNo) {
                            <p class="text-xs text-gray-500 font-mono">GTS: {{ b.gtsNo }}</p>
                          }
                          <p class="text-xs" [class]="batchDateClass(b)">
                            @if (b.expiryDate) {
                              SKT: {{ b.expiryDate.toDate() | date:'dd.MM.yyyy' }}
                              <span class="text-gray-400 ml-1">({{ daysLeft(b) }} gün)</span>
                            } @else {
                              <span class="text-gray-400">SKT yok</span>
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
      [header]="dialogMode() === 'in' ? 'Stok Ekle' : 'Stok Çıkar'"
      [modal]="true"
      [style]="{ width: '360px' }"
      [draggable]="false"
    >
      <div class="flex flex-col gap-4 py-2">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-semibold text-gray-700">Miktar</label>
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
          <label class="text-sm font-semibold text-gray-700">Neden <span class="text-gray-400 font-normal">(opsiyonel)</span></label>
          <input pInputText [(ngModel)]="dialogReason" placeholder="Örn: Sayım, iade, tedarik..." class="w-full" />
        </div>
        @if (dialogMode() === 'in') {
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-semibold text-gray-700">GTS No <span class="text-gray-400 font-normal">(opsiyonel)</span></label>
            <input pInputText [(ngModel)]="dialogGtsNo" placeholder="Bu partinin GTS numarası" class="w-full font-mono" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-semibold text-gray-700">Son Kullanma Tarihi <span class="text-gray-400 font-normal">(opsiyonel)</span></label>
            <p-datepicker
              [(ngModel)]="dialogExpiryDate"
              dateFormat="dd.mm.yy"
              [showIcon]="true"
              [showButtonBar]="true"
              placeholder="GG.AA.YYYY"
              styleClass="w-full"
              appendTo="body"
            />
          </div>
        }
      </div>
      <ng-template pTemplate="footer">
        <p-button label="İptal" severity="secondary" [outlined]="true" (onClick)="dialogVisible = false" />
        <p-button
          [label]="dialogMode() === 'in' ? 'Ekle' : 'Çıkar'"
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
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(MessageService);

  readonly product = signal<Product | null>(null);
  readonly movements = signal<StockMovement[]>([]);
  readonly saving = signal(false);
  readonly dialogMode = signal<'in' | 'out'>('in');
  readonly isEditing = signal(false);
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
      this.toast.add({ severity: 'success', summary: '', detail: 'Ürün güncellendi', life: 2500 });
    } catch {
      this.toast.add({ severity: 'error', summary: 'Hata', detail: 'Güncelleme başarısız', life: 3000 });
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
    this.dialogVisible = true;
  }

  async confirmAdjust(): Promise<void> {
    const p = this.product();
    if (!p || this.dialogQty <= 0) return;
    this.saving.set(true);
    try {
      const delta = this.dialogMode() === 'in' ? this.dialogQty : -this.dialogQty;
      const reason = this.dialogReason.trim() || (this.dialogMode() === 'in' ? 'Stok girişi' : 'Stok çıkışı');
      const expiryDate = this.dialogMode() === 'in' ? this.dialogExpiryDate : null;
      const gtsNo = this.dialogMode() === 'in' ? this.dialogGtsNo.trim() || null : null;
      await this.svc.adjustStock(p, delta, reason, null, expiryDate, gtsNo);
      this.product.set({ ...p, stock: p.stock + delta });
      this.dialogVisible = false;
      this.toast.add({ severity: 'success', summary: 'Başarılı', detail: `Stok güncellendi: ${p.stock + delta} adet`, life: 3000 });
    } catch {
      this.toast.add({ severity: 'error', summary: 'Hata', detail: 'Stok güncellenemedi', life: 3000 });
    } finally {
      this.saving.set(false);
    }
  }

  infoRows(): { label: string; value: string; class?: string }[] {
    const p = this.product();
    if (!p) return [];
    return [
      { label: 'Kategori', value: p.category || '-' },
      { label: 'Barkod', value: p.barcode || '-', class: 'font-mono' },
      { label: 'Marka', value: p.brand || '-' },
      { label: 'Min. Stok', value: p.minStock + ' adet' },
      ...(p.vatRate != null ? [{ label: 'KDV Oranı', value: '%' + p.vatRate }] : []),
      ...(p.expiryDate ? [{ label: 'Son Kullanma', value: p.expiryDate.toDate().toLocaleDateString('tr-TR') }] : []),
      ...(p.description ? [{ label: 'Açıklama', value: p.description }] : []),
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

  batchDateClass(b: Batch): string {
    if (!b.expiryDate) return '';
    const d = this.daysLeft(b);
    if (d <= 0) return 'text-gray-400 line-through';
    if (d <= 7) return 'text-red-500 font-semibold';
    if (d <= 30) return 'text-amber-600 font-medium';
    return 'text-gray-500';
  }
}
