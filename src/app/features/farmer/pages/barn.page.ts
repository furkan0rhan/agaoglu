import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LangService } from '../../../core/i18n/lang.service';
import { FarmerPurchaseItem } from '../../../shared/models/farmer.model';
import { fmt } from '../i18n/farmer.i18n';
import { F, FarmerHeaderComponent, FarmerRefreshButtonComponent, fmtDate, fmtNum, PRODUCT_TYPE_ICON, PRODUCT_TYPE_TONE, TILE_TONE } from '../layout/farmer-ui';
import { BarnRow, FarmerStore } from '../services/farmer-store.service';
import { daysUntil } from '../utils/phi.util';
import { unitLabel } from '../utils/units';

type Group = 'bitki_koruma' | 'gubre' | 'tohum' | 'fide' | 'diger';
const GROUPS: readonly Group[] = ['bitki_koruma', 'gubre', 'tohum', 'fide', 'diger'];

/**
 * Ambarım: bayiden satın alınan kalemler (salt okunur). Ürün kataloğu / fiyat / sipariş YOK
 * (BKÜ satış yönetmeliği md. 7 — internette tanıtım/satış yasağı); yalnızca zaten satın alınmış kalemler.
 */
@Component({
  selector: 'app-farmer-barn',
  standalone: true,
  imports: [FarmerHeaderComponent, FarmerRefreshButtonComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-farmer-header [title]="t().farmer.barn.title" back="/ciftci/borc"><app-farmer-refresh /></app-farmer-header>
    <p [class]="F.muted + ' -mt-2 mb-3'">{{ t().farmer.barn.subtitle }}</p>
    @for (g of groups(); track g.key) {
      <h2 [class]="F.h2 + ' mb-2 mt-4 flex items-center gap-2'">
        <span [class]="F.tile + ' h-9 w-9 text-18 ' + groupTile(g.key)" aria-hidden="true">{{ icon(g.key) }}</span>{{ t().farmer.barn.groups[g.key] }}
      </h2>
      <div class="flex flex-col gap-2">
        @for (r of g.rows; track r.key) {
          <ng-container *ngTemplateOutlet="row; context: { $implicit: r }" />
        }
      </div>
    } @empty {
      @if (store.loaded() && !usedUp().length) {
        <div [class]="F.card + ' flex flex-col items-center gap-2 py-8 text-center'">
          <span class="grid h-16 w-16 place-items-center rounded-token-xl bg-surface-muted text-fg-muted"><i class="pi pi-box text-28" aria-hidden="true"></i></span>
          <p [class]="F.muted + ' m-0'">{{ t().farmer.barn.empty }}</p>
        </div>
      } @else if (!store.loaded()) { <p [class]="F.muted">{{ t().farmer.common.loading }}</p> }
    }
    @if (usedUp().length) {
      <details class="mt-5" [open]="!groups().length">
        <summary class="flex min-h-[52px] cursor-pointer items-center gap-2 font-display text-20 font-extrabold text-fg">
          <span [class]="F.tile + ' h-9 w-9 text-18 ' + tone.neutral" aria-hidden="true">✔</span>{{ t().farmer.barn.usedUpTitle }}
          <span class="num rounded-token-sm bg-surface-strong px-2 text-15 font-bold text-fg-secondary">{{ usedUp().length }}</span>
        </summary>
        <p [class]="F.muted + ' mb-2 mt-1'">{{ t().farmer.barn.usedUpNote }}</p>
        <div class="flex flex-col gap-2">
          @for (r of usedUp(); track r.key) { <ng-container *ngTemplateOutlet="row; context: { $implicit: r }" /> }
        </div>
      </details>
    }
    <ng-template #row let-r>
      <article [class]="F.card" [class.opacity-75]="r.usedUp">
        <p class="m-0 flex items-start gap-2 font-display text-19 font-extrabold"><span class="min-w-0 flex-1">{{ r.item.productName }}</span>
          @if (r.usedUp) { <span class="shrink-0 rounded-token-sm bg-surface-strong px-2 py-0.5 text-14 font-bold text-fg-secondary">{{ t().farmer.barn.usedUp }}</span> }</p>
        <p class="num m-0 mt-0.5 text-18 font-semibold">@if (!r.usedUp) { {{ remaining(r) }} <small class="font-normal text-fg-muted">· {{ bought(r) }}</small> } @else { <span class="font-normal text-fg-secondary">{{ bought(r) }}</span> }</p>
        <p class="m-0 text-15 text-fg-muted">{{ r.tenantName }} · <span class="num">{{ date(r.date) }}</span></p>
        @if (r.item.gtsNos.length) { <p class="num m-0 mt-1 break-all text-14 text-fg-secondary">{{ gts(r.item) }}</p> }
        @if (showRx(r.item)) { <p class="num m-0 text-14 text-fg-secondary">{{ rx(r.item) }}</p> }
        @if (r.item.expiryDate; as e) {
          <p class="num m-0 mt-1 text-15">{{ expiry(e) }}</p>
          @if (!r.usedUp && expiryDays(e) < 0) { <p [class]="F.danger + ' mb-0 mt-2'">{{ t().farmer.barn.expired }}</p> }
          @else if (!r.usedUp && expiryDays(e) <= 30) { <p [class]="F.note + ' mb-0 mt-2'">{{ t().farmer.barn.expiringSoon }}</p> }
        }
      </article>
    </ng-template>
  `,
})
export class FarmerBarnPage {
  readonly t = inject(LangService).t;
  private readonly lang = inject(LangService).lang;
  readonly F = F;
  readonly store = inject(FarmerStore);

  readonly tone = TILE_TONE;
  /** Biten kalemler kaybolmaz: GTS / SKT / e-reçete kaydı için ayrı bölümde kalır (rapor #7). */
  readonly usedUp = computed(() => this.store.barnRows().filter(r => r.usedUp));
  readonly groups = computed(() => {
    const rows = this.store.barnRows().filter(r => !r.usedUp);
    return GROUPS.map(key => ({ key, rows: rows.filter(r => (GROUPS.includes(r.item.productType as Group) ? r.item.productType : 'diger') === key) }))
      .filter(g => g.rows.length);
  });

  constructor() { void this.store.load(); }

  icon(g: string): string { return PRODUCT_TYPE_ICON[g] ?? '📦'; }
  groupTile(g: string): string { return TILE_TONE[PRODUCT_TYPE_TONE[g] ?? 'neutral']; }
  date(d: Date): string { return fmtDate(d, this.lang()); }
  remaining(r: BarnRow): string { return fmt(this.t().farmer.barn.remaining, { q: `${fmtNum(r.remaining, this.lang())} ${unitLabel(r.item.unit, this.lang())}` }); }
  bought(r: BarnRow): string { return fmt(this.t().farmer.barn.bought, { q: `${fmtNum(r.item.quantity, this.lang())} ${unitLabel(r.item.unit, this.lang())}` }); }
  /**
   * E-reçete no yalnız reçeteli (bitki koruma) kalemde gösterilir. Eski senkronlar satış düzeyindeki numarayı
   * gübreye de yazmış olabilir (rapor #6) — gösterimde de süzülür.
   */
  showRx(i: FarmerPurchaseItem): boolean { return !!i.prescriptionNo && (i.requiresPrescription || i.productType === 'bitki_koruma'); }
  gts(i: FarmerPurchaseItem): string { return fmt(this.t().farmer.barn.gts, { no: i.gtsNos.join(', ') }); }
  rx(i: FarmerPurchaseItem): string { return fmt(this.t().farmer.barn.prescription, { no: i.prescriptionNo ?? '' }); }
  expiry(d: Date): string { return fmt(this.t().farmer.barn.expiry, { date: fmtDate(d, this.lang()) }); }
  expiryDays(d: Date): number { return daysUntil(d); }
}
