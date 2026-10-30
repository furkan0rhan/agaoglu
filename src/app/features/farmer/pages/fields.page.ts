import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LangService } from '../../../core/i18n/lang.service';
import { ApplicationLog, SeasonStatus } from '../../../shared/models/farmer.model';
import { fmt } from '../i18n/farmer.i18n';
import { F, FarmerHeaderComponent, fmtDate, fmtNum, fmtShortDate, TILE_TONE, TYPE_ICON, typeTile } from '../layout/farmer-ui';
import { FarmerStore } from '../services/farmer-store.service';
import { cropDef } from '../utils/crops';
import { unitLabel } from '../utils/units';
import { FarmerWeatherCardComponent } from './weather-card.component';

@Component({
  selector: 'app-farmer-fields',
  standalone: true,
  imports: [RouterLink, FarmerHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-farmer-header [title]="t().farmer.fields.title" />
    <div class="flex flex-col gap-3">
      @for (f of store.fields(); track f.id) {
        <a [routerLink]="['/ciftci/tarlalar', f.id]" [class]="F.card + ' flex min-h-[80px] items-center gap-3 no-underline'">
          <span class="grid h-14 w-14 shrink-0 place-items-center rounded-token-lg bg-surface-muted text-[2rem]" aria-hidden="true">{{ cropIcon(f.id) }}</span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-display text-20 font-extrabold">{{ f.name }}</span>
            <span class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-16 text-fg-secondary">
              <span class="num font-semibold text-fg">{{ num(f.areaDecare) }} {{ t().farmer.common.decare }}</span>
              <span class="inline-flex h-7 items-center gap-1 rounded-token-sm px-2 text-14 font-semibold"
                [class]="f.irrigation === 'irrigated' ? 'bg-info-soft text-info-text' : 'bg-warning-soft text-warning-text'">
                <span aria-hidden="true">{{ f.irrigation === 'irrigated' ? '💧' : '☀️' }}</span>{{ f.irrigation === 'irrigated' ? t().farmer.fields.irrigated : t().farmer.fields.dry }}
              </span>
              @if (cropLabel(f.id); as c) { <span>{{ c }}</span> }
            </span>
          </span>
          <i [class]="F.chevron" aria-hidden="true"></i>
        </a>
      } @empty {
        @if (store.loaded()) {
          <div [class]="F.card + ' flex flex-col items-center gap-2 py-8 text-center'">
            <span class="grid h-16 w-16 place-items-center rounded-token-xl bg-surface-muted text-[2.125rem]" aria-hidden="true">🌾</span>
            <p [class]="F.muted + ' m-0'">{{ t().farmer.fields.empty }}</p>
          </div>
        } @else { <p [class]="F.muted">{{ t().farmer.common.loading }}</p> }
      }
      <a routerLink="/ciftci/tarlalar/yeni" [class]="F.btn"><i class="pi pi-plus text-18" aria-hidden="true"></i>{{ t().farmer.fields.add }}</a>
    </div>
  `,
})
export class FarmerFieldsPage {
  readonly t = inject(LangService).t;
  private readonly lang = inject(LangService).lang;
  readonly F = F;
  readonly store = inject(FarmerStore);

  constructor() { void this.store.load(); }

  num(v: number): string { return fmtNum(v, this.lang()); }
  cropIcon(fieldId: string): string { const s = this.store.currentSeason(fieldId); return s ? cropDef(s.crop).icon : '🟫'; }
  cropLabel(fieldId: string): string | null { const s = this.store.currentSeason(fieldId); return s ? cropDef(s.crop)[this.lang()] : null; }
}

@Component({
  selector: 'app-farmer-field-detail',
  standalone: true,
  imports: [RouterLink, FarmerHeaderComponent, FarmerWeatherCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (field(); as f) {
      <app-farmer-header [title]="f.name" back="/ciftci/tarlalar">
        <a [routerLink]="['/ciftci/tarlalar', f.id, 'duzenle']" class="grid h-12 w-12 shrink-0 place-items-center rounded-token-lg border border-line-strong bg-surface text-fg no-underline hover:bg-surface-muted"
           [attr.aria-label]="t().farmer.fields.edit"><i class="pi pi-pencil text-18" aria-hidden="true"></i></a>
      </app-farmer-header>
      <div class="flex flex-col gap-4">
        <div [class]="F.card">
          <div class="grid grid-cols-2 gap-2">
            <div class="rounded-token-lg bg-surface-muted px-3 py-2.5">
              <p class="eyebrow m-0 text-fg-muted">{{ t().farmer.fields.area }}</p>
              <p class="num m-0 font-display text-24 font-extrabold">{{ num(f.areaDecare) }} <span class="text-16 font-semibold text-fg-secondary">{{ t().farmer.common.decare }}</span></p>
            </div>
            <div class="rounded-token-lg px-3 py-2.5" [class]="f.irrigation === 'irrigated' ? 'bg-info-soft text-info-text' : 'bg-warning-soft text-warning-text'">
              <p class="eyebrow m-0">{{ t().farmer.fields.irrigation }}</p>
              <p class="m-0 font-display text-20 font-extrabold"><span aria-hidden="true">{{ f.irrigation === 'irrigated' ? '💧' : '☀️' }}</span>
                {{ f.irrigation === 'irrigated' ? t().farmer.fields.irrigated : t().farmer.fields.dry }}</p>
            </div>
          </div>
          @if (place()) { <p class="m-0 mt-3 flex items-center gap-2 text-17"><i class="pi pi-map-marker text-fg-muted" aria-hidden="true"></i>{{ place() }}</p> }
          @if (f.ada || f.parsel) { <p class="m-0 mt-1 text-16 text-fg-secondary">{{ t().farmer.fields.ada }} {{ f.ada || '—' }} / {{ t().farmer.fields.parsel }} {{ f.parsel || '—' }}</p> }
          @if (f.sharedTenantIds.length) { <p class="m-0 mt-1 flex items-center gap-2 text-14 text-fg-muted"><i class="pi pi-eye" aria-hidden="true"></i>{{ shared() }}</p> }
          <div class="mt-3 grid grid-cols-2 gap-2">
            @if (f.location) {
              <a [href]="mapUrl()" target="_blank" rel="noopener" [class]="F.btn2 + ' text-16'"><i class="pi pi-map-marker" aria-hidden="true"></i>{{ t().farmer.fields.openMap }}</a>
            }
            <a href="https://parselsorgu.tkgm.gov.tr/" target="_blank" rel="noopener" [class]="F.btn2 + ' text-16'" [class.col-span-2]="!f.location"><i class="pi pi-external-link" aria-hidden="true"></i>{{ t().farmer.fields.openTkgm }}</a>
          </div>
        </div>

        <section [class]="F.card" aria-labelledby="fd-seasons">
          <div [class]="F.head">
            <span [class]="F.tile + ' h-9 w-9 ' + tone.success"><i class="pi pi-sun text-17" aria-hidden="true"></i></span>
            <h2 id="fd-seasons" class="m-0 font-display text-18 font-extrabold">{{ t().farmer.fields.seasons }}</h2>
          </div>
          <div class="flex flex-col gap-2">
            @for (s of seasons(); track s.id) {
              <a [routerLink]="['/ciftci/tarlalar', f.id, 'sezon', s.id]" class="list-row flex min-h-[64px] items-center gap-3 rounded-token-lg border border-line p-3 text-fg no-underline">
                <span class="text-[1.875rem]" aria-hidden="true">{{ crop(s.crop).icon }}</span>
                <span class="min-w-0 flex-1">
                  <span class="flex flex-wrap items-center gap-2">
                    <b class="text-18">{{ crop(s.crop)[lang()] }}</b>@if (s.variety) { <span class="text-fg-secondary">({{ s.variety }})</span> }
                    <span class="inline-flex h-6 items-center rounded-token-sm px-2 text-13 font-semibold" [class]="seasonTone(s.status)">{{ t().farmer.season[s.status] }}</span>
                  </span>
                  <span class="mt-0.5 block text-14 text-fg-muted">{{ t().farmer.season.sowingDate }}: {{ date(s.sowingDate) }} · {{ t().farmer.season.expectedHarvest }}: {{ date(s.expectedHarvestDate) }}</span>
                </span>
                <i [class]="F.chevron" aria-hidden="true"></i>
              </a>
            } @empty { <p [class]="F.muted + ' m-0'">{{ t().farmer.fields.noSeason }}</p> }
          </div>
          <a [routerLink]="['/ciftci/tarlalar', f.id, 'sezon', 'yeni']" [class]="F.btn2 + ' mt-3'"><i class="pi pi-plus" aria-hidden="true"></i>{{ t().farmer.fields.addSeason }}</a>
        </section>

        <section [class]="F.card" aria-labelledby="fd-logs">
          <div [class]="F.head">
            <span [class]="F.tile + ' h-9 w-9 ' + tone.info"><i class="pi pi-book text-17" aria-hidden="true"></i></span>
            <h2 id="fd-logs" class="m-0 font-display text-18 font-extrabold">{{ t().farmer.fields.recentLogs }}</h2>
          </div>
          @for (l of logs(); track l.id) {
            <div class="flex items-center gap-3 border-b border-line py-2 last:border-b-0">
              <span [class]="F.tile + ' h-10 w-10 text-20 ' + tile(l)" aria-hidden="true">{{ icon(l) }}</span>
              <span class="min-w-0 flex-1 text-17">
                <b>{{ t().farmer.types[l.type] }}</b> @if (l.productName) { · {{ l.productName }} }
                <span class="block text-14 text-fg-muted"><span class="num">{{ short(l.date) }}</span>@if (l.quantity !== null) { · <span class="num">{{ num(l.quantity) }} {{ uLabel(l.unit) }}</span> }</span>
              </span>
            </div>
          } @empty { <p [class]="F.muted + ' m-0'">{{ t().farmer.fields.noLogs }}</p> }
          <a [routerLink]="'/ciftci/kayit/yeni'" [queryParams]="{ tarla: f.id }" [class]="F.btn + ' mt-3'"><i class="pi pi-plus-circle" aria-hidden="true"></i>{{ t().farmer.home.addRecord }}</a>
        </section>

        <app-farmer-weather-card [location]="f.location" [fieldName]="f.name" />
      </div>
    } @else if (store.loaded()) {
      <app-farmer-header [title]="t().farmer.fields.notFound" back="/ciftci/tarlalar" />
    } @else {
      <p [class]="F.muted">{{ t().farmer.common.loading }}</p>
    }
  `,
})
export class FarmerFieldDetailPage {
  readonly t = inject(LangService).t;
  readonly lang = inject(LangService).lang;
  readonly F = F;
  readonly tone = TILE_TONE;
  readonly store = inject(FarmerStore);
  readonly id = signal(inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '');

  readonly field = computed(() => this.store.field(this.id()));
  readonly seasons = computed(() => this.store.seasonsOf(this.id()));
  readonly logs = computed(() => this.store.logs().filter(l => l.fieldId === this.id()).slice(0, 8));
  readonly place = computed(() => { const f = this.field(); return f ? [f.village, f.district, f.city].filter(Boolean).join(', ') : ''; });
  readonly shared = computed(() => fmt(this.t().farmer.fields.sharedWith, { n: this.field()?.sharedTenantIds.length ?? 0 }));
  readonly mapUrl = computed(() => { const l = this.field()?.location; return l ? `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}` : ''; });

  constructor() { void this.store.load(); }

  crop = cropDef;
  num(v: number): string { return fmtNum(v, this.lang()); }
  date(d: Date | null): string { return fmtDate(d, this.lang()); }
  short(d: Date): string { return fmtShortDate(d, this.lang()); }
  uLabel(u: string | null): string { return unitLabel(u, this.lang()); }
  icon(l: ApplicationLog): string { return TYPE_ICON[l.type]; }
  tile(l: ApplicationLog): string { return typeTile(l.type); }
  seasonTone(s: SeasonStatus): string {
    return s === 'active' ? 'bg-success-soft text-success-text' : s === 'planned' ? 'bg-info-soft text-info-text' : 'bg-surface-strong text-fg-secondary';
  }
}
