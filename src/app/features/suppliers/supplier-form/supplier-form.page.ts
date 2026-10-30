import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SupplierService } from '../services/supplier.service';
import { LangService } from '../../../core/i18n/lang.service';
import { GlassCardComponent, PageHeaderComponent } from '../../../shared/ui';

@Component({
  selector: 'app-supplier-form',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, TextareaModule, ToastModule, PageHeaderComponent, GlassCardComponent],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p-toast />

    <ui-page-header [title]="t().suppliers.addSupplier" [subtitle]="t().suppliers.addSubtitle"
      backLink="/suppliers" [backLabel]="t().common.back">
      <p-button [label]="t().common.save" icon="pi pi-check" styleClass="hidden sm:inline-flex"
        [loading]="saving()" (onClick)="save()" />
    </ui-page-header>

    <div class="page-body">
      <form [formGroup]="form" (ngSubmit)="save()" novalidate class="w-full max-w-3xl">
        <ui-glass-card padding="lg">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">

            <div class="flex flex-col gap-1.5 sm:col-span-2">
              <label for="s-name" class="text-sm font-semibold text-fg-secondary">{{ t().suppliers.companyName }}</label>
              <input pInputText id="s-name" formControlName="name" autocomplete="organization" class="w-full"
                [placeholder]="t().suppliers.companyNamePlaceholder"
                [attr.aria-invalid]="showError('name')" [attr.aria-describedby]="showError('name') ? 's-name-err' : null" />
              @if (showError('name')) {
                <p id="s-name-err" class="m-0 text-xs font-medium text-danger">{{ t().suppliers.companyNameRequired }}</p>
              }
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="s-contact" class="text-sm font-semibold text-fg-secondary">{{ t().suppliers.contactPerson }}</label>
              <input pInputText id="s-contact" formControlName="contactPerson" autocomplete="name" class="w-full"
                [placeholder]="t().suppliers.contactPersonPlaceholder" />
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="s-phone" class="text-sm font-semibold text-fg-secondary">{{ t().suppliers.phone }}</label>
              <input pInputText id="s-phone" type="tel" inputmode="tel" autocomplete="tel" formControlName="phone" class="w-full"
                [placeholder]="t().suppliers.phonePlaceholder" />
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="s-email" class="text-sm font-semibold text-fg-secondary">{{ t().suppliers.email }}</label>
              <input pInputText id="s-email" type="email" inputmode="email" autocomplete="email" formControlName="email" class="w-full"
                [placeholder]="t().suppliers.emailPlaceholder"
                [attr.aria-invalid]="showError('email')" [attr.aria-describedby]="showError('email') ? 's-email-err' : null" />
              @if (showError('email')) {
                <p id="s-email-err" class="m-0 text-xs font-medium text-danger">{{ t().suppliers.emailInvalid }}</p>
              }
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="s-tax" class="text-sm font-semibold text-fg-secondary">{{ t().suppliers.taxNo }}</label>
              <input pInputText id="s-tax" inputmode="numeric" autocomplete="off" formControlName="taxNo" class="num w-full font-mono"
                [placeholder]="t().suppliers.taxNoPlaceholder" />
            </div>

            <div class="flex flex-col gap-1.5 sm:col-span-2">
              <label for="s-address" class="text-sm font-semibold text-fg-secondary">{{ t().suppliers.address }}</label>
              <textarea pTextarea id="s-address" formControlName="address" rows="2" autocomplete="street-address"
                class="w-full resize-y" [placeholder]="t().suppliers.addressPlaceholder"></textarea>
            </div>

            <div class="flex flex-col gap-1.5 sm:col-span-2">
              <label for="s-notes" class="text-sm font-semibold text-fg-secondary">{{ t().suppliers.notes }}</label>
              <textarea pTextarea id="s-notes" formControlName="notes" rows="3"
                class="w-full resize-y" [placeholder]="t().suppliers.notesPlaceholder"></textarea>
            </div>
          </div>

          <div card-footer class="flex sm:justify-end">
            <p-button type="submit" [label]="t().common.save" icon="pi pi-check" size="large" styleClass="w-full sm:w-auto"
              [loading]="saving()" />
          </div>
        </ui-glass-card>
      </form>
    </div>
  `,
})
/** Yalnızca yeni tedarikçi ekleme; düzenleme supplier-detail içinde satır içi yapılır. */
export class SupplierFormPage {
  private readonly svc = inject(SupplierService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  readonly t = inject(LangService).t;

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

  showError(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && c.touched;
  }

  async save(): Promise<void> {
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
      await this.svc.create(data);
      await this.router.navigate(['/suppliers']);
    } catch {
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().suppliers.saveFailed });
    } finally {
      this.saving.set(false);
    }
  }
}
