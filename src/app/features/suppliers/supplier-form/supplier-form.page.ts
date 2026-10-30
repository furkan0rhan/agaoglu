import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SupplierService } from '../services/supplier.service';
import { LangService } from '../../../core/i18n/lang.service';
import {
  AvatarComponent, GlassCardComponent, KbdComponent, PageHeaderComponent, StatusBadgeComponent, UiTone,
} from '../../../shared/ui';
import { SUPPLIER_FORM_TEXTS } from './supplier-form.i18n';
import { TaxNoStatus, taxNoStatus } from './tax-no';

/** Sağ paneldeki kontrol listesinin bir bölümü. */
interface ChecklistSection { id: string; label: string; done: number; total: number; error: boolean; missingRequired: string[] }

const TAX_TONE: Record<TaxNoStatus, UiTone> = { empty: 'neutral', vkn: 'success', tckn: 'success', length: 'warning', checksum: 'warning' };
const TAX_ICON: Record<TaxNoStatus, string> = {
  empty: 'pi-minus', vkn: 'pi-check', tckn: 'pi-check', length: 'pi-exclamation-triangle', checksum: 'pi-exclamation-triangle',
};

@Component({
  selector: 'app-supplier-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, ButtonModule, InputTextModule, TextareaModule, ToastModule, PageHeaderComponent, GlassCardComponent,
    AvatarComponent, StatusBadgeComponent, KbdComponent,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', '(window:keydown.control.s)': 'onCtrlS($event)' },
  template: `
    <p-toast />

    <ui-page-header [title]="t().suppliers.addSupplier" [subtitle]="t().suppliers.addSubtitle"
      backLink="/suppliers" [backLabel]="t().common.back" />

    <form [formGroup]="form" (ngSubmit)="save()" novalidate class="page-body">
      <div class="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">

        <!-- Sol: bölüm kartları -->
        <div class="flex min-w-0 flex-col gap-3 lg:gap-4">
          <ui-glass-card id="sf-sec-company" class="scroll-mt-4" [title]="x().secCompany" icon="pi-building">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="flex flex-col gap-1.5 sm:col-span-2">
                <label for="s-name" class="text-sm font-semibold text-fg-secondary">{{ t().suppliers.companyName }}</label>
                <input pInputText id="s-name" formControlName="name" autocomplete="organization" class="w-full"
                  [placeholder]="t().suppliers.companyNamePlaceholder"
                  [attr.aria-invalid]="showError('name')" [attr.aria-describedby]="showError('name') ? 's-name-err' : null" />
                @if (showError('name')) {
                  <p id="s-name-err" class="m-0 text-xs font-medium text-danger-text">{{ t().suppliers.companyNameRequired }}</p>
                }
              </div>

              <div class="flex flex-col gap-1.5">
                <label for="s-contact" class="text-sm font-semibold text-fg-secondary">{{ t().suppliers.contactPerson }}</label>
                <input pInputText id="s-contact" formControlName="contactPerson" autocomplete="name" class="w-full"
                  [placeholder]="t().suppliers.contactPersonPlaceholder" />
              </div>

              <div class="flex flex-col gap-1.5">
                <label for="s-tax" class="text-sm font-semibold text-fg-secondary">{{ t().suppliers.taxNo }}</label>
                <input pInputText id="s-tax" inputmode="numeric" autocomplete="off" formControlName="taxNo" class="num w-full font-mono"
                  [placeholder]="t().suppliers.taxNoPlaceholder" aria-describedby="s-tax-status" />
                <p id="s-tax-status" class="m-0 flex items-center gap-1.5 text-xs" [class]="taxTextClass()" aria-live="polite">
                  @if (taxStatus() !== 'empty') {
                    <i class="pi text-10" [class]="taxIcon()" aria-hidden="true"></i>{{ x().tax[taxStatus()] }}
                  } @else {
                    {{ x().taxHint }}
                  }
                </p>
              </div>
            </div>
          </ui-glass-card>

          <div class="grid grid-cols-1 items-stretch gap-3 lg:gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <ui-glass-card id="sf-sec-contact" class="scroll-mt-4" [title]="x().secContact" icon="pi-phone" tone="info">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="flex flex-col gap-1.5">
                  <label for="s-phone" class="text-sm font-semibold text-fg-secondary">{{ t().suppliers.phone }}</label>
                  <input pInputText id="s-phone" type="tel" inputmode="tel" autocomplete="tel" formControlName="phone" class="num w-full"
                    [placeholder]="t().suppliers.phonePlaceholder" />
                </div>

                <div class="flex flex-col gap-1.5">
                  <label for="s-email" class="text-sm font-semibold text-fg-secondary">{{ t().suppliers.email }}</label>
                  <input pInputText id="s-email" type="email" inputmode="email" autocomplete="email" formControlName="email" class="w-full"
                    [placeholder]="t().suppliers.emailPlaceholder"
                    [attr.aria-invalid]="showError('email')" [attr.aria-describedby]="showError('email') ? 's-email-err' : null" />
                  @if (showError('email')) {
                    <p id="s-email-err" class="m-0 text-xs font-medium text-danger-text">{{ t().suppliers.emailInvalid }}</p>
                  }
                </div>

                <div class="flex flex-col gap-1.5 sm:col-span-2">
                  <label for="s-address" class="text-sm font-semibold text-fg-secondary">{{ t().suppliers.address }}</label>
                  <textarea pTextarea id="s-address" formControlName="address" rows="2" autocomplete="street-address"
                    class="w-full resize-y" [placeholder]="t().suppliers.addressPlaceholder"></textarea>
                </div>
              </div>
            </ui-glass-card>

            <ui-glass-card id="sf-sec-notes" class="scroll-mt-4" [title]="x().secNotes" icon="pi-pencil" tone="neutral">
              <div class="flex h-full flex-col gap-1.5">
                <label for="s-notes" class="sr-only">{{ t().suppliers.notes }}</label>
                <textarea pTextarea id="s-notes" formControlName="notes" rows="5"
                  class="w-full flex-1 resize-y" [placeholder]="t().suppliers.notesPlaceholder"></textarea>
              </div>
            </ui-glass-card>
          </div>
        </div>

        <!-- Sağ: yapışkan önizleme + kontrol listesi + kaydet (telefonda formun altına iner) -->
        <aside class="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-6rem)]">
          <div class="flex min-h-0 flex-col gap-3 lg:overflow-y-auto lg:[scrollbar-width:none]">
          <ui-glass-card [title]="x().preview" icon="pi-id-card" tone="neutral" padding="none">
            <div class="flex items-center gap-3 px-4 pb-3 pt-3.5">
              <ui-avatar [name]="vals().name?.trim() || '?'" size="lg" tone="info" />
              <div class="min-w-0">
                <p class="m-0 truncate font-display text-18 font-extrabold leading-tight text-fg">{{ vals().name?.trim() || x().newSupplier }}</p>
                @if (vals().contactPerson?.trim()) {
                  <p class="m-0 mt-0.5 truncate text-13.5 text-fg-secondary">
                    <i class="pi pi-user mr-1 text-12 text-fg-muted" aria-hidden="true"></i>{{ vals().contactPerson }}
                  </p>
                }
                <p class="num m-0 mt-0.5 truncate text-14 font-semibold" [class]="vals().phone?.trim() ? 'text-fg-secondary' : 'text-fg-muted'">
                  <i class="pi pi-phone mr-1 text-12 text-fg-muted" aria-hidden="true"></i>{{ vals().phone?.trim() || x().noPhone }}
                </p>
              </div>
            </div>
            @if (vals().email?.trim() || vals().address?.trim()) {
              <dl class="m-0 flex flex-col gap-1.5 px-4 pb-3 text-13.5">
                @if (vals().email?.trim()) {
                  <div class="flex min-w-0 items-start gap-2">
                    <dt class="shrink-0 pt-0.5"><i class="pi pi-envelope text-12 text-fg-muted" aria-hidden="true"></i><span class="sr-only">{{ t().suppliers.email }}</span></dt>
                    <dd class="m-0 min-w-0 break-words text-fg-secondary">{{ vals().email }}</dd>
                  </div>
                }
                @if (vals().address?.trim()) {
                  <div class="flex min-w-0 items-start gap-2">
                    <dt class="shrink-0 pt-0.5"><i class="pi pi-map-marker text-12 text-fg-muted" aria-hidden="true"></i><span class="sr-only">{{ t().suppliers.address }}</span></dt>
                    <dd class="m-0 min-w-0 break-words text-fg-secondary">{{ vals().address }}</dd>
                  </div>
                }
              </dl>
            }
            <div class="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5">
              <span class="min-w-0">
                <span class="eyebrow block text-fg-muted">{{ x().taxTitle }}</span>
                <span class="num block truncate text-14 font-bold text-fg">{{ vals().taxNo?.trim() || '—' }}</span>
              </span>
              <ui-status-badge size="sm" [tone]="taxTone()" [icon]="taxIcon()">{{ x().tax[taxStatus()] }}</ui-status-badge>
            </div>
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
            <button type="submit" [disabled]="saving()" aria-keyshortcuts="Control+S"
              class="relative inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-token-md border-0 bg-brand px-4 font-display text-16 font-extrabold text-brand-contrast transition-colors hover:bg-brand-hover disabled:cursor-not-allowed ui-btn-disabled-soft">
              <i class="pi" [class]="saving() ? 'pi-spin pi-spinner' : 'pi-check'" aria-hidden="true"></i>{{ t().common.save }}
              <ui-kbd tone="inverse" class="absolute right-3">Ctrl S</ui-kbd>
            </button>
            <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <p-button type="button" [label]="x().saveAndPurchase" icon="pi pi-truck" severity="secondary" styleClass="w-full"
                [disabled]="saving()" (onClick)="save('purchase')" />
              <p-button type="button" [label]="t().common.cancel" [text]="true" (onClick)="cancel()" />
            </div>
          </div>
        </aside>
      </div>

      <!-- Telefon / tablet: altta yapışkan kaydet -->
      <div class="sticky bottom-0 z-sticky -mx-3 -mb-3 flex gap-2 border-t border-line bg-page px-3 py-2.5 lg:hidden">
        <p-button type="button" icon="pi pi-truck" severity="secondary" size="large" [ariaLabel]="x().saveAndPurchase"
          [disabled]="saving()" (onClick)="save('purchase')" />
        <p-button type="submit" [label]="t().common.save" icon="pi pi-check" size="large" styleClass="w-full" class="flex-1"
          [loading]="saving()" />
      </div>
    </form>
  `,
})
/** Yalnızca yeni tedarikçi ekleme; düzenleme supplier-detail içinde satır içi yapılır. */
export class SupplierFormPage {
  private readonly svc = inject(SupplierService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly lang = inject(LangService);
  readonly t = this.lang.t;
  readonly x = computed(() => SUPPLIER_FORM_TEXTS[this.lang.lang()]);

  readonly saving = signal(false);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    contactPerson: [''],
    phone: [''],
    email: ['', Validators.email],
    taxNo: [''],
    address: [''],
    notes: [''],
  });

  /** Formun canlı değeri — önizleme ve kontrol listesi için. */
  readonly vals = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), { initialValue: this.form.getRawValue() });

  readonly taxStatus = computed(() => taxNoStatus(this.vals().taxNo));
  readonly taxTone = computed(() => TAX_TONE[this.taxStatus()]);
  readonly taxIcon = computed(() => TAX_ICON[this.taxStatus()]);
  readonly taxTextClass = computed(() => {
    const s = this.taxStatus();
    return s === 'empty' ? 'text-fg-muted' : TAX_TONE[s] === 'success' ? 'text-success-text' : 'text-warning-text';
  });

  readonly checklist = computed<ChecklistSection[]>(() => {
    const v = this.vals();
    const ctrls = this.form.controls;
    type Key = keyof typeof v;
    const filled = (val: unknown) => val != null && String(val).trim() !== '';
    const sec = (id: string, label: string, keys: Key[], required: Key[] = []): ChecklistSection => ({
      id, label,
      done: keys.filter(k => filled(v[k])).length,
      total: keys.length,
      error: keys.some(k => filled(v[k]) && ctrls[k].invalid),
      missingRequired: required.filter(k => !filled(v[k])).map(() => this.t().suppliers.companyName.replace(' *', '')),
    });
    return [
      sec('sf-sec-company', this.x().secCompany, ['name', 'contactPerson', 'taxNo'], ['name']),
      sec('sf-sec-contact', this.x().secContact, ['phone', 'email', 'address']),
      sec('sf-sec-notes', this.x().secNotes, ['notes']),
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

  showError(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && c.touched;
  }

  jump(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  onCtrlS(event: Event): void {
    event.preventDefault();
    void this.save();
  }

  cancel(): void {
    void this.router.navigate(['/suppliers']);
  }

  /** `next = 'purchase'`: kaydettikten sonra tedarikçi seçili alış formu açılır (/purchases/new?supplierId=<id>). */
  async save(next: 'default' | 'purchase' = 'default'): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (this.saving()) return;
    this.saving.set(true);
    try {
      const v = this.form.value;
      const data = {
        name: v.name!.trim(),
        contactPerson: v.contactPerson?.trim() || null,
        phone: v.phone?.trim() || null,
        email: v.email?.trim() || null,
        taxNo: v.taxNo?.trim() || null,
        address: v.address?.trim() || null,
        notes: v.notes?.trim() || null,
        isActive: true,
      };
      const id = await this.svc.create(data);
      if (next === 'purchase') await this.router.navigate(['/purchases/new'], { queryParams: { supplierId: id } });
      else await this.router.navigate(['/suppliers']);
    } catch {
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().suppliers.saveFailed });
    } finally {
      this.saving.set(false);
    }
  }
}
