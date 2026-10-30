import { Component, computed, DestroyRef, effect, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ProductStore } from '../store/product.store';
import { ProductService, ProductStockError } from '../services/product.service';
import { Batch, isDecimalUnit, Product, productUnit, ProductUnit, StockMovement } from '../../../shared/models/product.model';
import { SupplierService } from '../../suppliers/services/supplier.service';
import { Supplier } from '../../../shared/models/supplier.model';
import { LangService } from '../../../core/i18n/lang.service';
import { batchTotal, checkStockVsBatches, expiryInfo, findBarcodeConflict, findGtsConflict, roundQty, sortFEFO } from '../../../shared/utils/batch.utils';
import { priceBreakdown } from '../../../shared/utils/pricing';
import { collectCategories, collectVatRates, parseVatRate, suggestCategories, suggestVatRates } from '../../../shared/utils/product-form.utils';
import { DateFieldComponent, GlassCardComponent, IconButtonComponent, MoneyComponent, PageHeaderComponent } from '../../../shared/ui';
import { ProductStockBannerComponent, ReconcileMode } from '../components/product-stock-banner.component';
import { ProductMovementListComponent } from '../components/product-movement-list.component';
import { GtsRowSave, ProductGtsTableComponent } from '../components/product-gts-table.component';
import { GtsAddRequest, ProductGtsAddPanelComponent } from '../components/product-gts-add-panel.component';
import { qtyFractionDigits, qtyWithUnit, unitOptions, unitText } from '../product-unit';
import { formatPctNumber } from '../inventory-ui';
import { ProductRegulatoryCardComponent } from '../components/product-regulatory-card.component';
import { AuthService } from '../../../core/auth/services/auth.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    RouterLink, FormsModule,
    ButtonModule, DialogModule, ConfirmDialogModule, InputNumberModule,
    InputTextModule, SelectModule, DateFieldComponent, ToastModule, SkeletonModule, AutoCompleteModule, ToggleSwitchModule,
    PageHeaderComponent, GlassCardComponent, IconButtonComponent, MoneyComponent,
    ProductStockBannerComponent, ProductMovementListComponent, ProductGtsTableComponent, ProductGtsAddPanelComponent,
    ProductRegulatoryCardComponent,
  ],
  providers: [MessageService, ConfirmationService],
  host: { class: 'block' },
  template: `
    <p-toast position="top-right" />
    <p-confirmDialog />

    <ui-page-header [title]="product()?.name ?? t().products.detail" [subtitle]="headerSubtitle()"
                    backLink="/products" [backLabel]="t().common.back" icon="pi-box">
      @if (product() && !isEditing() && isAdmin) {
        <ui-icon-button variant="outline" [icon]="isPassive() ? 'pi-check-circle' : 'pi-ban'" [tone]="isPassive() ? 'success' : 'neutral'"
                        [ariaLabel]="isPassive() ? t().products.makeActive : t().products.makePassive"
                        [disabled]="saving()" (click)="toggleActive()" />
        <ui-icon-button icon="pi-trash" variant="outline" tone="danger" [ariaLabel]="t().common.delete" (click)="confirmDelete()" />
        <ui-icon-button class="sm:hidden" icon="pi-pencil" variant="outline" [ariaLabel]="t().common.edit" (click)="startEdit()" />
        <p-button icon="pi pi-pencil" [label]="t().common.edit" severity="secondary" class="hidden sm:inline-flex" (onClick)="startEdit()" />
        <p-button icon="pi pi-truck" [label]="t().inventory.stockEntry" severity="secondary" routerLink="/purchases/new" class="hidden md:inline-flex" />
      }
      @if (isEditing()) {
        <ui-icon-button icon="pi-times" variant="outline" [ariaLabel]="t().common.cancel" (click)="cancelEdit()" />
        <p-button icon="pi pi-check" [label]="t().common.save" [loading]="saving()" (onClick)="saveEdit()" />
      }
    </ui-page-header>

    <div class="page-body">
      @if (!product()) {
        <div class="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-4" aria-hidden="true">
          <div class="ui-card flex flex-col gap-4 p-5">
            @for (i of [1,2,3,4,5]; track i) { <p-skeleton height="20px" /> }
          </div>
          <div class="ui-card flex flex-col gap-3 p-5">
            @for (i of [1,2,3]; track i) { <p-skeleton height="56px" /> }
          </div>
        </div>
      } @else {
        @if (isPassive()) {
          <div class="flex flex-wrap items-center gap-3 rounded-token-lg border border-line bg-surface-muted px-4 py-3">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-token-md bg-surface-strong text-fg-secondary" aria-hidden="true">
              <i class="pi pi-ban"></i>
            </span>
            <p class="m-0 flex-1 text-sm font-semibold text-fg">{{ t().products.passive }}</p>
            @if (isAdmin) {
              <p-button [label]="t().products.makeActive" icon="pi pi-check-circle" size="small" [loading]="saving()" (onClick)="toggleActive()" />
            }
          </div>
        }

        <div class="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-4">

          <!-- Sol: stok + bilgi -->
          <div class="flex min-w-0 flex-col gap-3 lg:gap-4">
            <app-product-stock-banner [product]="product()!" [reconcileState]="reconcile()" [expiredQty]="expiry().expiredQty"
                                      [saving]="saving()" (reconcile)="confirmReconcile($event)">
              <ng-container stock-actions>
                @if (isAdmin) {
                  <p-button [label]="t().products.addStock" icon="pi pi-plus" (onClick)="openDialog('in')" />
                  <p-button [label]="t().products.removeStock" icon="pi pi-minus" severity="secondary"
                            [disabled]="product()!.stock <= 0" (onClick)="openDialog('out')" />
                }
                <a [routerLink]="['/products', productId(), 'movements']"
                   class="ml-auto inline-flex min-h-[44px] items-center gap-1.5 px-1 text-13.5 font-semibold text-brand-text no-underline hover:underline">
                  <i class="pi pi-history text-sm" aria-hidden="true"></i>{{ t().products.viewMovements }}
                </a>
              </ng-container>
            </app-product-stock-banner>

            <ui-glass-card [title]="t().inventory.infoCard" icon="pi-info-circle" tone="neutral">
              @if (!isEditing() && isAdmin) {
                <p-button card-actions [label]="t().common.edit" icon="pi pi-pencil" size="small" severity="secondary" [text]="true" (onClick)="startEdit()" />
              }
              @if (!isEditing()) {
                <dl class="m-0 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                  @for (row of infoRows(); track row.label) {
                    <div class="flex items-baseline justify-between gap-3 border-b border-line py-2.5 sm:flex-col sm:items-start sm:justify-start sm:gap-0.5">
                      <dt class="shrink-0 text-12.5 font-semibold text-fg-muted">{{ row.label }}</dt>
                      <dd class="m-0 min-w-0 break-words text-right text-sm font-semibold sm:text-left" [class]="row.class ?? 'text-fg'">{{ row.value }}</dd>
                    </div>
                  }
                </dl>
              } @else {
                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div class="flex flex-col gap-1.5 md:col-span-2">
                    <label for="pd-name" class="text-sm font-semibold text-fg-secondary">{{ t().products.infoName }}</label>
                    <input id="pd-name" pInputText [(ngModel)]="editForm.name" class="w-full" />
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label for="pd-barcode" class="text-sm font-semibold text-fg-secondary">{{ t().products.infoBarcode }}</label>
                    <input id="pd-barcode" pInputText [(ngModel)]="editForm.barcode" class="w-full font-mono" />
                    @if (editBarcodeConflict(); as c) {
                      <p class="m-0 text-xs text-danger-text" role="alert">{{ t().products.barcodeDuplicate }} {{ c }}</p>
                    }
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label for="pd-brand" class="text-sm font-semibold text-fg-secondary">{{ t().products.infoBrand }}</label>
                    <input id="pd-brand" pInputText [(ngModel)]="editForm.brand" class="w-full" />
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label for="pd-category" class="text-sm font-semibold text-fg-secondary">{{ t().products.infoCategory }}</label>
                    <p-autocomplete inputId="pd-category" [(ngModel)]="editForm.category" [suggestions]="categorySuggestions"
                                    (completeMethod)="searchCategory($event)" [forceSelection]="false" [dropdown]="true"
                                    [placeholder]="t().products.formCategoryPlaceholder" styleClass="w-full" appendTo="body" />
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label for="pd-unit" class="text-sm font-semibold text-fg-secondary">{{ t().products.unitLabel }}</label>
                    <p-select inputId="pd-unit" [(ngModel)]="editForm.unit" [options]="units()" optionLabel="label" optionValue="value"
                              styleClass="w-full" appendTo="body" />
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label for="pd-min" class="text-sm font-semibold text-fg-secondary">{{ t().products.infoMinStock }}</label>
                    <p-inputNumber inputId="pd-min" [(ngModel)]="editForm.minStock" [min]="0"
                                   [maxFractionDigits]="editDecimal() ? 3 : 0" [locale]="t().products.locale" styleClass="w-full" />
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label for="pd-purchase" class="text-sm font-semibold text-fg-secondary">{{ t().products.purchasePrice }} (₺)</label>
                    <p-inputNumber inputId="pd-purchase" [(ngModel)]="editForm.purchasePrice" [min]="0" [minFractionDigits]="2" [maxFractionDigits]="2"
                                   mode="decimal" [locale]="t().products.locale" styleClass="w-full" />
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label for="pd-sale" class="text-sm font-semibold text-fg-secondary">{{ t().products.salePrice }} (₺)</label>
                    <p-inputNumber inputId="pd-sale" [(ngModel)]="editForm.salePrice" [min]="0" [minFractionDigits]="2" [maxFractionDigits]="2"
                                   mode="decimal" [locale]="t().products.locale" styleClass="w-full" />
                    @if (!(editForm.salePrice > 0)) {
                      <p class="m-0 text-xs text-danger-text" role="alert">{{ t().products.salePriceRequired }}</p>
                    }
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label for="pd-vat" class="text-sm font-semibold text-fg-secondary">{{ t().products.infoVat }} (%)</label>
                    <p-autocomplete inputId="pd-vat" [(ngModel)]="editForm.vatRateStr" [suggestions]="vatSuggestions"
                                    (completeMethod)="searchVat($event)" [forceSelection]="false" [dropdown]="true"
                                    [placeholder]="t().products.formVatPlaceholder" styleClass="w-full" appendTo="body" />
                    @if (!editVatValid()) {
                      <p class="m-0 text-xs text-danger-text" role="alert">{{ t().products.vatInvalid }}</p>
                    }
                  </div>

                  <div class="flex items-center gap-3 rounded-token-lg border border-line bg-surface-muted px-4 py-3 md:col-span-2">
                    <p-toggleswitch inputId="pd-buy-incl-vat" [(ngModel)]="editForm.purchasePriceIncludesVat" />
                    <label for="pd-buy-incl-vat" class="min-w-0 flex-1 cursor-pointer">
                      <span class="block text-sm font-semibold text-fg">{{ t().inventory.purchaseIncludesVat }}</span>
                      <span class="block text-xs text-fg-secondary">{{ t().inventory.purchaseIncludesVatHint }}</span>
                    </label>
                  </div>

                  <div class="flex flex-col gap-1.5 md:col-span-2">
                    <label for="pd-desc" class="text-sm font-semibold text-fg-secondary">{{ t().products.infoDescription }}</label>
                    <input id="pd-desc" pInputText [(ngModel)]="editForm.description" class="w-full" [placeholder]="t().common.optional" />
                  </div>
                </div>
                <div class="mt-4 flex justify-end gap-2">
                  <p-button [label]="t().common.cancel" severity="secondary" [disabled]="saving()" (onClick)="cancelEdit()" />
                  <p-button [label]="t().common.save" icon="pi pi-check" [loading]="saving()" (onClick)="saveEdit()" />
                </div>
              }
            </ui-glass-card>
            <!-- GTS / Karekod tablosu (sol sütun) -->
            <ui-glass-card [title]="t().products.gtsListTitle" [subtitle]="gtsSubtitle()" icon="pi-qrcode" tone="info" padding="none">
              @if (isAdmin) {
                <p-button card-actions [label]="t().products.gtsAddBtn" [icon]="addPanelOpen() ? 'pi pi-times' : 'pi pi-plus'" size="small"
                          [severity]="addPanelOpen() ? 'secondary' : undefined" (onClick)="toggleAddPanel()" />
              }
              @if (addPanelOpen() && isAdmin) {
                <app-product-gts-add-panel [suppliers]="suppliers()" [saving]="saving()" [checkGts]="checkPanelGts" [barcode]="product()?.barcode"
                                           (submitted)="confirmAddPanel($event)" (cancelled)="closeAddPanel()" (warn)="warnToast($event)" />
              }
              <app-product-gts-table [batches]="activeBatches()" [suppliers]="suppliers()" [product]="product()" [saving]="saving()" [readonly]="!isAdmin"
                                     [(editingId)]="editingId" (saveRow)="saveRow($event)" (removeRow)="confirmRemoveBatch($event)" />
            </ui-glass-card>
          </div>

          <!-- Sağ: fiyat/kâr + mevzuat + son hareketler -->
          <div class="flex min-w-0 flex-col gap-3 lg:gap-4">
            <ui-glass-card [title]="t().inventory.priceCard" icon="pi-tag" tone="accent" padding="none">
              <div class="grid grid-cols-2 border-b border-line">
                <div class="flex flex-col gap-1 border-r border-line px-4 py-3.5">
                  <span class="text-12.5 font-semibold text-fg-muted">{{ t().products.salePrice }} / {{ unitName() }}</span>
                  <ui-money class="num-xl text-26 leading-tight text-fg" [value]="product()!.salePrice" />
                </div>
                @if (isAdmin) {
                  <div class="flex flex-col gap-1 px-4 py-3.5">
                    <span class="text-12.5 font-semibold text-fg-muted">{{ t().products.purchasePrice }}</span>
                    <ui-money class="num text-lg font-extrabold text-fg-secondary" [value]="product()!.purchasePrice" />
                  </div>
                }
              </div>
              <dl class="m-0 flex flex-col px-4 py-2">
                @if (isAdmin) {
                  <div class="flex items-center justify-between gap-3 py-2">
                    <dt class="text-sm text-fg-secondary">{{ t().inventory.unitProfit }}</dt>
                    <dd class="m-0"><ui-money class="num text-sm font-bold" colorize [value]="pricing().profit" /></dd>
                  </div>
                }
                @if (pricing().vatRate) {
                  <div class="flex items-center justify-between gap-3 py-2">
                    <dt class="text-sm text-fg-secondary">{{ t().inventory.netSale }}</dt>
                    <dd class="m-0"><ui-money class="num text-sm font-semibold text-fg" [value]="pricing().netSale" /></dd>
                  </div>
                  <div class="flex items-center justify-between gap-3 py-2">
                    <dt class="text-sm text-fg-secondary">{{ t().inventory.vatInPrice }} (%{{ pricing().vatRate }})</dt>
                    <dd class="m-0"><ui-money class="num text-sm font-semibold text-fg-secondary" [value]="pricing().vat" /></dd>
                  </div>
                }
                @if (isAdmin) {
                  @if (product()!.purchasePriceIncludesVat && pricing().vatRate) {
                    <div class="flex items-center justify-between gap-3 py-2">
                      <dt class="text-sm text-fg-secondary">{{ t().inventory.netCost }}</dt>
                      <dd class="m-0"><ui-money class="num text-sm font-semibold text-fg" [value]="pricing().netCost" /></dd>
                    </div>
                  }
                  <div class="flex items-center justify-between gap-3 py-2">
                    <dt class="text-sm text-fg-secondary">{{ t().products.markup }}</dt>
                    <dd class="num m-0 text-sm font-bold text-fg">%{{ markupPercent() }}</dd>
                  </div>
                  <div class="flex items-center justify-between gap-3 py-2">
                    <dt class="text-sm text-fg-secondary">{{ t().products.margin }}</dt>
                    <dd class="num m-0 text-sm font-bold text-fg">%{{ marginPercent() }}</dd>
                  </div>
                }
              </dl>
              @if (isAdmin) {
                <p class="m-0 px-4 pb-2 text-xs text-fg-muted">{{ t().inventory.profitNetNote }}</p>
                <div class="px-4 pb-3.5">
                  <div class="h-2 overflow-hidden rounded-full bg-surface-strong" aria-hidden="true">
                    <div class="h-full rounded-full bg-brand" [style.width.%]="marginBar()"></div>
                  </div>
                </div>
              }
            </ui-glass-card>

            <app-product-regulatory-card [product]="product()!" (saved)="onRegulatorySaved($event)" (failed)="onRegulatoryFailed()" />

            <app-product-movement-list [movements]="movements()" [productId]="productId()" [product]="product()" [limit]="6" />
          </div>
        </div>

      }
    </div>

    <!-- Stok ekle / çıkar (GTS'siz basit işlem) -->
    <p-dialog [(visible)]="dialogVisible" [header]="dialogMode() === 'in' ? t().products.dialogAddStock : t().products.dialogRemoveStock"
              [modal]="true" [draggable]="false" styleClass="w-[95vw] max-w-[24rem]">
      <div class="flex flex-col gap-4 py-2">
        <div class="flex flex-col gap-1.5">
          <label for="pd-dlg-qty" class="text-sm font-semibold text-fg-secondary">{{ t().products.dialogQty }} ({{ unitName() }})</label>
          <p-inputNumber inputId="pd-dlg-qty" [(ngModel)]="dialogQty" [min]="minQty()" [max]="dialogMode() === 'out' ? product()?.stock : 99999"
                         [maxFractionDigits]="fractionDigits()" [locale]="t().products.locale"
                         [showButtons]="true" buttonLayout="horizontal" incrementButtonIcon="pi pi-plus" decrementButtonIcon="pi pi-minus"
                         styleClass="w-full" inputStyleClass="w-full text-center" />
          @if (decimal()) {
            <span class="text-xs text-fg-muted">{{ t().products.unitDecimalHint }}</span>
          }
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="pd-dlg-reason" class="text-sm font-semibold text-fg-secondary">
            {{ t().products.dialogReason }} <span class="font-normal text-fg-muted">({{ t().common.optional }})</span>
          </label>
          <input id="pd-dlg-reason" pInputText [(ngModel)]="dialogReason" [placeholder]="t().products.dialogReasonPlaceholder" class="w-full" />
        </div>
        @if (dialogMode() === 'in') {
          <div class="flex flex-col gap-1.5">
            <label for="pd-dlg-supplier" class="text-sm font-semibold text-fg-secondary">
              {{ t().products.dialogSupplier }} <span class="font-normal text-fg-muted">({{ t().common.optional }})</span>
            </label>
            <p-select inputId="pd-dlg-supplier" [(ngModel)]="dialogSupplierId" [options]="suppliers()" optionLabel="name" optionValue="id"
                      [placeholder]="t().products.dialogSelectSupplier" [showClear]="true" styleClass="w-full" appendTo="body" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="pd-dlg-expiry" class="text-sm font-semibold text-fg-secondary">
              {{ t().products.dialogExpiry }} <span class="font-normal text-fg-muted">({{ t().common.optional }})</span>
            </label>
            <ui-date-field inputId="pd-dlg-expiry" [(ngModel)]="dialogExpiryDate" [placeholder]="t().products.dialogExpiryPlaceholder" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="pd-dlg-lot" class="text-sm font-semibold text-fg-secondary">
              {{ t().inventory.lotNo }} <span class="font-normal text-fg-muted">({{ t().common.optional }})</span>
            </label>
            <input id="pd-dlg-lot" pInputText [(ngModel)]="dialogLotNo" maxlength="20" autocomplete="off" class="w-full font-mono uppercase placeholder:normal-case"
                   [placeholder]="t().inventory.lotNoPlaceholder" />
          </div>
        }
      </div>
      <ng-template pTemplate="footer">
        <p-button [label]="t().common.cancel" severity="secondary" (onClick)="dialogVisible = false" />
        <p-button [label]="dialogMode() === 'in' ? t().products.dialogAdd : t().products.dialogRemove"
                  [severity]="dialogMode() === 'in' ? 'success' : 'warn'" [loading]="saving()" (onClick)="confirmAdjust()" />
      </ng-template>
    </p-dialog>

    <!-- 2.13: GTS'siz toplu partiden miktarlı çıkarma -->
    <p-dialog [(visible)]="removeQtyVisible" [header]="t().products.gtsRemoveQtyTitle" [modal]="true" [draggable]="false"
              styleClass="w-[95vw] max-w-[22.5rem]">
      <div class="flex flex-col gap-3 py-2">
        <p class="m-0 text-sm text-fg-secondary">{{ t().products.gtsRemoveQtyHint.replace('{n}', qtyLabel(removeTarget()?.quantity ?? 0)) }}</p>
        <label for="pd-rm-qty" class="text-sm font-semibold text-fg-secondary">{{ t().products.gtsRemoveQtyLabel }} ({{ unitName() }})</label>
        <p-inputNumber inputId="pd-rm-qty" [(ngModel)]="removeQty" [min]="minQty()" [max]="removeTarget()?.quantity ?? 1"
                       [maxFractionDigits]="fractionDigits()" [locale]="t().products.locale"
                       [showButtons]="true" buttonLayout="horizontal" incrementButtonIcon="pi pi-plus" decrementButtonIcon="pi pi-minus"
                       styleClass="w-full" inputStyleClass="w-full text-center" />
      </div>
      <ng-template pTemplate="footer">
        <p-button [label]="t().common.cancel" severity="secondary" (onClick)="removeQtyVisible = false" />
        <p-button [label]="t().products.dialogRemove" severity="danger" [loading]="saving()" (onClick)="confirmRemoveQty()" />
      </ng-template>
    </p-dialog>
  `,
})
export class ProductDetailPage implements OnInit {
  private readonly store = inject(ProductStore);
  private readonly svc = inject(ProductService);
  private readonly supplierSvc = inject(SupplierService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly t = inject(LangService).t;
  readonly isAdmin = inject(AuthService).hasRole('admin');

  readonly product = signal<Product | null>(null);
  readonly movements = signal<StockMovement[]>([]);
  readonly saving = signal(false);
  readonly dialogMode = signal<'in' | 'out'>('in');
  readonly isEditing = signal(false);
  readonly suppliers = signal<Supplier[]>([]);
  editForm = {
    name: '', barcode: '', brand: '', category: '', unit: 'adet' as ProductUnit,
    minStock: 0, purchasePrice: 0, salePrice: 0, vatRateStr: '', description: '', purchasePriceIncludesVat: false,
  };

  vatSuggestions: string[] = [];
  categorySuggestions: string[] = [];

  readonly productId = signal('');
  dialogVisible = false;
  dialogQty = 1;
  dialogReason = '';
  dialogExpiryDate: Date | null = null;
  dialogLotNo = '';
  dialogSupplierId: string | null = null;

  /** GTS Ekle paneli açık mı (panel durumu ProductGtsAddPanelComponent içinde) */
  readonly addPanelOpen = signal(false);

  /** Düzenlenen GTS satırı (ProductGtsTableComponent ile iki yönlü) */
  readonly editingId = signal<string | null>(null);

  // GTS'siz toplu partiden miktarlı çıkarma
  removeQtyVisible = false;
  removeQty = 1;
  readonly removeTarget = signal<Batch | null>(null);

  /** 2.12: stock ↔ Σ batch.quantity */
  readonly reconcile = computed(() => checkStockVsBatches(this.product() ?? { stock: 0, batches: [] }));
  /** 2.15: SKT özeti (geçmişler ayrı) */
  readonly expiry = computed(() => expiryInfo(this.product()?.batches));
  readonly activeBatches = computed(() => sortFEFO((this.product()?.batches ?? []).filter(b => b.quantity > 0)));

  readonly isPassive = computed(() => this.product()?.isActive === false);
  readonly unit = computed(() => productUnit(this.product()));
  readonly unitName = computed(() => unitText(this.unit(), this.t().products));
  readonly decimal = computed(() => isDecimalUnit(this.unit()));
  readonly fractionDigits = computed(() => qtyFractionDigits(this.product()));
  /** Diyaloglarda en küçük miktar: adet 1, kg/lt/metre 0,001 */
  readonly minQty = computed(() => (this.decimal() ? 0.001 : 1));
  readonly units = computed(() => unitOptions(this.t().products));

  readonly headerSubtitle = computed(() => {
    const p = this.product();
    if (!p) return '';
    const status = p.isActive === false ? this.t().products.passive : this.t().products.active;
    return [p.category, p.barcode || this.t().inventory.noBarcode, status].filter(Boolean).join(' · ');
  });

  readonly gtsSubtitle = computed(() => {
    const list = this.activeBatches();
    const gtsCount = list.filter(b => !!b.gtsNo).length;
    const pr = this.t().products;
    return `${gtsCount} GTS · ${list.length} ${pr.gtsUnitsCount} · ${qtyWithUnit(batchTotal(list), this.product(), pr)}`;
  });

  constructor() {
    effect(() => {
      const id = this.productId();
      const found = this.store.products().find(p => p.id === id);
      if (found) this.product.set(found);
    });
  }

  ngOnInit(): void {
    this.store.ensureLoaded();
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.productId.set(id);

    if (!id) return;

    const fromStore = this.store.products().find(p => p.id === id);
    if (!fromStore) {
      this.svc.getById$(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(p => { if (p) this.product.set(p); });
    }

    this.svc.getMovements$(id, 8).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(m => this.movements.set(m));
    // Y5: tedarikçiler (ve alış bilgisi) yalnız yöneticiye açık (kurallar da yalnız yöneticiye okutur)
    if (this.isAdmin) this.supplierSvc.getAll$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: s => this.suppliers.set(s), error: () => this.suppliers.set([]) });
  }

