import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

export interface UiSegmentOption<T = string> {
  value: T;
  label: string;
  /** PrimeIcons sınıfı (isteğe bağlı), ör. `pi-calendar`. */
  icon?: string;
}

/**
 * Bölümlü seçici (C "seg"): dönem (7G/14G/30G), görünüm, filtre. Tek seçim, `aria-pressed`.
 *
 * ```html
 * <ui-segmented [options]="[{value: 7, label: '7G'}, {value: 14, label: '14G'}, {value: 30, label: '30G'}]"
 *   [(value)]="days" ariaLabel="Dönem" />
 * ```
 */
@Component({
  selector: 'ui-segmented',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex max-w-full' },
  template: `
    <div role="group" [attr.aria-label]="ariaLabel() || null"
      class="inline-flex max-w-full gap-[3px] overflow-x-auto rounded-[9px] border border-line-strong bg-surface-muted p-[3px]"
      [class.w-full]="block()">
      @for (o of options(); track o.value) {
        @let on = o.value === value();
        <button type="button" [attr.aria-pressed]="on" (click)="value.set(o.value)"
          class="inline-flex min-w-[44px] shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-token-sm border-0 px-3 font-semibold transition-colors"
          [class]="itemClass(on)">
          @if (o.icon) { <i class="pi text-13" [class]="o.icon" aria-hidden="true"></i> }
          {{ o.label }}
        </button>
      }
    </div>
  `,
})
export class SegmentedComponent<T = string> {
  readonly options = input.required<UiSegmentOption<T>[]>();
  readonly value = model<T | null>(null);
  readonly ariaLabel = input<string>('');
  readonly size = input<'sm' | 'md'>('md');
  /** Tam genişlik (mobil filtre çubuğu): seçenekler eşit paylaşır. */
  readonly block = input(false);

  private readonly sizeClass = computed(() => (this.size() === 'sm' ? 'h-8 text-13' : 'h-9 text-13.5'));

  itemClass(on: boolean): string {
    const grow = this.block() ? ' flex-1' : '';
    return on
      ? `${this.sizeClass()}${grow} seg-on`
      : `${this.sizeClass()}${grow} bg-transparent text-fg-secondary hover:text-fg`;
  }
}
