import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TONE_SOFT, UiTone } from '../../../shared/ui';

export interface SumStripItem {
  icon: string;
  tone: UiTone;
  label: string;
  value: string | number;
  /** Değer metni tonu (ör. kritik sayısı > 0 iken danger) */
  valueTone?: UiTone | null;
}

const VALUE_TONE: Record<UiTone, string> = {
  neutral: 'text-fg', brand: 'text-brand-text', accent: 'text-accent-text', success: 'text-success-text',
  warning: 'text-warning-text', danger: 'text-danger-text', info: 'text-info-text',
};

/**
 * C "sumstrip": tek kartta 4 (mobilde 2×2) özet hücresi — ikon karesi + küçük etiket + Manrope rakam.
 * Ürünler, stok hareketleri, stok sayımı ve alış listesi kullanır.
 */
@Component({
  selector: 'app-sum-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ul class="ui-card m-0 grid list-none grid-cols-2 overflow-hidden p-0" [class]="items().length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'"
        [attr.aria-label]="ariaLabel() || null">
      @for (it of items(); track it.label; let i = $index; let last = $last) {
        <li class="flex min-w-0 items-center gap-3 border-line px-3 py-2.5 sm:px-4 sm:py-3"
            [class]="cellBorder(i, last)">
          <span class="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-token-md" [class]="soft(it.tone)" aria-hidden="true">
            <i class="pi text-base" [class]="it.icon"></i>
          </span>
          <span class="min-w-0">
            <span class="block truncate text-12.5 font-semibold text-fg-muted">{{ it.label }}</span>
            <b class="num block truncate text-lg font-extrabold sm:text-xl" [class]="it.valueTone ? valueTone(it.valueTone) : 'text-fg'">{{ it.value }}</b>
          </span>
        </li>
      }
    </ul>
  `,
})
export class SumStripComponent {
  readonly items = input.required<SumStripItem[]>();
  readonly ariaLabel = input('');

  soft(t: UiTone): string { return TONE_SOFT[t]; }
  valueTone(t: UiTone): string { return VALUE_TONE[t]; }

  /** Mobil 2 sütun: tek indeksler sağ kenarsız, ilk satır alt kenarlı; masaüstü tek satır: son hücre hariç sağ kenar. */
  cellBorder(i: number, last: boolean): string {
    const n = this.items().length;
    const cls: string[] = [];
    if (i % 2 === 0 && !last) cls.push('border-r');
    if (i < n - 2 || (n % 2 === 1 && i < n - 1)) cls.push('border-b lg:border-b-0');
    if (i % 2 === 1 && !last) cls.push('lg:border-r');
    return cls.join(' ');
  }
}
