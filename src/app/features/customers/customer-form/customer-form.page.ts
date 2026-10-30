import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { serverTimestamp, Timestamp } from '@angular/fire/firestore';
import { take } from 'rxjs';
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
import { GlassCardComponent, PageHeaderComponent } from '../../../shared/ui';
import { KvkkNoticeComponent } from '../components/kvkk-notice.component';

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
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p-toast position="top-right" />

    <p-dialog [header]="t().customers.kvkkTitle" [visible]="showKvkk()" (visibleChange)="showKvkk.set($event)"
      [modal]="true" [draggable]="false" appendTo="body" styleClass="w-[720px] max-w-[95vw]">
      @if (showKvkk()) { <app-kvkk-notice /> }
    </p-dialog>

    <ui-page-header
      [title]="isEdit ? t().customers.editCustomer : t().customers.addCustomer"
      [subtitle]="isEdit ? t().customers.editSubtitle : t().customers.addSubtitle"
      [backLink]="isEdit ? ['/customers', customerId] : '/customers'" [backLabel]="t().common.back">
      <p-button [label]="t().common.save" icon="pi pi-check" styleClass="hidden sm:inline-flex"
        [loading]="saving()" [disabled]="isEdit && !original()" (onClick)="save()" />
    </ui-page-header>

    <div class="page-body">
      <form [formGroup]="form" (ngSubmit)="save()" novalidate
        class="grid w-full max-w-[1200px] grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-4">
        <div class="flex min-w-0 flex-col gap-3 lg:gap-4">
        <ui-glass-card [title]="t().acc.secIdentity" icon="pi-id-card">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">

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

        <ui-glass-card [title]="t().acc.secFarm" icon="pi-map-marker" tone="success">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

            <div class="flex flex-col gap-1.5 sm:col-span-2">
              <label for="c-address" class="text-sm font-semibold text-fg-secondary">{{ t().customers.address }}</label>
              <textarea pTextarea id="c-address" formControlName="address" rows="2" autocomplete="street-address"
                class="w-full resize-y" [placeholder]="t().customers.addressPlaceholder"></textarea>
            </div>

          </div>
        </ui-glass-card>
        </div>

        <div class="flex min-w-0 flex-col gap-3 lg:gap-4">
        <ui-glass-card [title]="t().acc.secCredit" icon="pi-book" tone="accent">
          <div class="grid grid-cols-1 gap-4">
            <div class="flex flex-col gap-1.5">
              <label for="c-limit" class="text-sm font-semibold text-fg-secondary">{{ t().customers.creditLimit }}</label>
              <p-inputNumber inputId="c-limit" formControlName="creditLimit" mode="decimal" [min]="0" [maxFractionDigits]="2"
                locale="tr-TR" styleClass="w-full" inputStyleClass="num w-full" aria-describedby="c-limit-hint" />
              <p id="c-limit-hint" class="m-0 text-xs text-fg-muted">{{ t().customers.creditLimitHint }}</p>
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="c-notes" class="text-sm font-semibold text-fg-secondary">{{ t().customers.notes }}</label>
              <textarea pTextarea id="c-notes" formControlName="notes" rows="3"
                class="w-full resize-y" [placeholder]="t().customers.notesPlaceholder"></textarea>
            </div>
          </div>
        </ui-glass-card>

        <!-- KVKK -->
        <ui-glass-card [title]="t().customers.kvkkSection" icon="pi-shield" tone="info">
          <p class="m-0 mb-3 text-sm text-fg-secondary">{{ t().customers.kvkkInfo }}</p>
          <p-button [label]="t().customers.kvkkShow" icon="pi pi-file" severity="secondary"
            styleClass="mb-4" (onClick)="showKvkk.set(true)" />
          <div class="flex flex-col gap-3">
            <div class="flex items-start gap-3">
              <p-checkbox inputId="c-consent-proc" formControlName="consentProcessing" [binary]="true" />
              <label for="c-consent-proc" class="text-sm text-fg">
                {{ t().customers.consentProcessing }}
                @if (original()?.consents?.processing; as r) {
                  <span class="block text-xs text-fg-muted">{{ t().customers.consentGivenAt }}: {{ consentDate(r) | date:'dd.MM.yyyy HH:mm' }} · {{ r.version }}</span>
                }
              </label>
            </div>
            <div class="flex items-start gap-3">
              <p-checkbox inputId="c-consent-contact" formControlName="consentContact" [binary]="true" />
              <label for="c-consent-contact" class="text-sm text-fg">
                {{ t().customers.consentContact }}
                @if (original()?.consents?.contact; as r) {
                  <span class="block text-xs text-fg-muted">{{ t().customers.consentGivenAt }}: {{ consentDate(r) | date:'dd.MM.yyyy HH:mm' }} · {{ r.version }}</span>
                }
              </label>
            </div>
          </div>

          <div card-footer class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <p-button type="submit" [label]="t().common.save" icon="pi pi-check" size="large" styleClass="w-full sm:w-auto"
              [loading]="saving()" [disabled]="isEdit && !original()" />
          </div>
        </ui-glass-card>
        </div>
      </form>
    </div>
  `,
})
export class CustomerFormPage implements OnInit {
  private readonly svc = inject(CustomerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  readonly t = inject(LangService).t;
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
  private readonly settings = inject(TenantSettingsService);

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
    if (!this.isEdit) this.settings.ensureLoaded();
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

  async save(): Promise<void> {
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
        await this.router.navigate(['/customers', this.customerId]);
      } else {
        await this.svc.create({ ...data, consents, birthDate: null, isActive: true });
        await this.router.navigate(['/customers']);
      }
    } catch (err) {
      console.error(err);
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().customers.saveFailed });
    } finally {
      this.saving.set(false);
    }
  }
}