  qtyLabel(n: number): string {
    return qtyWithUnit(n, this.product(), this.t().products);
  }

  // ---- Bilgi düzenleme ----

  searchCategory(event: { query: string }): void {
    this.categorySuggestions = suggestCategories(collectCategories(this.store.products()), event.query);
  }

  searchVat(event: { query: string }): void {
    this.vatSuggestions = suggestVatRates(collectVatRates(this.store.products()), event.query);
  }

  editVatValid(): boolean {
    return parseVatRate(this.editForm.vatRateStr).valid;
  }

  editDecimal(): boolean {
    return isDecimalUnit(this.editForm.unit);
  }

  editBarcodeConflict(): string | null {
    return findBarcodeConflict(this.store.products(), this.editForm.barcode, this.productId())?.name ?? null;
  }

  startEdit(): void {
    const p = this.product();
    if (!p) return;
    this.editForm = {
      name: p.name,
      barcode: p.barcode ?? '',
      brand: p.brand ?? '',
      category: p.category ?? '',
      unit: productUnit(p),
      minStock: p.minStock,
      purchasePrice: p.purchasePrice,
      salePrice: p.salePrice,
      vatRateStr: p.vatRate != null ? p.vatRate.toString() : '',
      description: p.description ?? '',
      purchasePriceIncludesVat: !!p.purchasePriceIncludesVat,
    };
    this.isEditing.set(true);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
  }

