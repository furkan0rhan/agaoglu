import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LangService } from '../../../core/i18n/lang.service';
import { GeoPoint, IrrigationType } from '../../../shared/models/farmer.model';
import { F, FarmerHeaderComponent } from '../layout/farmer-ui';
import { FarmerStore } from '../services/farmer-store.service';

/** Tarla ekle / düzenle. Çevrimdışı çalışır (yerel önbelleğe yazılır, sonra senkron). */
@Component({
  selector: 'app-farmer-field-form',
  standalone: true,
  imports: [FormsModule, FarmerHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-farmer-header [title]="id ? t().farmer.fields.edit : t().farmer.fields.newTitle" [back]="id ? '/ciftci/tarlalar/' + id : '/ciftci/tarlalar'" />
    <form class="flex flex-col gap-4" (ngSubmit)="save()">
      <div>
        <label for="ff-name" [class]="F.label">{{ t().farmer.fields.name }}</label>
        <input id="ff-name" name="name" [class]="F.input" [placeholder]="t().farmer.fields.namePh" [(ngModel)]="name" maxlength="60" />
      </div>
      <div>
        <label for="ff-area" [class]="F.label">{{ t().farmer.fields.area }}</label>
        <input id="ff-area" name="area" type="number" inputmode="decimal" min="0" step="0.1" [class]="F.input" [(ngModel)]="area" />
      </div>
      <fieldset class="m-0 border-0 p-0">
        <legend [class]="F.label">{{ t().farmer.fields.irrigation }}</legend>
        <div class="grid grid-cols-2 gap-2">
          @for (o of irrigationOptions; track o) {
            <button type="button" class="min-h-[56px] cursor-pointer rounded-token-lg border text-18 font-bold transition-colors"
                    [class]="irrigation === o ? F.on : F.off"
                    [attr.aria-pressed]="irrigation === o" (click)="irrigation = o">
              {{ o === 'irrigated' ? '💧 ' + t().farmer.fields.irrigated : '☀️ ' + t().farmer.fields.dry }}
            </button>
          }
        </div>
      </fieldset>
      <div class="grid grid-cols-2 gap-3">
        <div><label for="ff-city" [class]="F.label">{{ t().farmer.fields.city }}</label><input id="ff-city" name="city" [class]="F.input" [(ngModel)]="city" /></div>
        <div><label for="ff-district" [class]="F.label">{{ t().farmer.fields.district }}</label><input id="ff-district" name="district" [class]="F.input" [(ngModel)]="district" /></div>
      </div>
      <div><label for="ff-village" [class]="F.label">{{ t().farmer.fields.village }}</label><input id="ff-village" name="village" [class]="F.input" [(ngModel)]="village" /></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label for="ff-ada" [class]="F.label">{{ t().farmer.fields.ada }}</label><input id="ff-ada" name="ada" inputmode="numeric" [class]="F.input" [(ngModel)]="ada" /></div>
        <div><label for="ff-parsel" [class]="F.label">{{ t().farmer.fields.parsel }}</label><input id="ff-parsel" name="parsel" inputmode="numeric" [class]="F.input" [(ngModel)]="parsel" /></div>
      </div>
      <div>
        <span [class]="F.label + ' flex items-center gap-2'"><i class="pi pi-map-marker text-brand-text" aria-hidden="true"></i>{{ t().farmer.fields.location }}</span>
        <p class="num m-0 mb-2 rounded-token-lg bg-surface-muted px-3 py-2.5 text-16 text-fg-secondary">{{ location() ? location()!.lat.toFixed(5) + ', ' + location()!.lng.toFixed(5) : t().farmer.fields.noLocation }}</p>
        <button type="button" [class]="F.btn2" (click)="useGps()" [disabled]="locating()"><i class="pi" [class]="locating() ? 'pi-spin pi-spinner' : 'pi-compass'" aria-hidden="true"></i>{{ locating() ? t().farmer.common.loading : t().farmer.fields.useGps }}</button>
      </div>
      @if (error()) { <p [class]="F.danger" role="alert">{{ error() }}</p> }
      <button type="submit" [class]="F.btn"><i class="pi pi-check" aria-hidden="true"></i>{{ t().farmer.common.save }}</button>
      @if (id) {
        <button type="button" [class]="F.btnDanger" (click)="archive()"><i class="pi pi-trash" aria-hidden="true"></i>{{ t().farmer.fields.archive }}</button>
      }
    </form>
  `,
})
export class FarmerFieldFormPage implements OnInit {
  readonly t = inject(LangService).t;
  readonly F = F;
  private readonly store = inject(FarmerStore);
  private readonly router = inject(Router);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  readonly irrigationOptions: readonly IrrigationType[] = ['irrigated', 'dry'];

  name = '';
  area: number | null = null;
  irrigation: IrrigationType = 'dry';
  city = '';
  district = '';
  village = '';
  ada = '';
  parsel = '';
  readonly location = signal<GeoPoint | null>(null);
  readonly locating = signal(false);
  readonly error = signal('');

  async ngOnInit(): Promise<void> {
    await this.store.load();
    const f = this.id ? this.store.field(this.id) : undefined;
    if (!f) return;
    this.name = f.name; this.area = f.areaDecare; this.irrigation = f.irrigation;
    this.city = f.city ?? ''; this.district = f.district ?? ''; this.village = f.village ?? '';
    this.ada = f.ada ?? ''; this.parsel = f.parsel ?? '';
    this.location.set(f.location);
  }

  useGps(): void {
    if (!('geolocation' in navigator)) { this.error.set(this.t().farmer.fields.gpsFailed); return; }
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      p => { this.location.set({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 }); this.locating.set(false); },
      () => { this.error.set(this.t().farmer.fields.gpsFailed); this.locating.set(false); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  save(): void {
    this.error.set('');
    if (!this.name.trim()) { this.error.set(this.t().farmer.fields.nameRequired); return; }
    const area = Number(this.area);
    if (!Number.isFinite(area) || area <= 0) { this.error.set(this.t().farmer.fields.areaInvalid); return; }
    const opt = (s: string) => s.trim() || null;
    const data = {
      name: this.name.trim(), areaDecare: Math.round(area * 100) / 100, irrigation: this.irrigation,
      city: opt(this.city), district: opt(this.district), village: opt(this.village), ada: opt(this.ada), parsel: opt(this.parsel),
      location: this.location(),
    };
    if (this.id) {
      this.store.updateField(this.id, data);
      void this.router.navigate(['/ciftci/tarlalar', this.id]);
    } else {
      const id = this.store.addField(data);
      void this.router.navigate(['/ciftci/tarlalar', id]);
    }
  }

  archive(): void {
    if (!this.id || !confirm(this.t().farmer.fields.archiveConfirm)) return;
    this.store.archiveField(this.id);
    void this.router.navigate(['/ciftci/tarlalar']);
  }
}
