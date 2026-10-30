import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TONE_SOFT, TONE_TINT, UiTone } from './tone';

export type UiCardPadding = 'none' | 'sm' | 'md' | 'lg';
/** v2'de üç değer de aynı opak C kartını çizer (geriye uyum için duruyor). */
export type UiCardVariant = 'glass' | 'strong' | 'solid';

const PAD: Record<UiCardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5 sm:p-6',
};

/**
 * C kartı: opak kâğıt yüzey, ince kenarlık, 10px köşe. `title` verilirse üstte **başlık şeridi**
 * (tarla çizgili bant) + ikon karesi + `[card-actions]` slot'u çizilir.
 *
 * ```html
 * <ui-glass-card title="Son Satışlar" icon="pi-receipt" tone="brand">
 *   <a card-actions routerLink="/sales">Tümü</a>
 *   ...içerik...
 * </ui-glass-card>
 *
 * <!-- Tablo: gövde dolgusuz, köşeler kırpılır -->
 * <ui-glass-card title="Ürünler" icon="pi-box" padding="none" clip>
 *   <p-table ...>
 * </ui-glass-card>
 *
 * <!-- Durum bloğu: bütün kart tonlu zemin -->
 * <ui-glass-card title="Gecikmiş alacak" icon="pi-clock" tone="danger" tinted>…</ui-glass-card>
 * ```
 */
@Component({
  selector: 'ui-glass-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-w-0 rounded-token-lg border',
    '[class]': 'hostClass()',
  },
  template: `
    @if (title()) {
      <header class="card-head" [class.card-head-tinted]="tinted()">
        @if (icon()) {
          <span class="card-head-icon" [class]="iconClass()">
            <i class="pi text-15" [class]="icon()" aria-hidden="true"></i>
          </span>
        }
        <div class="min-w-0 flex-1">
          <h3 class="truncate">{{ title() }}</h3>
          @if (subtitle()) {
            <p class="m-0 truncate font-sans text-13 font-normal text-fg-muted">{{ subtitle() }}</p>
          }
        </div>
        <div class="flex shrink-0 items-center gap-2 empty:hidden">
          <ng-content select="[card-actions]" />
        </div>
      </header>
    }
    <div [class]="bodyClass()">
      <ng-content />
    </div>
    <ng-content select="[card-footer]" />
  `,
  styles: [`
    :host .card-head-tinted { background-color: transparent; border-bottom-color: inherit; }
  `],
})
export class GlassCardComponent {
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
  /** PrimeIcons sınıfı, ör. `pi-receipt` — başlık şeridinde ikon karesi. */
  readonly icon = input<string>('');
  /** İkon karesi tonu (v2 adı). Verilmezse `iconTone`. */
  readonly tone = input<UiTone | null>(null);
  /** İkon karesi tonu (v1 adı, geriye uyum). */
  readonly iconTone = input<UiTone>('brand');
  readonly padding = input<UiCardPadding>('md');
  /** v2'de görünümü değiştirmez (hepsi opak C kartı). */
  readonly variant = input<UiCardVariant>('glass');
  /** İçerik köşelerden taşmasın (tablo gömerken). Açılır panel içeriyorsa KULLANMAYIN. */
  readonly clip = input(false, { transform: booleanAttribute });
  /** Tıklanabilir kart: hover'da marka kenarlığı. */
  readonly interactive = input(false, { transform: booleanAttribute });
  /** Bütün kart `tone` renginde yumuşak zemin (durum bloğu: gecikme, uyarı). */
  readonly tinted = input(false, { transform: booleanAttribute });

  readonly effectiveTone = computed<UiTone>(() => this.tone() ?? this.iconTone());
  readonly iconClass = computed(() => TONE_SOFT[this.effectiveTone()]);

  readonly hostClass = computed(() => {
    const parts = [this.tinted() ? TONE_TINT[this.effectiveTone()] : 'bg-surface border-line'];
    if (this.clip()) parts.push('overflow-hidden');
    if (this.interactive()) parts.push('transition-colors duration-150 hover:border-brand');
    return parts.join(' ');
  });

  readonly bodyClass = computed(() => PAD[this.padding()]);
}