  onRegulatorySaved(changes: Partial<Product>): void {
    const p = this.product();
    if (p) this.product.set({ ...p, ...changes });
    this.toast.add({ severity: 'success', summary: '', detail: this.t().products.updated, life: 2500 });
  }

  onRegulatoryFailed(): void {
    this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().products.updateFailed, life: 3500 });
  }

  async toggleActive(): Promise<void> {
    const p = this.product();
    if (!p) return;
    const next = p.isActive === false;
    this.saving.set(true);
    try {
      await this.svc.setActive(p.id, next);
      this.product.set({ ...p, isActive: next });
      this.toast.add({ severity: 'success', summary: '', detail: this.t().products.statusUpdated, life: 2500 });
    } catch {
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().products.statusFailed, life: 3000 });
    } finally {
      this.saving.set(false);
    }
  }

  confirmDelete(): void {
    this.confirm.confirm({
      message: this.t().products.deleteConfirm,
      header: this.t().products.deleteTitle,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.t().products.deleteAccept,
      rejectLabel: this.t().products.deleteCancel,
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.doDelete(),
    });
  }

  private async doDelete(): Promise<void> {
    const p = this.product();
    if (!p) return;
    try {
      // Veri Firestore'da korunur (isActive:false), sadece aktif listeden/UI'dan kalkar.
      // "Pasif Ürünler" filtresinden geri getirilebilir.
      await this.svc.setActive(p.id, false);
      this.toast.add({ severity: 'success', summary: '', detail: this.t().products.deleted, life: 2500 });
      await this.router.navigate(['/products']);
    } catch {
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().products.deleteFailed, life: 3000 });
    }
  }

  async saveEdit(): Promise<void> {
    const p = this.product();
    if (!p) return;
    const pr = this.t().products;
    const err = (detail: string) => this.toast.add({ severity: 'error', summary: this.t().common.error, detail, life: 3500 });
    // 2.18: KDV NaN, satış fiyatı 0, boş ad, tekrar eden barkod reddedilir
    const vat = parseVatRate(this.editForm.vatRateStr);
    if (!this.editForm.name.trim()) return err(pr.formNameRequired);
    if (!vat.valid) return err(pr.vatInvalid);
    if (!(this.editForm.salePrice > 0)) return err(pr.salePriceRequired);
    const dup = this.editBarcodeConflict();
    if (dup) return err(`${pr.barcodeDuplicate} ${dup}`);

    this.saving.set(true);
    try {
      const minStock = Number(this.editForm.minStock) || 0;
      const changes = {
        name: this.editForm.name.trim(),
        barcode: this.editForm.barcode.trim(),
        brand: this.editForm.brand.trim() || null,
        category: (this.editForm.category ?? '').trim() || pr.categoryOther,
        unit: this.editForm.unit,
        minStock: this.editDecimal() ? roundQty(minStock) : Math.floor(minStock),
        purchasePrice: Number(this.editForm.purchasePrice) || 0,
        salePrice: Number(this.editForm.salePrice),
        vatRate: vat.value,
        purchasePriceIncludesVat: !!this.editForm.purchasePriceIncludesVat,
        description: this.editForm.description.trim() || null,
      };
      await this.svc.update(p.id, changes);
      this.product.set({ ...p, ...changes });
      this.isEditing.set(false);
      this.toast.add({ severity: 'success', summary: '', detail: pr.updated, life: 2500 });
    } catch {
      err(pr.updateFailed);
    } finally {
      this.saving.set(false);
    }
  }

  // ---- Basit stok ekle / çıkar ----

  openDialog(mode: 'in' | 'out'): void {
    this.dialogMode.set(mode);
    this.dialogQty = 1;
    this.dialogReason = '';
    this.dialogExpiryDate = null;
    this.dialogLotNo = '';
    this.dialogSupplierId = null;
    this.dialogVisible = true;
  }

  /** Birime göre miktarı normalize et (adet: tam sayı, kg/lt/metre: 3 ondalık) */
  private normQty(n: number | null | undefined): number {
    const v = Number(n) || 0;
    return this.decimal() ? roundQty(v) : Math.floor(v);
  }

  /** GTS'siz basit stok ekle/çıkar (tek parti) */
  async confirmAdjust(): Promise<void> {
    const p = this.product();
    const qty = this.normQty(this.dialogQty);
    if (!p || qty <= 0) return;
    this.saving.set(true);
    try {
      const delta = this.dialogMode() === 'in' ? qty : -qty;
      const reason = this.dialogReason.trim() || (this.dialogMode() === 'in' ? this.t().products.stockIn : this.t().products.stockOut);
      const expiryDate = this.dialogMode() === 'in' ? this.dialogExpiryDate : null;
      const supplierId = this.dialogMode() === 'in' ? this.dialogSupplierId : null;
      const lotNo = this.dialogMode() === 'in' ? this.dialogLotNo : null;
      const res = await this.svc.adjustStock(p, delta, reason, null, expiryDate, null, supplierId, lotNo);
      this.dialogVisible = false;
      this.toast.add({ severity: 'success', summary: this.t().common.success, detail: `${this.t().products.stockUpdated}: ${this.qtyLabel(res.newStock)}`, life: 3000 });
      this.warnShortfall(res.shortfall);
      this.refreshProduct();
    } catch {
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().products.stockFailed, life: 3000 });
    } finally {
      this.saving.set(false);
    }
  }

  /** 2.12: FEFO düşümünde partiler yetersizse kullanıcıyı uyar (sessizce yutma) */
  private warnShortfall(shortfall: number): void {
    if (shortfall <= 0) return;
    this.toast.add({ severity: 'warn', summary: this.t().products.mismatchTitle, detail: this.t().products.fefoShortfall.replace('{n}', String(shortfall)), life: 6000 });
  }

  private refreshProduct(): void {
    const p = this.product();
    if (p) this.svc.getById$(p.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(updated => { if (updated) this.product.set(updated); });
  }

  // ---- 2.12: stok ↔ parti uzlaştırma ----

  confirmReconcile(mode: ReconcileMode): void {
    const r = this.reconcile();
    const pr = this.t().products;
    const message = mode === 'stockToBatches'
      ? pr.reconcileConfirm.replace('{from}', String(r.stock)).replace('{to}', String(r.batchTotal))
      : pr.addMissingBatchConfirm.replace('{n}', String(r.diff));
    this.confirm.confirm({
      message,
      header: pr.mismatchTitle,
      icon: 'pi pi-sync',
      acceptLabel: this.t().common.apply,
      rejectLabel: this.t().common.cancel,
      accept: () => this.doReconcile(mode),
    });
  }

  private async doReconcile(mode: ReconcileMode): Promise<void> {
    const p = this.product();
    if (!p) return;
    this.saving.set(true);
    try {
      await this.svc.reconcileStock(p, mode, this.t().products.reconcileReason);
      this.toast.add({ severity: 'success', summary: '', detail: this.t().products.reconciled, life: 2500 });
      this.refreshProduct();
    } catch {
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().products.stockFailed, life: 3000 });
    } finally {
      this.saving.set(false);
    }
  }

  // ---- GTS Ekle paneli ----

  toggleAddPanel(): void {
    this.addPanelOpen.update(open => !open);
  }

  closeAddPanel(): void {
    this.addPanelOpen.set(false);
  }

  warnToast(detail: string): void {
    this.toast.add({ severity: 'warn', summary: '', detail, life: 3000 });
  }

  /** Bu GTS başka bir birimde / üründe ya da barkod olarak kullanılıyor mu? (2.14) */
  private gtsUsedElsewhere(gts: string, ignoreBatchId?: string): string | null {
    const p = this.product();
    const products = this.store.products().some(x => x.id === p?.id) || !p
      ? this.store.products()
      : [...this.store.products(), p];
    const hit = findGtsConflict(products, gts, ignoreBatchId && p ? { productId: p.id, batchId: ignoreBatchId } : undefined);
    if (hit) return hit.product.name;
    return products.find(x => (x.barcode ?? '').trim() === gts)?.name ?? null;
  }

  /** Panelin okuttuğu GTS için uyarı metni (sorun yoksa null) */
  readonly checkPanelGts = (gts: string): string | null => {
    const owner = this.gtsUsedElsewhere(gts);
    if (!owner) return null;
    return owner === this.product()?.name ? this.t().products.dialogGtsDuplicate : `${this.t().products.gtsDuplicateOther} ${owner}`;
  };

  async confirmAddPanel(req: GtsAddRequest): Promise<void> {
    const p = this.product();
    if (!p || req.gtsList.length === 0) return;

    this.saving.set(true);
    try {
      // Parti no: karekoddan okunduysa GTS'nin kendisi, yoksa paneldeki ortak değer
      const lots = Object.fromEntries(req.gtsList.map(g => [g, req.lots[g] ?? req.lotNo]));
      const res = await this.svc.adjustStock(p, req.gtsList.length, this.t().products.stockIn, null, req.expiry, req.gtsList, req.supplierId, lots);
      this.closeAddPanel();
      this.toast.add({ severity: 'success', summary: this.t().common.success, detail: `${this.t().products.stockUpdated}: ${this.qtyLabel(res.newStock)}`, life: 3000 });
      this.refreshProduct();
    } catch (e) {
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.stockErrorText(e), life: 3500 });
    } finally {
      this.saving.set(false);
    }
  }

  private stockErrorText(e: unknown): string {
    if (e instanceof ProductStockError && e.code === 'duplicate-gts') {
      return `${this.t().products.dialogGtsDuplicate}: ${e.detail ?? ''}`;
    }
    return this.t().products.stockFailed;
  }

  // ---- Satır (birim) düzenleme / silme ----

  async saveRow(row: GtsRowSave): Promise<void> {
    const p = this.product();
    if (!p) return;
    const b = row.batch;
    const gts = row.gtsNo.trim();
    if (gts && gts !== b.gtsNo) {
      const owner = this.gtsUsedElsewhere(gts, b.id);
      if (owner) {
        this.toast.add({ severity: 'warn', summary: '', detail: `${this.t().products.gtsDuplicateOther} ${owner}`, life: 3000 });
        return;
      }
    }
    this.saving.set(true);
    try {
      await this.svc.updateBatch(p, b.id, {
        gtsNo: gts || null,
        expiryDate: row.expiryDate,
        supplierId: row.supplierId,
        lotNo: row.lotNo,
      });
      this.editingId.set(null);
      this.toast.add({ severity: 'success', summary: '', detail: this.t().products.gtsSaved, life: 2000 });
      this.refreshProduct();
    } catch (e) {
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.stockErrorText(e), life: 3500 });
    } finally {
      this.saving.set(false);
    }
  }

  /** GTS'li birim → onay; GTS'siz toplu parti (quantity > 1) → miktar soran dialog (2.13) */
  confirmRemoveBatch(b: Batch): void {
    if (!b.gtsNo && b.quantity > 1) {
      this.removeTarget.set(b);
      this.removeQty = 1;
      this.removeQtyVisible = true;
      return;
    }
    this.confirm.confirm({
      message: this.t().products.gtsRemoveConfirm,
      header: this.t().products.gtsRemoveTitle,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.t().products.deleteAccept,
      rejectLabel: this.t().products.deleteCancel,
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.doRemoveBatch(b),
    });
  }

  async confirmRemoveQty(): Promise<void> {
    const b = this.removeTarget();
    if (!b) return;
    const qty = Math.min(Math.max(this.minQty(), this.normQty(this.removeQty)), b.quantity);
    await this.doRemoveBatch(b, qty);
    this.removeQtyVisible = false;
    this.removeTarget.set(null);
  }

  private async doRemoveBatch(b: Batch, quantity?: number): Promise<void> {
    const p = this.product();
    if (!p) return;
    this.saving.set(true);
    try {
      const reason = b.gtsNo ? this.t().products.gtsOutReason : this.t().products.unitOutReason;
      const res = await this.svc.removeBatch(p, b.id, reason, quantity);
      this.toast.add({ severity: 'success', summary: '', detail: this.t().products.gtsRemoved, life: 2000 });
      this.warnShortfall(res.shortfall);
      this.refreshProduct();
    } catch (e) {
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.stockErrorText(e), life: 3000 });
    } finally {
      this.saving.set(false);
    }
  }

  // ---- Gösterim ----

  infoRows(): { label: string; value: string; class?: string }[] {
    const p = this.product();
    if (!p) return [];
    const pr = this.t().products;
    const nearest = this.expiry().nearest;
    return [
      { label: pr.infoCategory, value: p.category || '-' },
      { label: pr.unitLabel, value: this.unitName() },
      { label: pr.infoBarcode, value: p.barcode || '-', class: 'font-mono text-fg' },
      { label: pr.infoBrand, value: p.brand || '-' },
      { label: pr.infoMinStock, value: this.qtyLabel(p.minStock) },
      ...(p.vatRate != null ? [{ label: pr.infoVat, value: '%' + p.vatRate }] : []),
      ...(nearest ? [{
        label: pr.infoExpiry,
        value: nearest.toDate().toLocaleDateString(pr.locale) + (this.expiry().expiredQty > 0 ? ` · ${pr.expiredBadge}` : ''),
        class: this.expiry().expiredQty > 0 ? 'text-danger-text' : undefined,
      }] : []),
      ...(p.description ? [{ label: pr.infoDescription, value: p.description }] : []),
    ];
  }

  /** Fiyat dökümü: satış KDV dahil, kâr KDV hariç net tutarlardan (shared/utils/pricing.ts). */
  readonly pricing = computed(() => {
    const p = this.product();
    return priceBreakdown(p ?? { salePrice: 0, purchasePrice: 0, vatRate: null });
  });

  /** Kâr oranı (maliyete göre): kâr / net alış */
  markupPercent(): string {
    const m = this.pricing().markup;
    return m == null ? '0' : formatPctNumber(m, this.t().products.locale);
  }

  /** Fiyat kartındaki marj çubuğu (0-100) */
  marginBar(): number {
    const m = this.pricing().margin ?? 0;
    return Number.isFinite(m) ? Math.max(0, Math.min(100, m)) : 0;
  }

  /** Kâr marjı (net satışa göre): kâr / net satış */
  marginPercent(): string {
    const m = this.pricing().margin;
    return m == null ? '0' : formatPctNumber(m, this.t().products.locale);
  }
}
