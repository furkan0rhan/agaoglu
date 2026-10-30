import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { serverTimestamp, Timestamp } from '@angular/fire/firestore';
import { map, take } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ConsentRecord, Customer, CustomerConsents } from '../../../shared/models/customer.model';
import { CustomerService } from '../services/customer.service';
import { KVKK_TEXT_VERSION, formatTrMobile, isValidTcNo, isValidTrMobile, maskTcNo } from '../services/customer.utils';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { TenantSettingsService } from '../../../core/settings/tenant-settings.service';
import { AvatarComponent, GlassCardComponent, KbdComponent, PageHeaderComponent, StatusBadgeComponent } from '../../../shared/ui';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { KvkkNoticeComponent } from '../components/kvkk-notice.component';
import { CUSTOMER_FORM_TEXTS } from './customer-form.i18n';

/** Sağ paneldeki kontrol listesinin bir bölümü. */
interface ChecklistSection { id: string; label: string; done: number; total: number; error: boolean; missingRequired: string[] }

const mobileValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  !c.value || isValidTrMobile(String(c.value)) ? null : { mobile: true };

const tcValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = String(c.value ?? '').trim();
  if (!v || v.includes('*')) return null; // boş ya da maskeli (değiştirilmedi)
  if (!/^\d{11}$/.test(v)) return { length: true };
  return isValidTcNo(v) ? null : { checksum: true };
};

