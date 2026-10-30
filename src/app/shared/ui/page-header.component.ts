import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TONE_SOFT, UiTone } from './tone';
import { PageTitleService } from './page-title.service';

/**
 * Sayfa başlığı.
 *
 * v2 "Saha / Komuta": ana kabuk içinde başlık, alt başlık ve geri oku **topbar'a** (mobilde koyu üst
 * çubuğa) taşınır; bu bileşen yalnız sağa yaslı **aksiyon satırını** çizer (aksiyon yoksa hiç yer
 * kaplamaz). Kabuksuz yerlerde (superadmin paneli) başlığı kendisi çizer.
 *
 * ```html
 * <ui-page-header [title]="t().products.title" [subtitle]="count() + ' ürün'" backLink="/products">
 *   <p-button icon="pi pi-plus" [label]="t().common.new" routerLink="/products/new" />
 * </ui-page-header>
 * <div class="page-body"> ... </div>
 * ```
 */
@Component({
  selector: 'ui-page-header',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <!-- Tek ng-content: dal değişince (kabuk/kabuksuz) aksiyonlar kaybolmasın -->
    <ng-template #actions><ng-content /></ng-template>
    @if (hoisted()) {
      <div class="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-end gap-2 px-3 pt-3 empty:hidden lg:px-6 lg:pt-5">
        <ng-container [ngTemplateOutlet]="actions" />
      </div>
    } @else {
      <header [class]="wrapperClass()">
        <div class="mx-auto flex min-h-[60px] w-full max-w-[1600px] items-center gap-3 px-3 py-2.5 lg:px-6 lg:pb-1 lg:pt-5">
          @if (backLink()) {
            <a [routerLink]="backLink()"
               class="tap -ml-1 flex shrink-0 items-center justify-center rounded-token-md text-fg-secondary no-underline transition-colors hover:bg-surface-hover hover:text-fg"
               [attr.aria-label]="backLabel()">
              <i class="pi pi-arrow-left text-base" aria-hidden="true"></i>
            </a>
          }
          @if (icon()) {
            <span class="hidden h-10 w-10 shrink-0 items-center justify-center rounded-token-md sm:flex" [class]="iconClass()">
              <i class="pi text-base" [class]="icon()" aria-hidden="true"></i>
            </span>
          }
          <div class="min-w-0 flex-1">
            <h1 class="m-0 truncate font-display text-lg font-extrabold leading-tight text-fg lg:text-22">{{ title() }}</h1>
            @if (subtitle()) {
              <p class="m-0 mt-0.5 truncate text-13 text-fg-muted">{{ subtitle() }}</p>
            }
          </div>
          <div class="flex shrink-0 flex-wrap items-center gap-2">
            <ng-container [ngTemplateOutlet]="actions" />
          </div>
        </div>
      </header>
    }
  `,
})
export class PageHeaderComponent {
  private readonly pageTitle = inject(PageTitleService);

  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  /** PrimeIcons sınıfı (yalnız kabuksuz görünümde, sm ve üstü). */
  readonly icon = input<string>('');
  readonly iconTone = input<UiTone>('brand');
  /** Verilirse geri oku çıkar (kabukta topbar'da). */
  readonly backLink = input<string | unknown[] | null>(null);
  readonly backLabel = input('Geri');
  /** Kabuksuz görünümde mobilde yapışkan üst bar (varsayılan açık). */
  readonly sticky = input(true);
  /** false: kabuk içinde de başlığı yerinde çiz (topbar'a taşıma). */
  readonly hoist = input(true);

  readonly hoisted = computed(() => this.hoist() && this.pageTitle.hosted());
  readonly iconClass = computed(() => TONE_SOFT[this.iconTone()]);

  readonly wrapperClass = computed(() =>
    this.sticky()
      ? 'sticky top-0 z-sticky border-b border-line bg-surface lg:static lg:border-0 lg:bg-transparent'
      : '',
  );

  constructor() {
    effect(() => {
      if (!this.hoisted()) { this.pageTitle.clear(this); return; }
      this.pageTitle.set(this, {
        title: this.title(), subtitle: this.subtitle(), backLink: this.backLink(), backLabel: this.backLabel(),
      });
    });
    inject(DestroyRef).onDestroy(() => this.pageTitle.clear(this));
  }
}
