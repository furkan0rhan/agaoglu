import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CurrencyTrPipe } from '../pipes/currency-tr.pipe';

/**
 * Para tutarı (tr-TR, 2 hane, ₺) — Manrope, eşit genişlikte rakamlar (`.num`).
 *
 * ```html
 * <ui-money [value]="sale.totalAmount" />
 * <ui-money [value]="balance" colorize />          <!-- negatif kırmızı, pozitif yeşil -->
 * <ui-money [value]="profit" [symbol]="false" signed />
 * ```
 * Şablon içinde metin olarak lazım ise: `{{ x | currencyTr }}` + `class="num"`.
 */
@Component({
  selector: 'ui-money',
  standalone: true,
  imports: [CurrencyTrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'num whitespace-nowrap', '[class]': 'toneClass()' },
  template: `{{ prefix() }}{{ value() | currencyTr: symbol() }}`,
})
export class MoneyComponent {
  readonly value = input<number | null | undefined>(null);
  readonly symbol = input(true);
  /** Pozitifte `+` göster. */
  readonly signed = input(false, { transform: booleanAttribute });
  /** Negatif → danger, pozitif → success rengi. */
  readonly colorize = input(false, { transform: booleanAttribute });

  readonly prefix = computed(() => (this.signed() && (this.value() ?? 0) > 0 ? '+' : ''));

  readonly toneClass = computed(() => {
    if (!this.colorize()) return '';
    const v = this.value() ?? 0;
    return v < 0 ? 'text-danger-text' : v > 0 ? 'text-success-text' : '';
  });
}