/** TC no kaydedilecekse veri işleme rızası gerekir. */
const tcConsentValidator: ValidatorFn = (g: AbstractControl): ValidationErrors | null => {
  const tc = String(g.get('tcNo')?.value ?? '').trim();
  return tc && !g.get('consentProcessing')?.value ? { tcConsent: true } : null;
};

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, ButtonModule, CheckboxModule, DialogModule, InputNumberModule, InputTextModule,
    TextareaModule, ToastModule, PageHeaderComponent, GlassCardComponent, KvkkNoticeComponent,
    AvatarComponent, StatusBadgeComponent, KbdComponent, CurrencyTrPipe,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', '(window:keydown.control.s)': 'onCtrlS($event)' },
  template: `
    <p-toast position="top-right" />

    <p-dialog [header]="t().customers.kvkkTitle" [visible]="showKvkk()" (visibleChange)="showKvkk.set($event)"
      [modal]="true" [draggable]="false" appendTo="body" styleClass="w-[720px] max-w-[95vw]">
      @if (showKvkk()) { <app-kvkk-notice /> }
    </p-dialog>

    <ui-page-header
      [title]="isEdit ? t().customers.editCustomer : t().customers.addCustomer"
      [subtitle]="isEdit ? t().customers.editSubtitle : t().customers.addSubtitle"
      [backLink]="isEdit ? ['/customers', customerId] : '/customers'" [backLabel]="t().common.back" />

    <form [formGroup]="form" (ngSubmit)="save()" novalidate class="page-body">
      <div class="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">

        <!-- Sol: bölüm kartları -->
        <div class="flex min-w-0 flex-col gap-3 lg:gap-4">
          <ui-glass-card id="cf-sec-id" class="scroll-mt-4" [title]="t().acc.secIdentity" icon="pi-id-card">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">

              <div class="flex flex-col gap-1.5">
                <label for="c-first" class="text-sm font-semibold text-fg-secondary">{{ t().customers.firstName }}</label>
                <input pInputText id="c-first" formControlName="firstName" autocomplete="given-name" class="w-full"
                  [placeholder]="t().customers.firstNamePlaceholder"
                  [attr.aria-invalid]="showError('firstName')" [attr.aria-describedby]="showError('firstName') ? 'c-first-err' : null" />
                @if (showError('firstName')) {
                  <p id="c-first-err" class="m-0 text-xs font-medium text-danger-text">{{ t().customers.firstNameRequired }}</p>
                }
              </div>

              <div class="flex flex-col gap-1.5">
                <label for="c-last" class="text-sm font-semibold text-fg-secondary">{{ t().customers.lastName }}</label>
                <input pInputText id="c-last" formControlName="lastName" autocomplete="family-name" class="w-full"
                  [placeholder]="t().customers.lastNamePlaceholder"
                  [attr.aria-invalid]="showError('lastName')" [attr.aria-describedby]="showError('lastName') ? 'c-last-err' : null" />
                @if (showError('lastName')) {
                  <p id="c-last-err" class="m-0 text-xs font-medium text-danger-text">{{ t().customers.lastNameRequired }}</p>
                }
              </div>

              <div class="flex flex-col gap-1.5">
                <label for="c-phone" class="text-sm font-semibold text-fg-secondary">{{ t().customers.phone }}</label>
                <input pInputText id="c-phone" type="tel" inputmode="tel" autocomplete="tel" formControlName="phone" class="num w-full"
                  maxlength="17" [placeholder]="t().customers.phonePlaceholder" (blur)="formatPhone()"
                  [attr.aria-invalid]="showError('phone')" [attr.aria-describedby]="showError('phone') ? 'c-phone-err' : null" />
                @if (showError('phone')) {
                  <p id="c-phone-err" class="m-0 text-xs font-medium text-danger-text">
                    {{ form.controls.phone.hasError('required') ? t().customers.phoneRequired : t().customers.phoneInvalid }}
                  </p>
                }
              </div>

              <div class="flex flex-col gap-1.5">
                <label for="c-email" class="text-sm font-semibold text-fg-secondary">{{ t().customers.email }}</label>
                <input pInputText id="c-email" type="email" inputmode="email" autocomplete="email" formControlName="email" class="w-full"
                  [placeholder]="t().customers.emailPlaceholder"
                  [attr.aria-invalid]="showError('email')" [attr.aria-describedby]="showError('email') ? 'c-email-err' : null" />
                @if (showError('email')) {
                  <p id="c-email-err" class="m-0 text-xs font-medium text-danger-text">{{ t().customers.emailInvalid }}</p>
                }
              </div>

              <div class="flex flex-col gap-1.5">
                <label for="c-tc" class="text-sm font-semibold text-fg-secondary">{{ t().customers.tcNo }}</label>
                <input pInputText id="c-tc" inputmode="numeric" autocomplete="off" maxlength="11" formControlName="tcNo" class="num w-full"
                  [placeholder]="t().customers.tcNoPlaceholder"
                  [attr.aria-invalid]="showError('tcNo') || tcConsentError()"
                  [attr.aria-describedby]="showError('tcNo') || tcConsentError() ? 'c-tc-err' : null" />
                @if (showError('tcNo')) {
                  <p id="c-tc-err" class="m-0 text-xs font-medium text-danger-text">
                    {{ form.controls.tcNo.hasError('checksum') ? t().customers.tcNoChecksum : t().customers.tcNoInvalid }}
                  </p>
                } @else if (tcConsentError()) {
                  <p id="c-tc-err" class="m-0 text-xs font-medium text-danger-text">{{ t().customers.tcNeedsConsent }}</p>
                }
              </div>

            </div>
          </ui-glass-card>

          <div class="grid grid-cols-1 items-stretch gap-3 lg:gap-4 xl:grid-cols-2">
            <ui-glass-card id="cf-sec-farm" class="scroll-mt-4" [title]="t().acc.secFarm" icon="pi-map-marker" tone="success">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <div class="flex flex-col gap-1.5">
                  <label for="c-ck" class="text-sm font-semibold text-fg-secondary">{{ t().customers.cksNo }}</label>
                  <input pInputText id="c-ck" inputmode="numeric" autocomplete="off" maxlength="20" formControlName="cksNo" class="num w-full"
                    [placeholder]="t().customers.cksNoPlaceholder" />
                </div>

                <div class="flex flex-col gap-1.5">
                  <label for="c-village" class="text-sm font-semibold text-fg-secondary">{{ t().customers.village }}</label>
                  <input pInputText id="c-village" formControlName="village" autocomplete="address-level3" class="w-full"
                    [placeholder]="t().customers.villagePlaceholder" />
                </div>

                <div class="flex flex-col gap-1.5 sm:col-span-2 xl:col-span-1 2xl:col-span-2">
                  <label for="c-address" class="text-sm font-semibold text-fg-secondary">{{ t().customers.address }}</label>
                  <textarea pTextarea id="c-address" formControlName="address" rows="2" autocomplete="street-address"
                    class="w-full resize-y" [placeholder]="t().customers.addressPlaceholder"></textarea>
                </div>
              </div>
            </ui-glass-card>

            <ui-glass-card id="cf-sec-credit" class="scroll-mt-4" [title]="x().secCreditNotes" icon="pi-book" tone="accent">
              <div class="grid grid-cols-1 gap-4">
                <div class="flex flex-col gap-1.5">
                  <label for="c-limit" class="text-sm font-semibold text-fg-secondary">{{ t().customers.creditLimit }}</label>
                  <p-inputNumber inputId="c-limit" formControlName="creditLimit" mode="decimal" [min]="0" [maxFractionDigits]="2"
                    locale="tr-TR" styleClass="w-full" inputStyleClass="num w-full" aria-describedby="c-limit-hint" />
                  <p id="c-limit-hint" class="m-0 text-xs text-fg-muted">{{ t().customers.creditLimitHint }}</p>
                </div>

                <div class="flex flex-col gap-1.5">
                  <label for="c-notes" class="text-sm font-semibold text-fg-secondary">{{ t().customers.notes }}</label>
                  <textarea pTextarea id="c-notes" formControlName="notes" rows="2"
                    class="w-full resize-y" [placeholder]="t().customers.notesPlaceholder"></textarea>
                </div>
              </div>
            </ui-glass-card>
          </div>

          <!-- KVKK -->
          <ui-glass-card id="cf-sec-kvkk" class="scroll-mt-4" [title]="t().customers.kvkkSection" icon="pi-shield" tone="info">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:gap-6">
              <div class="flex flex-col items-start gap-3">
                <p class="m-0 text-sm text-fg-secondary">{{ t().customers.kvkkInfo }}</p>
                <p-button [label]="t().customers.kvkkShow" icon="pi pi-file" severity="secondary" (onClick)="showKvkk.set(true)" />
              </div>
              <div class="flex flex-col gap-3">
                <div class="flex items-start gap-3 rounded-token-md border border-line p-3">
                  <p-checkbox inputId="c-consent-proc" formControlName="consentProcessing" [binary]="true" />
                  <label for="c-consent-proc" class="text-sm text-fg">
                    {{ t().customers.consentProcessing }}
                    @if (original()?.consents?.processing; as r) {
                      <span class="block text-xs text-fg-muted">{{ t().customers.consentGivenAt }}: {{ consentDate(r) | date:'dd.MM.yyyy HH:mm' }} · {{ r.version }}</span>
                    }
                  </label>
                </div>
                <div class="flex items-start gap-3 rounded-token-md border border-line p-3">
                  <p-checkbox inputId="c-consent-contact" formControlName="consentContact" [binary]="true" />
                  <label for="c-consent-contact" class="text-sm text-fg">
                    {{ t().customers.consentContact }}
                    @if (original()?.consents?.contact; as r) {
                      <span class="block text-xs text-fg-muted">{{ t().customers.consentGivenAt }}: {{ consentDate(r) | date:'dd.MM.yyyy HH:mm' }} · {{ r.version }}</span>
                    }
                  </label>
                </div>
              </div>
            </div>
          </ui-glass-card>
        </div>

        <!-- Sağ: yapışkan önizleme + kontrol listesi + kaydet (telefonda formun altına iner) -->
        <aside class="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-6rem)]">
          <div class="flex min-h-0 flex-col gap-3 lg:overflow-y-auto lg:[scrollbar-width:none]">
          <ui-glass-card [title]="x().preview" icon="pi-id-card" tone="neutral" padding="none">
            <div class="flex items-center gap-3 px-4 pb-3 pt-3.5">
              <ui-avatar [name]="fullName() || '?'" size="lg" tone="brand" />
              <div class="min-w-0">
                <p class="m-0 truncate font-display text-18 font-extrabold leading-tight text-fg">{{ fullName() || x().newCustomer }}</p>
                <p class="num m-0 mt-0.5 truncate text-14 font-semibold" [class]="vals().phone ? 'text-fg-secondary' : 'text-fg-muted'">
                  <i class="pi pi-phone mr-1 text-12 text-fg-muted" aria-hidden="true"></i>{{ vals().phone || x().noPhone }}
                </p>
              </div>
            </div>
            @if (previewRows().length) {
              <dl class="m-0 flex flex-col gap-1.5 px-4 pb-3 text-13.5">
                @for (r of previewRows(); track r.icon) {
                  <div class="flex min-w-0 items-start gap-2">
                    <dt class="shrink-0 pt-0.5"><i class="pi text-12 text-fg-muted" [class]="r.icon" aria-hidden="true"></i><span class="sr-only">{{ r.label }}</span></dt>
                    <dd class="m-0 min-w-0 break-words text-fg-secondary" [class.num]="r.num">{{ r.value }}</dd>
                  </div>
                }
              </dl>
            }
            <dl class="m-0 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-t border-line px-4 py-3 text-13">
              <dt class="text-fg-muted">{{ x().limit }}</dt>
              <dd class="m-0 min-w-0 truncate text-right">
                <span class="num font-extrabold text-fg">{{ creditLimitValue() ? (creditLimitValue() | currencyTr) : x().unlimited }}</span>
                @if (creditLimitValue()) {
                  <span class="ml-1 text-11.5 text-fg-muted">· {{ limitIsDefault() ? x().fromSettings : x().custom }}</span>
                }
              </dd>
              <dt class="text-fg-muted">{{ x().defaultDue }}</dt>
              <dd class="m-0 text-right"><span class="num font-extrabold text-fg">{{ settings.credit().defaultDueDays }} {{ x().days }}</span></dd>
              <div class="col-span-2 flex items-center justify-between gap-2">
              <dt class="text-fg-muted">{{ x().kvkk }}</dt>
              <dd class="m-0 flex flex-wrap justify-end gap-1">
                <ui-status-badge size="sm" [tone]="vals().consentProcessing ? 'success' : 'neutral'"
                  [icon]="vals().consentProcessing ? 'pi-check' : 'pi-minus'">
                  {{ x().processing }}<span class="sr-only">: {{ vals().consentProcessing ? x().given : x().notGiven }}</span>
                </ui-status-badge>
                <ui-status-badge size="sm" [tone]="vals().consentContact ? 'success' : 'neutral'"
                  [icon]="vals().consentContact ? 'pi-check' : 'pi-minus'">
                  {{ x().contact }}<span class="sr-only">: {{ vals().consentContact ? x().given : x().notGiven }}</span>
                </ui-status-badge>
              </dd>
              </div>
            </dl>
          </ui-glass-card>

          <ui-glass-card [title]="x().checklist" icon="pi-list-check" tone="neutral" padding="none">
            <ui-status-badge card-actions size="sm" [tone]="progress().requiredOk ? 'success' : 'warning'"
              [icon]="progress().requiredOk ? 'pi-check' : 'pi-exclamation-circle'">
              {{ progress().requiredOk ? x().ready : x().missing }}
            </ui-status-badge>
            <div class="flex items-center gap-3 px-4 pt-3">
              <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-strong" aria-hidden="true">
                <div class="h-full rounded-full transition-[width]" [class]="progress().requiredOk ? 'bg-brand' : 'bg-warning'"
                  [style.width.%]="progress().pct"></div>
              </div>
              <span class="num shrink-0 text-12 font-semibold text-fg-muted">{{ progress().done }}/{{ progress().total }} {{ x().filled }}</span>
            </div>
            <nav class="flex flex-col px-2 py-1.5" [attr.aria-label]="x().sections">
              @for (s of checklist(); track s.id; let i = $index) {
                <button type="button" (click)="jump(s.id)"
                  class="flex min-h-[34px] w-full cursor-pointer items-center gap-2.5 rounded-token-md border-0 bg-transparent px-2 py-1 text-left transition-colors hover:bg-surface-hover">
                  <span class="num flex h-6 w-6 shrink-0 items-center justify-center rounded-token-sm text-11 font-bold"
                    [class]="s.error ? 'bg-danger-soft text-danger-text' : s.done === s.total ? 'bg-brand-soft text-brand-text' : 'bg-surface-strong text-fg-secondary'">
                    @if (s.done === s.total && !s.error) { <i class="pi pi-check text-10" aria-hidden="true"></i> } @else { {{ i + 1 }} }
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-13.5 font-semibold text-fg">{{ s.label }}</span>
                    @if (s.missingRequired.length) {
                      <span class="block truncate text-11.5 font-medium text-danger-text">{{ s.missingRequired.join(', ') }} · {{ x().required }}</span>
                    }
                  </span>
                  <span class="num shrink-0 text-12 font-semibold text-fg-muted">{{ s.done }}/{{ s.total }}</span>
                </button>
              }
            </nav>
          </ui-glass-card>
          </div>

          <!-- Aksiyonlar: her zaman görünür (önizleme/kontrol listesi gerekirse kendi içinde kayar) -->
          <div class="ui-card hidden shrink-0 flex-col gap-2 p-3 lg:flex">
            <button type="submit" [disabled]="saving() || (isEdit && !original())" aria-keyshortcuts="Control+S"
              class="relative inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-token-md border-0 bg-brand px-4 font-display text-16 font-extrabold text-brand-contrast transition-colors hover:bg-brand-hover disabled:cursor-not-allowed ui-btn-disabled-soft">
              <i class="pi" [class]="saving() ? 'pi-spin pi-spinner' : 'pi-check'" aria-hidden="true"></i>{{ t().common.save }}
              <ui-kbd tone="inverse" class="absolute right-3">Ctrl S</ui-kbd>
            </button>
            <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <p-button type="button" [label]="x().saveAndSell" icon="pi pi-shopping-cart" severity="secondary" styleClass="w-full"
                [disabled]="saving() || (isEdit && !original())" (onClick)="save('sell')" />
              <p-button type="button" [label]="t().common.cancel" [text]="true" (onClick)="cancel()" />
            </div>
          </div>
        </aside>
      </div>

      <!-- Telefon / tablet: altta yapışkan kaydet -->
      <div class="sticky bottom-0 z-sticky -mx-3 -mb-3 flex gap-2 border-t border-line bg-page px-3 py-2.5 lg:hidden">
        <p-button type="button" icon="pi pi-shopping-cart" severity="secondary" size="large" [ariaLabel]="x().saveAndSell"
          [disabled]="saving() || (isEdit && !original())" (onClick)="save('sell')" />
        <p-button type="submit" [label]="t().common.save" icon="pi pi-check" size="large" styleClass="w-full" class="flex-1"
          [loading]="saving()" [disabled]="isEdit && !original()" />
      </div>
    </form>
  `,
})
export class CustomerFormPage implements OnInit {
  private readonly svc = inject(CustomerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly lang = inject(LangService);
  readonly t = this.lang.t;
  readonly x = computed(() => CUSTOMER_FORM_TEXTS[this.lang.lang()]);
  readonly isAdmin = inject(AuthService).hasRole('admin');

  readonly saving = signal(false);
  /** Düzenleme modunda yüklenen müşteri (yalnızca değişen alanları göndermek için). */
  readonly original = signal<Customer | null>(null);
  readonly showKvkk = signal(false);
  isEdit = false;
  customerId = '';

  readonly form = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    phone: ['', [Validators.required, mobileValidator]],
    email: ['', Validators.email],
    // Kayıtlı (değiştirilmemiş) eski TC no düzenlemeyi kilitlemesin; yalnızca yeni/değişen değer doğrulanır
    tcNo: ['', (c: AbstractControl) => c.value && c.value === this.original()?.tcNo ? null : tcValidator(c)],
    cksNo: [''],
    village: [''],
    creditLimit: [null as number | null],
    address: [''],
    notes: [''],
    consentProcessing: [false],
    consentContact: [false],
  }, { validators: tcConsentValidator });

  private readonly toast = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  readonly settings = inject(TenantSettingsService);

  /** Formun canlı (disabled dahil) değeri — önizleme ve kontrol listesi için. */
  readonly vals = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), { initialValue: this.form.getRawValue() });

  readonly fullName = computed(() => `${this.vals().firstName ?? ''} ${this.vals().lastName ?? ''}`.trim());

  /** Kartvizitte gösterilecek dolu alanlar (TC her zaman maskeli). */
  readonly previewRows = computed(() => {
    const v = this.vals();
    const c = this.t().customers;
    const place = [v.village?.trim(), v.address?.trim()].filter(Boolean).join(' · ');
    const rows: { icon: string; label: string; value: string; num?: boolean }[] = [];
    if (place) rows.push({ icon: 'pi-map-marker', label: c.village, value: place });
    if (v.email?.trim()) rows.push({ icon: 'pi-envelope', label: c.email, value: v.email.trim() });
    if (v.tcNo?.trim()) rows.push({ icon: 'pi-id-card', label: c.tcNo, value: maskTcNo(v.tcNo.trim()), num: true });
    if (v.cksNo?.trim()) rows.push({ icon: 'pi-sun', label: c.cksNo, value: 'ÇKS ' + v.cksNo.trim(), num: true });
    return rows;
  });

  readonly creditLimitValue = computed(() => {
    const l = this.vals().creditLimit;
    return l != null && l > 0 ? l : null;
  });
  readonly limitIsDefault = computed(() => this.creditLimitValue() === this.settings.credit().defaultCreditLimit);

  /** Bölüm bazında doluluk; zorunlu eksikler ve geçersiz alanlar işaretlenir. */
  readonly checklist = computed<ChecklistSection[]>(() => {
    const v = this.vals();
    const c = this.t().customers;
    const ctrls = this.form.controls;
    type Key = keyof typeof v;
    const lbl = (s: string) => s.replace(' *', '');
    const filled = (val: unknown) => typeof val === 'boolean' ? val : val != null && val !== 0 && String(val).trim() !== '';
    const sec = (id: string, label: string, keys: Key[], required: Key[] = [], labels: Partial<Record<Key, string>> = {}): ChecklistSection => ({
      id, label,
      done: keys.filter(k => filled(v[k])).length,
      total: keys.length,
      error: keys.some(k => filled(v[k]) && ctrls[k].invalid) || (id === 'cf-sec-id' && this.form.hasError('tcConsent')),
      missingRequired: required.filter(k => !filled(v[k])).map(k => labels[k] ?? k),
    });
    return [
      sec('cf-sec-id', this.t().acc.secIdentity, ['firstName', 'lastName', 'phone', 'email', 'tcNo'],
        ['firstName', 'lastName', 'phone'], { firstName: lbl(c.firstName), lastName: lbl(c.lastName), phone: lbl(c.phone) }),
      sec('cf-sec-farm', this.t().acc.secFarm, ['cksNo', 'village', 'address']),
      sec('cf-sec-credit', this.x().secCreditNotes, ['creditLimit', 'notes']),
      sec('cf-sec-kvkk', c.kvkkSection, ['consentProcessing', 'consentContact']),
    ];
  });

  readonly progress = computed(() => {
    const list = this.checklist();
    const done = list.reduce((a, s) => a + s.done, 0);
    const total = list.reduce((a, s) => a + s.total, 0);
    return {
      done, total,
      pct: total ? Math.round((done / total) * 100) : 0,
      requiredOk: list.every(s => !s.missingRequired.length && !s.error),
    };
  });

  /** Yeni müşteride kredi limiti = Ayarlar → Veresiye "yeni müşteri limiti" (kullanıcı değiştirmediyse). */
  constructor() {
    effect(() => {
      const limit = this.settings.credit().defaultCreditLimit;
      const ctrl = this.form.controls.creditLimit;
      if (!this.route.snapshot.paramMap.has('id') && this.isAdmin && ctrl.pristine) ctrl.setValue(limit);
    });
  }

  ngOnInit(): void {
    this.customerId = this.route.snapshot.paramMap.get('id') ?? '';
    this.isEdit = !!this.customerId;
    if (!this.isAdmin) this.form.controls.creditLimit.disable();
    this.settings.ensureLoaded();
    if (this.isEdit) {
      // watch$ (onSnapshot) + take(1): yerel önbellek/sunucu farketmeksizin dolu belge gelir (bulgu #2).
      this.svc.watch$(this.customerId).pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe({
        next: c => {
          if (!c) {
            this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().common.notFound });
            return;
          }
          this.original.set(c);
          this.form.patchValue({
            firstName: c.firstName ?? '',
            lastName: c.lastName ?? '',
            phone: c.phone ?? '',
            email: c.email ?? '',
            // Yönetici olmayan TC no'yu açık göremez; maskeli ve kilitli gösterilir
            tcNo: this.isAdmin ? c.tcNo ?? '' : maskTcNo(c.tcNo),
            cksNo: c.cksNo ?? '',
            village: c.village ?? '',
            creditLimit: c.creditLimit ?? null,
            address: c.address ?? '',
            notes: c.notes ?? '',
            consentProcessing: !!c.consents?.processing,
            consentContact: !!c.consents?.contact,
          });
          if (!this.isAdmin && c.tcNo) this.form.controls.tcNo.disable();
        },
        error: () => this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().customers.loadError }),
      });
    }
  }

  showError(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && c.touched;
  }

  tcConsentError(): boolean {
    return this.form.hasError('tcConsent') && !!this.form.controls.tcNo.touched;
  }

  jump(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  onCtrlS(event: Event): void {
    event.preventDefault();
    if (this.isEdit && !this.original()) return;
    void this.save();
  }

  cancel(): void {
    void this.router.navigate(this.isEdit ? ['/customers', this.customerId] : ['/customers']);
  }

  formatPhone(): void {
    const c = this.form.controls.phone;
    if (c.value && isValidTrMobile(c.value)) c.setValue(formatTrMobile(c.value));
  }

  consentDate(r: ConsentRecord): Date | null {
    const at = r.at as Timestamp | null;
    return at && typeof at.toDate === 'function' ? at.toDate() : null;
  }

  /** Rıza alanı: yeni verildiyse zaman damgası + metin sürümü, geri alındıysa null, değişmediyse eski kayıt. */
  private consentValue(prev: ConsentRecord | null | undefined, checked: boolean): ConsentRecord | null {
    if (!checked) return null;
    if (prev) return prev;
    return { at: serverTimestamp() as unknown as Timestamp, version: KVKK_TEXT_VERSION };
  }

  /** `next = 'sell'`: kaydettikten sonra müşteri seçili POS açılır (/pos?customer=<id>). */
  async save(next: 'default' | 'sell' = 'default'): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (this.saving()) return;
    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      const orig = this.original();
      const consents: CustomerConsents = {
        processing: this.consentValue(orig?.consents?.processing, !!v.consentProcessing),
        contact: this.consentValue(orig?.consents?.contact, !!v.consentContact),
      };
      const tcRaw = v.tcNo?.trim() || null;
      const data = {
        firstName: v.firstName!.trim(),
        lastName: v.lastName!.trim(),
        phone: formatTrMobile(v.phone!.trim()),
        email: v.email?.trim() || null,
        // Maskeli değer (yönetici olmayan) asla yazılmaz
        tcNo: tcRaw && tcRaw.includes('*') ? orig?.tcNo ?? null : tcRaw,
        cksNo: v.cksNo?.trim() || null,
        village: v.village?.trim() || null,
        creditLimit: v.creditLimit != null && v.creditLimit > 0 ? v.creditLimit : null,
        address: v.address?.trim() || null,
        notes: v.notes?.trim() || null,
      };
      if (this.isEdit) {
        if (!orig) return;
        // Yalnızca değişen alanları gönder; isActive/birthDate/bakiye alanlarına dokunma.
        const changes: Partial<Customer> = {};
        (Object.keys(data) as (keyof typeof data)[]).forEach(k => {
          if (k === 'creditLimit' && !this.isAdmin) return;
          if ((orig[k] ?? null) !== data[k]) (changes as Record<string, unknown>)[k] = data[k];
        });
        if (consents.processing !== (orig.consents?.processing ?? null) || consents.contact !== (orig.consents?.contact ?? null)) {
          changes.consents = consents;
        }
        if (Object.keys(changes).length > 0) await this.svc.update(this.customerId, changes);
        if (next === 'sell') await this.router.navigate(['/pos'], { queryParams: { customer: this.customerId } });
        else await this.router.navigate(['/customers', this.customerId]);
      } else {
        const id = await this.svc.create({ ...data, consents, birthDate: null, isActive: true });
        if (next === 'sell') await this.router.navigate(['/pos'], { queryParams: { customer: id } });
        else await this.router.navigate(['/customers']);
      }
    } catch (err) {
      console.error(err);
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().customers.saveFailed });
    } finally {
      this.saving.set(false);
    }
  }
}
