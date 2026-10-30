import { ChangeDetectionStrategy, Component, computed, inject, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { LangService } from '../../../core/i18n/lang.service';
import { PRODUCT_TYPES, ProductType } from '../../../shared/models/product.model';
import { defaultRequiresPrescription, RegulatoryForm } from '../../../shared/utils/regulatory.utils';
import { productTypeLabel } from '../product-unit';

/**
 * Ürün formu / detay düzenlemesi: "Mevzuat" alanları (ürün türü, e-reçete, ruhsat no, etken madde,
 * hasat öncesi bekleme süresi, toksisite sınıfı). Değerler etiketten kayıt amaçlı girilir; uygulama
 * kullanım tavsiyesi üretmez.
 */
@Component({
  selector: 'app-product-regulatory-fields',
  standalone: true,
  imports: [FormsModule, InputTextModule, InputNumberModule, SelectModule, ToggleSwitchModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let v = value();
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div class="flex flex-col gap-1.5">
        <label for="reg-type" class="text-sm font-semibold text-fg-secondary">{{ t().compliance.productType }}</label>
        <p-select inputId="reg-type" [options]="typeOptions()" optionLabel="label" optionValue="value"
                  [ngModel]="v.productType" (ngModelChange)="setType($event)" styleClass="w-full" appendTo="body" />
      </div>

      <div class="flex items-center gap-3 rounded-token-lg border border-line bg-surface-muted px-4 py-3 md:col-span-1 xl:col-span-2">
        <p-toggleswitch inputId="reg-rx" [ngModel]="v.requiresPrescription" (ngModelChange)="patch({ requiresPrescription: $event })" />
        <label for="reg-rx" class="min-w-0 flex-1 cursor-pointer">
          <span class="block text-sm font-semibold text-fg">{{ t().compliance.requiresPrescription }}</span>
          <span class="block text-xs text-fg-secondary">{{ t().compliance.requiresPrescriptionHint }}</span>
        </label>
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="reg-license" class="text-sm font-semibold text-fg-secondary">{{ t().compliance.licenseNo }}</label>
        <input id="reg-license" pInputText class="w-full font-mono" maxlength="60"
               [ngModel]="v.licenseNo" (ngModelChange)="patch({ licenseNo: $event ?? '' })" />
      </div>

      @if (v.productType === 'bitki_koruma') {
        <div class="flex flex-col gap-1.5">
          <label for="reg-ai" class="text-sm font-semibold text-fg-secondary">{{ t().compliance.activeIngredient }}</label>
          <input id="reg-ai" pInputText class="w-full" maxlength="200"
                 [ngModel]="v.activeIngredient" (ngModelChange)="patch({ activeIngredient: $event ?? '' })" />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="reg-phi" class="text-sm font-semibold text-fg-secondary">{{ t().compliance.phiDays }}</label>
          <p-inputNumber inputId="reg-phi" [min]="0" [max]="3650" [useGrouping]="false" [showButtons]="false"
                         [ngModel]="v.phiDays" (ngModelChange)="patch({ phiDays: $event })" styleClass="w-full" />
          <span class="text-xs text-fg-muted">{{ t().compliance.phiHint }}</span>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="reg-tox" class="text-sm font-semibold text-fg-secondary">{{ t().compliance.toxicityClass }}</label>
          <input id="reg-tox" pInputText class="w-full" maxlength="40"
                 [ngModel]="v.toxicityClass" (ngModelChange)="patch({ toxicityClass: $event ?? '' })" />
        </div>
      }

      <p class="m-0 text-xs text-fg-muted md:col-span-2 xl:col-span-3">{{ t().compliance.labelNotice }}</p>
    </div>
  `,
})
export class ProductRegulatoryFieldsComponent {
  readonly t = inject(LangService).t;
  readonly value = model.required<RegulatoryForm>();

  readonly typeOptions = computed(() =>
    PRODUCT_TYPES.map(value => ({ value, label: productTypeLabel(value, this.t()) })));

  patch(p: Partial<RegulatoryForm>): void {
    this.value.update(v => ({ ...v, ...p }));
  }

  /** Tür değişince reçete bayrağı türün varsayılanına çekilir (bitki koruma → zorunlu). */
  setType(type: ProductType): void {
    this.value.update(v => ({ ...v, productType: type, requiresPrescription: defaultRequiresPrescription(type) }));
  }
}
