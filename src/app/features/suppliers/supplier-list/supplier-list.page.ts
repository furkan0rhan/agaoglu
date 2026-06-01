import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SupplierService } from '../services/supplier.service';
import { Supplier } from '../../../shared/models/supplier.model';
import { LangService } from '../../../core/i18n/lang.service';

@Component({
  selector: 'app-supplier-list',
  standalone: true,
  imports: [RouterLink, ButtonModule, InputTextModule, IconFieldModule, InputIconModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast></p-toast>
    <div style="display:flex; flex-direction:column; height:100%; background:var(--bg-page);">

      <!-- Header -->
      <div style="background:var(--bg-surface); border-bottom:1px solid var(--border); padding:14px 24px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
        <h1 style="font-size:20px; font-weight:700; color:var(--text-primary); margin:0;">{{ t().suppliers.title }}</h1>
        <p-button [label]="t().suppliers.newSupplier" icon="pi pi-plus" [routerLink]="['new']" severity="success" size="small"></p-button>
      </div>

      <!-- Search -->
      <div style="background:var(--bg-surface); border-bottom:1px solid var(--border); padding:10px 24px; flex-shrink:0;">
        <p-iconfield style="width:100%; max-width:420px; display:block;">
          <p-inputicon styleClass="pi pi-search" />
          <input pInputText (input)="search($any($event.target).value)" [placeholder]="t().suppliers.searchPlaceholder" style="width:100%;" />
        </p-iconfield>
      </div>

      <!-- List -->
      <div style="flex:1; overflow-y:auto; padding:20px 24px;">
        <div style="display:flex; flex-direction:column; gap:8px;">
          @for (s of filtered(); track s.id) {
            <a
              [routerLink]="[s.id]"
              style="background:var(--bg-surface); border-radius:16px; padding:14px 16px; box-shadow:0 1px 4px rgba(0,0,0,0.05); border:1px solid var(--border); display:flex; align-items:center; gap:14px; text-decoration:none; transition:box-shadow 0.15s, transform 0.15s;"
              onmouseenter="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'; this.style.transform='translateY(-1px)'"
              onmouseleave="this.style.boxShadow='0 1px 4px rgba(0,0,0,0.05)'; this.style.transform='translateY(0)'"
            >
              <div style="width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg,#3b82f6,#1d4ed8); display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:14px; flex-shrink:0; letter-spacing:0.5px;">
                {{ initials(s.name) }}
              </div>
              <div style="flex:1; min-width:0;">
                <p style="font-size:14px; font-weight:600; color:var(--text-primary); margin:0 0 2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ s.name }}</p>
                <p style="font-size:12px; color:var(--text-muted); margin:0;">
                  {{ s.contactPerson ?? '' }}{{ s.contactPerson && s.phone ? ' · ' : '' }}{{ s.phone ?? '' }}
                  @if (!s.contactPerson && !s.phone) { {{ t().suppliers.noInfo }} }
                </p>
              </div>
              @if (s.taxNo) {
                <span style="font-size:11px; color:var(--text-secondary); background:var(--bg-muted); border-radius:8px; padding:3px 8px; font-family:monospace; flex-shrink:0;">{{ s.taxNo }}</span>
              }
              <i class="pi pi-chevron-right" style="color:#cbd5e1; font-size:13px; flex-shrink:0;"></i>
            </a>
          }
          @if (filtered().length === 0 && !loading()) {
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:200px; color:var(--text-muted); gap:12px;">
              <i class="pi pi-truck" style="font-size:36px; opacity:0.3;"></i>
              <p style="font-size:14px; margin:0;">{{ t().suppliers.noSuppliers }}</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class SupplierListPage implements OnInit {
  private readonly svc = inject(SupplierService);
  private readonly toast = inject(MessageService);
  readonly t = inject(LangService).t;

  readonly suppliers = signal<Supplier[]>([]);
  readonly q = signal('');
  readonly loading = signal(true);

  ngOnInit(): void {
    this.svc.getAll$().subscribe({
      next: s => { this.suppliers.set(s); this.loading.set(false); },
      error: () => {
        this.loading.set(false);
        this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().suppliers.saveFailed });
      },
    });
  }

  filtered(): Supplier[] {
    const q = this.q().toLowerCase();
    if (!q) return this.suppliers();
    return this.suppliers().filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.phone ?? '').includes(q) ||
      (s.contactPerson ?? '').toLowerCase().includes(q)
    );
  }

  search(q: string): void { this.q.set(q); }
  initials(name: string): string { return name.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase()).join('').slice(0, 2); }
}
