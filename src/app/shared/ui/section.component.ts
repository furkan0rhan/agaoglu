import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Başlıklı bölüm (kart değil; kartları gruplar). Başlık C menü grubu gibi küçük büyük harf etiket.
 * Sağ aksiyonlar `[section-actions]` ile.
 *
 * ```html
 * <ui-section title="Hızlı İşlemler">
 *   <a section-actions routerLink="/reports">Tümü</a>
 *   <div class="grid grid-cols-3 gap-3">...</div>
 * </ui-section>
 * ```
 */
@Component({
  selector: 'ui-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section class="flex flex-col gap-3" [attr.aria-label]="title() || null">
      @if (title()) {
        <div class="flex items-end justify-between gap-3 px-0.5">
          <div class="min-w-0">
            <h2 class="eyebrow m-0 truncate text-fg-muted">{{ title() }}</h2>
            @if (subtitle()) {
              <p class="m-0 mt-0.5 truncate text-xs text-fg-muted">{{ subtitle() }}</p>
            }
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <ng-content select="[section-actions]" />
          </div>
        </div>
      }
      <ng-content />
    </section>
  `,
})
export class SectionComponent {
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
}
