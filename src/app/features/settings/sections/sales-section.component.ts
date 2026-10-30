import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { ConfirmationService, MessageService } from 'primeng/api';
import { LangService } from '../../../core/i18n/lang.service';
import { PrescriptionMode, SETTINGS_LIMITS, TenantSettingsService } from '../../../core/settings/tenant-settings.service';
import { GlassCardComponent, SettingsRowComponent, StatusBadgeComponent, TONE_SOFT, UiTone } from '../../../shared/ui';
import { injectSettingsTexts } from '../settings.i18n';

interface ModeOption { value: PrescriptionMode; title: string; desc: string; icon: string; tone: UiTone }

/**
 * Satış ayarları: e-reçete modu (`settings.prescriptionMode` — POS okur) ve SKT uyarı eşikleri
 * (`settings.expiryWarnDays` / `expiryCriticalDays` — TenantSettingsService sinyalleri).
 */
@Component({
  selector: 'app-sales-section',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputNumberModule, GlassCardComponent, SettingsRowComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3 lg:gap-4' },
  template: `
    @if (!loaded()) {
      <div class="ui-card flex flex-col gap-3 p-4" aria-hidden="true">
        @for (i of [1, 2, 3, 4]; track i) { <div class="h-11 animate-pulse rounded-token-md bg-surface-muted"></div> }
      </div>
    } @else {
    <ui-glass-card [title]="t().compliance.prescriptionModeTitle" [subtitle]="t().compliance.prescriptionModeDesc"
      icon="pi-file-check" tone="accent">
      <div role="radiogroup" [attr.aria-label]="t().compliance.prescriptionModeTitle" class="grid grid-cols-1 gap-2 md:grid-cols-3">
        @for (o of modes(); track o.value) {
          @let on = mode() === o.value;
          <button type="button" role="radio" [attr.aria-checked]="on" [disabled]="savingMode()"
            (click)="chooseMode(o.value)"
            class="flex min-h-[88px] cursor-pointer items-start gap-3 rounded-token-lg border bg-surface p-3 text-left transition-colors hover:bg-surface-hover disabled:cursor-wait"
            [class]="on ? 'border-brand shadow-[inset_0_0_0_1px_var(--brand)]' : 'border-line'">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-token-md" [class]="soft[o.tone]" aria-hidden="true">
              <i class="pi" [class]="o.icon"></i>
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2 text-14.5 font-semibold text-fg">
                {{ o.title }}
                @if (on) { <i class="pi pi-check-circle text-brand-text" aria-hidden="true"></i> }
              </span>
              <span class="mt-0.5 block text-13 text-fg-muted">{{ o.desc }}</span>
            </span>
          </button>
        }
      </div>
      @if (mode() !== 'required') {
        <p class="m-0 mt-3 flex items-start gap-2 rounded-token-md border border-warning-line bg-warning-soft px-3 py-2.5 text-13 text-warning-text" role="note">
          <i class="pi pi-exclamation-triangle mt-0.5 shrink-0" aria-hidden="true"></i>{{ s().rxNote }} {{ s().rxRisk }}
        </p>
      }
    </ui-glass-card>

    <ui-glass-card [title]="s().expiryTitle" [subtitle]="s().expiryDesc" icon="pi-calendar-times" tone="warning" padding="none">
      <p-button card-actions [label]="t().common.save" icon="pi pi-check" size="small"
        [severity]="expiryDirty() && expiryValid() ? 'success' : 'secondary'" [disabled]="!expiryDirty() || !expiryValid()" [loading]="savingExpiry()" (onClick)="saveExpiry()" />
      <ui-settings-row [title]="s().expiryWarn" [description]="s().expiryWarnDesc" labelFor="exp-warn">
        <ui-status-badge tone="warning" size="sm">{{ s().expiryWarn }}</ui-status-badge>
        <p-inputNumber inputId="exp-warn" [ngModel]="warn()" (ngModelChange)="setDays('warn', $event)" [min]="lim.min" [max]="lim.max"
          [showButtons]="false" inputStyleClass="num w-[84px] text-center" [useGrouping]="false" />
        <span class="text-sm text-fg-muted">{{ s().days }}</span>
      </ui-settings-row>
      <ui-settings-row [title]="s().expiryCritical" [description]="expiryValid() ? s().expiryCriticalDesc : s().expiryInvalid" labelFor="exp-crit">
        <ui-status-badge tone="danger" size="sm">{{ s().expiryCritical }}</ui-status-badge>
        <p-inputNumber inputId="exp-crit" [ngModel]="critical()" (ngModelChange)="setDays('critical', $event)" [min]="lim.min" [max]="lim.max"
          [showButtons]="false" inputStyleClass="num w-[84px] text-center" [useGrouping]="false"
          [invalid]="!expiryValid()" />
        <span class="text-sm text-fg-muted">{{ s().days }}</span>
      </ui-settings-row>
    </ui-glass-card>
    }
  `,
})
export class SalesSectionComponent implements OnInit {
  private readonly settings = inject(TenantSettingsService);
  private readonly confirm = inject(ConfirmationService);
  private readonly toast = inject(MessageService);
  readonly t = inject(LangService).t;
  readonly s = injectSettingsTexts();
  readonly soft = TONE_SOFT;
  readonly lim = SETTINGS_LIMITS.expiryDays;

