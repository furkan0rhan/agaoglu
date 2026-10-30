import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ToastModule } from 'primeng/toast';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { Timestamp } from '@angular/fire/firestore';
import { ProductService, ProductStockError } from '../services/product.service';
import { ProductStore } from '../store/product.store';
import { LangService } from '../../../core/i18n/lang.service';
import { Batch, DEFAULT_PRODUCT_UNIT, isDecimalUnit, Product, ProductType, productUnit, ProductUnit } from '../../../shared/models/product.model';
import { findBarcodeConflict, findGtsConflict, normalizeLotNo, roundQty, withLot } from '../../../shared/utils/batch.utils';
import { priceBreakdown, PriceBreakdown } from '../../../shared/utils/pricing';
import { collectCategories, collectVatRates, parseVatRate, suggestCategories, suggestVatRates } from '../../../shared/utils/product-form.utils';
import { DateFieldComponent, GlassCardComponent, IconButtonComponent, PageHeaderComponent, StatusBadgeComponent } from '../../../shared/ui';
import { unitOptions, unitText } from '../product-unit';
import { formatPct } from '../inventory-ui';
import {
  barcodeFromScan, gtinMatches, Gs1KeysDirective, injectScannerTexts, ScanButtonComponent, ScanFeedback, ScanResult, scanResultFromText,
} from '../../../shared/scanner';
import { userErrorMessage } from '../../../core/error/user-error';
import { SupplierService } from '../../suppliers/services/supplier.service';
import { Supplier } from '../../../shared/models/supplier.model';
import { ProductRegulatoryFieldsComponent } from '../components/product-regulatory-fields.component';
import {
  RegulatoryForm, regulatoryFromProduct, regulatoryToChanges, suggestProductType, defaultRequiresPrescription, isPlantProtection,
} from '../../../shared/utils/regulatory.utils';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule,
    ButtonModule, InputTextModule, InputNumberModule, SelectModule,
    TextareaModule, ToggleSwitchModule, DateFieldComponent,
    ToastModule, AutoCompleteModule,
    PageHeaderComponent, GlassCardComponent, IconButtonComponent, StatusBadgeComponent, ProductRegulatoryFieldsComponent,
    ScanButtonComponent, Gs1KeysDirective,
  ],
  providers: [MessageService],
  host: { class: 'block', '(window:keydown.control.s)': 'onCtrlS($event)' },
  template: `
    <p-toast position="top-right" />

    <ui-page-header [title]="isEdit ? t().products.editProduct : t().products.addProduct"
                    [subtitle]="isEdit ? t().products.editSubtitle : t().products.addSubtitle"
                    [backLink]="isEdit ? ['/products', productId] : '/products'" [backLabel]="t().common.back" icon="pi-box">
      <p-button [label]="t().common.save" icon="pi pi-check" [loading]="saving()" [disabled]="form.invalid" (onClick)="save()"
                aria-keyshortcuts="Control+S" />
    </ui-page-header>

    <form class="page-body" [formGroup]="form" (ngSubmit)="save()">

      <!-- Bölüm atlama çubuğu (1366×768'de uzun formda hızlı geçiş) -->
      <nav class="sticky top-0 z-sticky -mx-3 -mt-3 flex gap-2 overflow-x-auto border-b border-line bg-page px-3 py-2 [scrollbar-width:none] lg:-mx-6 lg:-mt-5 lg:px-6"
           [attr.aria-label]="inv().jumpTo">
        @for (sec of sections(); track sec.id) {
          <button type="button" (click)="jump(sec.id)"
                  class="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-token-md border border-line-strong bg-surface px-3 text-13.5 font-semibold text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg">
            <span class="num flex h-5 w-5 items-center justify-center rounded-token-sm bg-surface-strong text-11 font-bold text-fg-secondary">{{ $index + 1 }}</span>
            {{ sec.label }}
            @if (sec.error) { <span class="h-2 w-2 rounded-full bg-danger" aria-hidden="true"></span> }
          </button>
        }
      </nav>

      <div class="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-4">
        <div class="flex min-w-0 flex-col gap-3 lg:gap-4">

          <!-- 1. Temel -->
          <ui-glass-card id="pf-sec-basic" class="scroll-mt-16" [title]="inv().secBasic" [subtitle]="inv().secBasicHint" icon="pi-info-circle">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="flex flex-col gap-1.5 md:col-span-2">
                <label for="pf-name" class="text-sm font-semibold text-fg-secondary">{{ t().products.formName }}</label>
                <input id="pf-name" pInputText formControlName="name" [placeholder]="t().products.infoName" class="w-full" />
                @if (form.get('name')?.invalid && (form.get('name')?.touched || submitted())) {
                  <p class="m-0 text-xs text-danger-text" role="alert">{{ t().products.formNameRequired }}</p>
                }
              </div>

              <div class="flex flex-col gap-1.5">
                <label for="pf-barcode" class="text-sm font-semibold text-fg-secondary">{{ t().products.formBarcode }}</label>
                <div class="flex items-center gap-2">
                  <input id="pf-barcode" pInputText appGs1Keys formControlName="barcode" [placeholder]="t().products.formBarcodePlaceholder" class="w-full min-w-0 font-mono"
                         (keydown.enter)="onBarcodeTyped($event)" (blur)="onBarcodeTyped()" />
                  <ui-scan-button (scanned)="onBarcodeScan($event)" />
                </div>
                @if (barcodeConflict(); as c) {
                  <p class="m-0 text-xs text-danger-text" role="alert">{{ t().products.barcodeDuplicate }} {{ c }}</p>
                }
              </div>

              <div class="flex flex-col gap-1.5">
                <label for="pf-brand" class="text-sm font-semibold text-fg-secondary">{{ t().products.formBrand }}</label>
                <input id="pf-brand" pInputText formControlName="brand" [placeholder]="t().products.formBrandPlaceholder" class="w-full" />
              </div>

              <div class="flex flex-col gap-1.5">
                <label for="pf-category" class="text-sm font-semibold text-fg-secondary">{{ t().products.formCategory }}</label>
                <p-autocomplete inputId="pf-category" [(ngModel)]="categoryStr" [ngModelOptions]="{standalone: true}"
                                (ngModelChange)="onCategoryChange($event)" (onSelect)="onCategoryChange($event.value)"
                                [suggestions]="categorySuggestions" (completeMethod)="searchCategory($event)"
                                [forceSelection]="false" [dropdown]="true" [placeholder]="t().products.formCategoryPlaceholder"
                                [autoOptionFocus]="true" styleClass="w-full" appendTo="body">
                  <!-- Y29: yeni kategori ayrı satır ("+ 'Güb' ekle"); eşleşen mevcut kategori ilk sırada ve vurgulu -->
                  <ng-template #item let-c>
                    @if (isNewCategory(c)) {
                      <span class="flex items-center gap-1.5 text-brand-text"><i class="pi pi-plus text-xs" aria-hidden="true"></i>{{ newCategoryLabel(c) }}</span>
                    } @else {
                      <span>{{ c }}</span>
                    }
                  </ng-template>
                </p-autocomplete>
                @if (submitted() && !categoryStr.trim()) {
                  <p class="m-0 text-xs text-danger-text" role="alert">{{ t().products.categoryRequired }}</p>
                }
              </div>

              <div class="flex flex-col gap-1.5">
                <label for="pf-supplier" class="text-sm font-semibold text-fg-secondary">
                  {{ t().products.dialogSupplier }} <span class="font-normal text-fg-muted">({{ t().common.optional }})</span>
                </label>
                <p-select inputId="pf-supplier" [ngModel]="supplierId()" (ngModelChange)="supplierId.set($event ?? null)"
                          [ngModelOptions]="{standalone: true}" [options]="suppliers()" optionLabel="name" optionValue="id"
                          [placeholder]="t().products.dialogSelectSupplier" [showClear]="true" [filter]="suppliers().length > 8"
                          styleClass="w-full" appendTo="body" [emptyMessage]="t().compliance.noSuppliers" />
              </div>

              <div class="flex flex-col gap-1.5 md:col-span-2">
                <label for="pf-desc" class="text-sm font-semibold text-fg-secondary">
                  {{ t().products.formDescription }} <span class="font-normal text-fg-muted">({{ t().common.optional }})</span>
                </label>
                <textarea id="pf-desc" pTextarea formControlName="description" rows="2" [placeholder]="t().products.formDescriptionPlaceholder"
                          class="w-full resize-y"></textarea>
              </div>

              <div class="flex items-center gap-3 rounded-token-lg border border-line bg-surface-muted px-4 py-3 md:col-span-2">
                <p-toggleswitch inputId="pf-active" formControlName="isActive" />
                <label for="pf-active" class="min-w-0 flex-1 cursor-pointer">
                  <span class="block text-sm font-semibold text-fg">{{ t().products.formIsActive }}</span>
                  <span class="block text-xs text-fg-secondary">{{ t().products.formIsActiveDesc }}</span>
                </label>
              </div>
            </div>
          </ui-glass-card>

          <!-- 2. Fiyat -->
          <ui-glass-card id="pf-sec-price" class="scroll-mt-16" [title]="inv().secPrice" [subtitle]="inv().secPriceHint" icon="pi-tag" tone="accent">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div class="flex flex-col gap-1.5">
                <label for="pf-purchase" class="text-sm font-semibold text-fg-secondary">{{ t().products.purchasePrice }} (₺) *</label>
                <p-inputnumber inputId="pf-purchase" formControlName="purchasePrice" [minFractionDigits]="2" [maxFractionDigits]="2" [min]="0"
                               mode="decimal" [locale]="t().products.locale" styleClass="w-full" inputStyleClass="w-full min-w-0" />
              </div>

              <div class="flex flex-col gap-1.5">
                <label for="pf-sale" class="text-sm font-semibold text-fg-secondary">{{ t().products.salePrice }} (₺ / {{ unitName() }}) *</label>
                <p-inputnumber inputId="pf-sale" formControlName="salePrice" [minFractionDigits]="2" [maxFractionDigits]="2" [min]="0"
                               mode="decimal" [locale]="t().products.locale" styleClass="w-full" inputStyleClass="w-full min-w-0" />
                @if (form.get('salePrice')?.invalid && (form.get('salePrice')?.touched || submitted())) {
                  <p class="m-0 text-xs text-danger-text" role="alert">{{ t().products.salePriceRequired }}</p>
                }
              </div>

              <div class="flex flex-col gap-1.5">
                <label for="pf-vat" class="text-sm font-semibold text-fg-secondary">{{ t().products.formVat }}</label>
                <p-autocomplete inputId="pf-vat" [(ngModel)]="vatRateStr" [ngModelOptions]="{standalone: true}"
                                [suggestions]="vatSuggestions" (completeMethod)="searchVat($event)"
                                [forceSelection]="false" [dropdown]="true" [placeholder]="t().products.formVatPlaceholder"
                                styleClass="w-full" appendTo="body" />
                @if (!vatValid()) {
                  <p class="m-0 text-xs text-danger-text" role="alert">{{ t().products.vatInvalid }}</p>
                }
              </div>
            </div>
            <div class="mt-4 flex items-center gap-3 rounded-token-lg border border-line bg-surface-muted px-4 py-3">
              <p-toggleswitch inputId="pf-buy-incl-vat" formControlName="purchasePriceIncludesVat" />
              <label for="pf-buy-incl-vat" class="min-w-0 flex-1 cursor-pointer">
                <span class="block text-sm font-semibold text-fg">{{ inv().purchaseIncludesVat }}</span>
                <span class="block text-xs text-fg-secondary">{{ inv().purchaseIncludesVatHint }}</span>
              </label>
            </div>
            <p class="num m-0 mt-3 text-sm text-fg-secondary" data-testid="pf-vat-breakdown" aria-live="polite">
              {{ vatBreakdownText() }}
            </p>
            <dl class="m-0 mt-3 grid grid-cols-3 overflow-hidden rounded-token-lg border border-line bg-surface-muted">
              <div class="border-r border-line px-3 py-2.5">
                <dt class="text-xs font-semibold text-fg-muted">{{ t().inventory.unitProfit }}</dt>
                <dd class="num m-0 text-base font-extrabold" [class]="unitProfit() < 0 ? 'text-danger-text' : 'text-fg'">{{ money(unitProfit()) }}</dd>
              </div>
              <div class="border-r border-line px-3 py-2.5">
                <dt class="text-xs font-semibold text-fg-muted">{{ inv().markupPreview }}</dt>
                <dd class="num m-0 text-base font-extrabold text-fg">{{ markupText() }}</dd>
              </div>
              <div class="px-3 py-2.5">
                <dt class="text-xs font-semibold text-fg-muted">{{ inv().marginPreview }}</dt>
                <dd class="num m-0 text-base font-extrabold text-fg">{{ marginText() }}</dd>
              </div>
            </dl>
            <p class="m-0 mt-2 text-xs text-fg-muted">{{ inv().profitNetNote }}</p>
          </ui-glass-card>

          <!-- 3. Stok ve birim -->
          <ui-glass-card id="pf-sec-stock" class="scroll-mt-16" [title]="inv().secStock" [subtitle]="inv().secStockHint" icon="pi-box" tone="success">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div class="flex flex-col gap-1.5">
                <label for="pf-unit" class="text-sm font-semibold text-fg-secondary">{{ t().products.unitLabel }}</label>
                <p-select inputId="pf-unit" formControlName="unit" [options]="units()" optionLabel="label" optionValue="value"
                          styleClass="w-full" appendTo="body" />
              </div>
              @if (!isEdit) {
                <div class="flex flex-col gap-1.5">
                  <label for="pf-stock" class="text-sm font-semibold text-fg-secondary">{{ t().products.formStockQty }} ({{ unitName() }})</label>
                  <p-inputnumber inputId="pf-stock" formControlName="stock" [min]="0" [showButtons]="true"
                                 [maxFractionDigits]="decimal() ? 3 : 0" [locale]="t().products.locale" styleClass="w-full" inputStyleClass="w-full min-w-0" />
                </div>
              }
              <div class="flex flex-col gap-1.5">
                <label for="pf-min" class="text-sm font-semibold text-fg-secondary">{{ t().products.formMinStock }} ({{ unitName() }})</label>
                <p-inputnumber inputId="pf-min" formControlName="minStock" [min]="0" [showButtons]="true"
                               [maxFractionDigits]="decimal() ? 3 : 0" [locale]="t().products.locale" styleClass="w-full" inputStyleClass="w-full min-w-0" />
              </div>
              @if (decimal()) {
                <p class="m-0 text-xs text-fg-muted sm:col-span-3">{{ t().products.unitDecimalHint }}</p>
              }
              @if (isEdit) {
                <div class="flex items-center gap-2 rounded-token-lg border border-info-line bg-info-soft px-4 py-3 text-sm text-fg-secondary sm:col-span-3">
                  <i class="pi pi-info-circle text-info-text" aria-hidden="true"></i> {{ t().products.formStockEditHint }}
                </div>
              }
            </div>
          </ui-glass-card>

          <!-- 4. Mevzuat -->
          <ui-glass-card id="pf-sec-reg" class="scroll-mt-16" [title]="t().compliance.sectionTitle" [subtitle]="inv().secRegulatoryHint" icon="pi-verified" tone="warning">
            <app-product-regulatory-fields [(value)]="regulatory" />
          </ui-glass-card>

          <!-- 5. GTS / ilk parti (sadece yeni üründe; edit modunda partiler formdan yazılmaz) -->
          @if (!isEdit) {
            <ui-glass-card id="pf-sec-gts" class="scroll-mt-16" [title]="inv().secGts" [subtitle]="inv().secGtsHint" icon="pi-qrcode" tone="info">
              @if (gtsList().length) {
                <ui-status-badge card-actions tone="info"><span class="num">{{ gtsList().length }}</span> GTS</ui-status-badge>
              }
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div class="flex flex-col gap-1.5">
                  <label for="pf-gts" class="text-sm font-semibold text-fg-secondary">{{ t().products.formGtsNo }}</label>
                  <div class="flex items-center gap-2">
                    <input id="pf-gts" pInputText appGs1Keys formControlName="gtsNo" [placeholder]="t().products.dialogGtsScanPlaceholder"
                           class="w-full min-w-0 font-mono" autocomplete="off" (keydown.enter)="addFormGts($event)" (blur)="addFormGts()" />
                    <ui-scan-button continuous [handler]="onGtsScan" />
                  </div>
                  <span class="text-xs text-fg-muted">{{ t().compliance.formGtsHint }}</span>
                  @if (gtsList().length) {
                    <ul class="m-0 mt-1 flex max-h-40 list-none flex-wrap gap-1.5 overflow-auto p-0">
                      @for (g of gtsList(); track g; let i = $index) {
                        <li class="inline-flex items-center gap-1 rounded-token-md border border-brand-line bg-brand-soft py-0.5 pl-2 pr-0.5 font-mono text-xs text-fg">
                          <span class="num text-fg-muted">{{ i + 1 }}.</span> {{ g }}
                          <ui-icon-button icon="pi-times" size="sm" tone="danger" [ariaLabel]="t().products.gtsChipRemove + ': ' + g" (click)="removeFormGts(i)" />
                        </li>
                      }
                    </ul>
                    @if (gtsStockGap() > 0) {
                      <p class="m-0 text-xs text-warning-text" role="status">{{ t().compliance.gtsStockGap.replace('{n}', '' + gtsStockGap()) }}</p>
                    }
                  }
                  @if (gtsConflict(); as c) {
                    <p class="m-0 text-xs text-danger-text" role="alert">{{ t().products.gtsDuplicateOther }} {{ c }}</p>
                  }
                </div>

                <div class="flex flex-col gap-1.5">
                  <label for="pf-expiry" class="text-sm font-semibold text-fg-secondary">{{ t().products.formExpiry }}</label>
                  <ui-date-field inputId="pf-expiry" formControlName="expiryDateVal" [placeholder]="t().products.formExpiryPlaceholder" />
                  @if (expiryMissingForPp()) {
                    <p class="m-0 text-xs" [class]="submitted() ? 'text-danger-text' : 'text-warning-text'" [attr.role]="submitted() ? 'alert' : null">{{ inv().expiryRequiredPpHint }}</p>
                  } @else if (gtsWithoutExpiry() > 0 && form.controls.expiryDateVal.value) {
                    <p class="m-0 text-xs text-fg-muted">{{ inv().gtsNoExpiry(gtsWithoutExpiry()) }}</p>
                  }
                </div>

                <div class="flex flex-col gap-1.5">
                  <label for="pf-lot" class="text-sm font-semibold text-fg-secondary">{{ inv().lotNo }}</label>
                  <input id="pf-lot" pInputText formControlName="lotNoVal" maxlength="20" autocomplete="off"
                         class="w-full font-mono uppercase placeholder:normal-case" [placeholder]="inv().lotNoPlaceholder" />
                </div>
              </div>
            </ui-glass-card>
          }
        </div>

        <!-- Sağ: yapışkan özet + kaydet (masaüstü) -->
        <aside class="sticky top-16 hidden lg:block">
          <ui-glass-card [title]="inv().summary" icon="pi-list-check" tone="neutral" padding="none">
            <dl class="m-0 flex flex-col px-4 py-2 text-sm">
              <div class="flex items-baseline justify-between gap-3 border-b border-line py-2">
                <dt class="shrink-0 text-fg-muted">{{ t().products.infoName }}</dt>
                <dd class="m-0 min-w-0 truncate text-right font-semibold text-fg">{{ form.value.name || '—' }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-3 border-b border-line py-2">
                <dt class="text-fg-muted">{{ t().products.salePrice }}</dt>
                <dd class="num m-0 font-extrabold text-fg">{{ money(form.value.salePrice ?? 0) }} <span class="font-sans text-xs font-medium text-fg-muted">/ {{ unitName() }}</span></dd>
              </div>
              <div class="flex items-baseline justify-between gap-3 border-b border-line py-2">
                <dt class="text-fg-muted">{{ inv().markupPreview }}</dt>
                <dd class="num m-0 font-bold text-fg">{{ markupText() }}</dd>
              </div>
              @if (!isEdit) {
                <div class="flex items-baseline justify-between gap-3 border-b border-line py-2">
                  <dt class="text-fg-muted">{{ t().products.formStockQty.replace(' *', '') }}</dt>
                  <dd class="num m-0 font-bold text-fg">{{ form.value.stock ?? 0 }} {{ unitName() }}</dd>
                </div>
                <div class="flex items-baseline justify-between gap-3 py-2">
                  <dt class="text-fg-muted">GTS</dt>
                  <dd class="num m-0 font-bold text-fg">{{ gtsList().length }}</dd>
                </div>
              } @else {
                <div class="flex items-baseline justify-between gap-3 py-2">
                  <dt class="text-fg-muted">{{ t().products.infoMinStock }}</dt>
                  <dd class="num m-0 font-bold text-fg">{{ form.value.minStock ?? 0 }} {{ unitName() }}</dd>
                </div>
              }
            </dl>
            <div card-footer class="flex flex-col gap-2 border-t border-line p-3">
              <p-button type="submit" [label]="t().common.save" icon="pi pi-check" size="large" [loading]="saving()"
                        [disabled]="form.invalid" styleClass="w-full" />
              <p class="m-0 text-center text-xs text-fg-muted">{{ inv().saveHint }}</p>
            </div>
          </ui-glass-card>
        </aside>
      </div>

      <!-- Telefon / tablet: alt kaydet -->
      <div class="lg:hidden">
        <p-button type="submit" [label]="t().common.save" icon="pi pi-check" size="large" [loading]="saving()"
                  [disabled]="form.invalid" styleClass="w-full" />
      </div>
    </form>
  `,
})
export class ProductFormPage implements OnInit {
  private readonly svc = inject(ProductService);
  private readonly store = inject(ProductStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly messageSvc = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly supplierSvc = inject(SupplierService);
  private readonly lang = inject(LangService);
  readonly t = this.lang.t;
  private readonly sx = injectScannerTexts();
  readonly inv = computed(() => this.t().inventory);

  readonly suppliers = signal<Supplier[]>([]);
  readonly supplierId = signal<string | null>(null);
  /** Mevzuat alanları (ürün türü, e-reçete, ruhsat no, ...) */
  regulatory: RegulatoryForm = regulatoryFromProduct(null);
  /** Kategoriden en son önerilen tür — kullanıcı türü elle değiştirdiyse kategori değişimi türü ezmez. */
  private lastSuggestedType: ProductType | null = regulatoryFromProduct(null).productType;
  /** İlk partide okutulan GTS'ler (her biri 1 birim) */
  readonly gtsList = signal<string[]>([]);
  /** GTS → karekoddan okunan parti no */
  private readonly scannedLots = new Map<string, string>();
  /** GTS → karekoddan okunan SKT (AI 17). Farklı SKT'li birimler kendi SKT'siyle ayrı parti olur (Y3). */
  private readonly scannedExpiries = new Map<string, Date>();

  readonly saving = signal(false);
  readonly submitted = signal(false);
  isEdit = false;
  productId = '';
  /** Edit modunda ürün yüklenene kadar kaydetme engellenir (boş formla üzerine yazmayı önler) */
  private editLoaded = false;

  vatRateStr = '';
  vatSuggestions: string[] = [];

  categoryStr = '';
  categorySuggestions: string[] = [];

  readonly units = computed(() => unitOptions(this.t().products));

  /** Bölüm atlama çubuğu (hatalı bölüm kırmızı noktayla) */
  sections(): { id: string; label: string; error: boolean }[] {
    const i = this.inv();
    const sub = this.submitted();
    const list = [
      { id: 'pf-sec-basic', label: i.secBasic, error: sub && (!!this.form.controls.name.invalid || !this.categoryStr.trim()) || !!this.barcodeConflict() },
      { id: 'pf-sec-price', label: i.secPrice, error: (sub && this.form.controls.salePrice.invalid) || !this.vatValid() },
      { id: 'pf-sec-stock', label: i.secStock, error: false },
      { id: 'pf-sec-reg', label: this.t().compliance.sectionTitle, error: false },
    ];
    if (!this.isEdit) list.push({ id: 'pf-sec-gts', label: i.secGts, error: !!this.gtsConflict() });
    return list;
  }

  jump(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  onCtrlS(event: Event): void {
    event.preventDefault();
    if (!this.form.invalid && !this.saving()) this.save();
  }

  /** Canlı fiyat dökümü: satış KDV dahil; kâr KDV hariç net tutarlardan (shared/utils/pricing.ts). */
  pricing(): PriceBreakdown {
    const v = this.form.value;
    return priceBreakdown({
      salePrice: Number(v.salePrice) || 0,
      purchasePrice: Number(v.purchasePrice) || 0,
      vatRate: parseVatRate(this.vatRateStr).value,
      purchasePriceIncludesVat: !!v.purchasePriceIncludesVat,
    });
  }

  unitProfit(): number {
    return this.pricing().profit;
  }

  markupText(): string {
    return formatPct(this.pricing().markup, this.t().products.locale);
  }

  marginText(): string {
    return formatPct(this.pricing().margin, this.t().products.locale);
  }

  vatBreakdownText(): string {
    const b = this.pricing();
    return this.inv().vatBreakdown(this.money(b.gross), this.money(b.netSale), this.money(b.vat))
      + (b.vatRate ? ` (%${b.vatRate})` : '');
  }

  money(n: number): string {
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ₺';
  }

  unitName(): string {
    return unitText(this.form.controls.unit.value, this.t().products);
  }

  readonly form = this.fb.group({
    name: ['', Validators.required],
    barcode: [''],
    brand: [''],
    purchasePrice: [0, [Validators.required, Validators.min(0)]],
    salePrice: [0, [Validators.required, Validators.min(0.01)]],
    purchasePriceIncludesVat: [false],
    stock: [0, [Validators.required, Validators.min(0)]],
    minStock: [5],
    unit: [DEFAULT_PRODUCT_UNIT as ProductUnit],
    gtsNo: [''],
    expiryDateVal: [null as Date | null],
    lotNoVal: [''],
    description: [''],
    isActive: [true],
  });

  ngOnInit(): void {
    this.store.ensureLoaded();
    this.supplierSvc.getAll$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: s => this.suppliers.set(s),
      error: () => this.suppliers.set([]),
    });
    this.productId = this.route.snapshot.paramMap.get('id') ?? '';
    this.isEdit = !!this.productId && this.productId !== 'new';

    if (this.isEdit) {
      const product = this.store.products().find(p => p.id === this.productId);
      if (product) {
        this.patchFromProduct(product);
      } else {
        this.svc.getById$(this.productId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(p => { if (p) this.patchFromProduct(p); });
      }
    }
  }

  /** Seçili birim ondalıklı miktar kabul ediyor mu (kg / lt / metre) */
  decimal(): boolean {
    return isDecimalUnit(this.form.controls.unit.value);
  }

  /** Birime göre miktarı normalize et (adet: tam sayı, kg/lt/metre: 3 ondalık) */
  private normQty(n: unknown): number {
    const v = Math.max(0, Number(n) || 0);
    return this.decimal() ? roundQty(v) : Math.floor(v);
  }

  private knownCategories: string[] = [];

  searchCategory(event: { query: string }): void {
    this.knownCategories = collectCategories(this.store.products());
    this.categorySuggestions = suggestCategories(this.knownCategories, event.query);
  }

  isNewCategory(c: string): boolean {
    const l = (c ?? '').toLocaleLowerCase('tr-TR');
    return !this.knownCategories.some(k => k.toLocaleLowerCase('tr-TR') === l);
  }

  newCategoryLabel(c: string): string {
    return this.lang.lang() === 'tr' ? `"${c}" yeni kategori olarak ekle` : `Add "${c}" as a new category`;
  }

  searchVat(event: { query: string }): void {
    this.vatSuggestions = suggestVatRates(collectVatRates(this.store.products()), event.query);
  }

  vatValid(): boolean {
    return parseVatRate(this.vatRateStr).valid;
  }

  /** 2.14: barkod aynı tenant'ın yüklü ürünlerinde (barkod veya GTS olarak) kullanılıyor mu */
  barcodeConflict(): string | null {
    return findBarcodeConflict(this.store.products(), this.form.value.barcode ?? '', this.isEdit ? this.productId : undefined)?.name ?? null;
  }

  /** 2.14: ilk partinin GTS'lerinden biri başka bir birimde / barkodda kullanılıyor mu */
  gtsConflict(): string | null {
    if (this.isEdit) return null;
    for (const g of this.gtsList()) {
      const hit = this.gtsConflictOf(g);
      if (hit) return `${hit} (${g})`;
    }
    return null;
  }

  private gtsConflictOf(g: string): string | null {
    return findGtsConflict(this.store.products(), g)?.product.name
      ?? this.store.products().find(p => (p.barcode ?? '').trim() === g)?.name
      ?? null;
  }

  /** Kategori değişince ürün türünü öner (kullanıcı türü elle değiştirmediyse). */
  onCategoryChange(value: unknown): void {
    const type = suggestProductType(typeof value === 'string' ? value : '');
    if (this.regulatory.productType !== this.lastSuggestedType) return;
    this.lastSuggestedType = type;
    if (this.regulatory.productType === type) return;
    this.regulatory = { ...this.regulatory, productType: type, requiresPrescription: defaultRequiresPrescription(type) };
  }

  /**
   * GTS okut/yaz + Enter: listeye ekle (1 birim). Stok GTS sayısından azsa stok artırılır.
   * Y3: USB okuyucu / elle giriş kamera ile aynı yoldan geçer; karekoddaki SKT (17) ve parti (10) forma yazılır.
   */
  addFormGts(event?: Event): void {
    event?.preventDefault();
    const raw = (this.form.controls.gtsNo.value ?? '').trim();
    if (!raw) return;
    this.form.controls.gtsNo.setValue('');
    const r = scanResultFromText(raw);
    const fb = this.onGtsScan(r);
    // Düz GTS başarıyla eklendiyse sessiz; karekodsa okunan SKT / parti bilgisi gösterilir
    if (fb.tone !== 'success' || r.gs1) {
      this.messageSvc.add({ severity: fb.tone === 'success' ? 'success' : fb.tone === 'warn' ? 'warn' : 'error', summary: '', detail: fb.message, life: 3500 });
    }
  }

  /** Barkod alanına USB okuyucuyla karekod okutulduysa kamera yoluyla aynı işlem (GTIN → EAN-13, GTS, SKT). */
  onBarcodeTyped(event?: Event): void {
    const raw = (this.form.controls.barcode.value ?? '').trim();
    const r = raw ? scanResultFromText(raw) : null;
    if (!r?.gs1?.gtin) return;
    event?.preventDefault();
    this.onBarcodeScan(r);
  }

  /** Bitki koruma ürünü + stok var + SKT'siz birim kalıyor (ne formda ne karekodda SKT). */
  expiryMissingForPp(): boolean {
    if (this.isEdit) return false;
    if (!isPlantProtection({ productType: this.regulatory.productType, category: this.categoryStr })) return false;
    const stock = Math.max(Number(this.form.controls.stock.value) || 0, this.gtsList().length);
    if (stock <= 0 || this.form.controls.expiryDateVal.value) return false;
    // Formda SKT yok: tüm birimler karekoddan SKT almış olmalı (GTS'siz kalan birim varsa SKT'siz kalır)
    const list = this.gtsList();
    return list.length < stock || list.some(g => !this.scannedExpiries.has(g));
  }

  /** Karekodunda SKT olmayan GTS sayısı (formdaki SKT bunlara yazılır). */
  gtsWithoutExpiry(): number {
    return this.gtsList().filter(g => !this.scannedExpiries.has(g)).length;
  }

  /** Karekoddaki parti no (AI 10): GTS'ye özel saklanır; form alanı boşsa oraya da yazılır. */
  private rememberLot(gts: string, lot: string | null): void {
    const l = normalizeLotNo(lot);
    if (!l) return;
    this.scannedLots.set(gts, l);
    if (!(this.form.controls.lotNoVal.value ?? '').trim()) this.form.controls.lotNoVal.setValue(l);
  }

  /**
   * Barkod alanına kamerayla okut. Karekodsa barkod = GTIN'den EAN-13; yeni üründe ayrıca birim GTS listeye,
   * SKT boşsa karekoddaki SKT forma yazılır.
   */
  onBarcodeScan(r: ScanResult): void {
    this.form.controls.barcode.setValue(barcodeFromScan(r.text));
    this.form.controls.barcode.markAsDirty();
    if (r.gs1?.gtin && !this.isEdit) {
      const fb = this.onGtsScan(r);
      this.messageSvc.add({ severity: fb.tone === 'success' ? 'success' : 'warn', summary: '', detail: fb.message, life: 3500 });
    }
  }

  /**
   * GTS / ilk parti: sürekli kamera okutması — her karekod bir GTS çipi. GTIN ürün barkoduyla eşleşmezse eklenmez;
   * barkod boşsa GTIN'den doldurulur; SKT boşsa karekoddaki SKT yazılır.
   */
  readonly onGtsScan = (r: ScanResult): ScanFeedback => {
    const sx = this.sx();
    const pr = this.t().products;
    const barcode = (this.form.controls.barcode.value ?? '').trim();
    const gtin = r.gs1?.gtin ?? null;
    if (gtin && barcode && !gtinMatches(barcode, gtin)) {
      return { tone: 'error', message: sx.gtinMismatch(r.gs1?.ean13 ?? gtin, barcode) };
    }
    if (gtin && !barcode) this.form.controls.barcode.setValue(r.gs1?.ean13 ?? gtin);
    const code = r.code;
    if (this.gtsList().includes(code)) return { tone: 'warn', message: pr.dialogGtsDuplicate };
    const conflict = this.gtsConflictOf(code);
    if (conflict) return { tone: 'warn', message: `${pr.gtsDuplicateOther} ${conflict}` };
    this.gtsList.update(l => [...l, code]);
    const n = this.gtsList().length;
    if ((Number(this.form.controls.stock.value) || 0) < n) this.form.controls.stock.setValue(n);
    const parts = [`GTS ${n}`];
    if (r.gs1?.expiry) {
      this.scannedExpiries.set(code, r.gs1.expiry);
      if (!this.form.controls.expiryDateVal.value) this.form.controls.expiryDateVal.setValue(r.gs1.expiry);
      parts.push(`${sx.gs1Expiry}: ${r.gs1.expiry.toLocaleDateString(pr.locale)}`);
    }
    if (r.gs1?.lot) parts.push(`${sx.gs1Lot}: ${r.gs1.lot}`);
    this.rememberLot(code, r.gs1?.lot ?? null);
    return { tone: 'success', message: parts.join(' · ') };
  };

  removeFormGts(index: number): void {
    const g = this.gtsList()[index];
    if (g) { this.scannedExpiries.delete(g); this.scannedLots.delete(g); }
    this.gtsList.update(l => l.filter((_, i) => i !== index));
  }

  /** Stokta GTS'siz kalacak birim sayısı (bilgi). */
  gtsStockGap(): number {
    const n = this.gtsList().length;
    return n ? Math.max(0, roundQty((Number(this.form.controls.stock.value) || 0) - n)) : 0;
  }

  private patchFromProduct(product: Product): void {
    this.form.patchValue({
      name: product.name,
      barcode: product.barcode ?? '',
      brand: product.brand ?? '',
      purchasePrice: product.purchasePrice,
      salePrice: product.salePrice,
      purchasePriceIncludesVat: !!product.purchasePriceIncludesVat,
      minStock: product.minStock,
      unit: productUnit(product),
      description: product.description ?? '',
      isActive: product.isActive,
    });
    this.vatRateStr = product.vatRate != null ? product.vatRate.toString() : '';
    this.categoryStr = product.category ?? '';
    this.supplierId.set(product.supplierId ?? null);
    this.regulatory = regulatoryFromProduct(product);
    this.lastSuggestedType = product.productType ? null : this.regulatory.productType;
    this.editLoaded = true;
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    const pr = this.t().products;
    if (this.form.invalid || !this.categoryStr.trim() || !this.vatValid()) { this.form.markAllAsTouched(); return; }
    if (this.isEdit && !this.editLoaded) return;
    // Yazılıp Enter'a basılmamış son GTS de (SKT kontrolünden önce) listeye alınsın
    if (!this.isEdit && (this.form.controls.gtsNo.value ?? '').trim()) this.addFormGts();
    // Y3 (mevzuat): bitki koruma ürünü SKT'siz kaydedilemez
    if (this.expiryMissingForPp()) {
      this.messageSvc.add({ severity: 'error', summary: this.t().common.error, detail: this.inv().expiryRequiredPp, life: 6000 });
      document.getElementById('pf-expiry')?.focus();
      return;
    }
    const dupBarcode = this.barcodeConflict();
    if (dupBarcode) {
      this.messageSvc.add({ severity: 'error', summary: this.t().common.error, detail: `${pr.barcodeDuplicate} ${dupBarcode}`, life: 4000 });
      return;
    }
    const dupGts = this.gtsConflict();
    if (dupGts) {
      this.messageSvc.add({ severity: 'error', summary: this.t().common.error, detail: `${pr.gtsDuplicateOther} ${dupGts}`, life: 4000 });
      return;
    }

    this.saving.set(true);
    try {
      const v = this.form.value;
      const info = {
        name: (v.name ?? '').trim(),
        barcode: (v.barcode ?? '').trim(),
        category: this.categoryStr.trim(),
        brand: v.brand?.trim() || null,
        purchasePrice: Number(v.purchasePrice) || 0,
        salePrice: Number(v.salePrice),
        vatRate: parseVatRate(this.vatRateStr).value,
        purchasePriceIncludesVat: !!v.purchasePriceIncludesVat,
        minStock: this.normQty(v.minStock),
        unit: productUnit({ unit: v.unit ?? undefined }),
        description: v.description?.trim() || null,
        isActive: v.isActive ?? true,
        supplierId: this.supplierId() || null,
        ...regulatoryToChanges(this.regulatory),
      };

      if (this.isEdit) {
        // 1.6: edit modunda stok / partiler / SKT ASLA gönderilmez — GTS birimleri korunur.
        await this.svc.update(this.productId, info);
      } else {
        const stock = this.normQty(v.stock);
        const expiryDate = v.expiryDateVal ? Timestamp.fromDate(v.expiryDateVal) : null;
        // Yazılıp Enter'a basılmamış son GTS de listeye alınır
        if ((v.gtsNo ?? '').trim()) this.addFormGts();
        const gtsList = this.gtsList();
        const addedAt = Timestamp.now();
        const supplierId = this.supplierId() || null;
        const formLot = normalizeLotNo(v.lotNoVal);
        // Parti no: karekoddan okunduysa o GTS'nin kendi partisi, değilse formdaki
        // SKT: karekoddan okunduysa o GTS'nin kendi SKT'si (farklı SKT = ayrı parti), değilse formdaki
        const expiryOf = (gts: string | null): Timestamp | null => {
          const d = gts ? this.scannedExpiries.get(gts) : undefined;
          return d ? Timestamp.fromDate(d) : expiryDate;
        };
        const mk = (quantity: number, gts: string | null): Batch =>
          withLot({ id: crypto.randomUUID(), quantity, expiryDate: expiryOf(gts), gtsNo: gts, addedAt, supplierId },
            (gts && this.scannedLots.get(gts)) || formLot);
        // GTS kuralı: GTS'li her birim = quantity:1. Kalan adet GTS'siz tek parti olur.
        const totalStock = Math.max(stock, gtsList.length);
        const rest = roundQty(totalStock - gtsList.length);
        const batches: Batch[] = totalStock <= 0 ? []
          : [...gtsList.map(g => mk(1, g)), ...(rest > 0 ? [mk(rest, null)] : [])];
        // İlk stok > 0 ise servis 'in' stok hareketini aynı yazma grubunda kaydeder.
        await this.svc.create({ ...info, stock: totalStock, expiryDate, imageUrl: null, batches }, pr.initialStockReason);

      }
      this.messageSvc.add({ severity: 'success', summary: '', detail: this.isEdit ? pr.updated : pr.added, life: 2000 });
      await this.router.navigate(this.isEdit ? ['/products', this.productId] : ['/products']);
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string } | null;
      const detail = err instanceof ProductStockError && err.code === 'duplicate-gts'
        ? `${pr.dialogGtsDuplicate}: ${err.detail ?? ''}`
        : e?.message?.includes('permission') || e?.code === 'permission-denied'
          ? pr.permissionError
          : userErrorMessage(err, pr.updateFailed, this.lang.lang());
      this.messageSvc.add({ severity: 'error', summary: this.t().common.error, detail, life: 5000 });
    } finally {
      this.saving.set(false);
    }
  }
}
