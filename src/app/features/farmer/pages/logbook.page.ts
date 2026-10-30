import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LangService } from '../../../core/i18n/lang.service';
import { ApplicationLog } from '../../../shared/models/farmer.model';
import { fmt } from '../i18n/farmer.i18n';
import { F, FarmerHeaderComponent, fmtDate, fmtNum, TYPE_ICON, TYPE_STRIPE, typeTile } from '../layout/farmer-ui';
import { FarmerStore } from '../services/farmer-store.service';

/** Kişisel uygulama defteri. Resmî ÜKD değildir — ekranda açıkça yazar. */
@Component({
  selector: 'app-farmer-logbook',
  standalone: true,
  imports: [FormsModule, RouterLink, FarmerHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-farmer-header [title]="t().farmer.logbook.title" />
    <a routerLink="/ciftci/kayit/yeni" [class]="F.btn + ' mb-3 min-h-[60px] text-20 font-extrabold'"><i class="pi pi-plus-circle text-20" aria-hidden="true"></i>{{ t().farmer.home.addRecord }}</a>
    <p [class]="F.legal + ' mb-3 flex items-start gap-2'"><i class="pi pi-info-circle mt-0.5 shrink-0" aria-hidden="true"></i><span>{{ t().farmer.legal.personalLog }} {{ t().farmer.legal.ukdReminder }}</span></p>
    @if (store.fields().length > 1) {
      <label for="lb-field" [class]="F.label">{{ t().farmer.logbook.filterField }}</label>
      <select id="lb-field" [class]="F.input + ' mb-3'" [ngModel]="fieldFilter()" (ngModelChange)="fieldFilter.set($event)" name="field">
        <option [ngValue]="null">{{ t().farmer.common.all }}</option>
        @for (f of store.fields(); track f.id) { <option [ngValue]="f.id">{{ f.name }}</option> }
      </select>
    }
    <div class="flex flex-col gap-3">
      @for (l of logs(); track l.id) {
        <article [class]="F.card + ' ' + TYPE_STRIPE[l.type] + ' pl-5'">
          <div class="flex items-center gap-3">
            <span [class]="F.tile + ' ' + tile(l)" aria-hidden="true">{{ TYPE_ICON[l.type] }}</span>
            <div class="min-w-0 flex-1">
              <p class="m-0 font-display text-18 font-extrabold">{{ t().farmer.types[l.type] }}</p>
              <p class="num m-0 text-15 text-fg-muted">{{ date(l.date) }}</p>
            </div>
            <button type="button" class="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-token-lg border border-line-strong bg-surface text-fg-muted hover:border-danger-line hover:bg-danger-soft hover:text-danger-text"
              [attr.aria-label]="t().farmer.common.delete" (click)="remove(l)"><i class="pi pi-trash text-16" aria-hidden="true"></i></button>
          </div>
          <div class="mt-2 flex flex-col gap-0.5">
            <p class="m-0 text-17">{{ store.field(l.fieldId)?.name ?? '—' }} @if (l.areaDecare) { <span class="num text-fg-secondary">· {{ num(l.areaDecare) }} {{ t().farmer.common.decare }}</span> }</p>
            @if (l.productName) {
              <p class="m-0 text-17"><b>{{ l.productName }}</b> @if (l.quantity !== null) { <span class="num ml-1">· {{ num(l.quantity) }} {{ l.unit }}</span> }
                @if (l.dosePerDecare !== null) { <span class="num ml-1 text-fg-secondary">({{ num(l.dosePerDecare) }} {{ l.unit }}/da)</span> }</p>
            }
            @if (l.earliestHarvestDate) {
              <p class="m-0 mt-1 inline-flex items-center gap-1.5 self-start rounded-token-md bg-warning-soft px-2 py-1 text-15 font-bold text-warning-text">
                <i class="pi pi-hourglass text-13" aria-hidden="true"></i>{{ earliest(l) }}</p>
            }
            @if (l.recommendationId) { <p class="m-0 mt-1 flex items-center gap-1.5 text-14 text-brand-text"><i class="pi pi-file-edit text-13" aria-hidden="true"></i>{{ t().farmer.recs.title }}</p> }
            @if (l.notes) { <p class="m-0 mt-1 text-15 italic text-fg-secondary">{{ l.notes }}</p> }
          </div>
        </article>
      } @empty {
        @if (store.loaded()) {
          <div [class]="F.card + ' flex flex-col items-center gap-2 py-8 text-center'">
            <span class="grid h-16 w-16 place-items-center rounded-token-xl bg-surface-muted text-fg-muted"><i class="pi pi-book text-28" aria-hidden="true"></i></span>
            <p [class]="F.muted + ' m-0'">{{ t().farmer.logbook.empty }}</p>
          </div>
        } @else { <p [class]="F.muted">{{ t().farmer.common.loading }}</p> }
      }
    </div>
  `,
})
export class FarmerLogbookPage {
  readonly t = inject(LangService).t;
  private readonly lang = inject(LangService).lang;
  readonly F = F;
  readonly TYPE_ICON = TYPE_ICON;
  readonly TYPE_STRIPE = TYPE_STRIPE;
  readonly store = inject(FarmerStore);
  readonly fieldFilter = signal<string | null>(null);
  readonly logs = computed(() => this.store.logs().filter(l => !this.fieldFilter() || l.fieldId === this.fieldFilter()));

  constructor() { void this.store.load(); }

  tile(l: ApplicationLog): string { return typeTile(l.type); }
  date(d: Date): string { return fmtDate(d, this.lang()); }
  num(v: number): string { return fmtNum(v, this.lang()); }
  earliest(l: ApplicationLog): string { return fmt(this.t().farmer.log.phiEarliest, { date: fmtDate(l.earliestHarvestDate, this.lang()) }); }

  remove(l: ApplicationLog): void {
    if (confirm(this.t().farmer.logbook.deleteConfirm)) this.store.deleteLog(l.id);
  }
}
