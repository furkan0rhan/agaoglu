import { Component, inject, OnInit, signal, computed, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CartStore } from './store/cart.store';
import { ProductStore } from '../products/store/product.store';
import { SaleService } from './services/sale.service';
import { CustomerService } from '../customers/services/customer.service';
import { CurrencyTrPipe } from '../../shared/pipes/currency-tr.pipe';
import { BarcodeInputDirective } from '../../shared/directives/barcode-input.directive';
import { Customer } from '../../shared/models/customer.model';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [
    RouterLink, FormsModule, CurrencyTrPipe, BarcodeInputDirective,
    ButtonModule, InputTextModule, IconFieldModule, InputIconModule,
    DialogModule, ToastModule,
  ],
  template: `
    <p-toast position="top-right"></p-toast>

    <!-- Cash payment dialog -->
    <p-dialog
      header="Nakit Ödeme"
      [(visible)]="showCashDialog"
      [modal]="true"
      [closable]="true"
      [style]="{width:'340px'}"
      [draggable]="false"
    >
      <div style="display:flex; flex-direction:column; gap:16px; padding:8px 0;">
        <div>
          <p style="font-size:13px; color:#64748b; margin:0 0 4px;">Toplam Tutar</p>
          <p style="font-size:24px; font-weight:700; color:#1e293b; margin:0;">{{ cart.totalAmount() | currencyTr }}</p>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <label style="font-size:13px; font-weight:600; color:#374151;">Alınan Tutar</label>
          <p-iconfield>
            <p-inputicon><span style="font-size:14px; font-weight:700; color:#64748b;">₺</span></p-inputicon>
            <input pInputText type="number" [(ngModel)]="cashAmount" [placeholder]="cart.totalAmount().toString()" style="width:100%;" />
          </p-iconfield>
        </div>
        @if (cashAmount > 0 && cashAmount >= cart.totalAmount()) {
          <div style="background:#f0fdf4; border-radius:10px; padding:10px 14px; display:flex; justify-content:space-between;">
            <span style="font-size:13px; color:#16a34a; font-weight:600;">Para Üstü</span>
            <span style="font-size:15px; font-weight:700; color:#16a34a;">{{ (cashAmount - cart.totalAmount()) | currencyTr }}</span>
          </div>
        }
      </div>
      <ng-template pTemplate="footer">
        <p-button label="İptal" severity="secondary" [outlined]="true" (onClick)="showCashDialog = false" size="small"></p-button>
        <p-button label="Tamamla" icon="pi pi-check" severity="success" (onClick)="confirmCashPayment()" size="small"></p-button>
      </ng-template>
    </p-dialog>

    <!-- Veresiye dialog -->
    <p-dialog
      header="Veresiye"
      [(visible)]="showCreditDialog"
      [modal]="true"
      [closable]="true"
      [style]="{width:'360px'}"
      [draggable]="false"
      appendTo="body"
    >
      <div style="display:flex; flex-direction:column; gap:16px; padding:8px 0;">

        <!-- Toplam tutar -->
        <div style="background:#fff7ed; border-radius:12px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:13px; color:#92400e; font-weight:600;">Sepet Tutarı</span>
          <span style="font-size:18px; font-weight:800; color:#f97316;">{{ cart.totalAmount() | currencyTr }}</span>
        </div>

        <!-- Vade farkı -->
        <div style="display:flex; flex-direction:column; gap:6px;">
          <label style="font-size:13px; font-weight:600; color:#374151;">Vade Farkı (%)</label>
          <p-iconfield>
            <p-inputicon styleClass="pi pi-percentage" />
            <input pInputText type="number" [(ngModel)]="creditInterestRate" min="0" placeholder="0" style="width:100%;" (ngModelChange)="recalcCredit()" />
          </p-iconfield>
        </div>

        <!-- Taksit sayısı -->
        <div style="display:flex; flex-direction:column; gap:6px;">
          <label style="font-size:13px; font-weight:600; color:#374151;">Taksit Sayısı</label>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            @for (n of installmentOptions; track n) {
              <button
                (click)="creditInstallments = n; recalcCredit()"
                style="padding:6px 14px; border-radius:8px; border:1px solid; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.15s;"
                [style.background]="creditInstallments === n ? '#f97316' : '#f8fafc'"
                [style.borderColor]="creditInstallments === n ? '#f97316' : '#e2e8f0'"
                [style.color]="creditInstallments === n ? 'white' : '#64748b'"
              >{{ n }}</button>
            }
            <input pInputText type="number" [(ngModel)]="creditInstallments" min="1" style="width:64px;" (ngModelChange)="recalcCredit()" />
          </div>
        </div>

        <!-- Hesaplanan tutarlar -->
        @if (creditInterestRate > 0 || creditInstallments > 1) {
          <div style="background:#f8fafc; border-radius:12px; padding:12px 16px; display:flex; flex-direction:column; gap:8px;">
            @if (creditInterestRate > 0) {
              <div style="display:flex; justify-content:space-between;">
                <span style="font-size:13px; color:#64748b;">Vade Farkı</span>
                <span style="font-size:13px; font-weight:600; color:#ef4444;">+{{ creditInterestAmount | currencyTr }}</span>
              </div>
            }
            <div style="display:flex; justify-content:space-between; border-top:1px solid #e2e8f0; padding-top:8px;">
              <span style="font-size:13px; color:#64748b;">Toplam (faizli)</span>
              <span style="font-size:15px; font-weight:700; color:#1e293b;">{{ creditTotalWithInterest | currencyTr }}</span>
            </div>
            @if (creditInstallments > 1) {
              <div style="display:flex; justify-content:space-between;">
                <span style="font-size:13px; color:#64748b;">{{ creditInstallments }} × Taksit</span>
                <span style="font-size:15px; font-weight:700; color:#f97316;">{{ creditInstallmentAmount | currencyTr }}</span>
              </div>
            }
          </div>
        }
      </div>

      <ng-template pTemplate="footer">
        <p-button label="İptal" severity="secondary" [outlined]="true" (onClick)="showCreditDialog = false" size="small"></p-button>
        <p-button label="Tamamla" icon="pi pi-check" severity="warn" (onClick)="confirmCreditPayment()" size="small"></p-button>
      </ng-template>
    </p-dialog>

    <!-- Customer select dialog -->
    <p-dialog
      header="Müşteri Seç"
      [(visible)]="showCustomerDialog"
      [modal]="true"
      [closable]="true"
      [style]="{width:'380px'}"
      [draggable]="false"
    >
      <div style="display:flex; flex-direction:column; gap:12px; padding:8px 0;">
        <p-iconfield style="width:100%;">
          <p-inputicon styleClass="pi pi-search" />
          <input pInputText type="text" [(ngModel)]="customerSearch" placeholder="Ad veya telefon ara..." style="width:100%;" />
        </p-iconfield>
        <div style="max-height:300px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
          @for (c of filteredCustomers(); track c.id) {
            <button
              (click)="selectCustomer(c)"
              style="display:flex; align-items:center; gap:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; cursor:pointer; text-align:left; width:100%;"
              onmouseenter="this.style.background='#f0fdf4'; this.style.borderColor='#bbf7d0'"
              onmouseleave="this.style.background='#f8fafc'; this.style.borderColor='#e2e8f0'"
            >
              <div style="width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,#4ade80,#16a34a); display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:13px; flex-shrink:0;">
                {{ c.firstName.charAt(0) }}{{ c.lastName.charAt(0) }}
              </div>
              <div style="flex:1; min-width:0;">
                <p style="font-size:14px; font-weight:600; color:#1e293b; margin:0;">{{ c.firstName }} {{ c.lastName }}</p>
                <p style="font-size:12px; color:#94a3b8; margin:0;">{{ c.phone }}</p>
              </div>
              @if (c.balance > 0) {
                <span style="font-size:11px; color:#ef4444; font-weight:600; background:#fef2f2; padding:2px 8px; border-radius:6px;">{{ c.balance | currencyTr }}</span>
              }
            </button>
          }
          @if (filteredCustomers().length === 0) {
            <div style="text-align:center; padding:32px; color:#94a3b8;">
              <i class="pi pi-users" style="font-size:28px; opacity:0.4; display:block; margin-bottom:8px;"></i>
              <p style="font-size:13px; margin:0;">Müşteri bulunamadı</p>
            </div>
          }
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="İptal" severity="secondary" [outlined]="true" (onClick)="showCustomerDialog = false" size="small"></p-button>
      </ng-template>
    </p-dialog>

    <!-- Main -->
    <div appBarcodeInput (barcodeDetected)="onBarcodeDetected($event)" style="display:flex; flex-direction:column; height:100%; background:#f8fafc;">

      <!-- Header -->
      <div style="background:#fff; border-bottom:1px solid #f1f5f9; padding:14px 20px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg,#f97316,#ea580c); display:flex; align-items:center; justify-content:center;">
            <i class="pi pi-shopping-cart" style="color:white; font-size:16px;"></i>
          </div>
          <div>
            <h1 style="font-size:18px; font-weight:700; color:#1e293b; margin:0;">Sepet</h1>
            <p style="font-size:12px; color:#64748b; margin:0;">{{ cart.itemCount() }} ürün · {{ cart.totalAmount() | currencyTr }}</p>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          @if (cart.customerId()) {
            <button
              (click)="clearCustomer()"
              style="display:flex; align-items:center; gap:6px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:20px; padding:6px 12px; cursor:pointer; color:#16a34a; font-size:13px; font-weight:600;"
            >
              <i class="pi pi-user" style="font-size:12px;"></i>
              {{ cart.customerName() }}
              <i class="pi pi-times" style="font-size:11px; color:#86efac;"></i>
            </button>
          } @else {
            <p-button label="Müşteri Seç" icon="pi pi-user" severity="secondary" [outlined]="true" size="small" (onClick)="showCustomerDialog = true"></p-button>
          }
          @if (cart.items().length > 0) {
            <button
              (click)="cart.clearCart()"
              style="display:flex; align-items:center; gap:5px; background:#fef2f2; border:none; border-radius:10px; padding:7px 12px; cursor:pointer; color:#ef4444; font-size:12px; font-weight:600;"
            >
              <i class="pi pi-trash" style="font-size:12px;"></i>
              Temizle
            </button>
          }
        </div>
      </div>

      <!-- Body -->
      @if (cart.items().length === 0) {
        <!-- Empty state -->
        <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; color:#94a3b8;">
          <i class="pi pi-shopping-cart" style="font-size:56px; opacity:0.25;"></i>
          <div style="text-align:center;">
            <p style="font-size:16px; font-weight:600; margin:0 0 4px; color:#64748b;">Sepet boş</p>
            <p style="font-size:13px; margin:0;">Ürünler sayfasından ürün ekleyebilirsiniz</p>
          </div>
          <a routerLink="/products" style="display:flex; align-items:center; gap:6px; background:#f97316; color:white; text-decoration:none; border-radius:10px; padding:10px 20px; font-size:14px; font-weight:600;">
            <i class="pi pi-box"></i>
            Ürünlere Git
          </a>
        </div>
      } @else {
        <div [style]="isMobile() ? 'flex:1; display:flex; flex-direction:column; overflow:hidden;' : 'flex:1; display:flex; overflow:hidden;'">

          <!-- Ürünler listesi -->
          <div [style]="isMobile() ? 'flex:1; overflow-y:auto; padding:10px 12px; display:flex; flex-direction:column; gap:8px;' : 'flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:8px;'">
            @for (item of cart.items(); track item._tempId) {
              <div style="display:flex; align-items:center; gap:10px; background:#fff; border:1px solid #f1f5f9; border-radius:14px; padding:10px 12px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                @if (!isMobile()) {
                  <div style="width:40px; height:40px; border-radius:10px; background:#fff7ed; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <i class="pi pi-box" style="font-size:16px; color:#f97316;"></i>
                  </div>
                }
                <div style="flex:1; min-width:0;">
                  <p style="font-size:14px; font-weight:600; color:#1e293b; margin:0 0 2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ item.productName }}</p>
                  <p style="font-size:12px; color:#94a3b8; margin:0;">{{ item.unitPrice | currencyTr }} / adet</p>
                </div>
                <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                  <button
                    (click)="cart.updateQuantity(item._tempId, item.quantity - 1)"
                    style="width:30px; height:30px; border-radius:8px; border:1px solid #e2e8f0; background:#f8fafc; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#64748b;"
                  ><i class="pi pi-minus" style="font-size:11px;"></i></button>
                  <span style="font-size:15px; font-weight:700; color:#1e293b; min-width:24px; text-align:center;">{{ item.quantity }}</span>
                  <button
                    (click)="cart.updateQuantity(item._tempId, item.quantity + 1)"
                    style="width:30px; height:30px; border-radius:8px; border:1px solid #e2e8f0; background:#f8fafc; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#64748b;"
                  ><i class="pi pi-plus" style="font-size:11px;"></i></button>
                </div>
                <p style="font-size:14px; font-weight:700; color:#1e293b; margin:0; min-width:64px; text-align:right;">{{ item.totalPrice | currencyTr }}</p>
                <button
                  (click)="cart.updateQuantity(item._tempId, 0)"
                  style="width:28px; height:28px; border-radius:8px; border:none; background:#fef2f2; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#ef4444; flex-shrink:0;"
                ><i class="pi pi-trash" style="font-size:12px;"></i></button>
              </div>
            }
          </div>

          <!-- Sağ panel (masaüstü) -->
          @if (!isMobile()) {
            <div style="width:320px; flex-shrink:0; display:flex; flex-direction:column; background:#fff; border-left:1px solid #f1f5f9;">
              <div style="padding:20px 20px 16px; border-bottom:1px solid #f1f5f9;">
                <p style="font-size:13px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 12px;">Sipariş Özeti</p>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                  <span style="font-size:13px; color:#64748b;">Ara Toplam</span>
                  <span style="font-size:13px; color:#1e293b; font-weight:500;">{{ cart.subtotal() | currencyTr }}</span>
                </div>
                @if (cart.itemsDiscount() > 0) {
                  <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="font-size:13px; color:#16a34a;">İndirim</span>
                    <span style="font-size:13px; color:#16a34a; font-weight:600;">-{{ cart.itemsDiscount() | currencyTr }}</span>
                  </div>
                }
                <div style="display:flex; justify-content:space-between; border-top:2px solid #f1f5f9; margin-top:10px; padding-top:10px;">
                  <span style="font-size:17px; font-weight:700; color:#1e293b;">Toplam</span>
                  <span style="font-size:20px; font-weight:800; color:#f97316;">{{ cart.totalAmount() | currencyTr }}</span>
                </div>
              </div>
              <div style="padding:16px; display:flex; flex-direction:column; gap:10px; flex:1; justify-content:flex-end;">
                <button (click)="pay('cash')" style="display:flex; align-items:center; justify-content:center; gap:8px; background:linear-gradient(135deg,#22c55e,#16a34a); color:white; border:none; border-radius:12px; padding:14px; cursor:pointer; font-size:15px; font-weight:700;">
                  <i class="pi pi-wallet" style="font-size:16px;"></i> Nakit Ödeme
                </button>
                <button (click)="pay('card')" style="display:flex; align-items:center; justify-content:center; gap:8px; background:linear-gradient(135deg,#3b82f6,#2563eb); color:white; border:none; border-radius:12px; padding:14px; cursor:pointer; font-size:15px; font-weight:700;">
                  <i class="pi pi-credit-card" style="font-size:16px;"></i> Kart ile Öde
                </button>
                <button (click)="payCredit()" style="display:flex; align-items:center; justify-content:center; gap:8px; background:linear-gradient(135deg,#f97316,#ea580c); color:white; border:none; border-radius:12px; padding:14px; cursor:pointer; font-size:15px; font-weight:700;">
                  <i class="pi pi-user" style="font-size:16px;"></i> Veresiye
                </button>
              </div>
            </div>
          }

          <!-- Alt panel (mobil) -->
          @if (isMobile()) {
            <div style="background:#fff; border-top:1px solid #f1f5f9; box-shadow:0 -4px 16px rgba(0,0,0,0.08); padding:12px 16px; flex-shrink:0;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-size:14px; color:#64748b;">
                  {{ cart.itemCount() }} ürün
                  @if (cart.itemsDiscount() > 0) { · <span style="color:#16a34a;">-{{ cart.itemsDiscount() | currencyTr }}</span> }
                </span>
                <span style="font-size:20px; font-weight:800; color:#f97316;">{{ cart.totalAmount() | currencyTr }}</span>
              </div>
              <div style="display:flex; gap:8px;">
                <button (click)="pay('cash')" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; background:linear-gradient(135deg,#22c55e,#16a34a); color:white; border:none; border-radius:12px; padding:13px 8px; cursor:pointer; font-size:13px; font-weight:700;">
                  <i class="pi pi-wallet" style="font-size:14px;"></i> Nakit
                </button>
                <button (click)="pay('card')" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; background:linear-gradient(135deg,#3b82f6,#2563eb); color:white; border:none; border-radius:12px; padding:13px 8px; cursor:pointer; font-size:13px; font-weight:700;">
                  <i class="pi pi-credit-card" style="font-size:14px;"></i> Kart
                </button>
                <button (click)="payCredit()" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; background:linear-gradient(135deg,#f97316,#ea580c); color:white; border:none; border-radius:12px; padding:13px 8px; cursor:pointer; font-size:13px; font-weight:700;">
                  <i class="pi pi-user" style="font-size:14px;"></i> Veresiye
                </button>
              </div>
            </div>
          }

        </div>
      }
    </div>
  `,
})
export class PosPage implements OnInit {
  readonly cart = inject(CartStore);
  private readonly productStore = inject(ProductStore);
  private readonly customerSvc = inject(CustomerService);
  private readonly saleSvc = inject(SaleService);
  private readonly messageSvc = inject(MessageService);

