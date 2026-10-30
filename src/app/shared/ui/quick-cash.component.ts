import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

/** Banknot adımları: toplamın üstündeki ilk yuvarlak tutarlar bunlardan üretilir. */
// Y32: büyük tutarlarda bir üst banknot katı da (2.900 → 3.000 · 5.000 · 10.000)
const STEPS = [50, 100, 200, 500, 1000, 5000, 10000];

/** Toplamın üstündeki en fazla `count` yuvarlak tutar (artan, tekrarsız). */
export function quickCashAmounts(total: number, count = 3): number[] {
  if (!(total > 0)) return [];
  const out: number[] = [];
  for (const step of STEPS) {
    const v = Math.ceil(total / step) * step;
    if (v > total && !out.includes(v)) out.push(v);
  }
  return out.sort((a, b) => a - b).slice(0, count);
}

/**
 * Hızlı para butonları (B prototipi, POS nakit ödeme): "Tam" + toplamın üstündeki yuvarlak tutarlar.
 * Seçilen "alınan" tutar `value` modeline yazılır; para üstünü sayfa hesaplar.
 *
 * ```html
 * <ui-quick-cash [total]="cart.total()" [(value)]="received" label="Alınan:" exactLabel="Tam" />
 * ```
 */
@Component({
  selector: 'ui-quick-cash',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex flex-wrap items-center gap-1.5" role="group" [attr.aria-label]="label()">
      @if (label()) {
        <span class="mr-0.5 text-12.5 font-bold text-fg-muted">{{ label() }}</span>
      }
      <button type="button" (click)="value.set(total())" [attr.aria-pressed]="value() === total()" [class]="btn(value() === total())">
        {{ exactLabel() }}
      </button>
      @for (a of amounts(); track $index) {
        <button type="button" (click)="value.set(a)" [attr.aria-pressed]="value() === a" [class]="btn(value() === a)">
          <span class="num">{{ fmt(a) }}</span>
        </button>
      }
    </div>
  `,
})
export class QuickCashComponent {
  readonly total = input(0);
  readonly value = model<number | null>(null);
  readonly label = input('Alınan:');
  readonly exactLabel = input('Tam');
  /** Kaç yuvarlak tutar önerilsin. */
  readonly count = input(3);

  readonly amounts = computed(() => quickCashAmounts(this.total(), this.count()));

  fmt(n: number): string {
    return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
  }

  btn(on: boolean): string {
    const base = 'inline-flex h-10 min-w-[56px] cursor-pointer items-center justify-center rounded-token-md border px-3 text-13.5 font-bold transition-colors';
    return on
      ? `${base} border-brand bg-brand-soft text-brand-text`
      : `${base} border-line-strong bg-surface text-fg hover:bg-surface-muted`;
  }
}
