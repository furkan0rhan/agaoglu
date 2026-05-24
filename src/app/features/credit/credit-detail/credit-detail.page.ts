import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Firestore, collection, query, where, onSnapshot, doc, writeBatch, serverTimestamp, increment } from '@angular/fire/firestore';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/services/auth.service';
import { CustomerService } from '../../customers/services/customer.service';
import { Customer } from '../../../shared/models/customer.model';
import { CreditTransaction } from '../../../shared/models/credit.model';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';

@Component({
  selector: 'app-credit-detail',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe, CurrencyTrPipe, ButtonModule, DialogModule, InputTextModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast position="top-right"></p-toast>

    <!-- Tahsilat dialog -->
    <p-dialog
      [header]="paymentMethod === 'cash' ? 'Nakit Tahsilat' : 'Kart ile Tahsilat'"
      [(visible)]="showPaymentDialog"
      [modal]="true"
      [closable]="true"
      [style]="{width:'340px'}"
      [draggable]="false"
    >
      <div style="display:flex; flex-direction:column; gap:14px; padding:8px 0;">
        <div>
          <p style="font-size:12px; color:#94a3b8; margin:0 0 4px;">Mevcut Borç</p>
          <p style="font-size:22px; font-weight:800; color:#ef4444; margin:0;">{{ customer()?.balance | currencyTr }}</p>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <label style="font-size:12px; font-weight:600; color:#374151;">Tahsilat Tutarı</label>
          <input pInputText type="number" [(ngModel)]="paymentAmount" placeholder="0.00" style="width:100%;" />
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <label style="font-size:12px; font-weight:600; color:#374151;">Not <span style="color:#94a3b8; font-weight:400;">(opsiyonel)</span></label>
          <input pInputText [(ngModel)]="paymentNote" placeholder="Açıklama" style="width:100%;" />
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="İptal" severity="secondary" [outlined]="true" (onClick)="showPaymentDialog = false" size="small"></p-button>
        <p-button
          label="Kaydet"
          icon="pi pi-check"
          severity="success"
          [loading]="saving()"
          [disabled]="!paymentAmount || paymentAmount <= 0"
          (onClick)="savePayment()"
          size="small"
        ></p-button>
      </ng-template>
    </p-dialog>

    <div style="display:flex; flex-direction:column; height:100%; background:#f8fafc; overflow:hidden;">

      <!-- Header -->
      <div style="background:#fff; border-bottom:1px solid #f1f5f9; padding:14px 20px; display:flex; align-items:center; gap:12px; flex-shrink:0;">
        <a routerLink="/credit" style="width:36px; height:36px; border-radius:10px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; text-decoration:none; color:#64748b; flex-shrink:0;">
          <i class="pi pi-arrow-left" style="font-size:14px;"></i>
        </a>
        @if (customer(); as c) {
          <div style="display:flex; align-items:center; gap:12px; flex:1;">
            <div style="width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg,#f87171,#dc2626); display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:14px; flex-shrink:0;">
              {{ c.firstName.charAt(0) }}{{ c.lastName.charAt(0) }}
            </div>
            <div>
              <h1 style="font-size:17px; font-weight:700; color:#1e293b; margin:0;">{{ c.firstName }} {{ c.lastName }}</h1>
              <p style="font-size:12px; color:#94a3b8; margin:0;">{{ c.phone }}</p>
            </div>
          </div>
        }
      </div>

      <!-- Content -->
      <div style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:16px; max-width:640px; width:100%;">

        @if (customer(); as c) {
          <!-- Bakiye kartı -->
          <div style="background:#fff; border-radius:20px; border:1px solid #f1f5f9; box-shadow:0 2px 12px rgba(0,0,0,0.06); overflow:hidden;">
            <div style="padding:20px 24px 16px; border-bottom:1px solid #f8fafc;">
              <p style="font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.8px; margin:0 0 6px;">Toplam Borç</p>
              <p style="font-size:34px; font-weight:800; margin:0; color:{{ c.balance > 0 ? '#ef4444' : '#16a34a' }};">{{ c.balance | currencyTr }}</p>
            </div>
            <div style="display:flex; gap:0; padding:12px 16px; gap:10px;">
              <button
                (click)="openPayment('cash')"
                style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:11px; cursor:pointer; color:#16a34a; font-size:13px; font-weight:600;"
                onmouseenter="this.style.background='#dcfce7'"
                onmouseleave="this.style.background='#f0fdf4'"
              >
                <i class="pi pi-wallet" style="font-size:14px;"></i>
                Nakit Tahsilat
              </button>
              <button
                (click)="openPayment('card')"
                style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:11px; cursor:pointer; color:#2563eb; font-size:13px; font-weight:600;"
                onmouseenter="this.style.background='#dbeafe'"
                onmouseleave="this.style.background='#eff6ff'"
              >
                <i class="pi pi-credit-card" style="font-size:14px;"></i>
                Kart Tahsilat
              </button>
            </div>
          </div>

          <!-- Hareketler -->
          <div style="background:#fff; border-radius:16px; border:1px solid #f1f5f9; box-shadow:0 2px 12px rgba(0,0,0,0.04); overflow:hidden;">
            <div style="padding:16px 20px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; justify-content:space-between;">
              <p style="font-size:14px; font-weight:700; color:#1e293b; margin:0;">Hareket Geçmişi</p>
              <span style="font-size:12px; color:#94a3b8;">{{ transactions().length }} kayıt</span>
            </div>
            @if (transactions().length === 0) {
              <div style="padding:40px; text-align:center; color:#94a3b8;">
                <i class="pi pi-list" style="font-size:32px; opacity:0.3; display:block; margin-bottom:8px;"></i>
                <p style="font-size:13px; margin:0;">Henüz hareket yok</p>
              </div>
            } @else {
              @for (tx of transactions(); track tx.id) {
                <div style="display:flex; gap:14px; padding:16px 20px; border-bottom:1px solid #f8fafc; align-items:flex-start;">

                  <!-- İkon -->
                  <div style="width:38px; height:38px; border-radius:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; margin-top:2px;"
                    [style.background]="tx.type === 'debt' ? '#fff7ed' : '#f0fdf4'">
                    <i [class]="'pi ' + (tx.type === 'debt' ? 'pi-shopping-cart' : 'pi-check-circle')"
                      style="font-size:16px;"
                      [style.color]="tx.type === 'debt' ? '#f97316' : '#16a34a'"></i>
                  </div>

                  <!-- Detay -->
                  <div style="flex:1; min-width:0;">
                    @if (tx.type === 'debt') {
                      <p style="font-size:14px; font-weight:600; color:#1e293b; margin:0 0 4px; line-height:1.5;">
                        {{ parseProducts(tx.description) }}
                      </p>
                      <p style="font-size:11px; color:#94a3b8; margin:0; font-family:monospace;">
                        {{ parseSaleRef(tx.description) }}
                      </p>
                      @if (tx.installmentCount && tx.installmentCount > 1) {
                        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
                          <span style="font-size:11px; font-weight:600; background:#fff7ed; color:#f97316; border:1px solid #fed7aa; padding:2px 8px; border-radius:6px;">
                            {{ tx.installmentCount }} Taksit · {{ tx.installmentAmount | currencyTr }}
                          </span>
                          @if (tx.interestRate) {
                            <span style="font-size:11px; font-weight:600; background:#fef2f2; color:#ef4444; border:1px solid #fecaca; padding:2px 8px; border-radius:6px;">
                              Vade Farkı %{{ tx.interestRate }}
                            </span>
                          }
                        </div>
                      }
                    } @else {
                      <p style="font-size:14px; font-weight:600; color:#1e293b; margin:0 0 4px;">
                        {{ tx.amount | currencyTr }} {{ tx.paymentMethod === 'card' ? 'kart ile' : 'nakit' }} ödendi
                      </p>
                      @if (tx.description && tx.description !== 'Nakit ödeme' && tx.description !== 'Kart ile ödeme') {
                        <p style="font-size:12px; color:#64748b; margin:0 0 4px; font-style:italic;">{{ tx.description }}</p>
                      }
                    }
                    <p style="font-size:11px; color:#94a3b8; margin:4px 0 0;">
                      {{ tx.createdAt.toDate() | date:'dd MMMM yyyy, HH:mm':'':'tr' }}
                    </p>
                  </div>

                  <!-- Tutar -->
                  <div style="text-align:right; flex-shrink:0;">
                    <p style="font-size:15px; font-weight:800; margin:0;"
                      [style.color]="tx.type === 'debt' ? '#ef4444' : '#16a34a'">
                      {{ tx.type === 'debt' ? '+' : '-' }}{{ tx.amount | currencyTr }}
                    </p>
                    @if (tx.type === 'debt' && tx.originalAmount) {
                      <p style="font-size:11px; color:#94a3b8; margin:2px 0 0; text-decoration:line-through;">
                        {{ tx.originalAmount | currencyTr }}
                      </p>
                    }
                  </div>

                </div>
              }
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class CreditDetailPage implements OnInit {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly customerSvc = inject(CustomerService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(MessageService);

  readonly customer = signal<Customer | null>(null);
  readonly transactions = signal<CreditTransaction[]>([]);
  readonly saving = signal(false);

  customerId = '';
  showPaymentDialog = false;
  paymentMethod: 'cash' | 'card' = 'cash';
  paymentAmount = 0;
  paymentNote = '';

  ngOnInit(): void {
    this.customerId = this.route.snapshot.paramMap.get('customerId') ?? this.route.snapshot.paramMap.get('id') ?? '';
    this.customerSvc.getById$(this.customerId).subscribe(c => this.customer.set(c));
    this.loadTransactions();
  }

  openPayment(method: 'cash' | 'card'): void {
    this.paymentMethod = method;
    this.paymentAmount = this.customer()?.balance ?? 0;
    this.paymentNote = '';
    this.showPaymentDialog = true;
  }

  async savePayment(): Promise<void> {
    const c = this.customer();
    if (!c || !this.paymentAmount || this.paymentAmount <= 0) return;
    this.saving.set(true);
    try {
      const batch = writeBatch(this.firestore);
      const txRef = doc(collection(this.firestore, 'creditTransactions'));
      batch.set(txRef, {
        tenantId: this.auth.currentTenantId(),
        customerId: this.customerId,
        customerName: `${c.firstName} ${c.lastName}`,
        saleId: null,
        type: 'payment',
        amount: this.paymentAmount,
        description: this.paymentNote || (this.paymentMethod === 'cash' ? 'Nakit ödeme' : 'Kart ile ödeme'),
        paymentMethod: this.paymentMethod,
        balance: Math.max(0, c.balance - this.paymentAmount),
        createdAt: serverTimestamp(),
        createdBy: this.auth.currentUserId(),
      });
      const customerRef = doc(this.firestore, 'customers', this.customerId);
      batch.update(customerRef, {
        totalPaid: increment(this.paymentAmount),
        balance: Math.max(0, c.balance - this.paymentAmount),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      const newBalance = Math.max(0, c.balance - this.paymentAmount);
      this.customer.update(cur => cur ? { ...cur, balance: newBalance } : null);
      this.toast.add({ severity: 'success', summary: '', detail: 'Tahsilat kaydedildi', life: 3000 });
      this.showPaymentDialog = false;
    } catch (err) {
      console.error(err);
      this.toast.add({ severity: 'error', summary: '', detail: 'Kayıt başarısız', life: 3000 });
    } finally {
      this.saving.set(false);
    }
  }

  parseSaleRef(description: string): string {
    const part = description.split(' · ')[0];
    return part.replace('Satış: ', '').trim();
  }

  parseProducts(description: string): string {
    const parts = description.split(' · ');
    return parts.length > 1 ? parts.slice(1).join(', ') : '-';
  }

  private loadTransactions(): void {
    const uid = this.auth.currentUserId();
    if (!uid) return;
    const q = query(
      collection(this.firestore, 'creditTransactions'),
      where('tenantId', '==', uid),
    );
    onSnapshot(q,
      snap => {
        const txs = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as CreditTransaction))
          .filter(tx => tx.customerId === this.customerId);
        txs.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        this.transactions.set(txs);
      },
      err => console.error('creditTransactions listener error:', err)
    );
  }
}
