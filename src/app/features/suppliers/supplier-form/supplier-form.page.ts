import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SupplierService } from '../services/supplier.service';
import { LangService } from '../../../core/i18n/lang.service';

@Component({
  selector: 'app-supplier-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, TextareaModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast></p-toast>
    <div style="display:flex; flex-direction:column; height:100%; background:var(--bg-page); overflow:hidden;">

      <!-- Header -->
      <div style="background:var(--bg-surface); border-bottom:1px solid var(--border); padding:14px 20px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
        <div style="display:flex; align-items:center; gap:12px;">
          <a routerLink="/suppliers" style="width:36px; height:36px; border-radius:10px; background:var(--bg-muted); display:flex; align-items:center; justify-content:center; text-decoration:none; color:var(--text-secondary); flex-shrink:0;">
            <i class="pi pi-arrow-left" style="font-size:14px;"></i>
          </a>
          <div>
            <h1 style="font-size:17px; font-weight:700; color:var(--text-primary); margin:0;">{{ isEdit ? t().suppliers.editSupplier : t().suppliers.addSupplier }}</h1>
            <p style="font-size:12px; color:var(--text-muted); margin:0;">{{ isEdit ? t().suppliers.editSubtitle : t().suppliers.addSubtitle }}</p>
          </div>
        </div>
        <p-button
          [label]="t().common.save"
          icon="pi pi-check"
          severity="success"
          [loading]="saving()"
          [disabled]="form.invalid"
          (onClick)="save()"
          size="small"
        ></p-button>
      </div>

      <!-- Form -->
      <div style="flex:1; overflow-y:auto; padding:24px;">
        <form [formGroup]="form">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; max-width:680px;">

            <!-- Firma Adı -->
            <div style="grid-column:1/-1; display:flex; flex-direction:column; gap:6px;">
              <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">{{ t().suppliers.companyName }}</label>
              <input pInputText formControlName="name" [placeholder]="t().suppliers.companyNamePlaceholder" style="width:100%;" />
              @if (form.get('name')?.invalid && form.get('name')?.touched) {
                <p style="font-size:11px; color:#ef4444; margin:0;">{{ t().suppliers.companyNameRequired }}</p>
              }
            </div>

            <!-- Yetkili Kişi -->
            <div style="display:flex; flex-direction:column; gap:6px;">
              <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">{{ t().suppliers.contactPerson }}</label>
              <input pInputText formControlName="contactPerson" [placeholder]="t().suppliers.contactPersonPlaceholder" style="width:100%;" />
            </div>

            <!-- Telefon -->
            <div style="display:flex; flex-direction:column; gap:6px;">
              <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">{{ t().suppliers.phone }}</label>
              <input pInputText type="tel" formControlName="phone" [placeholder]="t().suppliers.phonePlaceholder" style="width:100%;" />
            </div>

            <!-- E-posta -->
            <div style="display:flex; flex-direction:column; gap:6px;">
              <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">{{ t().suppliers.email }}</label>
              <input pInputText type="email" formControlName="email" [placeholder]="t().suppliers.emailPlaceholder" style="width:100%;" />
            </div>

            <!-- Vergi No -->
            <div style="display:flex; flex-direction:column; gap:6px;">
              <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">{{ t().suppliers.taxNo }}</label>
              <input pInputText formControlName="taxNo" [placeholder]="t().suppliers.taxNoPlaceholder" style="width:100%; font-family:monospace;" />
            </div>

            <!-- Adres -->
            <div style="grid-column:1/-1; display:flex; flex-direction:column; gap:6px;">
              <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">{{ t().suppliers.address }}</label>
              <textarea pTextarea formControlName="address" rows="2" [placeholder]="t().suppliers.addressPlaceholder" style="width:100%; resize:vertical;"></textarea>
            </div>

            <!-- Notlar -->
            <div style="grid-column:1/-1; display:flex; flex-direction:column; gap:6px;">
              <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">{{ t().suppliers.notes }}</label>
              <textarea pTextarea formControlName="notes" rows="2" [placeholder]="t().suppliers.notesPlaceholder" style="width:100%; resize:vertical;"></textarea>
            </div>

          </div>
        </form>
      </div>
    </div>
  `,
})
export class SupplierFormPage implements OnInit {
  private readonly svc = inject(SupplierService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  readonly t = inject(LangService).t;

  readonly saving = signal(false);
  isEdit = false;
  supplierId = '';

  readonly form = this.fb.group({
    name: ['', Validators.required],
    contactPerson: [''],
    phone: [''],
    email: [''],
    taxNo: [''],
    address: [''],
    notes: [''],
  });

  ngOnInit(): void {
    this.supplierId = this.route.snapshot.paramMap.get('id') ?? '';
    this.isEdit = !!this.supplierId;
    if (this.isEdit) {
      this.svc.getById$(this.supplierId).subscribe(s => {
        if (s) {
          this.form.patchValue({
            name: s.name,
            contactPerson: s.contactPerson ?? '',
            phone: s.phone ?? '',
            email: s.email ?? '',
            taxNo: s.taxNo ?? '',
            address: s.address ?? '',
            notes: s.notes ?? '',
          });
        }
      });
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
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
      if (this.isEdit) await this.svc.update(this.supplierId, data);
      else await this.svc.create(data);
      await this.router.navigate(['/suppliers']);
    } catch {
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().suppliers.saveFailed });
    } finally {
      this.saving.set(false);
    }
  }
}
