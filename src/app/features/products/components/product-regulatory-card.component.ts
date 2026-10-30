import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { LangService } from '../../../core/i18n/lang.service';
import { Product } from '../../../shared/models/product.model';
import { GlassCardComponent, StatusBadgeComponent } from '../../../shared/ui';
import {
  productRequiresPrescription, productTypeOf, RegulatoryForm, regulatoryFromProduct, regulatoryToChanges,
} from '../../../shared/utils/regulatory.utils';
import { ProductService } from '../services/product.service';
import { ProductRegulatoryFieldsComponent } from './product-regulatory-fields.component';
import { productTypeLabel } from '../product-unit';

/**
 * Ürün detayında "Mevzuat" kartı: tür, e-reçete, ruhsat no, etken madde, hasat öncesi bekleme süresi,
 * toksisite sınıfı. Kendi düzenleme modu vardır; kaydedince `saved` ile güncel alanları verir.
 */
@Component({
  selector: 'app-product-regulatory-card',
  standalone: true,
  imports: [ButtonModule, GlassCardComponent, StatusBadgeComponent, ProductRegulatoryFieldsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ui-glass-card [title]="t().compliance.sectionTitle" icon="pi-verified" iconTone="warning">
      @if (!editing()) {
        <p-button card-actions [label]="t().common.edit" icon="pi pi-pencil" size="small" severity="secondary" [text]="true"
                  (onClick)="startEdit()" />
      }
      @if (!editing()) {
        <dl class="m-0 flex flex-col divide-y divide-line">
          <div class="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-center sm:gap-4">
            <dt class="shrink-0 text-sm text-fg-secondary sm:w-40">{{ t().compliance.productType }}</dt>
            <dd class="m-0 flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
              {{ typeText() }}
              @if (rx()) {
                <ui-status-badge tone="warning" size="sm" icon="pi-file-check">{{ t().compliance.rxBadge }}</ui-status-badge>
              }
            </dd>
          </div>
          @for (row of rows(); track row.label) {
            <div class="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-center sm:gap-4">
              <dt class="shrink-0 text-sm text-fg-secondary sm:w-40">{{ row.label }}</dt>
              <dd class="m-0 break-words text-sm font-semibold text-fg">{{ row.value }}</dd>
            </div>
          }
        </dl>
        <p class="m-0 mt-2 text-xs text-fg-muted">{{ t().compliance.labelNotice }}</p>
      } @else {
        <app-product-regulatory-fields [(value)]="form" />
        <div class="mt-4 flex justify-end gap-2">
          <p-button [label]="t().common.cancel" severity="secondary" [disabled]="saving()" (onClick)="editing.set(false)" />
          <p-button [label]="t().common.save" icon="pi pi-check" [loading]="saving()" (onClick)="save()" />
        </div>
      }
    </ui-glass-card>
  `,
})
export class ProductRegulatoryCardComponent {
  private readonly svc = inject(ProductService);
  readonly t = inject(LangService).t;

  readonly product = input.required<Product>();
  readonly saved = output<Partial<Product>>();
  readonly failed = output<void>();

  readonly editing = signal(false);
  readonly saving = signal(false);
  form: RegulatoryForm = regulatoryFromProduct(null);

  readonly typeText = computed(() => productTypeLabel(productTypeOf(this.product()), this.t()));
  readonly rx = computed(() => productRequiresPrescription(this.product()));
  readonly rows = computed(() => {
    const p = this.product();
    const c = this.t().compliance;
    const dash = '—';
    const rows = [{ label: c.licenseNo, value: p.licenseNo || dash }];
    if (productTypeOf(p) === 'bitki_koruma') {
      rows.push(
        { label: c.activeIngredient, value: p.activeIngredient || dash },
        { label: c.phiDays, value: p.phiDays != null ? `${p.phiDays} ${c.days}` : dash },
        { label: c.toxicityClass, value: p.toxicityClass || dash },
      );
    }
    return rows;
  });

  startEdit(): void {
    this.form = regulatoryFromProduct(this.product());
    this.editing.set(true);
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      const changes = regulatoryToChanges(this.form);
      await this.svc.update(this.product().id, changes);
      this.saved.emit(changes);
      this.editing.set(false);
    } catch {
      this.failed.emit();
    } finally {
      this.saving.set(false);
    }
  }
}
