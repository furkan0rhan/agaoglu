import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Marka işareti: zümrüt gradyan kare + filiz ikonu (C prototipi). Sidebar, mobil üst çubuk, giriş.
 *
 * ```html
 * <ui-logo-mark [size]="40" />
 * ```
 */
@Component({
  selector: 'ui-logo-mark',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-grid shrink-0 place-items-center bg-brand-gradient text-brand-contrast shadow-brand',
    'aria-hidden': 'true',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.border-radius.px]': 'radius()',
  },
  template: `
    <svg viewBox="0 0 24 24" [attr.width]="iconSize()" [attr.height]="iconSize()" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 21v-8" />
      <path d="M12 13C12 8 9 5 4 5c0 5 3 8 8 8z" />
      <path d="M12 15c0-4 3-7 8-7 0 5-3 7-8 7z" />
    </svg>
  `,
})
export class LogoMarkComponent {
  readonly size = input(40);
  readonly iconSize = computed(() => Math.round(this.size() * 0.55));
  readonly radius = computed(() => Math.round(this.size() / 4));
}
