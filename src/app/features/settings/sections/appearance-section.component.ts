import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LangService } from '../../../core/i18n/lang.service';
import { Density, FontScale, ThemeMode, ThemeService } from '../../../core/theme/theme.service';
import { GlassCardComponent, SegmentedComponent, SettingsRowComponent, UiSegmentOption } from '../../../shared/ui';
import { injectSettingsTexts } from '../settings.i18n';

/** Görünüm: tema (açık/koyu/sistem), yoğunluk, yazı boyutu — ThemeService (cihazda, kullanıcı bazlı). */
@Component({
  selector: 'app-appearance-section',
  standalone: true,
  imports: [GlassCardComponent, SettingsRowComponent, SegmentedComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  styles: `
    /* Tema küçük önizlemeleri: temadan bağımsız sabit renkler (açık / koyu örneği) */
    .mini { display: flex; height: 64px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-subtle); }
    .mini .side { width: 18px; background: #edf0e4; border-right: 1px solid #d4dcc9; }
    .mini .body { flex: 1; padding: 8px; display: flex; flex-direction: column; gap: 5px; }
    .mini .body i { display: block; height: 6px; border-radius: 3px; }
    .mini.light .body { background: #f7f4ec; } .mini.light .body i { background: #e6e0d3; } .mini.light .body i.b { background: #9ec6a2; width: 50%; }
    .mini.dark .side { background: #2a2d25; border-right-color: #3e4337; }
    .mini.dark .body { background: #22231e; } .mini.dark .body i { background: #3b3d34; } .mini.dark .body i.b { background: #a8cfac; width: 50%; }
    .mini.system .body { background: linear-gradient(90deg, #f7f4ec 50%, #22231e 50%); } .mini.system .body i { background: #9c9789; } .mini.system .body i.b { background: #9ec6a2; width: 50%; }
    .mini .body i.s { width: 70%; }
  `,
  template: `
    <ui-glass-card [title]="s().sections.appearance.title" [subtitle]="s().sections.appearance.desc" icon="pi-palette" padding="none">
      <div class="border-b border-line px-3 py-3 sm:px-4">
        <p class="m-0 text-14.5 font-semibold text-fg" id="theme-label">{{ s().theme }}</p>
        <div role="radiogroup" aria-labelledby="theme-label" class="mt-2 grid grid-cols-3 gap-2 sm:max-w-[520px]">
          @for (o of themes(); track o.value) {
            @let on = theme.mode() === o.value;
            <button type="button" role="radio" [attr.aria-checked]="on" (click)="theme.setMode(o.value)"
              class="flex cursor-pointer flex-col gap-2 rounded-token-lg border bg-surface p-2 text-left transition-colors hover:bg-surface-hover"
              [class]="on ? 'border-brand shadow-[inset_0_0_0_1px_var(--brand)]' : 'border-line'">
              <span class="mini" [class]="o.value" aria-hidden="true">
                <span class="side"></span>
                <span class="body"><i class="b"></i><i></i><i class="s"></i></span>
              </span>
              <span class="flex items-center gap-1.5 px-0.5 text-13.5 font-semibold text-fg">
                <i class="pi text-xs" [class]="o.icon" aria-hidden="true"></i>{{ o.label }}
                @if (on) { <i class="pi pi-check-circle ml-auto text-brand-text" aria-hidden="true"></i> }
              </span>
            </button>
          }
        </div>
        @if (theme.mode() === 'system') {
          <p class="m-0 mt-2 text-13 text-fg-muted">{{ s().themeSystemDesc }}</p>
        }
      </div>

      <ui-settings-row [title]="s().density" [description]="s().densityDesc">
        <ui-segmented [options]="densities()" [value]="theme.density()" (valueChange)="theme.setDensity($event!)" [ariaLabel]="s().density" />
      </ui-settings-row>

      <ui-settings-row [title]="s().fontScale" [description]="s().fontScaleDesc">
        <div role="radiogroup" [attr.aria-label]="s().fontScale"
          class="inline-flex flex-wrap gap-[3px] rounded-[9px] border border-line-strong bg-surface-muted p-[3px]">
          @for (f of fonts(); track f.value) {
            @let on = theme.fontScale() === f.value;
            <!-- Y23: etiketli 4 kademe -->
            <button type="button" role="radio" [attr.aria-checked]="on" [title]="f.label"
              (click)="theme.setFontScale(f.value)"
              class="inline-flex min-h-[52px] min-w-[56px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-token-sm border-0 px-2 py-1"
              [class]="on ? 'bg-surface text-fg shadow-[0_0_0_1px_var(--border-strong)]' : 'bg-transparent text-fg-secondary hover:text-fg'">
              <span class="font-display font-bold leading-none" [class]="f.cls" aria-hidden="true">A</span>
              <span class="whitespace-nowrap text-[11px] font-semibold leading-tight">{{ f.label }}</span>
            </button>
          }
        </div>
      </ui-settings-row>

      <p class="m-0 flex items-center gap-2 px-3 py-3 text-13 text-fg-muted sm:px-4">
        <i class="pi pi-desktop" aria-hidden="true"></i>{{ s().deviceNote }}
      </p>
    </ui-glass-card>
  `,
})
export class AppearanceSectionComponent {
  readonly theme = inject(ThemeService);
  readonly t = inject(LangService).t;
  readonly s = injectSettingsTexts();

  readonly themes = computed<{ value: ThemeMode; label: string; icon: string }[]>(() => [
    { value: 'light', label: this.s().themeLight, icon: 'pi-sun' },
    { value: 'dark', label: this.s().themeDark, icon: 'pi-moon' },
    { value: 'system', label: this.s().themeSystem, icon: 'pi-desktop' },
  ]);
  readonly densities = computed<UiSegmentOption<Density>[]>(() => [
    { value: 'normal', label: this.s().densityNormal, icon: 'pi-bars' },
    { value: 'compact', label: this.s().densityCompact, icon: 'pi-align-justify' },
  ]);
  /** Sabit px: düğmeler seçili ölçekten bağımsız gerçek farkı göstersin. */
  readonly fonts = computed<{ value: FontScale; label: string; cls: string }[]>(() => [
    { value: 'normal', label: this.s().fontNormal, cls: 'text-14' },
    { value: 'large', label: this.s().fontLarge, cls: 'text-17' },
    { value: 'xlarge', label: this.s().fontXLarge, cls: 'text-20' },
    { value: 'xxlarge', label: this.s().fontXXLarge, cls: 'text-22' },
  ]);
}
