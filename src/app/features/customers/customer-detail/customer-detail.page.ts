import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { CustomerService } from '../services/customer.service';
import { Customer } from '../../../shared/models/customer.model';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { LangService } from '../../../core/i18n/lang.service';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [RouterLink, CurrencyTrPipe, ButtonModule, TooltipModule],
  template: `
    <div style="display:flex; flex-direction:column; height:100%; background:var(--bg-page); overflow:hidden;">

      <!-- Header -->
      <div style="background:var(--bg-surface); border-bottom:1px solid var(--border); padding:14px 20px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
        <div style="display:flex; align-items:center; gap:12px;">
          <a routerLink="/customers" style="width:36px; height:36px; border-radius:10px; background:var(--bg-muted); display:flex; align-items:center; justify-content:center; text-decoration:none; color:var(--text-secondary); flex-shrink:0;">
            <i class="pi pi-arrow-left" style="font-size:14px;"></i>
          </a>
          @if (customer(); as c) {
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg,#4ade80,#16a34a); display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:14px; flex-shrink:0;">
                {{ c.firstName.charAt(0).toUpperCase() }}
              </div>
              <div>
                <h1 style="font-size:17px; font-weight:700; color:var(--text-primary); margin:0;">{{ c.firstName }} {{ c.lastName }}</h1>
                <p style="font-size:12px; color:var(--text-muted); margin:0;">{{ c.phone }}</p>
              </div>
            </div>
          }
        </div>
        @if (customer()) {
          <p-button
            icon="pi pi-pencil"
            severity="secondary"
            [outlined]="true"
            size="small"
            [routerLink]="['/customers', customerId, 'edit']"
            [pTooltip]="t().common.edit"
          ></p-button>
        }
      </div>

      <!-- Content -->
      <div style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:16px; max-width:640px;">
        @if (customer(); as c) {

          <!-- Müşteri Bilgileri -->
          <div style="background:var(--bg-surface); border-radius:16px; border:1px solid var(--border); box-shadow:0 2px 12px rgba(0,0,0,0.04); overflow:hidden;">
            <div style="padding:14px 18px; border-bottom:1px solid var(--border);">
              <p style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.8px; margin:0;">{{ t().customers.customerInfo }}</p>
            </div>
            @for (row of infoRows(c); track row.label) {
              <div style="display:flex; align-items:center; gap:12px; padding:13px 18px; border-bottom:1px solid var(--border);">
                <div style="width:32px; height:32px; border-radius:8px; background:var(--bg-muted); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                  <i [class]="'pi ' + row.icon" style="font-size:13px; color:var(--text-secondary);"></i>
                </div>
                <div style="flex:1;">
                  <p style="font-size:11px; color:var(--text-muted); margin:0 0 1px;">{{ row.label }}</p>
                  <p style="font-size:14px; font-weight:500; color:var(--text-primary); margin:0;">{{ row.value }}</p>
                </div>
              </div>
            }
          </div>

          <!-- Cari Özet -->
          <div style="background:var(--bg-surface); border-radius:16px; border:1px solid var(--border); box-shadow:0 2px 12px rgba(0,0,0,0.04); overflow:hidden;">
            <div style="padding:14px 18px; border-bottom:1px solid var(--border);">
              <p style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.8px; margin:0;">{{ t().customers.accountSummary }}</p>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0;">
              <div style="padding:16px 18px; text-align:center; border-right:1px solid var(--border);">
                <p style="font-size:11px; color:var(--text-muted); margin:0 0 4px; text-transform:uppercase; letter-spacing:0.4px;">{{ t().customers.totalDebt }}</p>
                <p style="font-size:18px; font-weight:700; color:#ef4444; margin:0;">{{ c.totalDebt | currencyTr }}</p>
              </div>
              <div style="padding:16px 18px; text-align:center; border-right:1px solid var(--border);">
                <p style="font-size:11px; color:var(--text-muted); margin:0 0 4px; text-transform:uppercase; letter-spacing:0.4px;">{{ t().customers.totalPaid }}</p>
                <p style="font-size:18px; font-weight:700; color:#16a34a; margin:0;">{{ c.totalPaid | currencyTr }}</p>
              </div>
              <div style="padding:16px 18px; text-align:center;">
                <p style="font-size:11px; color:var(--text-muted); margin:0 0 4px; text-transform:uppercase; letter-spacing:0.4px;">{{ t().customers.remainingBalance }}</p>
                <p [style]="'font-size:18px; font-weight:700; margin:0; color:' + (c.balance > 0 ? '#ef4444' : '#16a34a')">{{ c.balance | currencyTr }}</p>
              </div>
            </div>
          </div>

          <!-- Notlar -->
          @if (c.notes) {
            <div style="background:#fff; border-radius:16px; border:1px solid #f1f5f9; box-shadow:0 2px 12px rgba(0,0,0,0.04); padding:16px 18px;">
              <p style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.8px; margin:0 0 8px;">{{ t().customers.notes }}</p>
              <p style="font-size:14px; color:#475569; margin:0; line-height:1.6;">{{ c.notes }}</p>
            </div>
          }

          <!-- Cari Hareketler butonu -->
          <p-button
            [label]="t().customers.viewTransactions"
            icon="pi pi-list"
            severity="info"
            [outlined]="true"
            styleClass="w-full"
            routerLink="/credit"
          ></p-button>

        } @else {
          <div style="text-align:center; padding:60px; color:var(--text-muted);">
            <i class="pi pi-spin pi-spinner" style="font-size:32px; display:block; margin-bottom:12px;"></i>
            <p style="margin:0;">{{ t().common.loading }}</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class CustomerDetailPage implements OnInit {
  private readonly svc = inject(CustomerService);
  private readonly route = inject(ActivatedRoute);
  readonly t = inject(LangService).t;

  readonly customer = signal<Customer | null>(null);
  customerId = '';

  ngOnInit(): void {
    this.customerId = this.route.snapshot.paramMap.get('id') ?? '';
    this.svc.getById$(this.customerId).subscribe(c => this.customer.set(c));
  }

  infoRows(c: Customer) {
    const cu = this.t().customers;
    return [
      { icon: 'pi-phone', label: cu.phone.replace(' *', ''), value: c.phone },
      { icon: 'pi-envelope', label: cu.email, value: c.email || '-' },
      { icon: 'pi-id-card', label: cu.tcNo, value: (c as any).tcNo || '-' },
      { icon: 'pi-map-marker', label: cu.address, value: c.address || '-' },
    ];
  }
}
