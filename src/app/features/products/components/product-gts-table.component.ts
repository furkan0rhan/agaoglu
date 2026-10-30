import { ChangeDetectionStrategy, Component, inject, input, model, output } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Batch, Product } from '../../../shared/models/product.model';
import { Supplier } from '../../../shared/models/supplier.model';
import { daysUntilExpiry, isBatchExpired } from '../../../shared/utils/batch.utils';
import { ProductStore } from '../store/product.store';
import { LangService } from '../../../core/i18n/lang.service';
import { EmptyStateComponent, IconButtonComponent, StatusBadgeComponent, UiTone } from '../../../shared/ui';
import { qtyWithUnit } from '../product-unit';

export interface GtsRowSave {
  batch: Batch;
  gtsNo: string;
  expiryDate: Date | null;
  supplierId: string | null;
}

/**
 * Ürün detayı: GTS / karekod (parti) tablosu. Masaüstünde tablo, telefonda kart listesi.
 * Satır düzenleme alanları burada tutulur; kaydet/sil istekleri sayfaya çıkış olarak gider.
 * `editingId` iki yönlü: sayfa kaydetme başarılı olunca null yapar.
 */
@Component({
  selector: 'app-product-gts-table',
  standalone: true,
  imports: [
    DatePipe, NgTemplateOutlet, FormsModule, DatePickerModule, InputTextModule, SelectModule, TableModule,
    EmptyStateComponent, IconButtonComponent, StatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (batches().length === 0) {
      <ui-empty-state compact icon="pi-qrcode" [title]="t().products.gtsEmpty" />
    } @else {
      <!-- Telefon: kart listesi -->
      <ul class="m-0 flex list-none flex-col divide-y divide-line p-0 md:hidden">
        @for (b of batches(); track b.id; let i = $index) {
          <li class="flex flex-col gap-2 px-4 py-3">
            @if (editingId() === b.id) {
              <ng-container [ngTemplateOutlet]="editFields" [ngTemplateOutletContext]="{ $implicit: b, idx: 'm' + i }" />
            } @else {
              <div class="flex items-start gap-3">
                <span class="num mt-0.5 w-6 shrink-0 text-xs text-fg-muted">{{ i + 1 }}</span>
                <div class="min-w-0 flex-1">
                  <ng-container [ngTemplateOutlet]="codeCell" [ngTemplateOutletContext]="{ $implicit: b }" />
                  <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-secondary">
                    <ng-container [ngTemplateOutlet]="expiryCell" [ngTemplateOutletContext]="{ $implicit: b }" />
                    @if (supplierName(b); as s) {
                      <span class="inline-flex items-center gap-1"><i class="pi pi-truck text-10 text-info-text" aria-hidden="true"></i>{{ s }}</span>
                    }
                  </div>
                </div>
                <ng-container [ngTemplateOutlet]="rowActions" [ngTemplateOutletContext]="{ $implicit: b }" />
              </div>
            }
          </li>
        }
      </ul>

      <!-- Masaüstü: tablo -->
      <div class="hidden md:block">
        <p-table [value]="batches()" dataKey="id" styleClass="p-datatable-sm" [scrollable]="true" scrollHeight="380px">
          <ng-template pTemplate="header">
            <tr>
              <th class="w-12">#</th>
              <th>{{ t().products.gtsColCode }}</th>
              <th class="w-44">{{ t().products.gtsColExpiry }}</th>
              <th class="w-48">{{ t().products.dialogSupplier }}</th>
              <th class="w-28">{{ t().products.gtsColAdded }}</th>
              <th class="w-24"><span class="sr-only">{{ t().common.edit }}</span></th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-b let-i="rowIndex">
            <tr>
              <td class="num text-xs text-fg-muted">{{ i + 1 }}</td>
              <td>
                @if (editingId() === b.id) {
                  <input pInputText [(ngModel)]="editGts" class="w-full font-mono text-xs" [placeholder]="t().products.gtsNone"
                         [attr.aria-label]="t().products.gtsColCode" />
                } @else {
                  <ng-container [ngTemplateOutlet]="codeCell" [ngTemplateOutletContext]="{ $implicit: b }" />
                }
              </td>
              <td>
                @if (editingId() === b.id) {
                  <p-datepicker [(ngModel)]="editExpiry" dateFormat="dd.mm.yy" [showIcon]="true" [showButtonBar]="true" appendTo="body"
                                styleClass="w-full" [ariaLabel]="t().products.gtsColExpiry" />
                } @else {
                  <ng-container [ngTemplateOutlet]="expiryCell" [ngTemplateOutletContext]="{ $implicit: b }" />
                }
              </td>
              <td>
                @if (editingId() === b.id) {
                  <p-select [(ngModel)]="editSupplierId" [options]="suppliers()" optionLabel="name" optionValue="id"
                            [placeholder]="t().products.dialogSelectSupplier" [showClear]="true" appendTo="body" styleClass="w-full"
                            [ariaLabel]="t().products.dialogSupplier" />
                } @else if (supplierName(b); as s) {
                  <span class="inline-flex items-center gap-1 text-sm text-fg-secondary">
                    <i class="pi pi-truck text-10 text-info-text" aria-hidden="true"></i>{{ s }}
                  </span>
                } @else {
                  <span class="text-fg-muted">—</span>
                }
              </td>
              <td><span class="num text-xs text-fg-muted">{{ b.addedAt?.toDate() | date:'dd.MM.yyyy' }}</span></td>
              <td><ng-container [ngTemplateOutlet]="rowActions" [ngTemplateOutletContext]="{ $implicit: b }" /></td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    }

    <!-- GTS hücresi -->
    <ng-template #codeCell let-b>
      @if (b.gtsNo) {
        <div class="flex min-w-0 items-center gap-2">
          <span class="h-2 w-2 shrink-0 rounded-full" [class]="dotClass(b)" aria-hidden="true"></span>
          <span class="truncate font-mono text-sm text-fg">{{ b.gtsNo }}</span>
        </div>
      } @else {
        <span class="text-xs italic text-fg-secondary">{{ t().products.gtsNone }} · <span class="num not-italic">{{ qty(b.quantity) }}</span></span>
      }
    </ng-template>

    <!-- SKT hücresi -->
    <ng-template #expiryCell let-b>
      @if (b.expiryDate) {
        <span class="inline-flex flex-wrap items-center gap-1.5 text-sm">
          <span class="num" [class]="dateClass(b)">{{ b.expiryDate.toDate() | date:'dd.MM.yyyy' }}</span>
          @if (isExpired(b)) {
            <ui-status-badge tone="danger" size="sm">{{ t().products.expiredBadge }}</ui-status-badge>
          } @else {
            <span class="num text-xs text-fg-muted">({{ daysLeft(b) }} {{ t().products.dayShort }})</span>
          }
        </span>
      } @else {
        <span class="text-fg-muted">—</span>
      }
    </ng-template>

    <!-- Satır aksiyonları -->
    <ng-template #rowActions let-b>
      <div class="flex shrink-0 justify-end gap-1">
        @if (editingId() === b.id) {
          <ui-icon-button icon="pi-check" tone="brand" variant="solid" size="sm" [disabled]="saving()" [ariaLabel]="t().common.save" (click)="save(b)" />
          <ui-icon-button icon="pi-times" size="sm" [ariaLabel]="t().common.cancel" (click)="cancel()" />
        } @else {
          <ui-icon-button icon="pi-pencil" size="sm" [ariaLabel]="t().common.edit" (click)="startEdit(b)" />
          <ui-icon-button icon="pi-trash" tone="danger" size="sm" [ariaLabel]="t().common.delete" (click)="removeRow.emit(b)" />
        }
      </div>
    </ng-template>

    <!-- Telefon düzenleme formu -->
    <ng-template #editFields let-b let-idx="idx">
      <div class="flex flex-col gap-2">
        <label [for]="'gts-edit-code-' + idx" class="text-sm font-semibold text-fg-secondary">{{ t().products.gtsColCode }}</label>
        <input pInputText [id]="'gts-edit-code-' + idx" [(ngModel)]="editGts" class="w-full font-mono" [placeholder]="t().products.gtsNone" />
        <label [for]="'gts-edit-exp-' + idx" class="text-sm font-semibold text-fg-secondary">{{ t().products.gtsColExpiry }}</label>
        <p-datepicker [inputId]="'gts-edit-exp-' + idx" [(ngModel)]="editExpiry" dateFormat="dd.mm.yy" [showIcon]="true" [showButtonBar]="true"
                      appendTo="body" styleClass="w-full" />
        <label [for]="'gts-edit-sup-' + idx" class="text-sm font-semibold text-fg-secondary">{{ t().products.dialogSupplier }}</label>
        <p-select [inputId]="'gts-edit-sup-' + idx" [(ngModel)]="editSupplierId" [options]="suppliers()" optionLabel="name" optionValue="id"
                  [placeholder]="t().products.dialogSelectSupplier" [showClear]="true" appendTo="body" styleClass="w-full" />
        <div class="mt-1 flex justify-end">
          <ng-container [ngTemplateOutlet]="rowActions" [ngTemplateOutletContext]="{ $implicit: b }" />
        </div>
      </div>
    </ng-template>
  `,
})
export class ProductGtsTableComponent {
  readonly t = inject(LangService).t;
  private readonly productStore = inject(ProductStore);

  /** FEFO sıralı, miktarı > 0 partiler */
  readonly batches = input.required<Batch[]>();
  readonly suppliers = input<Supplier[]>([]);
  readonly product = input<Pick<Product, 'unit'> | null>(null);
  readonly saving = input(false);
  /** Düzenlenen satır (iki yönlü) */
  readonly editingId = model<string | null>(null);

  readonly saveRow = output<GtsRowSave>();
  readonly removeRow = output<Batch>();

  editGts = '';
  editExpiry: Date | null = null;
  editSupplierId: string | null = null;

  startEdit(b: Batch): void {
    this.editingId.set(b.id);
    this.editGts = b.gtsNo ?? '';
    this.editExpiry = b.expiryDate ? b.expiryDate.toDate() : null;
    this.editSupplierId = b.supplierId ?? null;
  }

  cancel(): void {
    this.editingId.set(null);
  }

  save(b: Batch): void {
    this.saveRow.emit({ batch: b, gtsNo: this.editGts.trim(), expiryDate: this.editExpiry, supplierId: this.editSupplierId });
  }

  qty(n: number): string {
    return qtyWithUnit(n, this.product(), this.t().products);
  }

  isExpired(b: Batch): boolean {
    return isBatchExpired(b);
  }

  /** SKT'ye kalan gün (asla negatif değil — geçmişse "Süresi geçti" rozeti gösterilir) */
  daysLeft(b: Batch): number {
    return Math.max(0, daysUntilExpiry(b) ?? 0);
  }

  supplierName(b: Batch): string | null {
    if (!b.supplierId) return null;
    return this.suppliers().find(s => s.id === b.supplierId)?.name ?? null;
  }

  private expiryTone(b: Batch): UiTone | null {
    if (!b.expiryDate) return null;
    if (this.isExpired(b)) return 'danger';
    const d = this.daysLeft(b);
    if (d <= this.productStore.expiryCriticalDays()) return 'danger';
    if (d <= this.productStore.expiryWarnDays()) return 'warning';
    return 'success';
  }

  dotClass(b: Batch): string {
    const tone = this.expiryTone(b);
    return tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : tone === 'success' ? 'bg-success' : 'bg-line-strong';
  }

  dateClass(b: Batch): string {
    const tone = this.expiryTone(b);
    return tone === 'danger' ? 'font-semibold text-danger-text' : tone === 'warning' ? 'font-medium text-warning-text' : 'text-fg-secondary';
  }
}
