import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { FarmerConsent } from '../../../shared/models/farmer.model';
import { LangService } from '../../../core/i18n/lang.service';

type Toggle = 'fields' | 'logs' | 'notifications';

/** KVKK izinleri: ayrı ayrı işaretlenir; "alışveriş/borç" zorunlu ve kilitli. */
@Component({
  selector: 'app-farmer-consent-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
      <legend class="sr-only">{{ t().farmer.consent.title }}</legend>
      <label class="flex min-h-[56px] items-center gap-3 rounded-token-lg border border-line bg-surface-muted p-3 text-fg">
        <input type="checkbox" class="h-7 w-7 shrink-0 accent-[var(--brand)]" checked disabled />
        <span class="min-w-0 flex-1"><b class="flex items-center gap-1.5">{{ t().farmer.consent.purchases }}<i class="pi pi-lock text-12 text-fg-muted" aria-hidden="true"></i></b>
          <small class="block text-14 text-fg-muted">{{ t().farmer.consent.purchasesNote }}</small></span>
      </label>
      @for (k of keys; track k) {
        <label class="flex min-h-[56px] cursor-pointer items-center gap-3 rounded-token-lg border border-line-strong bg-surface p-3 text-fg has-[:checked]:border-brand-line has-[:checked]:bg-brand-soft" [attr.for]="idPrefix() + k">
          <input type="checkbox" class="h-7 w-7 shrink-0 accent-[var(--brand)]" [id]="idPrefix() + k"
                 [checked]="consent()[k]" [disabled]="disabled()" (change)="toggle(k, $event)" />
          <span class="min-w-0 flex-1">{{ t().farmer.consent[k] }}</span>
          <span class="text-22" aria-hidden="true">{{ icons[k] }}</span>
        </label>
      }
    </fieldset>
  `,
})
export class FarmerConsentFormComponent {
  readonly t = inject(LangService).t;
  readonly consent = model.required<FarmerConsent>();
  readonly disabled = input(false);
  readonly idPrefix = input('fc-');
  readonly keys: readonly Toggle[] = ['fields', 'logs', 'notifications'];
  readonly icons: Record<Toggle, string> = { fields: '🌾', logs: '📒', notifications: '🔔' };

  toggle(k: Toggle, ev: Event): void {
    const checked = (ev.target as HTMLInputElement).checked;
    this.consent.update(c => ({ ...c, [k]: checked, updatedAt: new Date() }));
  }
}
