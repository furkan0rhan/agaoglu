import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UiTone } from './tone';

/** Halka koyu `-text` tonlarıyla çizilir: pastel dolgu (--brand vb.) krem zeminde çok soluk kalıyordu (14.12). */
const STROKE: Record<UiTone, string> = {
  neutral: 'var(--text-secondary)', brand: 'var(--brand-text)', accent: 'var(--accent-text)', success: 'var(--success-text)',
  warning: 'var(--warning-text)', danger: 'var(--danger-text)', info: 'var(--info-text)',
};

/**
 * Yüzde halkası (C "Kurulum %80"). Ortada yüzde yazar.
 *
 * ```html
 * <ui-progress-ring [value]="80" ariaLabel="Kurulum yüzde 80 tamamlandı" />
 * <ui-progress-ring [value]="limitPct" tone="warning" [size]="44" />
 * ```
 */
@Component({
  selector: 'ui-progress-ring',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    <svg viewBox="0 0 36 36" [attr.width]="size()" [attr.height]="size()" role="img"
         [attr.aria-label]="ariaLabel() || text()">
      <circle cx="18" cy="18" r="15" fill="none" stroke="var(--surface-strong)" stroke-width="5" />
      <circle cx="18" cy="18" r="15" fill="none" [attr.stroke]="stroke()" stroke-width="5"
        [attr.stroke-dasharray]="dash()" stroke-linecap="round" transform="rotate(-90 18 18)" />
      @if (showLabel()) {
        <text x="18" y="21.5" text-anchor="middle" font-family="Manrope Variable, Manrope, sans-serif"
          font-weight="800" font-size="8.5" fill="var(--text-primary)">{{ text() }}</text>
      }
    </svg>
  `,
})
export class ProgressRingComponent {
  /** 0–100 */
  readonly value = input(0);
  readonly size = input(56);
  readonly tone = input<UiTone>('brand');
  readonly showLabel = input(true);
  readonly ariaLabel = input<string>('');

  private readonly pct = computed(() => Math.max(0, Math.min(100, this.value() || 0)));
  readonly text = computed(() => `%${Math.round(this.pct())}`);
  /** Çevre 2πr ≈ 94.25 */
  readonly dash = computed(() => `${((this.pct() / 100) * 94.25).toFixed(2)} 94.25`);
  readonly stroke = computed(() => STROKE[this.tone()]);
}
