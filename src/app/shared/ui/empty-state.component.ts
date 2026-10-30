import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TONE_SOFT, UiTone } from './tone';

/**
 * Boş durum: ikon karesi, başlık (Manrope), açıklama, aksiyon (içerik olarak).
 *
 * ```html
 * <ui-empty-state icon="pi-box" title="Henüz ürün yok" description="İlk ürününüzü ekleyin.">
 *   <p-button label="Ürün Ekle" icon="pi pi-plus" routerLink="/products/new" />
 * </ui-empty-state>
 * ```
 */
@Component({
  selector: 'ui-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex flex-col items-center text-center" [class]="compact() ? 'gap-2 px-3 py-5' : 'gap-3 px-4 py-10'">
      <span class="relative flex items-center justify-center rounded-token-md"
            [class]="(compact() ? 'h-10 w-10 ' : 'h-14 w-14 ') + iconClass()">
        <i class="pi" [class]="icon() + (compact() ? ' text-lg' : ' text-2xl')" aria-hidden="true"></i>
      </span>
      <div class="flex max-w-sm flex-col gap-1">
        <p class="m-0 font-display font-bold text-fg" [class]="compact() ? 'text-sm' : 'text-base'">{{ title() }}</p>
        @if (description()) {
          <p class="m-0 text-sm leading-relaxed text-fg-muted">{{ description() }}</p>
        }
      </div>
      <div class="flex flex-wrap items-center justify-center gap-2 empty:hidden">
        <ng-content />
      </div>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly description = input<string>('');
  readonly icon = input<string>('pi-inbox');
  readonly tone = input<UiTone>('neutral');
  /** Kart içinde küçük boşluk için. */
  readonly compact = input(false, { transform: booleanAttribute });

  readonly iconClass = computed(() => TONE_SOFT[this.tone()]);
}
