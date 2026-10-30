import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TONE_SOFT, TONE_SOLID, UiTone } from './tone';

/** `outline` = C "iconbtn" (kâğıt zemin + kenarlık). `glass` v1 adıdır, `outline` gibi çizilir. */
export type UiIconButtonVariant = 'ghost' | 'soft' | 'solid' | 'outline' | 'glass';

const GHOST: Record<UiTone, string> = {
  neutral: 'text-fg-secondary hover:bg-surface-hover hover:text-fg',
  brand: 'text-brand-text hover:bg-brand-soft',
  accent: 'text-accent-text hover:bg-accent-soft',
  success: 'text-success-text hover:bg-success-soft',
  warning: 'text-warning-text hover:bg-warning-soft',
  danger: 'text-danger-text hover:bg-danger-soft',
  info: 'text-info-text hover:bg-info-soft',
};

/**
 * Sadece ikonlu buton. `ariaLabel` ZORUNLU (ekran okuyucu + tooltip için `title`).
 * Tıklama: host üzerinde `(click)` dinleyin.
 *
 * ```html
 * <ui-icon-button icon="pi-trash" tone="danger" [ariaLabel]="t().common.delete" (click)="remove()" />
 * <ui-icon-button icon="pi-shopping-cart" variant="soft" tone="accent" ariaLabel="Sepet" [badge]="3" />
 * ```
 */
@Component({
  selector: 'ui-icon-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    <button [type]="type()" [disabled]="disabled()" [attr.aria-label]="ariaLabel()" [attr.title]="ariaLabel()"
            [attr.aria-pressed]="pressed()"
            class="relative inline-flex items-center justify-center rounded-token-md transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
            [class]="buttonClass()">
      <i class="pi" [class]="icon() + (size() === 'sm' ? ' text-sm' : ' text-base')" aria-hidden="true"></i>
      @if (badge()) {
        <span class="num absolute -right-1.5 -top-1.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-token-sm px-1 text-11 font-bold leading-none"
              [class]="badgeClass()">{{ badge()! > 99 ? '99+' : badge() }}</span>
      }
    </button>
  `,
})
export class IconButtonComponent {
  readonly icon = input.required<string>();
  readonly ariaLabel = input.required<string>();
  readonly tone = input<UiTone>('neutral');
  readonly variant = input<UiIconButtonVariant>('ghost');
  /** sm: 36px · md: 44px (dokunmatik varsayılan) */
  readonly size = input<'sm' | 'md'>('md');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Aç/kapa butonlarda (tema vb.) `aria-pressed`. null → yazılmaz. */
  readonly pressed = input<boolean | null>(null);
  readonly badge = input<number | null>(null);
  readonly badgeTone = input<UiTone>('danger');

  readonly buttonClass = computed(() => {
    const size = this.size() === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
    const tone = this.tone();
    const look =
      this.variant() === 'solid' ? `${TONE_SOLID[tone]} hover:opacity-90`
      : this.variant() === 'soft' ? `${TONE_SOFT[tone]} hover:brightness-95`
      : this.variant() === 'outline' || this.variant() === 'glass'
        ? `border border-line bg-surface ${tone === 'neutral' ? 'text-fg-secondary hover:bg-surface-muted hover:text-fg' : GHOST[tone]}`
      : `bg-transparent ${GHOST[tone]}`;
    return `${size} ${look} cursor-pointer`;
  });

  readonly badgeClass = computed(() => TONE_SOLID[this.badgeTone()]);
}