  private windowWidth = signal(window.innerWidth);
  readonly isMobile = computed(() => this.windowWidth() < 768);

  @HostListener('window:resize')
  onResize() { this.windowWidth.set(window.innerWidth); }

  readonly customers = signal<Customer[]>([]);
  customerSearch = '';
  showCashDialog = false;
  cashAmount = 0;
  _pendingCredit = false;
  showCustomerDialog = false;
  showCreditDialog = false;
  creditInterestRate = 0;
  creditInstallments = 1;
  readonly installmentOptions = [1, 2, 3, 6, 9, 12];

  creditInterestAmount = 0;
  creditTotalWithInterest = 0;
  creditInstallmentAmount = 0;

  recalcCredit(): void {
    const total = this.cart.totalAmount();
    this.creditInterestAmount = total * (this.creditInterestRate / 100);
    this.creditTotalWithInterest = total + this.creditInterestAmount;
    this.creditInstallmentAmount = this.creditInstallments > 0
      ? this.creditTotalWithInterest / this.creditInstallments
      : this.creditTotalWithInterest;
  }

  ngOnInit(): void {
    this.productStore.loadProducts();
    this.customerSvc.getAll$().subscribe(c => this.customers.set(c));
  }

  filteredCustomers(): Customer[] {
    const q = this.customerSearch.toLowerCase();
    if (!q) return this.customers();
    return this.customers().filter(c =>
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  }

  selectCustomer(c: Customer): void {
    this.cart.setCustomer(c.id, `${c.firstName} ${c.lastName}`);
    this.showCustomerDialog = false;
    this.customerSearch = '';
    if (this._pendingCredit) {
      this._pendingCredit = false;
      this.pay('credit');
    }
  }

  onBarcodeDetected(barcode: string): void {
    const product = this.productStore.findByBarcode(barcode);
    if (product && product.stock > 0) {
      this.cart.addItem({
        productId: product.id,
        productName: product.name,
        barcode: product.barcode,
        quantity: 1,
        unitPrice: product.salePrice,
        discount: 0,
        discountType: 'percent',
        totalPrice: product.salePrice,
      });
      this.toast(`${product.name} eklendi`, 'success');
    } else {
      this.toast(`Barkod bulunamadı: ${barcode}`, 'warn');
    }
  }

  payCredit(): void {
    if (!this.cart.customerId()) {
      this.showCustomerDialog = true;
      this._pendingCredit = true;
      return;
    }
    this.pay('credit');
  }

  pay(method: 'cash' | 'card' | 'credit'): void {
    if (method === 'cash') {
      this.cashAmount = this.cart.totalAmount();
      this.showCashDialog = true;
    } else if (method === 'card') {
      this.cart.setPayment('card', 0, this.cart.totalAmount());
      this.completeSale();
    } else if (method === 'credit') {
      this.creditInterestRate = 0;
      this.creditInstallments = 1;
      this.recalcCredit();
      this.showCreditDialog = true;
    }
  }

  confirmCreditPayment(): void {
    this.cart.setPayment('credit', 0, 0);
    this.showCreditDialog = false;
    this.completeSale({
      interestRate: this.creditInterestRate || null,
      installmentCount: this.creditInstallments > 1 ? this.creditInstallments : null,
      installmentAmount: this.creditInstallments > 1 ? this.creditInstallmentAmount : null,
      totalWithInterest: this.creditInterestRate > 0 ? this.creditTotalWithInterest : null,
    });
  }

  confirmCashPayment(): void {
    const amount = this.cashAmount || this.cart.totalAmount();
    this.cart.setPayment('cash', amount, 0);
    this.showCashDialog = false;
    this.completeSale();
  }

  clearCustomer(): void {
    this.cart.setCustomer(null, null);
  }

  private async completeSale(creditOptions?: { interestRate: number | null; installmentCount: number | null; installmentAmount: number | null; totalWithInterest: number | null }): Promise<void> {
    try {
      await this.saleSvc.completeSale(creditOptions);
      this.toast('Satış tamamlandı!', 'success');
    } catch (err) {
      console.error('completeSale error:', err);
      this.toast('Satış kaydedilemedi!', 'error');
    }
  }

  private toast(message: string, severity: 'success' | 'error' | 'warn'): void {
    this.messageSvc.add({ severity, summary: '', detail: message, life: 2500 });
  }
}
