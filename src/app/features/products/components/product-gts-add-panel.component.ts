import { afterNextRender, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DateFieldComponent } from '../../../shared/ui/date-field.component';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { Supplier } from '../../../shared/models/supplier.model';
import { LangService } from '../../../core/i18n/lang.service';
import { IconButtonComponent } from '../../../shared/ui';
import { normalizeLotNo } from '../../../shared/utils/batch.utils';
import { canonicalGts, gtinMatches, injectScannerTexts, parseGs1, ScanButtonComponent, ScanFeedback, ScanResult } from '../../../shared/scanner';

export interface GtsAddRequest {
  gtsList: string[];
  expiry: Date | null;
  supplierId: string | null;
  /** Elle girilen parti no (tümüne); karekoddan okunanlar `lots` ile GTS başına gelir */
  lotNo: string | null;
  /** GTS → karekoddaki parti no */
  lots: Record<string, string>;
}

/**
 * "+ GTS Ekle" paneli (toplu okut): SKT + tedarikçi bir kez seçilir, GTS'ler arka arkaya okutulur (Enter).
 * Tekrar / başka üründe kullanım kontrolü `checkGts` ile sayfadan gelir (uyarı metni döner, sorun yoksa null).
 * Panel kaydetmez: `submitted` ile listeyi sayfaya verir; sayfa başarıda paneli kapatır.
 */
