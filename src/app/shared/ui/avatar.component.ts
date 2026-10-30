import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { initialsOf } from './initials';

export type UiAvatarTone = 'auto' | 'brand' | 'accent' | 'neutral' | 'info';

const SIZE = {
  sm: 'h-8 w-8 text-11 rounded-token-sm',
  md: 'h-9 w-9 text-13 rounded-token-md',
  lg: 'h-14 w-14 text-lg rounded-token-2xl',
} as const;

const TONE: Record<Exclude<UiAvatarTone, 'auto'>, string> = {
  brand: 'bg-brand-soft text-brand-text',
  accent: 'bg-accent-soft text-accent-text',
  neutral: 'bg-neutral-soft text-neutral-text',
  info: 'bg-info-soft text-info-text',
};
const AUTO_ORDER: Exclude<UiAvatarTone, 'auto'>[] = ['brand', 'accent', 'info', 'neutral'];

/**
 * Baş harf avatarı (Türkçe büyük harf). TS tarafında `initialsOf(name)` da kullanılabilir.
 *
 * ```html
 * <ui-avatar [name]="c.firstName + ' ' + c.lastName" />
 * <ui-avatar [name]="user.displayName" size="sm" tone="brand" variant="solid" />
 * ```
 * Ad yanında zaten yazıyorsa dekoratiftir (aria-hidden). Tek başınaysa `[decorative]="false"`.
 */
@Component({
  selector: 'ui-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex shrink-0 select-none items-center justify-center font-display font-extrabold',
    '[class]': 'hostClass()',
    '[attr.aria-hidden]': 'decorative() ? "true" : null',
    '[attr.role]': 'decorative() ? null : "img"',
    '[attr.aria-label]': 'decorative() ? null : name()',
  },
  template: `{{ initials() }}`,
})
export class AvatarComponent {
  readonly name = input<string | null | undefined>('');
  readonly size = input<keyof typeof SIZE>('md');
  readonly tone = input<UiAvatarTone>('auto');
  /** solid: koyu yeşil zemin + açık yeşil metin (C kullanıcı kutusu). */
  readonly variant = input<'soft' | 'solid'>('soft');
  readonly decorative = input(true);

  readonly initials = computed(() => initialsOf(this.name()));

  readonly hostClass = computed(() => {
    const size = SIZE[this.size()];
    if (this.variant() === 'solid') return `${size} bg-side-avatar text-side-avatar-text`;
    let tone = this.tone();
    if (tone === 'auto') {
      const n = this.name() ?? '';
      let h = 0;
      for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
      tone = AUTO_ORDER[h % AUTO_ORDER.length];
    }
    return `${size} ${TONE[tone]}`;
  });
}
