import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { Router } from '@angular/router';
import { SupplierService } from '../services/supplier.service';
import { Supplier } from '../../../shared/models/supplier.model';
import { ProductStore } from '../../products/store/product.store';
import { LangService } from '../../../core/i18n/lang.service';

@Component({
  selector: 'app-supplier-detail',
  standalone: true,
  imports: [RouterLink, FormsModule, ButtonModule, InputTextModule, TextareaModule, ToastModule, ConfirmDialogModule],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast></p-toast>
    <p-confirmDialog></p-confirmDialog>
    <div style="display:flex; flex-direction:column; height:100%; background:var(--bg-page); overflow:hidden;">

      <!-- Header -->
      <div style="background:var(--bg-surface); border-bottom:1px solid var(--border); padding:14px 24px; display:flex; align-items:center; gap:12px; flex-shrink:0;">
        <a routerLink="/suppliers" style="width:36px; height:36px; border-radius:10px; background:var(--bg-muted); display:flex; align-items:center; justify-content:center; text-decoration:none; color:var(--text-secondary); flex-shrink:0;">
          <i class="pi pi-arrow-left" style="font-size:14px;"></i>
        </a>
        <h1 style="font-size:18px; font-weight:700; color:var(--text-primary); margin:0; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ supplier()?.name ?? t().nav.suppliers }}</h1>
        @if (!isEditing()) {
          <p-button icon="pi pi-pencil" [label]="t().common.edit" severity="secondary" size="small" (onClick)="startEdit()" />
          <p-button icon="pi pi-trash" severity="danger" [outlined]="true" size="small" (onClick)="confirmDelete()" />
        }
        @if (isEditing()) {
          <p-button icon="pi pi-times" [label]="t().common.cancel" severity="secondary" [outlined]="true" size="small" (onClick)="cancelEdit()" />
          <p-button icon="pi pi-check" [label]="t().common.save" severity="success" size="small" [loading]="saving()" (onClick)="saveEdit()" />
        }
      </div>

      <!-- Content -->
      <div style="flex:1; overflow-y:auto; padding:24px; display:flex; flex-direction:column; gap:20px; max-width:900px;">

        @if (!supplier()) {
          <div style="display:flex; justify-content:center; padding:60px 0; color:var(--text-muted);">
            <i class="pi pi-spin pi-spinner" style="font-size:28px;"></i>
          </div>
        } @else {

          <!-- Avatar + hızlı bilgi -->
          <div style="background:var(--bg-surface); border-radius:20px; padding:24px; box-shadow:0 1px 4px rgba(0,0,0,0.05); border:1px solid var(--border); display:flex; align-items:center; gap:20px;">
            <div style="width:64px; height:64px; border-radius:18px; background:linear-gradient(135deg,#3b82f6,#1d4ed8); display:flex; align-items:center; justify-content:center; color:white; font-weight:800; font-size:20px; flex-shrink:0; letter-spacing:1px;">
              {{ initials(supplier()!.name) }}
            </div>
            <div style="flex:1; min-width:0;">
              <p style="font-size:20px; font-weight:700; color:var(--text-primary); margin:0 0 4px;">{{ supplier()!.name }}</p>
              @if (supplier()!.contactPerson) {
                <p style="font-size:13px; color:var(--text-secondary); margin:0;"><i class="pi pi-user" style="margin-right:6px;"></i>{{ supplier()!.contactPerson }}</p>
              }
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex-shrink:0;">
              @if (supplier()!.phone) {
                <a [href]="'tel:' + supplier()!.phone" style="font-size:14px; font-weight:600; color:#16a34a; text-decoration:none; display:flex; align-items:center; gap:6px;">
                  <i class="pi pi-phone"></i>{{ supplier()!.phone }}
                </a>
              }
              @if (supplier()!.email) {
                <a [href]="'mailto:' + supplier()!.email" style="font-size:13px; color:#3b82f6; text-decoration:none; display:flex; align-items:center; gap:6px;">
                  <i class="pi pi-envelope"></i>{{ supplier()!.email }}
                </a>
              }
            </div>
          </div>

          <!-- Bilgi kartı -->
          <div style="background:var(--bg-surface); border-radius:20px; box-shadow:0 1px 4px rgba(0,0,0,0.05); border:1px solid var(--border); overflow:hidden;">
            <div style="padding:14px 20px; border-bottom:1px solid var(--border);">
              <h2 style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin:0;">{{ t().suppliers.companyInfo }}</h2>
            </div>

            @if (!isEditing()) {
              <div>
                @for (row of infoRows(); track row.label) {
                  <div style="display:flex; align-items:flex-start; padding:12px 20px; border-bottom:1px solid var(--border);">
                    <span style="font-size:13px; color:var(--text-muted); width:120px; flex-shrink:0;">{{ row.label }}</span>
                    <span style="font-size:13px; font-weight:600; color:var(--text-primary); font-family:{{ row.mono ? 'monospace' : 'inherit' }};">{{ row.value }}</span>
                  </div>
                }
              </div>
            } @else {
              <div style="padding:20px; display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div style="grid-column:1/-1; display:flex; flex-direction:column; gap:6px;">
                  <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">{{ t().suppliers.companyName }}</label>
                  <input pInputText [(ngModel)]="editForm.name" style="width:100%;" />
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                  <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">{{ t().suppliers.contactPerson }}</label>
                  <input pInputText [(ngModel)]="editForm.contactPerson" style="width:100%;" />
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                  <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">{{ t().suppliers.phone }}</label>
                  <input pInputText type="tel" [(ngModel)]="editForm.phone" style="width:100%;" />
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                  <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">{{ t().suppliers.email }}</label>
                  <input pInputText type="email" [(ngModel)]="editForm.email" style="width:100%;" />
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                  <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">{{ t().suppliers.taxNo }}</label>
                  <input pInputText [(ngModel)]="editForm.taxNo" style="width:100%; font-family:monospace;" />
                </div>
                <div style="grid-column:1/-1; display:flex; flex-direction:column; gap:6px;">
                  <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">{{ t().suppliers.address }}</label>
                  <textarea pTextarea [(ngModel)]="editForm.address" rows="2" style="width:100%; resize:vertical;"></textarea>
                </div>
                <div style="grid-column:1/-1; display:flex; flex-direction:column; gap:6px;">
                  <label style="font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.4px;">{{ t().suppliers.notes }}</label>
                  <textarea pTextarea [(ngModel)]="editForm.notes" rows="2" style="width:100%; resize:vertical;"></textarea>
                </div>
              </div>
            }
          </div>

          <!-- Tedarik ettiği ürünler -->
          <div style="background:var(--bg-surface); border-radius:20px; box-shadow:0 1px 4px rgba(0,0,0,0.05); border:1px solid var(--border); overflow:hidden;">
            <div style="padding:14px 20px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between;">
              <h2 style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin:0;">{{ t().suppliers.productsSupplied }}</h2>
              @if (suppliedProducts().length > 0) {
                <span style="font-size:11px; font-weight:600; color:var(--text-secondary); background:var(--bg-muted); border-radius:999px; padding:2px 10px;">{{ suppliedProducts().length }} {{ t().suppliers.suppliedCount }}</span>
              }
            </div>
            @if (suppliedProducts().length === 0) {
              <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; color:var(--text-muted); gap:10px;">
                <i class="pi pi-box" style="font-size:28px; opacity:0.3;"></i>
                <p style="font-size:13px; margin:0;">{{ t().suppliers.noProducts }}</p>
                <p style="font-size:12px; margin:0; color:var(--text-muted);">{{ t().suppliers.noProductsHint }}</p>
              </div>
            } @else {
              <div>
                @for (p of suppliedProducts(); track p.id) {
                  <a [routerLink]="['/products', p.id]"
                    style="display:flex; align-items:center; gap:12px; padding:12px 20px; border-bottom:1px solid var(--border); text-decoration:none; transition:background 0.15s;"
                    onmouseenter="this.style.background='#f8fafc'"
                    onmouseleave="this.style.background='transparent'">
                    <div style="width:36px; height:36px; border-radius:10px; background:#f0fdf4; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                      <i class="pi pi-box" style="font-size:14px; color:#16a34a;"></i>
                    </div>
                    <div style="flex:1; min-width:0;">
                      <p style="font-size:14px; font-weight:600; color:var(--text-primary); margin:0 0 2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ p.name }}</p>
                      <p style="font-size:12px; color:var(--text-muted); margin:0;">{{ p.category }}</p>
                    </div>
                    <div style="text-align:right; flex-shrink:0;">
                      <p style="font-size:13px; font-weight:600; color:var(--text-primary); margin:0;">{{ p.stock }} {{ t().products.piece }}</p>
                    </div>
                    <i class="pi pi-chevron-right" style="color:#cbd5e1; font-size:12px; flex-shrink:0;"></i>
                  </a>
                }
              </div>
            }
          </div>

        }
      </div>
    </div>
  `,
})
export class SupplierDetailPage implements OnInit {
  private readonly svc = inject(SupplierService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly productStore = inject(ProductStore);
  readonly t = inject(LangService).t;

  readonly supplier = signal<Supplier | null>(null);
  readonly isEditing = signal(false);
  readonly saving = signal(false);
  supplierId = '';

  editForm = { name: '', contactPerson: '', phone: '', email: '', taxNo: '', address: '', notes: '' };

  readonly suppliedProducts = computed(() => {
    const id = this.supplierId;
    return this.productStore.products().filter(p =>
      p.batches?.some(b => (b as any).supplierId === id)
    );
  });

  ngOnInit(): void {
    this.supplierId = this.route.snapshot.paramMap.get('id') ?? '';
    this.svc.getById$(this.supplierId).subscribe(s => this.supplier.set(s));
    this.productStore.loadProducts(undefined as any);
  }

  startEdit(): void {
    const s = this.supplier();
    if (!s) return;
    this.editForm = {
      name: s.name,
      contactPerson: s.contactPerson ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      taxNo: s.taxNo ?? '',
      address: s.address ?? '',
      notes: s.notes ?? '',
    };
    this.isEditing.set(true);
  }

  cancelEdit(): void { this.isEditing.set(false); }

  async saveEdit(): Promise<void> {
    if (!this.editForm.name.trim()) {
      this.toast.add({ severity: 'warn', summary: '', detail: this.t().suppliers.companyNameRequired });
      return;
    }
    this.saving.set(true);
    try {
      const changes = {
        name: this.editForm.name.trim(),
        contactPerson: this.editForm.contactPerson.trim() || null,
        phone: this.editForm.phone.trim() || null,
        email: this.editForm.email.trim() || null,
        taxNo: this.editForm.taxNo.trim() || null,
        address: this.editForm.address.trim() || null,
        notes: this.editForm.notes.trim() || null,
      };
      await this.svc.update(this.supplierId, changes);
      this.supplier.set({ ...this.supplier()!, ...changes });
      this.isEditing.set(false);
      this.toast.add({ severity: 'success', summary: '', detail: this.t().suppliers.updated, life: 2500 });
    } catch {
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().suppliers.updateFailed });
    } finally {
      this.saving.set(false);
    }
  }

  confirmDelete(): void {
    this.confirm.confirm({
      message: this.t().suppliers.deleteConfirm,
      header: this.t().suppliers.deleteTitle,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.t().suppliers.deleteAccept,
      rejectLabel: this.t().suppliers.deleteCancel,
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.doDelete(),
    });
  }

  private async doDelete(): Promise<void> {
    try {
      await this.svc.delete(this.supplierId);
      await this.router.navigate(['/suppliers']);
    } catch {
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().suppliers.deleteFailed });
    }
  }

  infoRows(): { label: string; value: string; mono?: boolean }[] {
    const s = this.supplier();
    if (!s) return [];
    const su = this.t().suppliers;
    return [
      ...(s.contactPerson ? [{ label: su.contactShort, value: s.contactPerson }] : []),
      ...(s.phone ? [{ label: su.phone, value: s.phone }] : []),
      ...(s.email ? [{ label: su.email, value: s.email }] : []),
      ...(s.taxNo ? [{ label: su.taxNo, value: s.taxNo, mono: true }] : []),
      ...(s.address ? [{ label: su.address, value: s.address }] : []),
      ...(s.notes ? [{ label: su.notes, value: s.notes }] : []),
    ].filter(r => r.value);
  }

  initials(name: string): string {
    return name.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase()).join('').slice(0, 2);
  }
}
