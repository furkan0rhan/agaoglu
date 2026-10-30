import {
  ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, OnInit, signal, untracked, viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import { LangService } from '../../../core/i18n/lang.service';
import {
  CreditSettings, DEFAULT_CREDIT_SETTINGS, SETTINGS_LIMITS, TenantSettingsService,
} from '../../../core/settings/tenant-settings.service';
import {
  DEFAULT_REMINDER_TEMPLATE, REMINDER_VARIABLES, ReminderVariable, renderReminderTemplate,
} from '../../../core/settings/reminder-template';
import { GlassCardComponent, SegmentedComponent, SettingsRowComponent, StatusBadgeComponent, UiSegmentOption } from '../../../shared/ui';
import { TenantInfoService } from '../business/tenant-info.service';
import { injectSettingsTexts } from '../settings.i18n';

const DUE_PRESETS = [15, 30, 60, 90] as const;

/**
 * Veresiye kuralları: varsayılan vade (`settings.credit.defaultDueDays`), yeni müşteri limiti
 * (`settings.credit.defaultCreditLimit`), hatırlatma şablonu (`settings.credit.reminderTemplate`).
 */
@Component({
  selector: 'app-credit-section',
  standalone: true,
  imports: [
    FormsModule, ButtonModule, InputNumberModule, TextareaModule,
    GlassCardComponent, SettingsRowComponent, SegmentedComponent, StatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (!loaded()) {
      <div class="ui-card flex flex-col gap-3 p-4" aria-hidden="true">
        @for (i of [1, 2, 3, 4]; track i) { <div class="h-11 animate-pulse rounded-token-md bg-surface-muted"></div> }
      </div>
    } @else {
    <ui-glass-card [title]="s().sections.credit.title" [subtitle]="s().sections.credit.desc" icon="pi-book" tone="accent" padding="none">
      <div card-actions class="flex items-center gap-2">
        @if (dirty()) {
          <ui-status-badge tone="warning" size="sm" dot class="hidden sm:inline-flex">{{ s().unsaved }}</ui-status-badge>
        }
        <p-button [label]="t().common.save" icon="pi pi-check" size="small" [severity]="dirty() ? 'success' : 'secondary'"
          [loading]="saving()" [disabled]="!dirty()" (onClick)="save()" />
      </div>

      <ui-settings-row [title]="s().defaultDueDays" [description]="s().defaultDueDaysDesc">
        <ui-segmented [options]="dueOptions()" [value]="duePreset()" (valueChange)="pickDue($event)" [ariaLabel]="s().defaultDueDays" />
        <span class="inline-flex items-center gap-2">
          <p-inputNumber inputId="cr-due" [ngModel]="draft().defaultDueDays" (ngModelChange)="patch({ defaultDueDays: $event ?? 0 })"
            [min]="lim.dueDays.min" [max]="lim.dueDays.max" [useGrouping]="false" inputStyleClass="num w-[76px] text-center"
            [ariaLabel]="s().dueDaysAria" />
          <span class="text-sm text-fg-muted">{{ s().days }}</span>
        </span>
      </ui-settings-row>

      <ui-settings-row [title]="s().defaultLimit" [description]="s().defaultLimitDesc" labelFor="cr-limit">
        <p-inputNumber inputId="cr-limit" [ngModel]="draft().defaultCreditLimit" (ngModelChange)="patch({ defaultCreditLimit: $event || null })"
          mode="currency" currency="TRY" locale="tr-TR" [min]="0" [max]="lim.creditLimit.max" [placeholder]="s().noLimit"
          inputStyleClass="num w-[170px] text-right" />
      </ui-settings-row>

      <div class="border-b border-line px-3 py-3 last:border-b-0 sm:px-4">
        <label for="cr-tpl" class="block text-14.5 font-semibold text-fg">{{ s().reminder }}</label>
        <p class="m-0 mt-0.5 text-13 text-fg-muted">{{ s().reminderDesc }}</p>
        <textarea #tpl pTextarea id="cr-tpl" rows="3" class="mt-2 w-full" [maxlength]="lim.reminderTemplate"
          [placeholder]="sample" [ngModel]="draft().reminderTemplate" (ngModelChange)="patch({ reminderTemplate: $event })"></textarea>
        <div class="mt-2 flex flex-wrap items-center gap-1.5">
          <span class="text-13 text-fg-muted">{{ s().reminderVars }}</span>
          @for (v of vars; track v) {
            <button type="button" (click)="insertVar(v)" [attr.aria-label]="s().reminderVarLabels[v]"
              class="inline-flex min-h-[32px] cursor-pointer items-center rounded-token-sm border border-line-strong bg-surface-muted px-2 font-mono text-12.5 text-fg hover:bg-surface-hover"
              [title]="s().reminderVarLabels[v]">{{ '{' + v + '}' }}</button>
          }
          @if (!draft().reminderTemplate) {
            <p-button [label]="s().reminderUseSample" icon="pi pi-pencil" [text]="true" size="small" (onClick)="patch({ reminderTemplate: sample })" />
          }
        </div>
        <div class="mt-3 rounded-token-md border border-line bg-surface-muted p-3">
          <p class="eyebrow m-0 text-fg-muted">{{ s().reminderPreview }}</p>
          <p class="m-0 mt-1 whitespace-pre-wrap text-13.5 text-fg">{{ preview() }}</p>
        </div>
      </div>
    </ui-glass-card>
    }
  `,
})
export class CreditSectionComponent implements OnInit {
  private readonly settings = inject(TenantSettingsService);
  private readonly tenantInfo = inject(TenantInfoService);
  private readonly toast = inject(MessageService);
  readonly t = inject(LangService).t;
  readonly s = injectSettingsTexts();
  readonly lim = SETTINGS_LIMITS;
  readonly vars = REMINDER_VARIABLES;
  readonly sample = DEFAULT_REMINDER_TEMPLATE;
  private readonly tplRef = viewChild<ElementRef<HTMLTextAreaElement>>('tpl');

  readonly draft = signal<CreditSettings>(DEFAULT_CREDIT_SETTINGS);
  readonly saving = signal(false);
  readonly loaded = this.settings.loaded;
  private readonly business = signal({ name: '', phone: '' });
  private touched = false;

  readonly dueOptions = computed<UiSegmentOption<number>[]>(() => [
    ...DUE_PRESETS.map(d => ({ value: d as number, label: `${d}` })),
  ]);
  readonly duePreset = computed(() => (DUE_PRESETS as readonly number[]).includes(this.draft().defaultDueDays) ? this.draft().defaultDueDays : null);

  readonly dirty = computed(() => JSON.stringify(this.draft()) !== JSON.stringify(this.settings.credit()));

  readonly preview = computed(() => {
    const tpl = this.draft().reminderTemplate.trim() || this.sample;
    const due = new Date();
    due.setDate(due.getDate() + this.draft().defaultDueDays);
    const money = (n: number) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' TL';
    return renderReminderTemplate(tpl, {
      ad: this.s().sampleCustomer, borc: money(12450), gecikmis: money(3200),
      vade: due.toLocaleDateString('tr-TR'), isletme: this.business().name || 'Tarım Market Pro', telefon: this.business().phone,
    });
  });

  constructor() {
    effect(() => {
      const saved = this.settings.credit();
      if (!untracked(() => this.touched)) this.draft.set(saved);
    });
  }

  async ngOnInit(): Promise<void> {
    this.settings.ensureLoaded();
    try {
      const i = await this.tenantInfo.get();
      this.business.set({ name: i.name, phone: i.phone });
    } catch { /* önizleme işletme adı olmadan */ }
  }

  patch(p: Partial<CreditSettings>): void {
    this.touched = true;
    this.draft.update(d => ({ ...d, ...p }));
  }

  pickDue(v: number | null): void {
    if (v) this.patch({ defaultDueDays: v });
  }

  insertVar(v: ReminderVariable): void {
    const token = `{${v}}`;
    const el = this.tplRef()?.nativeElement;
    const cur = this.draft().reminderTemplate;
    const start = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? cur.length;
    const next = (cur.slice(0, start) + token + cur.slice(end)).slice(0, SETTINGS_LIMITS.reminderTemplate);
    this.patch({ reminderTemplate: next });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async save(): Promise<void> {
    const d = this.draft();
    const due = Math.round(d.defaultDueDays);
    if (this.saving() || due < this.lim.dueDays.min || due > this.lim.dueDays.max) return;
    this.saving.set(true);
    try {
      await this.settings.update({
        credit: { defaultDueDays: due, defaultCreditLimit: d.defaultCreditLimit && d.defaultCreditLimit > 0 ? d.defaultCreditLimit : null, reminderTemplate: d.reminderTemplate.trim() },
      });
      this.touched = false;
      this.toast.add({ severity: 'success', summary: '', detail: this.s().saved, life: 2500 });
    } catch (err) {
      console.error('[Settings] credit save error:', err);
      this.toast.add({ severity: 'error', summary: '', detail: this.s().saveFailed, life: 4000 });
    } finally {
      this.saving.set(false);
    }
  }
}
