import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LangService } from '../../../core/i18n/lang.service';
import { FarmerPurchaseItem } from '../../../shared/models/farmer.model';
import { fmt } from '../i18n/farmer.i18n';
import { F, FarmerHeaderComponent, fmtDate, fmtNum, PRODUCT_TYPE_ICON, PRODUCT_TYPE_TONE, TILE_TONE } from '../layout/farmer-ui';
import { FarmerStore } from '../services/farmer-store.service';
import { daysUntil } from '../utils/phi.util';

interface BarnRow { key: string; item: FarmerPurchaseItem; remaining: number; tenantName: string; date: Date }
type Group = 'bitki_koruma' | 'gubre' | 'tohum' | 'fide' | 'diger';
const GROUPS: readonly Group[] = ['bitki_koruma', 'gubre', 'tohum', 'fide', 'diger'];

/**
 * Ambarım: bayiden satın alınan kalemler (salt okunur). Ürün kataloğu / fiyat / sipariş YOK
 * (BKÜ satış yönetmeliği md. 7 — internette tanıtım/satış yasağı); yalnızca zaten satın alınmış kalemler.
 */
@Component({
  selector: 'app-farmer-barn',
  standalone: true,
  imports: [FarmerHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-farmer-header [title]="t().farmer.barn.title" back="/ciftci/borc" />
    <p [class]="F.muted + ' -mt-2 mb-3'">{{ t().farmer.barn.subtitle }}</p>
    @for (g of groups(); track g.key) {
      <h2 [class]="F.h2 + ' mb-2 mt-4 flex items-center gap-2'">
        <span [class]="F.tile + ' h-9 w-9 text-18 ' + groupTile(g.key)" aria-hidden="true">{{ icon(g.key) }}</span>{{ t().farmer.barn.groups[g.key] }}
      </h2>
      <div class="flex flex-col gap-2">
        @for (r of g.rows; track r.key) {
          <article [class]="F.card">
            <p class="m-0 font-display text-19 font-extrabold">{{ r.item.productName }}</p>
            <p class="num m-0 mt-0.5 text-18 font-semibold">{{ remaining(r) }} <small class="font-normal text-fg-muted">· {{ bought(r) }}</small></p>
            <p class="m-0 text-15 text-fg-muted">{{ r.tenantName }} · <span class="num">{{ date(r.date) }}</span></p>
            @if (r.item.gtsNos.length) { <p class="num m-0 mt-1 break-all text-14 text-fg-secondary">{{ gts(r.item) }}</p> }
            @if (r.item.prescriptionNo) { <p class="num m-0 text-14 text-fg-secondary">{{ rx(r.item) }}</p> }
            @if (r.item.expiryDate; as e) {
              <p class="num m-0 mt-1 text-15">{{ expiry(e) }}</p>
              @if (expiryDays(e) < 0) { <p [class]="F.danger + ' mb-0 mt-2'">{{ t().farmer.barn.expired }}</p> }
              @else if (expiryDays(e) <= 30) { <p [class]="F.note + ' mb-0 mt-2'">{{ t().farmer.barn.expiringSoon }}</p> }
            }
          </article>
        }
      </div>
    } @empty {
      @if (store.loaded()) {
        <div [class]="F.card + ' flex flex-col items-center gap-2 py-8 text-center'">
          <span class="grid h-16 w-16 place-items-center rounded-token-xl bg-surface-muted text-fg-muted"><i class="pi pi-box text-28" aria-hidden="true"></i></span>
          <p [class]="F.muted + ' m-0'">{{ t().farmer.barn.empty }}</p>
        </div>
      } @else { <p [class]="F.muted">{{ t().farmer.common.loading }}</p> }
    }
  `,
})
export class FarmerBarnPage {
  readonly t = inject(LangService).t;
  private readonly lang = inject(LangService).lang;
  readonly F = F;
  readonly store = inject(FarmerStore);

  readonly groups = computed(() => {
    const rows: BarnRow[] = [];
    for (const p of this.store.purchases()) {
      if (p.status !== 'completed') continue;
      p.items.forEach((item, i) => {
        const remaining = p.remaining[String(i)] ?? item.quantity;
        if (remaining > 0) rows.push({ key: `${p.id}:${i}`, item, remaining, tenantName: p.tenantName, date: p.purchasedAt });
      });
    }
    return GROUPS.map(key => ({ key, rows: rows.filter(r => (GROUPS.includes(r.item.productType as Group) ? r.item.productType : 'diger') === key) }))
      .filter(g => g.rows.length);
  });

  constructor() { void this.store.load(); }

  icon(g: string): string { return PRODUCT_TYPE_ICON[g] ?? '📦'; }
  groupTile(g: string): string { return TILE_TONE[PRODUCT_TYPE_TONE[g] ?? 'neutral']; }
  date(d: Date): string { return fmtDate(d, this.lang()); }
  remaining(r: BarnRow): string { return fmt(this.t().farmer.barn.remaining, { q: `${fmtNum(r.remaining, this.lang())} ${r.item.unit}` }); }
  bought(r: BarnRow): string { return fmt(this.t().farmer.barn.bought, { q: `${fmtNum(r.item.quantity, this.lang())} ${r.item.unit}` }); }
  gts(i: FarmerPurchaseItem): string { return fmt(this.t().farmer.barn.gts, { no: i.gtsNos.join(', ') }); }
  rx(i: FarmerPurchaseItem): string { return fmt(this.t().farmer.barn.prescription, { no: i.prescriptionNo ?? '' }); }
  expiry(d: Date): string { return fmt(this.t().farmer.barn.expiry, { date: fmtDate(d, this.lang()) }); }
  expiryDays(d: Date): number { return daysUntil(d); }
}
