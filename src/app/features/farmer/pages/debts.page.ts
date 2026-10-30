import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LangService } from '../../../core/i18n/lang.service';
import { FarmerPurchase, FarmerPurchaseItem } from '../../../shared/models/farmer.model';
import { FarmerSession } from '../auth/farmer-session.service';
import { FARMER_PURCHASE_REPOSITORY } from '../data/repositories';
import { fmt } from '../i18n/farmer.i18n';
import { F, FarmerHeaderComponent, fmtDate, fmtMoney, fmtNum, TILE_TONE } from '../layout/farmer-ui';
import { FarmerStore } from '../services/farmer-store.service';

/** Borcum: bayi başına bakiye (bayinin müşteri kaydından senkronlanan anlık değer). Salt okunur. */
@Component({
  selector: 'app-farmer-debts',
  standalone: true,
  imports: [RouterLink, FarmerHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-farmer-header [title]="t().farmer.hub.title" />
    <div class="mb-4 grid grid-cols-2 gap-3">
      <a routerLink="/ciftci/oneriler" [class]="F.card + ' relative flex flex-col gap-2 no-underline'">
        <span [class]="F.tile + ' ' + tone.brand"><i class="pi pi-file-edit text-20" aria-hidden="true"></i></span>
        <span class="font-display text-17 font-extrabold leading-tight">{{ t().farmer.hub.recs }}</span>
        @if (store.activeRecommendations().length; as n) {
          <span class="num absolute right-3 top-3 grid h-7 min-w-[28px] place-items-center rounded-token-md bg-brand px-1.5 text-14 font-bold text-brand-contrast">{{ n }}</span>
        }
      </a>
      <a routerLink="/ciftci/ambar" [class]="F.card + ' flex flex-col gap-2 no-underline'">
        <span [class]="F.tile + ' ' + tone.accent"><i class="pi pi-box text-20" aria-hidden="true"></i></span>
        <span class="font-display text-17 font-extrabold leading-tight">{{ t().farmer.hub.barn }}</span>
      </a>
    </div>

    <h2 [class]="F.h2 + ' mb-1'">{{ t().farmer.debts.title }}</h2>
    <p [class]="F.muted + ' mb-3 mt-0'">{{ t().farmer.debts.subtitle }}</p>
    <div class="flex flex-col gap-3">
      @for (l of session.links(); track l.id) {
        <a [routerLink]="['/ciftci/borc', l.tenantId]" [class]="F.card + ' flex items-center gap-3 no-underline'">
          <span [class]="F.tile + ' ' + tone.neutral"><i class="pi pi-shop text-20" aria-hidden="true"></i></span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-display text-19 font-extrabold">{{ l.tenantName }}</span>
            @if (l.status === 'active') {
              <span class="num block font-display text-28 font-extrabold leading-tight" [class]="(l.balance ?? 0) > 0 ? 'text-danger-text' : 'text-fg'">{{ l.balance === null ? '—' : money(l.balance) }}</span>
              <span class="block text-14 text-fg-muted">{{ l.balanceUpdatedAt ? updated(l.balanceUpdatedAt) : t().farmer.home.balanceUnknown }}</span>
            } @else {
              <span class="mt-1 inline-flex h-7 items-center rounded-token-sm bg-surface-strong px-2 text-14 font-semibold text-fg-secondary">{{ t().farmer.debts.revoked }}</span>
            }
          </span>
          <i [class]="F.chevron" aria-hidden="true"></i>
        </a>
      } @empty {
        <p [class]="F.muted">{{ t().farmer.debts.noLinks }}</p>
      }
      <p [class]="F.legal + ' m-0 flex items-start gap-2'"><i class="pi pi-info-circle mt-0.5 shrink-0" aria-hidden="true"></i><span>{{ t().farmer.debts.note }}</span></p>
    </div>
  `,
})
export class FarmerDebtsPage {
  readonly t = inject(LangService).t;
  private readonly lang = inject(LangService).lang;
  readonly F = F;
  readonly tone = TILE_TONE;
  readonly session = inject(FarmerSession);
  readonly store = inject(FarmerStore);

  constructor() {
    void this.session.refreshLinks().catch(() => undefined);
    void this.store.load();
  }

  money(v: number): string { return fmtMoney(v, this.lang()); }
  updated(d: Date): string { return fmt(this.t().farmer.home.lastUpdate, { date: fmtDate(d, this.lang()) }); }
}

@Component({
  selector: 'app-farmer-debt-detail',
  standalone: true,
  imports: [FarmerHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-farmer-header [title]="link()?.tenantName || t().farmer.debts.detailTitle" back="/ciftci/borc" />
    @if (link(); as l) {
      <div class="field-dark mb-4 rounded-token-2xl p-4">
        <p class="eyebrow m-0 text-side-soft">{{ t().farmer.debts.balance }}</p>
        <p class="num m-0 font-display text-[2.125rem] font-extrabold leading-tight" [class]="(l.balance ?? 0) > 0 ? 'text-side-danger' : 'text-side-text'">{{ l.balance === null ? '—' : money(l.balance) }}</p>
        @if (l.balanceUpdatedAt) { <p class="m-0 mt-1 text-14 text-side-soft">{{ updated(l.balanceUpdatedAt) }}</p> }
      </div>
    }
    <h2 [class]="F.h2 + ' mb-2'">{{ t().farmer.debts.detailTitle }}</h2>
    <div class="flex flex-col gap-3">
      @for (p of purchases(); track p.id) {
        <article [class]="F.card" [class.opacity-60]="p.status !== 'completed'">
          <div [class]="F.head">
            <span [class]="F.tile + ' h-9 w-9 ' + tone.neutral"><i class="pi pi-receipt text-17" aria-hidden="true"></i></span>
            <b class="num min-w-0 flex-1 text-17">{{ date(p.purchasedAt) }}</b>
            <span class="num shrink-0 text-14 text-fg-muted">{{ receipt(p) }}</span>
          </div>
          @if (p.status !== 'completed') { <p class="m-0 mb-1 inline-flex rounded-token-sm bg-danger-soft px-2 py-0.5 text-14 font-bold text-danger-text">{{ t().farmer.barn.cancelled }}</p> }
          <ul class="m-0 list-none p-0">
            @for (it of p.items; track $index) {
              <li class="flex justify-between gap-2 border-b border-line py-2 text-16 last:border-b-0">
                <span class="min-w-0">{{ it.productName }} · <span class="num">{{ num(it.quantity) }} {{ it.unit }}</span></span>
                @if (!isPlantProtection(it)) { <span class="num shrink-0 font-semibold">{{ money(it.totalPrice) }}</span> }
              </li>
            }
          </ul>
          @if (hasPlantProtection(p)) { <p class="m-0 mt-1 text-13 text-fg-muted">{{ t().farmer.legal.priceHidden }}</p> }
          <div class="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
            <p class="num m-0 font-display text-17 font-extrabold">{{ total(p) }}</p>
            @if (p.creditAmount > 0) { <p class="num m-0 rounded-token-sm bg-danger-soft px-2 py-0.5 text-15 font-bold text-danger-text">{{ credit(p) }}</p> }
          </div>
        </article>
      } @empty {
        <p [class]="F.muted">{{ loading() ? t().farmer.common.loading : t().farmer.debts.noPurchases }}</p>
      }
      <p [class]="F.legal + ' m-0 flex items-start gap-2'"><i class="pi pi-info-circle mt-0.5 shrink-0" aria-hidden="true"></i><span>{{ t().farmer.debts.note }}</span></p>
    </div>
  `,
})
export class FarmerDebtDetailPage implements OnInit {
  readonly t = inject(LangService).t;
  private readonly lang = inject(LangService).lang;
  readonly F = F;
  readonly tone = TILE_TONE;
  private readonly session = inject(FarmerSession);
  private readonly repo = inject(FARMER_PURCHASE_REPOSITORY);
  private readonly tenantId = inject(ActivatedRoute).snapshot.paramMap.get('tenantId') ?? '';
  readonly link = computed(() => this.session.links().find(l => l.tenantId === this.tenantId) ?? null);
  readonly purchases = signal<FarmerPurchase[]>([]);
  readonly loading = signal(true);

  async ngOnInit(): Promise<void> {
    const fid = this.session.farmerId();
    try {
      if (fid) this.purchases.set(await this.repo.listByFarmerAndTenant(fid, this.tenantId, 20));
    } catch { /* boş liste */ } finally {
      this.loading.set(false);
    }
  }

  /** Bitki koruma ürünlerinde birim/satır fiyatı gösterilmez (md. 7 ihtiyatlı yorum); toplam borçta görünür. */
  isPlantProtection(i: FarmerPurchaseItem): boolean { return i.productType === 'bitki_koruma'; }
  hasPlantProtection(p: FarmerPurchase): boolean { return p.items.some(i => this.isPlantProtection(i)); }
  money(v: number): string { return fmtMoney(v, this.lang()); }
  num(v: number): string { return fmtNum(v, this.lang()); }
  date(d: Date): string { return fmtDate(d, this.lang()); }
  updated(d: Date): string { return fmt(this.t().farmer.home.lastUpdate, { date: fmtDate(d, this.lang()) }); }
  receipt(p: FarmerPurchase): string { return fmt(this.t().farmer.debts.receipt, { no: p.saleNumber }); }
  total(p: FarmerPurchase): string { return fmt(this.t().farmer.debts.total, { amount: this.money(p.totalAmount) }); }
  credit(p: FarmerPurchase): string { return fmt(this.t().farmer.debts.credit, { amount: this.money(p.creditAmount) }); }
}
