import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ThemeService } from '../../core/theme/theme.service';
import { LangService } from '../../core/i18n/lang.service';
import { IconButtonComponent } from './icon-button.component';
import { LogoMarkComponent } from './logo-mark.component';

/**
 * Giriş / kayıt / şifre / doğrulama sayfalarının ortak kabuğu (C "Saha / Komuta"):
 * solda açık adaçayı, tarla çizgili tanıtım paneli; sağda kâğıt zeminli form. Mobilde tanıtım paneli
 * kısa bir başlık bandına iner. Sağ üstte tema + dil.
 *
 * ```html
 * <ui-auth-shell [title]="t().auth.forgotTitle" [subtitle]="t().auth.forgotSubtitle" icon="pi-lock">
 *   ...form...
 *   <div auth-footer>...formun altındaki bağlantılar...</div>
 * </ui-auth-shell>
 * ```
 */
@Component({
  selector: 'ui-auth-shell',
  standalone: true,
  imports: [IconButtonComponent, LogoMarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  styles: [`
    .hero-rows::after {
      content: '';
      position: absolute;
      inset: auto -10% -30% -10%;
      height: 60%;
      background: repeating-linear-gradient(90deg, transparent 0 22px, color-mix(in srgb, var(--side-hi) 14%, transparent) 22px 24px);
      transform: perspective(400px) rotateX(55deg);
      transform-origin: bottom;
      pointer-events: none;
    }
  `],
  template: `
    <div class="grid min-h-[100dvh] grid-rows-[auto_1fr] bg-page lg:grid-cols-2 lg:grid-rows-1">
      <!-- Tanıtım paneli -->
      <aside class="hero-rows field-dark relative flex flex-col gap-3.5 overflow-hidden px-5 pb-6 pt-[calc(20px+var(--safe-top))] lg:gap-7 lg:px-12 lg:py-10">
        <div class="relative z-[1] flex items-center gap-3">
          <ui-logo-mark [size]="44" />
          <div class="leading-tight">
            <p class="m-0 font-display text-19 font-extrabold tracking-tight">Tarım Market Pro</p>
            <p class="m-0 text-12.5 text-side-muted">{{ t().shell.heroTagline }}</p>
          </div>
        </div>
        <p class="relative z-[1] m-0 max-w-[460px] font-display text-22 font-extrabold leading-[1.15] tracking-tight lg:text-[2.125rem]">
          {{ t().shell.heroTitleA }} <span class="text-side-em">{{ t().shell.heroTitleEm }}</span> {{ t().shell.heroTitleB }}
        </p>
        <ul class="relative z-[1] m-0 hidden max-w-[440px] list-none flex-col gap-3.5 p-0 lg:flex">
          @for (f of t().shell.features; track f.title) {
            <li class="flex items-start gap-3.5">
              <span class="grid h-10 w-10 shrink-0 place-items-center rounded-[9px] bg-side-active text-side-em">
                <i class="pi text-base" [class]="f.icon" aria-hidden="true"></i>
              </span>
              <span>
                <span class="block font-semibold">{{ f.title }}</span>
                <span class="block text-13.5 text-side-soft">{{ f.desc }}</span>
              </span>
            </li>
          }
        </ul>
        <p class="relative z-[1] m-0 mt-auto hidden text-13 text-side-muted lg:block">{{ t().shell.heroFoot }}</p>
      </aside>

      <!-- Form -->
      <div class="relative flex justify-center overflow-y-auto px-[18px] pb-10 pt-6 lg:items-center lg:p-8">
        <div class="absolute right-3 top-3 flex items-center gap-2 lg:right-5 lg:top-5">
          <ui-icon-button variant="outline" [icon]="theme.isDark() ? 'pi-sun' : 'pi-moon'" [pressed]="theme.isDark()"
            [ariaLabel]="theme.isDark() ? t().nav.lightMode : t().nav.darkMode" (click)="theme.toggle()" />
          <button type="button" (click)="lang.toggle()"
            class="tap flex cursor-pointer items-center gap-1.5 rounded-token-md border border-line bg-surface px-3 text-xs font-bold text-fg-secondary transition-colors hover:bg-surface-muted hover:text-fg"
            [attr.aria-label]="t().nav.language + ': ' + (lang.lang() === 'tr' ? t().nav.switchToEn : t().nav.switchToTr)">
            <i class="pi pi-globe text-sm" aria-hidden="true"></i>{{ lang.lang() === 'tr' ? 'EN' : 'TR' }}
          </button>
        </div>

        <main class="flex w-full max-w-[400px] flex-col gap-4 pt-12 lg:pt-0">
          <div>
            @if (icon()) {
              <span class="mb-4 grid h-12 w-12 place-items-center rounded-token-md bg-brand-soft text-brand-text">
                <i class="pi text-xl" [class]="icon()" aria-hidden="true"></i>
              </span>
            }
            @if (eyebrow()) {
              <p class="eyebrow m-0 mb-1.5 text-brand-text">{{ eyebrow() }}</p>
            }
            <h1 class="m-0 font-display text-2xl font-extrabold text-fg lg:text-28">{{ title() }}</h1>
            @if (subtitle()) {
              <p class="m-0 mt-1 text-15 text-fg-secondary">{{ subtitle() }}</p>
            }
          </div>
          <ng-content />
          <div class="text-center text-sm text-fg-secondary">
            <ng-content select="[auth-footer]" />
          </div>
        </main>
      </div>
    </div>
  `,
})
export class AuthShellComponent {
  readonly theme = inject(ThemeService);
  readonly lang = inject(LangService);
  readonly t = this.lang.t;

  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  /** Küçük üst etiket (ör. "Tarım Market Pro"). */
  readonly eyebrow = input<string>('');
  /** Verilirse başlığın üstünde yumuşak ikon karesi (PrimeIcons sınıfı). */
  readonly icon = input<string>('');
}