@Component({
  selector: 'app-product-gts-add-panel',
  standalone: true,
  imports: [FormsModule, ButtonModule, DateFieldComponent, InputTextModule, SelectModule, IconButtonComponent, ScanButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block border-b border-line bg-brand-soft' },
  template: `
    <div class="flex flex-col gap-3 px-4 py-4 sm:px-5">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="flex flex-col gap-1.5">
          <label for="gts-panel-expiry" class="text-sm font-semibold text-fg-secondary">
            {{ t().products.dialogExpiry }} <span class="font-normal text-fg-muted">({{ t().common.optional }})</span>
          </label>
          <ui-date-field inputId="gts-panel-expiry" [(ngModel)]="expiry" [placeholder]="t().products.dialogExpiryPlaceholder" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="gts-panel-supplier" class="text-sm font-semibold text-fg-secondary">
            {{ t().products.dialogSupplier }} <span class="font-normal text-fg-muted">({{ t().common.optional }})</span>
          </label>
          <p-select inputId="gts-panel-supplier" [(ngModel)]="supplierId" [options]="suppliers()" optionLabel="name" optionValue="id"
                    [placeholder]="t().products.dialogSelectSupplier" [showClear]="true" styleClass="w-full" appendTo="body" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="gts-panel-lot" class="text-sm font-semibold text-fg-secondary">
            {{ t().inventory.lotNo }} <span class="font-normal text-fg-muted">({{ t().common.optional }})</span>
          </label>
          <input id="gts-panel-lot" pInputText [(ngModel)]="lotNo" maxlength="20" autocomplete="off" class="w-full font-mono uppercase placeholder:normal-case"
                 [placeholder]="t().inventory.lotNoPlaceholder" />
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="gts-panel-input" class="text-sm font-semibold text-fg-secondary">{{ t().products.dialogGts }}</label>
        <div class="flex items-center gap-2">
          <input #gtsInput id="gts-panel-input" pInputText [(ngModel)]="gtsInputValue" (keydown.enter)="addGts()"
                 [placeholder]="t().products.dialogGtsScanPlaceholder" class="w-full min-w-0 font-mono" autocomplete="off" />
          <ui-scan-button continuous [handler]="onScan" />
        </div>
        @if (gtsList().length === 0) {
          <span class="text-xs text-fg-muted">{{ t().products.dialogGtsListEmpty }}</span>
        } @else {
          <ul class="m-0 mt-1 flex max-h-40 list-none flex-wrap gap-1.5 overflow-auto p-0">
            @for (g of gtsList(); track g; let i = $index) {
              <li class="inline-flex items-center gap-1 rounded-token-md border border-brand-line bg-surface py-0.5 pl-2 pr-0.5 font-mono text-xs text-fg">
                <span class="num text-fg-muted">{{ i + 1 }}.</span> {{ g }}
                @if (lots[g]) { <span class="text-fg-muted">· {{ lots[g] }}</span> }
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
  /** Ürün barkodu: kamerayla okunan karekodun GTIN'i bununla eşleşmeli */
  readonly barcode = input<string | null | undefined>(null);

  readonly submitted = output<GtsAddRequest>();
  readonly cancelled = output<void>();
  /** Tekrarlanan / başka üründe kayıtlı GTS uyarısı (sayfa toast gösterir) */
  readonly warn = output<string>();

  expiry: Date | null = null;
  supplierId: string | null = null;
  lotNo = '';
  /** GTS → karekoddaki parti no (AI 10) */
  lots: Record<string, string> = {};
  gtsInputValue = '';
  readonly gtsList = signal<string[]>([]);

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sx = injectScannerTexts();
  private readonly gtsInput = viewChild<ElementRef<HTMLInputElement>>('gtsInput');

  constructor() {
    afterNextRender(() => this.gtsInput()?.nativeElement.focus());
  }

  /** GTS/karekod okut veya yaz + Enter — listeye ekler, aynısı varsa uyarır */
  addGts(): void {
    const typed = this.gtsInputValue.trim();
    if (!typed) return;
    this.gtsInputValue = '';
    // ngModel aynı değişim döngüsünde SKT alanı da değişince boş değeri her zaman yansıtmıyor → alanı doğrudan temizle
    const el = this.gtsInput()?.nativeElement;
    if (el) el.value = '';
    // Elle / USB okuyucuyla girilen karekod da kameradakiyle aynı kanonik biçimde saklanır; SKT + parti no okunur
    const gs1 = parseGs1(typed);
    const raw = gs1 ? canonicalGts(typed) : typed;
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
    if (gs1?.expiry && !this.expiry) this.expiry = gs1.expiry;
    this.rememberLot(raw, gs1?.lot ?? null);
  }

  /** Karekoddaki parti no: GTS'ye özel saklanır, parti alanı boşsa oraya da yazılır. */
  private rememberLot(gts: string, lot: string | null): void {
    const l = normalizeLotNo(lot);
    if (!l) return;
    this.lots = { ...this.lots, [gts]: l };
    if (!this.lotNo.trim()) this.lotNo = l;
  }

  /**
   * Kamerayla sürekli okutma: her karekod bir GTS çipi. GTIN ürün barkoduyla eşleşmezse eklenmez;
   * SKT boşsa karekoddaki SKT seçilir, farklı SKT'li birimde uyarı verilir.
   */
  readonly onScan = (r: ScanResult): ScanFeedback => {
    const sx = this.sx();
    const pr = this.t().products;
    const barcode = (this.barcode() ?? '').trim();
    const gtin = r.gs1?.gtin;
    if (gtin && barcode && !gtinMatches(barcode, gtin)) {
      return { tone: 'error', message: sx.gtinMismatch(r.gs1?.ean13 ?? gtin, barcode) };
    }
    const code = r.code;
    if (this.gtsList().includes(code)) return { tone: 'warn', message: pr.dialogGtsDuplicate };
    const problem = this.checkGts()(code);
    if (problem) return { tone: 'warn', message: problem };
    this.gtsList.update(list => [...list, code]);
    const exp = r.gs1?.expiry ?? null;
    let tone: ScanFeedback['tone'] = 'success';
    const parts = [`GTS ${this.gtsList().length}`];
    if (exp) {
      if (!this.expiry) this.expiry = exp;
      else if (this.expiry.toDateString() !== exp.toDateString()) tone = 'warn';
      parts.push(`${sx.gs1Expiry}: ${exp.toLocaleDateString(pr.locale)}`);
    }
    if (r.gs1?.lot) parts.push(`${sx.gs1Lot}: ${r.gs1.lot}`);
    this.rememberLot(code, r.gs1?.lot ?? null);
    this.cdr.markForCheck();
    return { tone, message: parts.join(' · ') };
  };

  removeGts(index: number): void {
    this.gtsList.update(list => list.filter((_, i) => i !== index));
  }

  submit(): void {
    if (this.gtsInputValue.trim()) this.addGts();
    const gtsList = this.gtsList();
    if (gtsList.length === 0) return;
    this.submitted.emit({ gtsList, expiry: this.expiry, supplierId: this.supplierId, lotNo: normalizeLotNo(this.lotNo), lots: this.lots });
  }
}
