import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LangService } from '../../../core/i18n/lang.service';
import { SeasonStatus } from '../../../shared/models/farmer.model';
import { F, FarmerHeaderComponent, fromInputDate, toInputDate } from '../layout/farmer-ui';
import { FarmerStore } from '../services/farmer-store.service';
import { CROPS } from '../utils/crops';

/** Ekim (sezon) kaydı: ürün (ikonlu sabit liste), çeşit, ekim ve beklenen hasat tarihi, durum. */
@Component({
  selector: 'app-farmer-season-form',
  standalone: true,
  imports: [FormsModule, FarmerHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-farmer-header [title]="t().farmer.season.title" [back]="'/ciftci/tarlalar/' + fieldId" />
    <form class="flex flex-col gap-4" (ngSubmit)="save()">
      <fieldset class="m-0 border-0 p-0">
        <legend [class]="F.label">{{ t().farmer.season.crop }}</legend>
        <div class="grid grid-cols-3 gap-2">
          @for (c of crops; track c.code) {
            <button type="button" class="flex min-h-[76px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-token-lg border text-15 font-semibold transition-colors"
                    [class]="crop() === c.code ? F.on : F.off"
                    [attr.aria-pressed]="crop() === c.code" (click)="crop.set(c.code)">
              <span class="text-28 leading-none" aria-hidden="true">{{ c.icon }}</span>{{ c[lang()] }}
            </button>
          }
        </div>
      </fieldset>
      <div><label for="sf-var" [class]="F.label">{{ t().farmer.season.variety }} ({{ t().farmer.common.optional }})</label>
        <input id="sf-var" name="variety" [class]="F.input" [(ngModel)]="variety" /></div>
      <div><label for="sf-sow" [class]="F.label">{{ t().farmer.season.sowingDate }}</label>
        <input id="sf-sow" name="sow" type="date" [class]="F.input" [(ngModel)]="sowing" /></div>
      <div><label for="sf-exp" [class]="F.label">{{ t().farmer.season.expectedHarvest }}</label>
        <input id="sf-exp" name="exp" type="date" [class]="F.input" [(ngModel)]="expected" /></div>
      <fieldset class="m-0 border-0 p-0">
        <legend [class]="F.label">{{ t().farmer.season.status }}</legend>
        <div class="grid grid-cols-3 gap-2">
          @for (s of statuses; track s) {
            <button type="button" class="min-h-[56px] cursor-pointer rounded-token-lg border text-16 font-bold transition-colors"
                    [class]="status === s ? F.on : F.off"
                    [attr.aria-pressed]="status === s" (click)="status = s">{{ t().farmer.season[s] }}</button>
          }
        </div>
      </fieldset>
      @if (status === 'harvested') {
        <div><label for="sf-h" [class]="F.label">{{ t().farmer.season.harvestDate }}</label>
          <input id="sf-h" name="harvest" type="date" [class]="F.input" [(ngModel)]="harvest" /></div>
      }
      @if (error()) { <p [class]="F.danger" role="alert">{{ error() }}</p> }
      <button type="submit" [class]="F.btn"><i class="pi pi-check" aria-hidden="true"></i>{{ t().farmer.common.save }}</button>
    </form>
  `,
})
export class FarmerSeasonFormPage implements OnInit {
  readonly t = inject(LangService).t;
  readonly lang = inject(LangService).lang;
  readonly F = F;
  private readonly store = inject(FarmerStore);
  private readonly router = inject(Router);
  private readonly params = inject(ActivatedRoute).snapshot.paramMap;
  readonly fieldId = this.params.get('id') ?? '';
  readonly seasonId = this.params.get('sid');
  readonly crops = CROPS;
  readonly statuses: readonly SeasonStatus[] = ['planned', 'active', 'harvested'];

  readonly crop = signal<string | null>(null);
  variety = '';
  sowing = toInputDate(new Date());
  expected = '';
  harvest = '';
  status: SeasonStatus = 'active';
  readonly error = signal('');

  async ngOnInit(): Promise<void> {
    await this.store.load();
    const s = this.seasonId ? this.store.seasons().find(x => x.id === this.seasonId) : undefined;
    if (!s) return;
    this.crop.set(s.crop); this.variety = s.variety ?? ''; this.status = s.status;
    this.sowing = toInputDate(s.sowingDate); this.expected = toInputDate(s.expectedHarvestDate); this.harvest = toInputDate(s.harvestDate);
  }

  save(): void {
    const crop = this.crop();
    if (!crop) { this.error.set(this.t().farmer.season.cropRequired); return; }
    const data = {
      fieldId: this.fieldId, crop, variety: this.variety.trim() || null, status: this.status,
      sowingDate: fromInputDate(this.sowing), expectedHarvestDate: fromInputDate(this.expected),
      harvestDate: this.status === 'harvested' ? fromInputDate(this.harvest) : null,
    };
    if (this.seasonId) this.store.updateSeason(this.seasonId, data);
    else this.store.addSeason(data);
    void this.router.navigate(['/ciftci/tarlalar', this.fieldId]);
  }
}
