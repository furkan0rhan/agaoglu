import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangService } from '../../../core/i18n/lang.service';
import { Recommendation } from '../../../shared/models/farmer.model';
import { fmt } from '../i18n/farmer.i18n';
import { F, FarmerHeaderComponent, FarmerRefreshButtonComponent, fmtDate, PRODUCT_TYPE_ICON, TILE_TONE } from '../layout/farmer-ui';
import { FarmerStore } from '../services/farmer-store.service';

/**
 * Bayinizin önerileri: yalnızca bayideki yetkili kişinin (canPrescribe) yazdığı, değiştirilemez kayıtlar.
 * Uygulama kendisi öneri ÜRETMEZ; yazarın adı ve yetki belge no'su her öneride görünür.
 */
@Component({
  selector: 'app-farmer-recommendations',
  standalone: true,
  imports: [RouterLink, FarmerHeaderComponent, FarmerRefreshButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-farmer-header [title]="t().farmer.recs.title" back="/ciftci/borc"><app-farmer-refresh [compact]="true" /></app-farmer-header>
    <p [class]="F.legal + ' mb-3 flex items-start gap-2'"><i class="pi pi-info-circle mt-0.5 shrink-0" aria-hidden="true"></i><span>{{ t().farmer.recs.info }}</span></p>
    <div class="flex flex-col gap-3">
      @for (r of store.recommendations(); track r.id) {
        <article [class]="F.card" [class.opacity-60]="r.status === 'withdrawn'">
          <div [class]="F.head">
            <span [class]="F.tile + ' h-9 w-9 ' + tone.brand"><i class="pi pi-user text-17" aria-hidden="true"></i></span>
            <span class="min-w-0 flex-1 py-1 leading-snug">
              <span class="block text-16 font-bold text-brand-text">{{ by(r) }}</span>
              <span class="block text-13 text-fg-muted">{{ license(r) }} · {{ r.tenantName }} · <span class="num">{{ date(r.createdAt) }}</span></span>
            </span>
          </div>
          @if (r.status === 'withdrawn') { <p [class]="F.danger + ' mb-2 mt-0'">{{ t().farmer.recs.withdrawn }}</p> }
          <p class="m-0 font-display text-19 font-extrabold">{{ t().farmer.recs.target }}: {{ r.target }}</p>
          @if (r.fieldId && store.field(r.fieldId); as f) { <p class="m-0 flex items-center gap-1.5 text-fg-secondary"><i class="pi pi-map text-14" aria-hidden="true"></i>{{ field(f.name) }}</p> }
          <ul class="m-0 mt-2 list-none p-0">
            @for (it of r.items; track $index) {
              <li class="flex gap-3 border-t border-line py-2.5">
                <span [class]="F.tile + ' h-10 w-10 text-20 ' + itemTone(it.productType)" aria-hidden="true">{{ itemIcon(it.productType) }}</span>
                <span class="min-w-0 flex-1">
                  <b class="block">{{ it.productName }}</b>
                  <span class="block text-fg-secondary">{{ t().farmer.recs.dose }}: {{ it.dose }}</span>
                  @if (it.phiDays !== null) { <span class="mt-1 inline-flex items-center gap-1.5 rounded-token-sm bg-warning-soft px-2 py-0.5 text-15 font-semibold text-warning-text"><i class="pi pi-hourglass text-12" aria-hidden="true"></i>{{ phi(it.phiDays) }}</span> }
                </span>
              </li>
            }
          </ul>
          @if (r.prescriptionNo) { <p class="num m-0 flex items-center gap-1.5 font-semibold"><i class="pi pi-verified text-brand-text" aria-hidden="true"></i>{{ rx(r.prescriptionNo) }}</p> }
          @if (r.windowStart || r.windowEnd) { <p class="m-0 mt-1 flex items-center gap-1.5 text-fg-secondary"><i class="pi pi-calendar text-14" aria-hidden="true"></i>{{ window(r) }}</p> }
          @if (r.notes) { <p class="m-0 mt-1 italic text-fg-secondary">{{ r.notes }}</p> }
          @if (r.status === 'active') {
            <a routerLink="/ciftci/kayit/yeni" [queryParams]="{ oneri: r.id }" [class]="F.btn + ' mt-3'"><i class="pi pi-check" aria-hidden="true"></i>{{ t().farmer.recs.apply }}</a>
          }
        </article>
      } @empty {
        <p [class]="F.muted">{{ store.loaded() ? t().farmer.recs.empty : t().farmer.common.loading }}</p>
      }
      <p [class]="F.muted + ' m-0 text-14'">{{ t().farmer.legal.labelFirst }}</p>
    </div>
  `,
})
export class FarmerRecommendationsPage {
  readonly t = inject(LangService).t;
  private readonly lang = inject(LangService).lang;
  readonly F = F;
  readonly tone = TILE_TONE;
  /** Öneri kalemi ikonu ürün türünden (eski önerilerde tür yok → ilaç ikonu) */
  itemIcon(pt: string | null | undefined): string { return (pt && PRODUCT_TYPE_ICON[pt]) || '💧'; }
  itemTone(pt: string | null | undefined): string { return pt && pt !== 'bitki_koruma' ? this.tone.success : this.tone.danger; }
  readonly store = inject(FarmerStore);

  constructor() {
    void this.store.load();
    // Ekrandaki öneriler görüldü sayılır (alt menü rozeti söner); yenilemeyle gelen yeni öneri de burada görülür
    effect(() => { this.store.recommendations(); untracked(() => this.store.markRecsSeen()); });
  }

  date(d: Date | null): string { return fmtDate(d, this.lang()); }
  by(r: Recommendation): string { return fmt(this.t().farmer.recs.by, { name: r.authorName }); }
  license(r: Recommendation): string { return fmt(this.t().farmer.recs.license, { no: r.authorLicenseNo }); }
  field(name: string): string { return fmt(this.t().farmer.recs.field, { name }); }
  phi(n: number): string { return fmt(this.t().farmer.recs.phi, { n }); }
  rx(no: string): string { return fmt(this.t().farmer.recs.rx, { no }); }
  window(r: Recommendation): string { return fmt(this.t().farmer.recs.window, { from: this.date(r.windowStart), to: this.date(r.windowEnd) }); }
}
