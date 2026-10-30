import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LangService } from '../../../core/i18n/lang.service';
import { FarmerInstallment, FarmerLink, FarmerPurchase, FarmerPurchaseItem } from '../../../shared/models/farmer.model';
import { FarmerSession } from '../auth/farmer-session.service';
import { FARMER_PURCHASE_REPOSITORY } from '../data/repositories';
import { fmt } from '../i18n/farmer.i18n';
import { F, FarmerHeaderComponent, FarmerRefreshButtonComponent, fmtDate, fmtMoney, fmtNum, TILE_TONE } from '../layout/farmer-ui';
import { FarmerStore } from '../services/farmer-store.service';
import { unitLabel } from '../utils/units';

/** Borcum: bayi başına bakiye + sıradaki ödeme (bayinin kayıtlarından senkronlanan anlık değer). Salt okunur. */
@Component({
  selector: 'app-farmer-debts',
  standalone: true,
  imports: [RouterLink, FarmerHeaderComponent, FarmerRefreshButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-farmer-header [title]="t().farmer.hub.title"><app-farmer-refresh /></app-farmer-header>
    <div class="mb-4 grid grid-cols-2 gap-3">
      <a routerLink="/ciftci/oneriler" [class]="F.card + ' relative flex flex-col gap-2 no-underline'">
        <span [class]="F.tile + ' ' + tone.brand"><i class="pi pi-file-edit text-20" aria-hidden="true"></i></span>
        <span class="font-display text-17 font-extrabold leading-tight">{{ t().farmer.hub.recs }}</span>
        @if (store.unseenRecCount(); as n) {
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
              <span class="num block break-words font-display text-28 font-extrabold leading-tight" [class]="(l.balance ?? 0) > 0 ? 'text-danger-text' : 'text-fg'">{{ l.balance === null ? '—' : money(l.balance) }}</span>
              @if (l.overdueAmount) { <span class="num mt-1 block text-15 font-bold text-danger-text">{{ overdue(l.overdueAmount) }}</span> }
              @if (l.nextDue; as nd) { <span class="num mt-1 block text-15 font-semibold text-fg-secondary">{{ nextDue(nd) }}</span> }
              <span class="block text-14 text-fg-muted">{{ l.balanceUpdatedAt ? updated(l.balanceUpdatedAt) : t().farmer.home.balanceUnknown }}</span>
            } @else {
              <span class="mt-1 inline-flex h-7 items-center rounded-token-sm bg-surface-strong px-2 text-14 font-semibold text-fg-secondary">{{ t().farmer.debts.revoked }}</span>
              <span class="mt-1 block text-14 text-fg-muted">{{ t().farmer.settings.reconnectHint }}</span>
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
  nextDue(d: NonNullable<FarmerLink['nextDue']>): string { return fmt(this.t().farmer.home.nextDue, { date: fmtDate(d.date, this.lang()), amount: this.money(d.amount) }); }
  overdue(v: number): string { return fmt(this.t().farmer.home.overdue, { amount: this.money(v) }); }
}

@Component({
  selector: 'app-farmer-debt-detail',
  standalone: true,
  imports: [FarmerHeaderComponent, FarmerRefreshButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-farmer-header [title]="link()?.tenantName || t().farmer.debts.detailTitle" back="/ciftci/borc"><app-farmer-refresh [compact]="true" /></app-farmer-header>
    @if (link(); as l) {
      <div class="field-dark mb-4 rounded-token-2xl p-4">
        <p class="eyebrow m-0 text-side-soft">{{ t().farmer.debts.balance }}</p>
        <p class="num m-0 break-words font-display text-[2.125rem] font-extrabold leading-tight" [class]="(l.balance ?? 0) > 0 ? 'text-side-danger' : 'text-side-text'">{{ l.balance === null ? '—' : money(l.balance) }}</p>
        @if (l.balanceUpdatedAt) { <p class="m-0 mt-1 text-14 text-side-soft">{{ updated(l.balanceUpdatedAt) }}</p> }
        @if (l.nextDue; as nd) {
          <div class="mt-3 rounded-token-lg border border-side-line px-3 py-2.5">
            <p class="m-0 text-15 font-semibold text-side-soft">{{ t().farmer.debts.nextDue }}</p>
            <p class="num m-0 font-display text-22 font-extrabold leading-tight text-side-text">{{ date(nd.date) }} — {{ money(nd.amount) }}</p>
          </div>
        }
        @if (l.overdueAmount) {
          <p class="num m-0 mt-2 rounded-token-lg bg-danger-soft px-3 py-2 text-16 font-bold text-danger-text" role="status">
            <i class="pi pi-exclamation-triangle mr-1" aria-hidden="true"></i>{{ overdue(l.overdueAmount) }}</p>
        }
      </div>

      <h2 [class]="F.h2 + ' mb-2'">{{ t().farmer.debts.schedule }}</h2>
      @if (l.schedule.length) {
        <ol class="m-0 mb-4 flex list-none flex-col gap-2 p-0">
          @for (i of l.schedule; track $index) {
            <li [class]="F.card + ' flex flex-wrap items-center gap-x-3 gap-y-1 py-3'" [class.opacity-60]="i.remaining <= 0">
              <span class="num min-w-0 flex-1 basis-40">
                <b class="block whitespace-nowrap text-17">{{ i.dueDate ? date(i.dueDate) : t().farmer.debts.noDueDate }}</b>
                <span class="block break-words text-14 text-fg-muted">{{ installmentLabel(i) }}</span>
              </span>
              <span class="num shrink-0 text-right">
                <b class="block whitespace-nowrap text-17">{{ money(i.amount) }}</b>
                @if (i.remaining <= 0) {
                  <span class="block text-14 font-semibold text-success-text"><i class="pi pi-check mr-1 text-12" aria-hidden="true"></i>{{ t().farmer.debts.paid }}</span>
                } @else if (isLate(i)) {
                  <span class="block text-14 font-bold text-danger-text">{{ t().farmer.debts.late }} · {{ left(i.remaining) }}</span>
                } @else if (i.remaining < i.amount) {
                  <span class="block text-14 text-fg-secondary">{{ left(i.remaining) }}</span>
                }
              </span>
            </li>
          }
        </ol>
      } @else {
        <p [class]="F.muted + ' mb-4 mt-0'">{{ l.overdueAmount !== null ? t().farmer.debts.noDue : t().farmer.debts.noSchedule }}</p>
      }
    }
    <h2 [class]="F.h2 + ' mb-2'">{{ t().farmer.debts.detailTitle }}</h2>
    <div class="flex flex-col gap-3">
      @for (p of purchases(); track p.id) {
        <article [class]="F.card" [class.opacity-60]="p.status !== 'completed'">
          <div [class]="F.head">
            <span [class]="F.tile + ' h-9 w-9 ' + tone.neutral"><i class="pi pi-receipt text-17" aria-hidden="true"></i></span>
            <b class="num shrink-0 whitespace-nowrap text-17">{{ date(p.purchasedAt) }}</b>
            <span class="num min-w-0 flex-1 truncate text-right text-14 text-fg-muted" [title]="receipt(p)">{{ receipt(p) }}</span>
          </div>
          @if (p.status !== 'completed') { <p class="m-0 mb-1 inline-flex rounded-token-sm bg-danger-soft px-2 py-0.5 text-14 font-bold text-danger-text">{{ t().farmer.barn.cancelled }}</p> }
          <ul class="m-0 list-none p-0">
            @for (it of p.items; track $index) {
              <li class="flex justify-between gap-2 border-b border-line py-2 text-16 last:border-b-0">
                <span class="min-w-0 break-words">{{ it.productName }} · <span class="num whitespace-nowrap">{{ num(it.quantity) }} {{ unit(it.unit) }}</span></span>
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
export class FarmerDebtDetailPage {
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
  private readonly store = inject(FarmerStore);

  constructor() {
    // İlk açılış + her "Yenile" / uygulama öne gelince (store.refreshTick) alışverişler yeniden okunur
    effect(() => {
      this.store.refreshTick();
      untracked(() => void this.loadPurchases());
    });
  }

  private async loadPurchases(): Promise<void> {
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
  unit(u: string): string { return unitLabel(u, this.lang()); }
  left(v: number): string { return fmt(this.t().farmer.debts.left, { amount: this.money(v) }); }
  overdue(v: number): string { return fmt(this.t().farmer.debts.overdue, { amount: this.money(v) }); }
  installmentLabel(i: FarmerInstallment): string {
    const no = i.count > 1 ? fmt(this.t().farmer.debts.installment, { no: i.no, count: i.count }) : '';
    return [no, i.saleNumber ? fmt(this.t().farmer.debts.receipt, { no: i.saleNumber }) : ''].filter(Boolean).join(' · ');
  }
  isLate(i: FarmerInstallment): boolean {
    if (!i.dueDate || i.remaining <= 0) return false;
    const now = new Date();
    return i.dueDate.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  receipt(p: FarmerPurchase): string { return fmt(this.t().farmer.debts.receipt, { no: p.saleNumber }); }
  total(p: FarmerPurchase): string { return fmt(this.t().farmer.debts.total, { amount: this.money(p.totalAmount) }); }
  credit(p: FarmerPurchase): string { return fmt(this.t().farmer.debts.credit, { amount: this.money(p.creditAmount) }); }
}