  readonly mode = this.settings.prescriptionMode;
  readonly savingMode = signal(false);
  readonly loaded = this.settings.loaded;
  readonly savingExpiry = signal(false);
  readonly warn = signal(30);
  readonly critical = signal(7);
  private expiryTouched = false;

  readonly modes = computed<ModeOption[]>(() => {
    const c = this.t().compliance;
    return [
      { value: 'required', title: c.modeRequired, desc: c.modeRequiredDesc, icon: 'pi-shield', tone: 'brand' },
      { value: 'warn', title: c.modeWarn, desc: c.modeWarnDesc, icon: 'pi-exclamation-triangle', tone: 'warning' },
      { value: 'off', title: c.modeOff, desc: c.modeOffDesc, icon: 'pi-ban', tone: 'danger' },
    ];
  });

  readonly expiryValid = computed(() =>
    this.warn() >= this.lim.min && this.critical() >= this.lim.min && this.critical() <= this.warn());
  readonly expiryDirty = computed(() =>
    this.warn() !== this.settings.expiryWarnDays() || this.critical() !== this.settings.expiryCriticalDays());

  constructor() {
    effect(() => {
      const w = this.settings.expiryWarnDays(), c = this.settings.expiryCriticalDays();
      if (!untracked(() => this.expiryTouched)) { this.warn.set(w); this.critical.set(c); }
    });
  }

  ngOnInit(): void {
    this.settings.ensureLoaded();
  }

  setDays(which: 'warn' | 'critical', v: number | null): void {
    this.expiryTouched = true;
    (which === 'warn' ? this.warn : this.critical).set(v ?? 0);
  }

  chooseMode(value: PrescriptionMode): void {
    if (value === this.mode() || this.savingMode()) return;
    if (value === 'required') { void this.saveMode(value); return; }
    this.confirm.confirm({
      header: this.s().rxWarnConfirmTitle,
      message: this.s().rxWarnConfirm,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.t().common.yes,
      rejectLabel: this.t().common.cancel,
      acceptButtonProps: { severity: 'warn' },
      rejectButtonProps: { severity: 'secondary' },
      accept: () => void this.saveMode(value),
    });
  }

  private async saveMode(value: PrescriptionMode): Promise<void> {
    this.savingMode.set(true);
    try {
      await this.settings.update({ prescriptionMode: value });
      this.toast.add({ severity: 'success', summary: '', detail: this.s().saved, life: 2500 });
    } catch (err) {
      console.error('[Settings] prescription mode save error:', err);
      this.toast.add({ severity: 'error', summary: '', detail: this.s().saveFailed, life: 4000 });
    } finally {
      this.savingMode.set(false);
    }
  }

  async saveExpiry(): Promise<void> {
    if (!this.expiryValid() || this.savingExpiry()) return;
    this.savingExpiry.set(true);
    try {
      await this.settings.update({ expiryWarnDays: Math.round(this.warn()), expiryCriticalDays: Math.round(this.critical()) });
      this.expiryTouched = false;
      this.toast.add({ severity: 'success', summary: '', detail: this.s().saved, life: 2500 });
    } catch (err) {
      console.error('[Settings] expiry save error:', err);
      this.toast.add({ severity: 'error', summary: '', detail: this.s().saveFailed, life: 4000 });
    } finally {
      this.savingExpiry.set(false);
    }
  }
}
