import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { LangService } from '../../../core/i18n/lang.service';
import { FarmerLink, FarmField, PrescriberInfo, RecommendationItem } from '../../../shared/models/farmer.model';
import { DEALER_FARMER_REPOSITORY, DealerProductOption } from '../data/repositories';
import { fromInputDate } from '../layout/farmer-ui';
import { MAX_RECOMMENDATION_ITEMS, recommendationNeedsPrescription, validateRecommendation } from '../utils/consent.util';

interface ItemDraft { key: number; productId: string | null; productName: string; dose: string; phiDays: number | null; requiresPrescription: boolean; rxLocked: boolean }

/**
 * Öneri / reçete kaydı (yalnızca `canPrescribe` + yetki belge no). Kayıt DEĞİŞTİRİLEMEZ (rules); sadece geri çekilir.
 * Reçeteli ürün varsa e-reçete no zorunlu (istemci + rules). Ürün kartındaki reçete bayrağı kilitli gelir.
 */
@Component({
  selector: 'app-recommendation-dialog',
  standalone: true,
  imports: [FormsModule, ButtonModule, DialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [header]="t().farmer.dealer.recTitle" [(visible)]="visible" [modal]="true" [style]="{ width: 'min(640px, 96vw)' }" [draggable]="false" (onShow)="open()">
      <form class="flex flex-col gap-3.5" (ngSubmit)="save()">
        <div class="flex items-start gap-3 rounded-token-lg border border-warning-line bg-warning-soft p-3">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-token-md bg-warning text-fg-inverse"><i class="pi pi-shield" aria-hidden="true"></i></span>
          <p class="m-0 self-center text-13.5 leading-snug text-warning-text">{{ t().farmer.dealer.prescribersInfo }}</p>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="rec-target" class="text-sm font-semibold text-fg-secondary">{{ t().farmer.dealer.recTarget }} *</label>
          <input id="rec-target" class="p-inputtext w-full" name="target" [(ngModel)]="target" maxlength="120" required />
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="rec-field" class="text-sm font-semibold text-fg-secondary">{{ t().farmer.dealer.recField }}</label>
          <select id="rec-field" class="p-inputtext w-full" name="field" [(ngModel)]="fieldId">
            <option [ngValue]="null">{{ t().farmer.dealer.recAnyField }}</option>
            @for (f of fields(); track f.id) { <option [ngValue]="f.id">{{ f.name }} ({{ f.areaDecare }} da)</option> }
          </select>
        </div>

        @for (it of items(); track it.key; let i = $index) {
          <fieldset class="m-0 flex flex-col gap-2.5 rounded-token-lg border border-line bg-surface-muted p-3">
            <legend class="eyebrow px-1 text-fg-muted">{{ t().farmer.dealer.recProduct }} {{ i + 1 }}</legend>
            <input class="p-inputtext w-full" [name]="'p' + i" [attr.list]="'rec-products'" [placeholder]="t().farmer.dealer.recProductPh"
                   [ngModel]="it.productName" (ngModelChange)="setProduct(i, $event)" [attr.aria-label]="t().farmer.dealer.recProduct" />
            <input class="p-inputtext w-full" [name]="'d' + i" [placeholder]="t().farmer.dealer.recDose" [ngModel]="it.dose" (ngModelChange)="patchItem(i, { dose: $event })" [attr.aria-label]="t().farmer.dealer.recDose" />
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label class="flex items-center gap-2 text-sm text-fg-secondary">{{ t().farmer.dealer.recPhi }}
                <input class="p-inputtext num w-24" type="number" min="0" max="365" step="1" [name]="'phi' + i" [ngModel]="it.phiDays" (ngModelChange)="patchItem(i, { phiDays: $event })" /></label>
              <label class="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-semibold text-fg">
                <input type="checkbox" class="h-5 w-5 accent-[var(--brand)]" [name]="'rx' + i" [ngModel]="it.requiresPrescription" (ngModelChange)="patchItem(i, { requiresPrescription: $event })" [disabled]="it.rxLocked" />
                {{ t().farmer.dealer.recRx }}@if (it.rxLocked) { <i class="pi pi-lock text-11 text-fg-muted" aria-hidden="true"></i> }</label>
              @if (items().length > 1) {
                <p-button class="ml-auto" [text]="true" severity="danger" size="small" icon="pi pi-trash" [label]="t().farmer.dealer.removeItem" (onClick)="removeItem(i)" />
              }
            </div>
          </fieldset>
        }
        <datalist id="rec-products">
          @for (p of products(); track p.id) { <option [value]="p.name"></option> }
        </datalist>
        @if (items().length < maxItems) {
          <p-button class="self-start" severity="secondary" size="small" icon="pi pi-plus" [label]="t().farmer.dealer.addItem" (onClick)="addItem()" />
        }

        @if (needsRx()) {
          <div class="flex flex-col gap-1.5 rounded-token-lg border border-danger-line bg-danger-soft p-3">
            <label for="rec-rxno" class="text-sm font-semibold text-danger-text">{{ t().farmer.dealer.recRxNo }} *</label>
            <input id="rec-rxno" class="p-inputtext num w-full" name="rxno" [(ngModel)]="prescriptionNo" maxlength="40" required />
            <small class="text-danger-text">{{ t().farmer.dealer.recRxRequired }}</small>
          </div>
        }
        <div class="grid grid-cols-2 gap-2">
          <div class="flex flex-col gap-1.5">
            <label for="rec-ws" class="text-sm font-semibold text-fg-secondary">{{ t().farmer.dealer.recWindowStart }}</label>
            <input id="rec-ws" class="p-inputtext w-full" type="date" name="ws" [(ngModel)]="windowStart" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="rec-we" class="text-sm font-semibold text-fg-secondary">{{ t().farmer.dealer.recWindowEnd }}</label>
            <input id="rec-we" class="p-inputtext w-full" type="date" name="we" [(ngModel)]="windowEnd" />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="rec-notes" class="text-sm font-semibold text-fg-secondary">{{ t().farmer.dealer.recNotes }}</label>
          <textarea id="rec-notes" class="p-inputtext w-full" rows="2" name="notes" [(ngModel)]="notes" maxlength="500"></textarea>
        </div>
        <label class="flex cursor-pointer items-start gap-3 rounded-token-lg border border-line-strong p-3 text-sm font-semibold text-fg has-[:checked]:border-brand-line has-[:checked]:bg-brand-soft">
          <input type="checkbox" name="confirm" [(ngModel)]="confirmed" class="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]" /> {{ t().farmer.dealer.recConfirm }}</label>
        <p class="m-0 flex items-center gap-1.5 text-xs text-fg-muted"><i class="pi pi-user text-11" aria-hidden="true"></i>{{ prescriber()?.displayName }} · <span class="num">{{ prescriber()?.prescriberLicenseNo }}</span></p>
        @if (error()) { <p class="m-0 rounded-token-md bg-danger-soft px-3 py-2 text-sm font-semibold text-danger-text" role="alert">{{ error() }}</p> }
        <div class="flex justify-end gap-2 border-t border-line pt-3">
          <p-button severity="secondary" [label]="t().common.cancel" (onClick)="visible.set(false)" />
          <p-button type="submit" icon="pi pi-check" [label]="t().common.save" [loading]="busy()" [disabled]="!confirmed" />
        </div>
      </form>
    </p-dialog>
  `,
})
export class RecommendationDialogComponent {
  readonly t = inject(LangService).t;
  private readonly repo = inject(DEALER_FARMER_REPOSITORY);
  readonly visible = model(false);
  readonly link = input.required<FarmerLink>();
  readonly fields = input<FarmField[]>([]);
  readonly prescriber = input<PrescriberInfo | null>(null);
  readonly tenantName = input('');
  readonly saved = output<void>();

  readonly maxItems = MAX_RECOMMENDATION_ITEMS;
  readonly products = signal<DealerProductOption[]>([]);
  readonly items = signal<ItemDraft[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly needsRx = computed(() => recommendationNeedsPrescription(this.items()));
  target = '';
  fieldId: string | null = null;
  prescriptionNo = '';
  windowStart = '';
  windowEnd = '';
  notes = '';
  confirmed = false;

  open(): void {
    this.target = ''; this.fieldId = null; this.prescriptionNo = ''; this.windowStart = ''; this.windowEnd = ''; this.notes = '';
    this.confirmed = false; this.error.set('');
    this.items.set([this.emptyItem()]);
    if (!this.products().length) {
      this.repo.listPrescriptionProducts(this.link().tenantId)
        .then(ps => this.products.set(ps.filter(p => p.productType === 'bitki_koruma' || p.productType === 'gubre')))
        .catch(() => undefined);
    }
  }

  private emptyItem(): ItemDraft {
    return { key: ++this.keySeq, productId: null, productName: '', dose: '', phiDays: null, requiresPrescription: false, rxLocked: false };
  }

  private keySeq = 0;

  /**
   * Taslak kalemler yalnız bu yolla değişir (signal'deki nesne yerinde DEĞİŞTİRİLMEZ). Eskiden doz/PHI/reçete
   * `[(ngModel)]="it.dose"` ile görünümdeki nesneye yazılıyordu; ürün seçimi `items` signal'ini yeni nesnelerle
   * güncelleyince (OnPush) bu yerinde yazılanlar signal'le senkron kalmayıp doz boş görünebiliyordu.
   */
  patchItem(i: number, patch: Partial<Omit<ItemDraft, 'key'>>): void {
    this.items.update(xs => xs.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  }

  addItem(): void { this.items.update(xs => [...xs, this.emptyItem()]); }
  removeItem(i: number): void { this.items.update(xs => xs.filter((_, k) => k !== i)); }

  /** Ürün kartından etiket bilgisi (PHI, reçete bayrağı) gelir; reçete bayrağı ürün kartında açıksa kapatılamaz. */
  setProduct(i: number, name: string): void {
    const p = this.products().find(x => x.name === name);
    this.items.update(xs => xs.map((it, k) => (k !== i ? it : p
      ? { ...it, productId: p.id, productName: p.name, phiDays: p.phiDays, requiresPrescription: p.requiresPrescription, rxLocked: p.requiresPrescription }
      : { ...it, productId: null, productName: name, rxLocked: false })));
  }

  async save(): Promise<void> {
    const pr = this.prescriber();
    const items: RecommendationItem[] = this.items().map(i => ({
      productId: i.productId, productName: i.productName, dose: i.dose,
      phiDays: i.phiDays == null || (i.phiDays as unknown) === '' ? null : Math.round(Number(i.phiDays)),
      requiresPrescription: !!i.requiresPrescription,
    }));
    const errs = validateRecommendation({
      canPrescribe: !!pr?.canPrescribe, licenseNo: pr?.prescriberLicenseNo, linkActive: this.link().status === 'active',
      target: this.target, items, prescriptionNo: this.prescriptionNo,
    });
    if (errs.length) {
      const d = this.t().farmer.dealer;
      this.error.set(errs.includes('prescription-required') ? d.recRxRequired
        : errs.includes('not-prescriber') || errs.includes('no-license') ? d.onlyPrescriber : d.recInvalid);
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const l = this.link();
      const f = this.fields().find(x => x.id === this.fieldId);
      await this.repo.createRecommendation({
        tenantId: l.tenantId, tenantName: this.tenantName() || l.tenantName, farmerId: l.farmerId,
        fieldId: f?.id ?? null, seasonId: null, target: this.target, items,
        prescriptionNo: this.needsRx() ? this.prescriptionNo.trim() : null,
        windowStart: fromInputDate(this.windowStart), windowEnd: fromInputDate(this.windowEnd), notes: this.notes,
        authorUid: pr!.uid, authorName: pr!.displayName, authorLicenseNo: pr!.prescriberLicenseNo ?? '',
      });
      this.visible.set(false);
      this.saved.emit();
    } catch {
      this.error.set(this.t().farmer.dealer.recFailed);
    } finally {
      this.busy.set(false);
    }
  }
}
