import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangService } from '../../../core/i18n/lang.service';
import { FarmerSession } from '../auth/farmer-session.service';
import { fmt } from '../i18n/farmer.i18n';
import { F, FarmerRefreshButtonComponent, fmtDate, fmtMoney, TILE_TONE } from '../layout/farmer-ui';
import { FarmerStore } from '../services/farmer-store.service';
import { FarmerWeatherCardComponent } from './weather-card.component';

@Component({
  selector: 'app-farmer-home',
  standalone: true,
  imports: [RouterLink, FarmerWeatherCardComponent, FarmerRefreshButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <h1 class="m-0 min-w-0 flex-1 truncate font-display text-26 font-extrabold leading-tight text-fg">{{ hello() }}</h1>
        <app-farmer-refresh [compact]="true" />
        @if (canSpeak) {
          <button type="button" (click)="toggleRead()" [attr.aria-pressed]="speaking()"
            class="flex min-h-[48px] shrink-0 cursor-pointer items-center gap-2 rounded-token-lg border border-line-strong bg-surface px-3 text-16 font-bold text-fg hover:bg-surface-muted">
            <i class="pi text-18" [class]="speaking() ? 'pi-stop-circle' : 'pi-volume-up'" aria-hidden="true"></i>
            {{ speaking() ? t().farmer.common.stopReading : t().farmer.common.read }}
          </button>
        }
      </div>

      @for (w of store.phiWarnings(); track w.fieldId + (w.seasonId ?? '')) {
        <a [routerLink]="['/ciftci/tarlalar', w.fieldId]" class="flex gap-3 rounded-token-2xl border p-4 no-underline"
           [class]="w.conflict ? 'border-danger-line bg-danger-soft text-danger-text' : 'border-warning-line bg-warning-soft text-warning-text'">
          <span class="grid h-11 w-11 shrink-0 place-items-center rounded-token-lg text-fg-inverse" [class]="w.conflict ? 'bg-danger' : 'bg-warning'">
            <i class="pi pi-exclamation-triangle text-20" aria-hidden="true"></i>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block font-display text-19 font-extrabold">{{ t().farmer.home.phiTitle }} — {{ store.field(w.fieldId)?.name }}</span>
            <span class="mt-1 block text-18 font-semibold">{{ phiEarliest(w.earliest) }}</span>
            <span class="block text-17">{{ daysLeft(w.daysLeft) }}</span>
            <span class="mt-1 block text-15 text-fg-secondary">{{ w.productName }} ({{ w.phiDays }} {{ t().farmer.common.days }})</span>
            @if (w.conflict) { <span class="mt-1 block font-bold">{{ t().farmer.home.phiConflict }}</span> }
            <span class="mt-1 block text-13 text-fg-secondary">{{ t().farmer.legal.labelFirst }}</span>
          </span>
        </a>
      }

      @if (store.activeRecommendations().length) {
        <a routerLink="/ciftci/oneriler" class="flex min-h-[72px] items-center gap-3 rounded-token-2xl border border-brand-line bg-brand-soft p-4 text-brand-text no-underline">
          <span class="grid h-11 w-11 shrink-0 place-items-center rounded-token-lg bg-brand text-brand-contrast"><i class="pi pi-file-edit text-20" aria-hidden="true"></i></span>
          <span class="min-w-0 flex-1 font-display text-19 font-extrabold">{{ t().farmer.home.recsCard }}</span>
          <span class="num shrink-0 rounded-token-md bg-brand px-2.5 py-1 text-16 font-bold text-brand-contrast">{{ recsCount() }}</span>
          <i [class]="F.chevron" aria-hidden="true"></i>
        </a>
      }

      <a routerLink="/ciftci/borc" [class]="F.card + ' no-underline'">
        <span [class]="F.head">
          <span [class]="F.tile + ' h-9 w-9 text-18 ' + tone.accent"><i class="pi pi-wallet text-18" aria-hidden="true"></i></span>
          <span class="min-w-0 flex-1 font-display text-18 font-extrabold">{{ t().farmer.home.debtTitle }}</span>
          <i [class]="F.chevron" aria-hidden="true"></i>
        </span>
        @for (l of session.activeLinks(); track l.id) {
          <span class="block border-b border-line py-2 last:border-b-0 last:pb-0">
            <span class="flex items-baseline justify-between gap-3">
              <span class="min-w-0">
                <span class="block truncate text-17 font-semibold">{{ l.tenantName }}</span>
                <span class="block text-14 text-fg-muted">{{ l.balanceUpdatedAt ? lastUpdate(l.balanceUpdatedAt) : t().farmer.home.balanceUnknown }}</span>
              </span>
              <span class="num shrink-0 font-display text-24 font-extrabold" [class]="(l.balance ?? 0) > 0 ? 'text-danger-text' : 'text-fg'">
                {{ l.balance === null ? '—' : money(l.balance) }}</span>
            </span>
            @if (l.overdueAmount) {
              <span class="num mt-1 block rounded-token-sm bg-danger-soft px-2 py-1 text-15 font-bold text-danger-text">{{ overdue(l.overdueAmount) }}</span>
            }
            @if (l.nextDue; as nd) {
              <span class="num mt-1 block text-15 font-semibold text-fg-secondary"><i class="pi pi-calendar mr-1 text-13" aria-hidden="true"></i>{{ nextDue(nd) }}</span>
            }
          </span>
        } @empty {
          <span [class]="F.muted">{{ t().farmer.home.noDebt }}</span>
        }
      </a>

      <a routerLink="/ciftci/kayit/yeni" [class]="F.btn + ' min-h-[64px] text-[1.3125rem] font-extrabold tracking-wide'">
        <i class="pi pi-plus-circle text-22" aria-hidden="true"></i>{{ t().farmer.home.addRecord }}
      </a>

      <div class="grid grid-cols-2 gap-3">
        <a routerLink="/ciftci/tarlalar" [class]="F.card + ' flex flex-col gap-2 no-underline'">
          <span [class]="F.tile + ' ' + tone.success"><i class="pi pi-map text-20" aria-hidden="true"></i></span>
          <span class="font-display text-18 font-extrabold">{{ t().farmer.home.fieldsCard }}</span>
          <span class="num text-16 text-fg-muted">{{ store.fields().length }}</span>
        </a>
        <a routerLink="/ciftci/ambar" [class]="F.card + ' flex flex-col gap-2 no-underline'">
          <span [class]="F.tile + ' ' + tone.accent"><i class="pi pi-box text-20" aria-hidden="true"></i></span>
          <span class="font-display text-18 font-extrabold">{{ t().farmer.home.barnCard }}</span>
          <span class="num text-16 text-fg-muted">{{ productsCount() }}</span>
        </a>
        <a routerLink="/ciftci/defter" [class]="F.card + ' col-span-2 flex items-center gap-3 no-underline'">
          <span [class]="F.tile + ' ' + tone.info"><i class="pi pi-book text-20" aria-hidden="true"></i></span>
          <span class="min-w-0 flex-1">
            <span class="block font-display text-18 font-extrabold">{{ t().farmer.home.logbookCard }}</span>
            <span class="num block text-16 text-fg-muted">{{ recordsCount() }}</span>
          </span>
          <i [class]="F.chevron" aria-hidden="true"></i>
        </a>
      </div>

      <app-farmer-weather-card [location]="weatherField()?.location ?? null" [fieldName]="weatherField()?.name ?? ''" />

      <div [class]="F.legal + ' flex gap-2.5'">
        <i class="pi pi-info-circle mt-0.5 shrink-0 text-16 text-fg-muted" aria-hidden="true"></i>
        <p class="m-0">{{ t().farmer.legal.notAdvisor }} {{ t().farmer.legal.personalLog }}</p>
      </div>
      @if (store.loadError()) {
        <button type="button" [class]="F.btn2" (click)="store.load(true)">
          <i class="pi pi-refresh" aria-hidden="true"></i>{{ t().farmer.common.loadFailed }} — {{ t().farmer.common.retry }}</button>
      }
    </div>
  `,
})
export class FarmerHomePage implements OnDestroy {
  readonly t = inject(LangService).t;
  private readonly lang = inject(LangService).lang;
  readonly F = F;
  readonly tone = TILE_TONE;
  readonly session = inject(FarmerSession);
  readonly store = inject(FarmerStore);
  readonly canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  readonly speaking = signal(false);

  readonly hello = computed(() => fmt(this.t().farmer.home.hello, { name: this.session.farmer()?.displayName.split(' ')[0] ?? '' }));
  readonly recsCount = computed(() => fmt(this.t().farmer.home.newRecs, { n: this.store.activeRecommendations().length }));
  /** Ambarım'la aynı kural: kalanı olan kalemler + biten sayısı (rapor #7) */
  readonly productsCount = computed(() => {
    const n = this.store.barnItemCount(), m = this.store.barnUsedUpCount();
    return m ? fmt(this.t().farmer.home.productsUsedUp, { n, m }) : fmt(this.t().farmer.home.productsCount, { n });
  });
  readonly recordsCount = computed(() => fmt(this.t().farmer.home.recordsCount, { n: this.store.logs().length }));
  readonly weatherField = computed(() => this.store.fields().find(f => f.location) ?? null);

  constructor() {
    void this.store.load();
  }

  money(v: number): string { return fmtMoney(v, this.lang()); }
  nextDue(d: { date: Date; amount: number }): string { return fmt(this.t().farmer.home.nextDue, { date: fmtDate(d.date, this.lang()), amount: this.money(d.amount) }); }
  overdue(v: number): string { return fmt(this.t().farmer.home.overdue, { amount: this.money(v) }); }
  lastUpdate(d: Date): string { return fmt(this.t().farmer.home.lastUpdate, { date: fmtDate(d, this.lang()) }); }
  phiEarliest(d: Date): string { return fmt(this.t().farmer.home.phiEarliest, { date: fmtDate(d, this.lang()) }); }
  daysLeft(n: number): string { return fmt(this.t().farmer.home.phiDaysLeft, { n }); }

  /** Ekran özeti sesli okunur (tr-TR ses cihazda varsa). */
  toggleRead(): void {
    const synth = window.speechSynthesis;
    if (this.speaking()) { synth.cancel(); this.speaking.set(false); return; }
    const parts = [this.hello()];
    for (const w of this.store.phiWarnings()) parts.push(`${this.t().farmer.home.phiTitle}. ${this.store.field(w.fieldId)?.name ?? ''}. ${this.phiEarliest(w.earliest)}.`);
    for (const l of this.session.activeLinks()) if (l.balance != null) parts.push(`${l.tenantName}: ${this.money(l.balance)}`);
    const u = new SpeechSynthesisUtterance(parts.join('. '));
    u.lang = this.lang() === 'tr' ? 'tr-TR' : 'en-GB';
    u.onend = () => this.speaking.set(false);
    this.speaking.set(true);
    synth.speak(u);
  }

  ngOnDestroy(): void {
    if (this.speaking()) window.speechSynthesis.cancel();
  }
}
