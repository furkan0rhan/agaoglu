import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { CustomerService } from '../services/customer.service';
import { Customer } from '../../../shared/models/customer.model';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { retry, timer, EMPTY } from 'rxjs';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [RouterLink, CurrencyTrPipe, ButtonModule, InputTextModule, TagModule, IconFieldModule, InputIconModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast></p-toast>
    <div class="flex flex-col h-full bg-gray-50">

      <!-- Header -->
      <div class="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <h1 class="text-xl font-bold text-gray-800">Müşteriler</h1>
        <p-button label="Yeni Müşteri" icon="pi pi-plus" [routerLink]="['new']" severity="success" size="small"></p-button>
      </div>

      <!-- Search -->
      <div class="bg-white border-b border-gray-100 px-6 py-3 flex-shrink-0">
        <p-iconfield class="w-full max-w-md">
          <p-inputicon styleClass="pi pi-search" />
          <input pInputText (input)="search($any($event.target).value)" placeholder="Ad, soyad veya telefon ara..." class="w-full text-sm" />
        </p-iconfield>
      </div>

      <!-- List -->
      <div class="flex-1 overflow-auto p-6">
        <div class="space-y-2">
          @for (c of filtered(); track c.id) {
            <a
              [routerLink]="[c.id]"
              class="bg-white rounded-2xl px-4 py-3.5 shadow-soft border border-gray-50 flex items-center gap-4 hover:shadow-card hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
            >
              <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {{ initials(c) }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-gray-800 text-sm">{{ c.firstName }} {{ c.lastName }}</p>
                <p class="text-xs text-gray-400 mt-0.5">{{ c.phone }}{{ c.email ? ' · ' + c.email : '' }}</p>
              </div>
              @if (c.balance > 0) {
                <p-tag [value]="c.balance | currencyTr" severity="danger" styleClass="text-xs"></p-tag>
              } @else {
                <i class="pi pi-chevron-right text-gray-300 text-sm"></i>
              }
            </a>
          }
          @if (filtered().length === 0) {
            <div class="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
              <i class="pi pi-users text-4xl opacity-30"></i>
              <p class="text-sm">Müşteri bulunamadı</p>
            </div>
          }
        </div>
      </div>

    </div>
  `,
})
export class CustomerListPage implements OnInit {
  private readonly svc = inject(CustomerService);
  private readonly toast = inject(MessageService);
  readonly customers = signal<Customer[]>([]);
  readonly q = signal('');

  ngOnInit(): void {
    this.svc.getAll$().pipe(
      retry({
        count: 20,
        delay: (err) => {
          if (err?.message?.includes('currently building')) return timer(5000);
          return EMPTY;
        },
      })
    ).subscribe({
      next: c => this.customers.set(c),
      error: () => this.toast.add({ severity: 'error', summary: 'Hata', detail: 'Müşteriler yüklenemedi' }),
    });
  }

  filtered() {
    const q = this.q().toLowerCase();
    if (!q) return this.customers();
    return this.customers().filter(c =>
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  }

  search(q: string) { this.q.set(q); }
  initials(c: Customer) { return `${c.firstName.charAt(0)}${c.lastName.charAt(0)}`.toUpperCase(); }
}
