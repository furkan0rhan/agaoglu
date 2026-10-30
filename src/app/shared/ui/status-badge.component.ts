import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TONE_SOFT, UiTone } from './tone';

/**
 * Durum rozeti — C "pill": 6px köşe, yumuşak zemin + tonlu metin, kenarlıksız. Metin içerik olarak.
 *
 * ```html
 * <ui-status-badge tone="danger" icon="pi-exclamation-triangle">Kritik</ui-status-badge>
 * <ui-status-badge tone="success" dot>Aktif</ui-status-badge>
 * ```
 */
@Component({
  selector: 'ui-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-token-sm font-semibold leading-none',
    '[class]': 'hostClass()',
  },
  template: `
    @if (dot()) {
      <span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>
    }
    @if (icon()) {
      <i class="pi" [class]="icon() + (size() === 'sm' ? ' text-10' : ' text-12')" aria-hidden="true"></i>
    }
    <span class="truncate"><ng-content /></span>
  `,
})
export class StatusBadgeComponent {
  readonly tone = input<UiTone>('neutral');
  readonly icon = input<string>('');
  readonly dot = input(false, { transform: booleanAttribute });
  readonly size = input<'sm' | 'md'>('md');

  readonly hostClass = computed(() => {
    const size = this.size() === 'sm' ? 'h-5 px-1.5 text-11.5' : 'h-6 px-[9px] text-12.5';
    return `${TONE_SOFT[this.tone()]} ${size}`;
  });
}
