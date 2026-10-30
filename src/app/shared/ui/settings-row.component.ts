import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Ayarlar satırı (C "srow"): solda başlık + açıklama, sağda kontrol (içerik olarak).
 * Kartın içinde alt alta dizilir; aralarına çizgi otomatik. Mobilde kontrol alta iner
 * (`inline` ise yan yana kalır — anahtar/switch için).
 *
 * ```html
 * <ui-glass-card title="Satış ayarları" icon="pi-shopping-cart" padding="none">
 *   <ui-settings-row title="Negatif stokla satış" description="Stok 0 iken satışa izin ver" labelFor="neg" inline>
 *     <p-toggleswitch inputId="neg" [(ngModel)]="allowNegative" />
 *   </ui-settings-row>
 *   <ui-settings-row title="Varsayılan ödeme" description="POS açılınca seçili gelir">
 *     <p-select ... />
 *   </ui-settings-row>
 * </ui-glass-card>
 * ```
 */
@Component({
  selector: 'ui-settings-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block border-b border-line last:border-b-0' },
  template: `
    <div class="grid min-h-[66px] items-center gap-x-4 gap-y-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-4"
         [class]="inline() ? 'grid-cols-[minmax(0,1fr)_auto]' : 'grid-cols-1'">
      <div class="min-w-0">
        @if (labelFor()) {
          <label [for]="labelFor()" class="block cursor-pointer text-14.5 font-semibold text-fg">{{ title() }}</label>
        } @else {
          <p class="m-0 text-14.5 font-semibold text-fg">{{ title() }}</p>
        }
        @if (description()) {
          <p class="m-0 mt-0.5 text-13 text-fg-muted">{{ description() }}</p>
        }
      </div>
      <div class="flex flex-wrap items-center gap-2 sm:justify-end" [class.justify-end]="inline()">
        <ng-content />
      </div>
    </div>
  `,
})
export class SettingsRowComponent {
  readonly title = input.required<string>();
  readonly description = input<string>('');
  /** Kontrolün id'si (`inputId`) — başlık `<label for>` olur. */
  readonly labelFor = input<string>('');
  /** Mobilde de kontrol sağda kalsın (switch, kısa kontrol). */
  readonly inline = input(false, { transform: booleanAttribute });
}
