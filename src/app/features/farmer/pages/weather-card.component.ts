import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { LangService } from '../../../core/i18n/lang.service';
import { GeoPoint } from '../../../shared/models/farmer.model';
import { fmt } from '../i18n/farmer.i18n';
import { F, TILE_TONE } from '../layout/farmer-ui';
import { SprayHint, sprayHints, sprayLevel, WeatherHour, WeatherService } from '../services/weather.service';

/** Tarla konumu için 12 saatlik şerit + dikkat notları. "Uygun" demez; karar çiftçide, etiket önceliklidir. */
@Component({
  selector: 'app-farmer-weather-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [class]="F.card" aria-labelledby="wx-h">
      <div [class]="F.head">
        <span [class]="F.tile + ' h-9 w-9 ' + tone.info"><i class="pi pi-cloud text-18" aria-hidden="true"></i></span>
        <h2 id="wx-h" class="m-0 min-w-0 flex-1 truncate font-display text-18 font-extrabold">
          {{ t().farmer.weather.title }}@if (fieldName()) { <span class="font-sans text-15 font-normal text-fg-muted"> · {{ fieldName() }}</span> }
        </h2>
      </div>
      @if (!location()) {
        <p [class]="F.muted + ' m-0 flex items-center gap-2'"><i class="pi pi-map-marker" aria-hidden="true"></i>{{ t().farmer.weather.noLocation }}</p>
      } @else if (failed()) {
        <p [class]="F.muted + ' m-0'">{{ t().farmer.weather.unavailable }}</p>
      } @else if (hours().length) {
        <div class="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="list">
          @for (h of hours().slice(0, 12); track h.time.getTime()) {
            <div role="listitem" class="flex w-[60px] shrink-0 flex-col items-center gap-0.5 rounded-token-lg border px-1 py-1.5 text-13" [class]="levelClass(h)">
              <b class="num text-14">{{ h.time.getHours() }}:00</b>
              <span class="num font-display text-17 font-extrabold">{{ h.tempC === null ? '—' : (h.tempC | number: '1.0-0') }}°</span>
              <span class="num flex items-center gap-1" [attr.aria-label]="windLabel(h)"><svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/></svg>{{ h.windKmh ?? '—' }}</span>
              <span class="num flex items-center gap-1" [class]="(h.rainMm ?? 0) > 0 ? 'font-bold text-info-text' : 'text-fg-muted'" [attr.aria-label]="rainLabel(h)">
                <span aria-hidden="true">💧</span>{{ h.rainMm ?? 0 | number: '1.0-1' }}</span>
            </div>
          }
        </div>
        <p class="m-0 mt-1 flex flex-wrap gap-x-3 text-13 text-fg-muted">
          <span>°C</span><span class="inline-flex items-center gap-1 whitespace-nowrap"><svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/></svg> km/s</span>
          <span class="inline-flex items-center gap-1 whitespace-nowrap"><span aria-hidden="true">💧</span>mm</span>
        </p>
        @for (hint of hints(); track hint.key) {
          <p class="mb-0 mt-2 flex items-start gap-2" [class]="hint.level === 'bad' ? F.danger : F.note">
            <i class="pi mt-0.5 shrink-0" [class]="hintIcon(hint)" aria-hidden="true"></i><span>{{ hintText(hint) }}</span>
          </p>
        }
        <p class="mb-0 mt-3 text-15 font-semibold text-fg-secondary">{{ t().farmer.weather.decision }}</p>
        <p class="m-0 mt-1 text-12 text-fg-muted"><a href="https://api.met.no/" target="_blank" rel="noopener" class="text-inherit">{{ t().farmer.weather.attribution }}</a></p>
      } @else {
        <p [class]="F.muted + ' m-0'">{{ t().farmer.common.loading }}</p>
      }
    </section>
  `,
  imports: [DecimalPipe],
})
export class FarmerWeatherCardComponent {
  readonly t = inject(LangService).t;
  readonly F = F;
  readonly tone = TILE_TONE;
  private readonly wx = inject(WeatherService);
  readonly location = input<GeoPoint | null>(null);
  readonly fieldName = input<string>('');
  readonly hours = signal<WeatherHour[]>([]);
  readonly hints = signal<SprayHint[]>([]);
  readonly failed = signal(false);

  constructor() {
    effect(() => {
      const loc = this.location();
      if (!loc) return;
      this.failed.set(false);
      this.wx.forecast(loc.lat, loc.lng)
        .then(h => { this.hours.set(h); this.hints.set(sprayHints(h)); })
        .catch(() => this.failed.set(true));
    });
  }

  levelClass(h: WeatherHour): string {
    switch (sprayLevel(h)) {
      case 'bad': return 'border-danger-line bg-danger-soft text-danger-text';
      case 'caution': return 'border-warning-line bg-warning-soft text-warning-text';
      default: return 'border-success-line bg-success-soft text-success-text';
    }
  }

  windLabel(h: WeatherHour): string {
    return fmt(this.t().farmer.weather.wind, { v: h.windKmh ?? '—' });
  }

  rainLabel(h: WeatherHour): string {
    return fmt(this.t().farmer.weather.rain, { v: h.rainMm ?? 0 });
  }

  hintIcon(h: SprayHint): string {
    switch (h.key) {
      case 'rainSoon': return 'pi-cloud';
      case 'hot': return 'pi-sun';
      default: return 'pi-exclamation-triangle';
    }
  }

  hintText(h: SprayHint): string {
    return fmt(this.t().farmer.weather[h.key], { v: h.value });
  }
}

