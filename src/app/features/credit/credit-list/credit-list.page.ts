import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { CustomerService } from '../../customers/services/customer.service';
import { Customer } from '../../../shared/models/customer.model';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';

@Component({
  selector: 'app-credit-list',
  standalone: true,
  imports: [RouterLink, CurrencyTrPipe, ButtonModule, InputTextModule, TagModule, IconFieldModule, InputIconModule],
  template: `
    <div class="flex flex-col h-full bg-gray-50">

      <!-- Header -->
      <div class="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
        <h1 class="text-xl font-bold text-gray-800">Veresiye / Cari</h1>
        <p class="text-sm text-gray-400 mt-0.5">{{ debtors().length }} müşteri borçlu</p>
      </div>

      <!-- Search -->
      <div class="bg-white border-b border-gray-100 px-6 py-3 flex-shrink-0">
        <p-iconfield class="w-full max-w-md">
          <p-inputicon styleClass="pi pi-search" />
          <input pInputText (input)="search($any($event.target).value)" placeholder="Müşteri ara..." class="w-full text-sm" />
        </p-iconfield>
      </div>

      <!-- List -->
      <div class="flex-1 overflow-auto p-6">
        <div class="space-y-2">
          @for (c of debtors(); track c.id) {
            <a
              [routerLink]="[c.id]"
              class="bg-white rounded-2xl px-4 py-3.5 shadow-soft border border-gray-50 flex items-center gap-4 hover:shadow-card hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
            >
              <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {{ initials(c) }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-gray-800 text-sm">{{ c.firstName }} {{ c.lastName }}</p>
                <p class="text-xs text-gray-400 mt-0.5">{{ c.phone }}</p>
              </div>
              <div class="text-right flex-shrink-0">
                <p class="text-xs text-gray-400 mb-1">Borç</p>
                <p-tag [value]="c.balance | currencyTr" severity="danger" styleClass="text-xs font-bold"></p-tag>
              </div>
            </a>
          }
          @if (debtors().length === 0) {
            <div class="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
              <i class="pi pi-check-circle text-4xl text-green-300"></i>
              <p class="text-sm">Veresiyeli müşteri yok</p>
            </div>
          }
        </div>
      </div>

    </div>
  `,
})
export class CreditListPage implements OnInit {
  private readonly svc = inject(CustomerService);
  readonly customers = signal<Customer[]>([]);
  readonly q = signal('');

  ngOnInit(): void { this.svc.getAll$().subscribe(c => this.customers.set(c)); }

  debtors() {
    const q = this.q().toLowerCase();
    return this.customers()
      .filter(c => c.balance > 0 && (!q || c.firstName.toLowerCase().includes(q) || c.lastName.toLowerCase().includes(q) || c.phone.includes(q)))
      .sort((a, b) => b.balance - a.balance);
  }

  initials(c: Customer) { return `${c.firstName.charAt(0)}${c.lastName.charAt(0)}`.toUpperCase(); }
  search(q: string) { this.q.set(q); }
}
