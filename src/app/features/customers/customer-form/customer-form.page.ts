import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { CustomerService } from '../services/customer.service';

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, TextareaModule],
  template: `
    <div style="display:flex; flex-direction:column; height:100%; background:#f8fafc; overflow:hidden;">

      <!-- Header -->
      <div style="background:#fff; border-bottom:1px solid #f1f5f9; padding:14px 20px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
        <div style="display:flex; align-items:center; gap:12px;">
          <a routerLink="/customers" style="width:36px; height:36px; border-radius:10px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; text-decoration:none; color:#64748b; flex-shrink:0;">
            <i class="pi pi-arrow-left" style="font-size:14px;"></i>
          </a>
          <div>
            <h1 style="font-size:17px; font-weight:700; color:#1e293b; margin:0;">{{ isEdit ? 'Müşteriyi Düzenle' : 'Yeni Müşteri' }}</h1>
            <p style="font-size:12px; color:#94a3b8; margin:0;">{{ isEdit ? 'Müşteri bilgilerini güncelleyin' : 'Yeni müşteri ekleyin' }}</p>
          </div>
        </div>
        <p-button
          label="Kaydet"
          icon="pi pi-check"
          severity="success"
          [loading]="saving()"
          [disabled]="form.invalid"
          (onClick)="save()"
          size="small"
        ></p-button>
      </div>

      <!-- Form -->
      <div style="flex:1; overflow-y:auto; padding:20px;">
        <form [formGroup]="form">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; max-width:680px;">

            <!-- Ad -->
            <div style="display:flex; flex-direction:column; gap:6px;">
              <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">Ad *</label>
              <input pInputText formControlName="firstName" placeholder="Müşteri adı" style="width:100%;" />
              @if (form.get('firstName')?.invalid && form.get('firstName')?.touched) {
                <p style="font-size:11px; color:#ef4444; margin:0;">Ad zorunlu</p>
              }
            </div>

            <!-- Soyad -->
            <div style="display:flex; flex-direction:column; gap:6px;">
              <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">Soyad *</label>
              <input pInputText formControlName="lastName" placeholder="Müşteri soyadı" style="width:100%;" />
              @if (form.get('lastName')?.invalid && form.get('lastName')?.touched) {
                <p style="font-size:11px; color:#ef4444; margin:0;">Soyad zorunlu</p>
              }
            </div>

            <!-- Telefon -->
            <div style="display:flex; flex-direction:column; gap:6px;">
              <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">Telefon *</label>
              <input pInputText type="tel" formControlName="phone" placeholder="05xx xxx xx xx" style="width:100%;" />
              @if (form.get('phone')?.invalid && form.get('phone')?.touched) {
                <p style="font-size:11px; color:#ef4444; margin:0;">Telefon zorunlu</p>
              }
            </div>

            <!-- E-posta -->
            <div style="display:flex; flex-direction:column; gap:6px;">
              <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">E-posta</label>
              <input pInputText type="email" formControlName="email" placeholder="ornek@mail.com" style="width:100%;" />
            </div>

            <!-- TC No -->
            <div style="display:flex; flex-direction:column; gap:6px;">
              <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">TC No</label>
              <input pInputText formControlName="tcNo" placeholder="11 haneli TC kimlik no" maxlength="11" style="width:100%;" />
            </div>

            <!-- Adres -->
            <div style="grid-column:1/-1; display:flex; flex-direction:column; gap:6px;">
              <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">Adres</label>
              <textarea pTextarea formControlName="address" rows="2" placeholder="Müşteri adresi" style="width:100%; resize:vertical;"></textarea>
            </div>

            <!-- Notlar -->
            <div style="grid-column:1/-1; display:flex; flex-direction:column; gap:6px;">
              <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">Notlar</label>
              <textarea pTextarea formControlName="notes" rows="2" placeholder="Ek notlar" style="width:100%; resize:vertical;"></textarea>
            </div>

          </div>
        </form>
      </div>
    </div>
  `,
})
export class CustomerFormPage implements OnInit {
  private readonly svc = inject(CustomerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly saving = signal(false);
  isEdit = false;
  customerId = '';

  readonly form = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    phone: ['', Validators.required],
    email: [''],
    tcNo: [''],
    address: [''],
    notes: [''],
  });

  ngOnInit(): void {
    this.customerId = this.route.snapshot.paramMap.get('id') ?? '';
    this.isEdit = !!this.customerId;
  }

  async save(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    try {
      const v = this.form.value;
      const data = {
        firstName: v.firstName!,
        lastName: v.lastName!,
        phone: v.phone!,
        email: v.email || null,
        tcNo: v.tcNo || null,
        address: v.address || null,
        notes: v.notes || null,
        birthDate: null,
        isActive: true,
      };
      if (this.isEdit) await this.svc.update(this.customerId, data);
      else await this.svc.create(data);
      await this.router.navigate(['/customers']);
    } finally {
      this.saving.set(false);
    }
  }
}
