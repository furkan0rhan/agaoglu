import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { Supplier } from '../../../shared/models/supplier.model';
import { LangService } from '../../../core/i18n/lang.service';
import { IconButtonComponent } from '../../../shared/ui';

export interface GtsAddRequest {
  gtsList: string[];
  expiry: Date | null;
  supplierId: string | null;
}

/**
 * "+ GTS Ekle" paneli (toplu okut): SKT + tedarikçi bir kez seçilir, GTS'ler arka arkaya okutulur (Enter).
 * Tekrar / başka üründe kullanım kontrolü `checkGts` ile sayfadan gelir (uyarı metni döner, sorun yoksa null).
 * Panel kaydetmez: `submitted` ile listeyi sayfaya verir; sayfa başarıda paneli kapatır.
 */
@Component({
  selector: 'app-product-gts-add-panel',
  standalone: true,
  imports: [FormsModule, ButtonModule, DatePickerModule, InputTextModule, SelectModule, IconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block border-b border-line bg-brand-soft' },
  template: `
    <div class="flex flex-col gap-3 px-4 py-4 sm:px-5">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5">
          <label for="gts-panel-expiry" class="text-sm font-semibold text-fg-secondary">
            {{ t().products.dialogExpiry }} <span class="font-normal text-fg-muted">({{ t().common.optional }})</span>
          </label>
          <p-datepicker inputId="gts-panel-expiry" [(ngModel)]="expiry" dateFormat="dd.mm.yy" [showIcon]="true" [showButtonBar]="true"
                        [placeholder]="t().products.dialogExpiryPlaceholder" styleClass="w-full" appendTo="body" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="gts-panel-supplier" class="text-sm font-semibold text-fg-secondary">
            {{ t().products.dialogSupplier }} <span class="font-normal text-fg-muted">({{ t().common.optional }})</span>
          </label>
          <p-select inputId="gts-panel-supplier" [(ngModel)]="supplierId" [options]="suppliers()" optionLabel="name" optionValue="id"
                    [placeholder]="t().products.dialogSelectSupplier" [showClear]="true" styleClass="w-full" appendTo="body" />
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="gts-panel-input" class="text-sm font-semibold text-fg-secondary">{{ t().products.dialogGts }}</label>
        <input #gtsInput id="gts-panel-input" pInputText [(ngModel)]="gtsInputValue" (keydown.enter)="addGts()"
               [placeholder]="t().products.dialogGtsScanPlaceholder" class="w-full font-mono" autocomplete="off" />
        @if (gtsList().length === 0) {
          <span class="text-xs text-fg-muted">{{ t().products.dialogGtsListEmpty }}</span>
        } @else {
          <ul class="m-0 mt-1 flex max-h-40 list-none flex-wrap gap-1.5 overflow-auto p-0">
            @for (g of gtsList(); track g; let i = $index) {
              <li class="inline-flex items-center gap-1 rounded-token-md border border-brand-line bg-surface py-0.5 pl-2 pr-0.5 font-mono text-xs text-fg">
                <span class="num text-fg-muted">{{ i + 1 }}.</span> {{ g }}
                <ui-icon-button icon="pi-times" size="sm" tone="danger" [ariaLabel]="t().products.gtsChipRemove + ': ' + g" (click)="removeGts(i)" />
              </li>
            }
          </ul>
        }
      </div>

      <div class="flex flex-wrap justify-end gap-2">
        <p-button [label]="t().common.cancel" severity="secondary" (onClick)="cancelled.emit()" />
        <p-button [label]="t().common.add + (gtsList().length ? ' (' + gtsList().length + ')' : '')"
                  icon="pi pi-check" [disabled]="gtsList().length === 0 && !gtsInputValue.trim()" [loading]="saving()"
                  (onClick)="submit()" />
      </div>
    </div>
  `,
})
export class ProductGtsAddPanelComponent {
  readonly t = inject(LangService).t;

  readonly suppliers = input<Supplier[]>([]);
  readonly saving = input(false);
  /** GTS kullanılabilir mi? Sorun varsa kullanıcıya gösterilecek uyarı metni, yoksa null. */
  readonly checkGts = input<(gts: string) => string | null>(() => null);

  readonly submitted = output<GtsAddRequest>();
  readonly cancelled = output<void>();
  /** Tekrarlanan / başka üründe kayıtlı GTS uyarısı (sayfa toast gösterir) */
  readonly warn = output<string>();

  expiry: Date | null = null;
  supplierId: string | null = null;
  gtsInputValue = '';
  readonly gtsList = signal<string[]>([]);

  private readonly gtsInput = viewChild<ElementRef<HTMLInputElement>>('gtsInput');

  constructor() {
    afterNextRender(() => this.gtsInput()?.nativeElement.focus());
  }

  /** GTS/karekod okut veya yaz + Enter — listeye ekler, aynısı varsa uyarır */
  addGts(): void {
    const raw = this.gtsInputValue.trim();
    if (!raw) return;
    this.gtsInputValue = '';
    if (this.gtsList().includes(raw)) {
      this.warn.emit(this.t().products.dialogGtsDuplicate);
      return;
    }
    const problem = this.checkGts()(raw);
    if (problem) {
      this.warn.emit(problem);
      return;
    }
    this.gtsList.update(list => [...list, raw]);
  }

  removeGts(index: number): void {
    this.gtsList.update(list => list.filter((_, i) => i !== index));
  }

  submit(): void {
    if (this.gtsInputValue.trim()) this.addGts();
    const gtsList = this.gtsList();
    if (gtsList.length === 0) return;
    this.submitted.emit({ gtsList, expiry: this.expiry, supplierId: this.supplierId });
  }
}
