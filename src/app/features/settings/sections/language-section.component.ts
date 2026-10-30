import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LangService } from '../../../core/i18n/lang.service';
import type { Lang } from '../../../core/i18n/translations';
import { GlassCardComponent, SettingsRowComponent } from '../../../shared/ui';
import { injectSettingsTexts } from '../settings.i18n';

/** Dil & bölge: uygulama dili (LangService, cihazda saklanır) + seçilen dile göre biçim örnekleri (salt okunur). */
@Component({
  selector: 'app-language-section',
  standalone: true,
  imports: [GlassCardComponent, SettingsRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ui-glass-card [title]="s().sections.language.title" [subtitle]="s().sections.language.desc" icon="pi-globe" padding="none">
      <div class="border-b border-line px-3 py-3 sm:px-4">
        <p class="m-0 text-14.5 font-semibold text-fg" id="lang-label">{{ s().language }}</p>
        <p class="m-0 mt-0.5 text-13 text-fg-muted">{{ s().languageDesc }}</p>
        <div role="radiogroup" aria-labelledby="lang-label" class="mt-2 grid grid-cols-2 gap-2 sm:max-w-[420px]">
          @for (l of langs; track l.value) {
            @let on = lang.lang() === l.value;
            <button type="button" role="radio" [attr.aria-checked]="on" (click)="lang.setLang(l.value)" [attr.lang]="l.value"
              class="flex min-h-[56px] cursor-pointer items-center gap-3 rounded-token-lg border bg-surface px-3 text-left transition-colors hover:bg-surface-hover"
              [class]="on ? 'border-brand shadow-[inset_0_0_0_1px_var(--brand)]' : 'border-line'">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-token-md bg-surface-muted font-display text-sm font-extrabold text-fg">{{ l.code }}</span>
              <span class="flex-1 text-14.5 font-semibold text-fg">{{ l.label }}</span>
              @if (on) { <i class="pi pi-check-circle text-brand-text" aria-hidden="true"></i> }
            </button>
          }
        </div>
      </div>
      <ui-settings-row [title]="s().currency" inline><span class="text-sm font-semibold text-fg">{{ s().currencyValue }}</span></ui-settings-row>
      <ui-settings-row [title]="s().dateFormat" inline><span class="num text-sm font-semibold text-fg">{{ formats().date }}</span></ui-settings-row>
      <ui-settings-row [title]="s().numberFormat" inline><span class="num text-sm font-semibold text-fg">{{ formats().number }}</span></ui-settings-row>
      <ui-settings-row [title]="s().timeZone" inline><span class="text-sm font-semibold text-fg">{{ formats().zone }}</span></ui-settings-row>
      <p class="m-0 px-3 py-3 text-13 text-fg-muted sm:px-4">{{ s().regionNote }}</p>
    </ui-glass-card>
  `,
})
export class LanguageSectionComponent {
  readonly lang = inject(LangService);
  readonly s = injectSettingsTexts();

  readonly langs: { value: Lang; label: string; code: string }[] = [
    { value: 'tr', label: 'Türkçe', code: 'TR' },
    { value: 'en', label: 'English', code: 'EN' },
  ];

  /** Uygulamanın kullandığı yerel ayarla örnek (bugün, 1234,56). */
  readonly formats = computed(() => {
    const loc = this.lang.t().reports.dateLocale;
    const now = new Date();
    return {
      date: now.toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' }),
      number: (1234.56).toLocaleString(loc, { minimumFractionDigits: 2 }),
      zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  });
}
