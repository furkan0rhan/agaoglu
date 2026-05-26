import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { MessageService } from 'primeng/api';
import { ProductService } from '../services/product.service';
import { ProductStore } from '../store/product.store';
import { Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule, RouterLink,
    ButtonModule, InputTextModule, InputNumberModule,
    TextareaModule, ToggleSwitchModule, DatePickerModule,
    ToastModule, AutoCompleteModule,
  ],
  template: `
    <p-toast position="top-right"></p-toast>
    <div class="flex flex-col h-full bg-gray-50">

      <!-- Header -->
      <div class="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0 gap-3">
        <div class="flex items-center gap-3">
          <a routerLink="/products"
             class="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-gray-500 flex-shrink-0">
            <i class="pi pi-arrow-left text-sm"></i>
          </a>
          <div>
            <h1 class="text-lg font-bold text-gray-800 m-0">{{ isEdit ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle' }}</h1>
            <p class="text-xs text-gray-400 m-0">{{ isEdit ? 'Ürün bilgilerini güncelleyin' : 'Yeni ürün bilgilerini girin' }}</p>
          </div>
        </div>
        <p-button
          label="Kaydet"
          icon="pi pi-check"
          severity="success"
          [loading]="saving()"
          [disabled]="form.invalid"
          (onClick)="save()"
          size="small"
        />
      </div>

      <!-- Form -->
      <div class="flex-1 overflow-y-auto min-h-0 p-6">
        <form [formGroup]="form">
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

            <!-- Ürün Adı -->
            <div class="md:col-span-2 xl:col-span-3 flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ürün Adı *</label>
              <input pInputText formControlName="name" placeholder="Ürün adını girin" class="w-full" />
              @if (form.get('name')?.invalid && form.get('name')?.touched) {
                <p class="text-xs text-red-500 m-0">Ürün adı zorunlu</p>
              }
            </div>

            <!-- Barkod -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Barkod</label>
              <input pInputText formControlName="barcode" placeholder="Barkod numarası" class="w-full font-mono" />
            </div>

            <!-- Marka -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Marka</label>
              <input pInputText formControlName="brand" placeholder="Marka adı" class="w-full" />
            </div>

            <!-- Kategori -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kategori *</label>
              <p-autocomplete
                [(ngModel)]="categoryStr"
                [ngModelOptions]="{standalone: true}"
                [suggestions]="categorySuggestions"
                (completeMethod)="searchCategory($event)"
                [forceSelection]="false"
                [dropdown]="true"
                placeholder="Kategori seçin veya yazın"
                styleClass="w-full"
              />
            </div>

            <!-- Ayırıcı: Fiyatlar -->
            <div class="md:col-span-2 xl:col-span-3 border-t border-gray-100 pt-4 mt-1">
              <p class="text-xs font-bold text-gray-400 uppercase tracking-widest m-0">Fiyatlandırma</p>
            </div>

            <!-- Alış Fiyatı -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Alış Fiyatı (₺) *</label>
              <p-inputnumber
                formControlName="purchasePrice"
                [minFractionDigits]="2"
                [maxFractionDigits]="2"
                [min]="0"
                mode="decimal"
                locale="tr-TR"
                styleClass="w-full"
              />
            </div>

            <!-- Satış Fiyatı -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Satış Fiyatı (₺) *</label>
              <p-inputnumber
                formControlName="salePrice"
                [minFractionDigits]="2"
                [maxFractionDigits]="2"
                [min]="0"
                mode="decimal"
                locale="tr-TR"
                styleClass="w-full"
              />
            </div>

            <!-- KDV Oranı -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">KDV Oranı (%)</label>
              <p-autocomplete
                [(ngModel)]="vatRateStr"
                [ngModelOptions]="{standalone: true}"
                [suggestions]="vatSuggestions"
                (completeMethod)="searchVat($event)"
                [forceSelection]="false"
                [dropdown]="true"
                placeholder="Örn: 8, 18, 20"
                styleClass="w-full"
              />
            </div>

            <!-- Ayırıcı: Stok -->
            <div class="md:col-span-2 xl:col-span-3 border-t border-gray-100 pt-4 mt-1">
              <p class="text-xs font-bold text-gray-400 uppercase tracking-widest m-0">Stok Bilgileri</p>
            </div>

            <!-- Stok Miktarı -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stok Miktarı *</label>
              <p-inputnumber
                formControlName="stock"
                [min]="0"
                [showButtons]="true"
                styleClass="w-full"
              />
            </div>

            <!-- Minimum Stok -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Minimum Stok</label>
              <p-inputnumber
                formControlName="minStock"
                [min]="0"
                [showButtons]="true"
                styleClass="w-full"
              />
            </div>

            <!-- Ayırıcı: İlk Parti -->
            <div class="md:col-span-2 xl:col-span-3 border-t border-gray-100 pt-4 mt-1">
              <p class="text-xs font-bold text-gray-400 uppercase tracking-widest m-0">İlk Parti Bilgileri <span class="normal-case font-normal text-gray-300">(stok > 0 ise)</span></p>
            </div>

            <!-- GTS No -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">GTS No</label>
              <input pInputText formControlName="gtsNo" placeholder="Bu partinin GTS numarası" class="w-full font-mono" />
            </div>

            <!-- Son Kullanma Tarihi -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Son Kullanma Tarihi</label>
              <p-datepicker
                formControlName="expiryDateVal"
                dateFormat="dd.mm.yy"
                [showIcon]="true"
                [showButtonBar]="true"
                placeholder="Tarih seçin"
                styleClass="w-full"
                appendTo="body"
              />
            </div>

            <!-- Açıklama -->
            <div class="md:col-span-2 xl:col-span-3 flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Açıklama</label>
              <textarea pTextarea formControlName="description" rows="3" placeholder="Ürün açıklaması (opsiyonel)" class="w-full resize-y"></textarea>
            </div>

            <!-- Aktif toggle -->
            <div class="md:col-span-2 xl:col-span-3 flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
              <p-toggleswitch formControlName="isActive" />
              <div>
                <p class="text-sm font-semibold text-gray-800 m-0">Ürün Aktif</p>
                <p class="text-xs text-gray-400 m-0">Kapalıysa ürün listede ve satışta görünmez</p>
              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  `,
})
export class ProductFormPage implements OnInit {
  private readonly svc = inject(ProductService);
  private readonly store = inject(ProductStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly messageSvc = inject(MessageService);

  readonly saving = signal(false);
  isEdit = false;
  productId = '';

  vatRateStr = '';
  vatSuggestions: string[] = [];

  categoryStr = '';
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

  readonly form = this.fb.group({
    name: ['', Validators.required],
    barcode: [''],
    brand: [''],
    purchasePrice: [0, [Validators.required, Validators.min(0)]],
    salePrice: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    minStock: [5],
    gtsNo: [''],
    expiryDateVal: [null as Date | null],
    description: [''],
    isActive: [true],
  });

  ngOnInit(): void {
    this.productId = this.route.snapshot.paramMap.get('id') ?? '';
    this.isEdit = !!this.productId && this.productId !== 'new';

    if (this.isEdit) {
      const product = this.store.products().find(p => p.id === this.productId);
      if (product) {
        this.form.patchValue({
          name: product.name,
          barcode: product.barcode ?? '',
          brand: product.brand ?? '',
          purchasePrice: product.purchasePrice,
          salePrice: product.salePrice,
          stock: product.stock,
          minStock: product.minStock,
          description: product.description ?? '',
          isActive: product.isActive,
          expiryDateVal: product.expiryDate ? product.expiryDate.toDate() : null,
        });
        this.vatRateStr = product.vatRate != null ? product.vatRate.toString() : '';
        this.categoryStr = product.category ?? '';
      }
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    try {
      const v = this.form.value;
      const expiryDate = v.expiryDateVal ? Timestamp.fromDate(v.expiryDateVal) : null;

      const stock = Number(v.stock);
      const gtsNo = v.gtsNo?.trim() || null;
      const initialBatches = stock > 0
        ? [{ id: crypto.randomUUID(), quantity: stock, expiryDate: expiryDate ?? null, gtsNo, addedAt: Timestamp.now() }]
        : [];

      const data = {
        name: v.name!,
        barcode: v.barcode ?? '',
        category: this.categoryStr || 'Diğer',
        brand: v.brand || null,
        purchasePrice: Number(v.purchasePrice),
        salePrice: Number(v.salePrice),
        vatRate: this.vatRateStr ? Number(this.vatRateStr) : null,
        stock,
        minStock: Number(v.minStock),
        expiryDate,
        description: v.description || null,
        imageUrl: null,
        isActive: v.isActive ?? true,
        batches: initialBatches,
      };

      if (this.isEdit) {
        await this.svc.update(this.productId, data);
      } else {
        await this.svc.create(data);
      }
      this.messageSvc.add({ severity: 'success', summary: '', detail: this.isEdit ? 'Ürün güncellendi' : 'Ürün eklendi', life: 2000 });
      await this.router.navigate(['/products']);
    } catch (err: any) {
      const detail = err?.message?.includes('permission') || err?.code === 'permission-denied'
        ? 'Yetki hatası — Firebase kurallarını kontrol edin'
        : (err?.message ?? 'Ürün kaydedilemedi');
      this.messageSvc.add({ severity: 'error', summary: 'Hata', detail, life: 5000 });
    } finally {
      this.saving.set(false);
    }
  }

  private toast(message: string, severity: 'success' | 'error' | 'warn'): void {
    this.messageSvc.add({ severity, summary: '', detail: message, life: 2500 });
  }
}
