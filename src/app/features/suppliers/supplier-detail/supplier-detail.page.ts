import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormControl, FormsModule, Validators } from '@angular/forms';
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
import { SupplierAccountComponent } from '../supplier-account/supplier-account.component';
import { LangService } from '../../../core/i18n/lang.service';
import {
  EmptyStateComponent, GlassCardComponent, IconButtonComponent, PageHeaderComponent,
  StatusBadgeComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-supplier-detail',
  standalone: true,
  imports: [
    RouterLink, FormsModule, ButtonModule, InputTextModule, TextareaModule, ToastModule, ConfirmDialogModule,
    PageHeaderComponent, GlassCardComponent, EmptyStateComponent, IconButtonComponent,
    StatusBadgeComponent, SupplierAccountComponent,
  ],
  providers: [MessageService, ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p-toast />
    <p-confirmDialog />

    <ui-page-header backLink="/suppliers" [backLabel]="t().common.back"
      [title]="supplier()?.name ?? t().nav.suppliers" [subtitle]="supplier()?.contactPerson ?? ''">
      @if (supplier()) {
        @if (!isEditing()) {
          <ui-icon-button icon="pi-pencil" variant="outline" [ariaLabel]="t().common.edit" (click)="startEdit()" />
          <ui-icon-button icon="pi-trash" tone="danger" variant="outline" [ariaLabel]="t().suppliers.deleteTitle" (click)="confirmDelete()" />
        } @else {
          <ui-icon-button icon="pi-times" variant="outline" [ariaLabel]="t().common.cancel" (click)="cancelEdit()" />
          <p-button icon="pi pi-check" [label]="t().common.save" [loading]="saving()"
            [disabled]="!editForm.name.trim() || editEmailInvalid()" (onClick)="saveEdit()" />
        }
      }
    </ui-page-header>

    <div class="page-body">
      @if (!supplier()) {
        <div class="h-48 animate-pulse rounded-token-xl bg-surface-muted" aria-hidden="true"></div>
        <div class="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4" aria-hidden="true">
          <div class="h-56 animate-pulse rounded-token-xl bg-surface-muted"></div>
          <div class="h-56 animate-pulse rounded-token-xl bg-surface-muted"></div>
        </div>
        <span class="sr-only" role="status">{{ t().common.loading }}</span>
      } @else {
        <!-- Cari kartı: bakiye, ödeme, hareketler, alış belgeleri -->
        <app-supplier-account [supplier]="supplier()!" />

        <div class="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-4">

          <!-- Firma bilgileri -->
          <ui-glass-card [title]="t().suppliers.companyInfo" icon="pi-building" tone="info" [padding]="isEditing() ? 'md' : 'none'" clip>
            @if (!isEditing()) {
              @if (infoRows().length) {
                <dl class="m-0 flex flex-col">
                  @for (row of infoRows(); track row.label) {
                    <div class="flex min-h-[52px] flex-col justify-center gap-0.5 border-b border-line px-4 py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-start sm:gap-3">
                      <dt class="shrink-0 text-12.5 text-fg-muted sm:w-28">{{ row.label }}</dt>
                      <dd class="m-0 min-w-0 break-words text-14 font-medium text-fg" [class.font-mono]="row.mono">
                        @if (row.href) {
                          <a [href]="row.href" class="text-brand-text no-underline hover:underline">{{ row.value }}</a>
                        } @else { {{ row.value }} }
                      </dd>
                    </div>
                  }
                </dl>
              } @else {
                <ui-empty-state compact icon="pi-building" [title]="t().suppliers.noInfo" />
              }
            } @else {
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="flex flex-col gap-1.5 sm:col-span-2">
                  <label for="sd-name" class="text-sm font-semibold text-fg-secondary">{{ t().suppliers.companyName }}</label>
                  <input pInputText id="sd-name" class="w-full" autocomplete="organization" [(ngModel)]="editForm.name"
                    [attr.aria-invalid]="!editForm.name.trim()" [attr.aria-describedby]="!editForm.name.trim() ? 'sd-name-err' : null" />
                  @if (!editForm.name.trim()) {
                    <p id="sd-name-err" class="m-0 text-xs font-medium text-danger-text">{{ t().suppliers.companyNameRequired }}</p>
                  }
                </div>
                <div class="flex flex-col gap-1.5">
                  <label for="sd-contact" class="text-sm font-semibold text-fg-secondary">{{ t().suppliers.contactPerson }}</label>
                  <input pInputText id="sd-contact" class="w-full" autocomplete="name" [(ngModel)]="editForm.contactPerson" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label for="sd-phone" class="text-sm font-semibold text-fg-secondary">{{ t().suppliers.phone }}</label>
                  <input pInputText id="sd-phone" type="tel" inputmode="tel" autocomplete="tel" class="w-full" [(ngModel)]="editForm.phone" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label for="sd-email" class="text-sm font-semibold text-fg-secondary">{{ t().suppliers.email }}</label>
                  <input pInputText id="sd-email" type="email" inputmode="email" autocomplete="email" class="w-full" [(ngModel)]="editForm.email"
                    [attr.aria-invalid]="editEmailInvalid()" [attr.aria-describedby]="editEmailInvalid() ? 'sd-email-err' : null" />
                  @if (editEmailInvalid()) {
                    <p id="sd-email-err" class="m-0 text-xs font-medium text-danger-text">{{ t().suppliers.emailInvalid }}</p>
                  }
                </div>
                <div class="flex flex-col gap-1.5">
                  <label for="sd-tax" class="text-sm font-semibold text-fg-secondary">{{ t().suppliers.taxNo }}</label>
                  <input pInputText id="sd-tax" inputmode="numeric" autocomplete="off" class="num w-full font-mono" [(ngModel)]="editForm.taxNo" />
                </div>
                <div class="flex flex-col gap-1.5 sm:col-span-2">
                  <label for="sd-address" class="text-sm font-semibold text-fg-secondary">{{ t().suppliers.address }}</label>
                  <textarea pTextarea id="sd-address" rows="2" class="w-full resize-y" [(ngModel)]="editForm.address"></textarea>
                </div>
                <div class="flex flex-col gap-1.5 sm:col-span-2">
                  <label for="sd-notes" class="text-sm font-semibold text-fg-secondary">{{ t().suppliers.notes }}</label>
                  <textarea pTextarea id="sd-notes" rows="2" class="w-full resize-y" [(ngModel)]="editForm.notes"></textarea>
                </div>
              </div>
            }
          </ui-glass-card>

          <!-- Tedarik ettiği ürünler -->
          <ui-glass-card [title]="t().suppliers.productsSupplied" icon="pi-box" padding="none" clip>
            @if (suppliedProducts().length > 0) {
              <ui-status-badge card-actions tone="neutral" size="sm">{{ suppliedProducts().length }} {{ t().suppliers.suppliedCount }}</ui-status-badge>
            }
            @if (suppliedProducts().length === 0) {
              <ui-empty-state compact icon="pi-box" [title]="t().suppliers.noProducts" [description]="t().suppliers.noProductsHint" />
            } @else {
              <ul class="m-0 flex list-none flex-col p-0">
                @for (p of suppliedProducts(); track p.id) {
                  <li class="border-b border-line last:border-b-0">
                    <a [routerLink]="['/products', p.id]"
                      class="list-row flex min-h-[56px] items-center gap-3 px-4 py-2 no-underline">
                      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-token-md bg-brand-soft text-brand-text" aria-hidden="true">
                        <i class="pi pi-box text-sm"></i>
                      </span>
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-sm font-semibold text-fg">{{ p.name }}</span>
                        <span class="block truncate text-xs text-fg-muted">{{ p.category }}</span>
                      </span>
                      <span class="num shrink-0 text-14 font-bold text-fg">{{ p.stock }} {{ t().pos.units[p.unit ?? 'adet'] }}</span>
                      <i class="pi pi-chevron-right text-xs text-fg-muted" aria-hidden="true"></i>
                    </a>
                  </li>
                }
              </ul>
            }
          </ui-glass-card>
        </div>

      }
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
  private readonly destroyRef = inject(DestroyRef);
  readonly t = inject(LangService).t;

  readonly supplier = signal<Supplier | null>(null);
  readonly isEditing = signal(false);
  readonly saving = signal(false);
  supplierId = '';

  editForm = { name: '', contactPerson: '', phone: '', email: '', taxNo: '', address: '', notes: '' };

  readonly suppliedProducts = computed(() => {
    const id = this.supplierId;
    return this.productStore.products().filter(p =>
      p.batches?.some(b => b.supplierId === id)
    );
  });

  ngOnInit(): void {
    this.supplierId = this.route.snapshot.paramMap.get('id') ?? '';
    this.svc.getById$(this.supplierId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: s => this.supplier.set(s),
      error: () => this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().suppliers.loadError }),
    });
    this.productStore.ensureLoaded();
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

  editEmailInvalid(): boolean {
    const v = this.editForm.email.trim();
    return !!v && Validators.email(new FormControl(v)) !== null;
  }

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
    // Partilerde bu tedarikçiye referans varsa silmeyi engelle (ürün listesi yüklenmeden karar verme).
    if (this.productStore.loading()) {
      this.toast.add({ severity: 'info', summary: '', detail: this.t().common.loading, life: 2000 });
      return;
    }
    if (this.suppliedProducts().length > 0) {
      this.toast.add({ severity: 'warn', summary: '', detail: this.t().suppliers.deleteHasProducts, life: 4000 });
      return;
    }
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
    if (this.suppliedProducts().length > 0) {
      this.toast.add({ severity: 'warn', summary: '', detail: this.t().suppliers.deleteHasProducts, life: 4000 });
      return;
    }
    try {
      await this.svc.delete(this.supplierId);
      await this.router.navigate(['/suppliers']);
    } catch {
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().suppliers.deleteFailed });
    }
  }

  infoRows(): { label: string; value: string; mono?: boolean; href?: string }[] {
    const s = this.supplier();
    if (!s) return [];
    const su = this.t().suppliers;
    return [
      ...(s.contactPerson ? [{ label: su.contactShort, value: s.contactPerson }] : []),
      ...(s.phone ? [{ label: su.phone, value: s.phone, href: `tel:${s.phone.replace(/\s+/g, '')}` }] : []),
      ...(s.email ? [{ label: su.email, value: s.email, href: `mailto:${s.email}` }] : []),
      ...(s.taxNo ? [{ label: su.taxNo, value: s.taxNo, mono: true }] : []),
      ...(s.address ? [{ label: su.address, value: s.address }] : []),
      ...(s.notes ? [{ label: su.notes, value: s.notes }] : []),
    ].filter(r => r.value);
  }
}
