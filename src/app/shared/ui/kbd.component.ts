import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Klavye kısayolu rozeti (F1, F2, Ctrl K, Enter). Dekoratiftir: kısayolu ayrıca
 * `aria-keyshortcuts` ile verin.
 *
 * ```html
 * <button aria-keyshortcuts="F2">Hızlı Satış <ui-kbd>F2</ui-kbd></button>
 * <ui-kbd tone="inverse">F1</ui-kbd>   <!-- dolu renkli butonun içinde -->
 * ```
 */
@Component({
  selector: 'ui-kbd',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'kbd',
    'aria-hidden': 'true',
    '[class.kbd-inverse]': 'tone() === "inverse"',
  },
  template: `<ng-content />`,
  styles: [`
    :host(.kbd-inverse) { background: rgba(0, 0, 0, 0.2); border-color: rgba(255, 255, 255, 0.28); color: inherit; }
  `],
})
export class KbdComponent {
  /** inverse: dolu renkli zemin (turuncu/yeşil buton) üstünde. */
  readonly tone = input<'default' | 'inverse'>('default');
}
