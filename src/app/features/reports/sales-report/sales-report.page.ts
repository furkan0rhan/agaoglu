import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Firestore, collection, query, where, limit, getDocs } from '@angular/fire/firestore';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/services/auth.service';
import { Sale } from '../../../shared/models/sale.model';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { SkeletonModule } from 'primeng/skeleton';
import { ExpenseService } from '../../expenses/services/expense.service';

type Period = 'today' | 'week' | 'month';

@Component({
  selector: 'app-sales-report',
  standalone: true,
  imports: [CurrencyTrPipe, SkeletonModule, RouterLink],
  template: `
    <div class="flex flex-col h-full bg-gray-50">

      <!-- Header -->
      <div style="background:#fff; border-bottom:1px solid #f1f5f9; padding:16px 24px; display:flex; align-items:center; gap:12px; flex-shrink:0;">
        <div style="width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg,#3b82f6,#1d4ed8); display:flex; align-items:center; justify-content:center;">
          <i class="pi pi-chart-bar" style="color:white; font-size:16px;"></i>
        </div>
        <div>
          <h1 style="font-size:18px; font-weight:700; color:#1e293b; margin:0;">Raporlar</h1>
          <p style="font-size:12px; color:#64748b; margin:0;">Satış ve gelir analizleri</p>
        </div>
      </div>

      <!-- Period selector -->
      <div style="background:#fff; border-bottom:1px solid #f1f5f9; padding:12px 24px; display:flex; gap:8px; flex-shrink:0;">
        @for (p of periods; track p.value) {
          <button
            (click)="setPeriod(p.value)"
            [style]="period() === p.value
              ? 'padding:6px 18px; border-radius:20px; border:none; background:#3b82f6; color:#fff; font-size:13px; font-weight:600; cursor:pointer;'
              : 'padding:6px 18px; border-radius:20px; border:1px solid #e2e8f0; background:#fff; color:#64748b; font-size:13px; font-weight:500; cursor:pointer;'"
          >{{ p.label }}</button>
        }
      </div>

      <!-- Content -->
      <div style="flex:1; overflow-y:auto; padding:20px 24px; display:flex; flex-direction:column; gap:16px;">

        @if (loading()) {
          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px;">
            @for (i of [1,2,3]; track i) {
              <div style="background:#fff; border-radius:16px; padding:20px; border:1px solid #f1f5f9;">
                <p-skeleton height="16px" styleClass="mb-3" width="60%"></p-skeleton>
                <p-skeleton height="28px" width="80%"></p-skeleton>
              </div>
            }
          </div>
          <div style="background:#fff; border-radius:16px; padding:20px; border:1px solid #f1f5f9;">
            <p-skeleton height="16px" styleClass="mb-4" width="40%"></p-skeleton>
            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px;">
              @for (i of [1,2,3,4]; track i) {
                <p-skeleton height="80px" borderRadius="12px"></p-skeleton>
              }
            </div>
          </div>
        } @else {

          <!-- Stat cards -->
          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px;">
            <div style="background:#fff; border-radius:16px; padding:20px; border:1px solid #f1f5f9;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                <div style="width:32px; height:32px; border-radius:8px; background:#f0fdf4; display:flex; align-items:center; justify-content:center;">
                  <i class="pi pi-dollar" style="font-size:14px; color:#16a34a;"></i>
                </div>
                <span style="font-size:12px; color:#64748b; font-weight:500;">Toplam Ciro</span>
              </div>
              <p style="font-size:22px; font-weight:700; color:#1e293b; margin:0;">{{ totalRevenue() | currencyTr }}</p>
            </div>

            <div style="background:#fff; border-radius:16px; padding:20px; border:1px solid #f1f5f9;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                <div style="width:32px; height:32px; border-radius:8px; background:#eff6ff; display:flex; align-items:center; justify-content:center;">
                  <i class="pi pi-receipt" style="font-size:14px; color:#3b82f6;"></i>
                </div>
                <span style="font-size:12px; color:#64748b; font-weight:500;">İşlem Sayısı</span>
              </div>
              <p style="font-size:22px; font-weight:700; color:#1e293b; margin:0;">{{ sales().length }}</p>
            </div>

            <div style="background:#fff; border-radius:16px; padding:20px; border:1px solid #f1f5f9;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                <div style="width:32px; height:32px; border-radius:8px; background:#fff7ed; display:flex; align-items:center; justify-content:center;">
                  <i class="pi pi-wallet" style="font-size:14px; color:#f97316;"></i>
                </div>
                <span style="font-size:12px; color:#64748b; font-weight:500;">Ort. Sepet</span>
              </div>
              <p style="font-size:22px; font-weight:700; color:#1e293b; margin:0;">{{ avgBasket() | currencyTr }}</p>
            </div>
          </div>

          <!-- Kâr özeti -->
          <div style="background:#fff; border-radius:16px; padding:20px; border:1px solid #f1f5f9; display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
            <div style="flex:1; min-width:140px;">
              <p style="font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 6px;">Toplam Ciro</p>
              <p style="font-size:20px; font-weight:700; color:#1e293b; margin:0;">{{ totalRevenue() | currencyTr }}</p>
            </div>
            <i class="pi pi-minus" style="color:#cbd5e1; font-size:12px;"></i>
            <div style="flex:1; min-width:140px;">
              <div style="display:flex; align-items:center; justify-content:space-between;">
                <p style="font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 6px;">Giderler</p>
                <a routerLink="/expenses" style="font-size:11px; color:#f97316; text-decoration:none; font-weight:600;">Düzenle →</a>
              </div>
              <p style="font-size:20px; font-weight:700; color:#ea580c; margin:0;">{{ totalExpenses() | currencyTr }}</p>
            </div>
            <i class="pi pi-equals" style="color:#cbd5e1; font-size:12px;"></i>
            <div style="flex:1; min-width:140px; background:#f0fdf4; border-radius:12px; padding:12px 16px;">
              <p style="font-size:11px; font-weight:600; color:#16a34a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 6px;">Tahmini Kâr</p>
              <p style="font-size:22px; font-weight:700; margin:0;" [style.color]="profit() >= 0 ? '#15803d' : '#dc2626'">{{ profit() | currencyTr }}</p>
            </div>
          </div>

          <!-- Payment breakdown -->
          <div style="background:#fff; border-radius:16px; padding:20px; border:1px solid #f1f5f9;">
            <h3 style="font-size:14px; font-weight:600; color:#1e293b; margin:0 0 14px;">Ödeme Yöntemi Dağılımı</h3>
            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px;">
              <div style="text-align:center; padding:14px 8px; background:#f0fdf4; border-radius:12px;">
                <i class="pi pi-money-bill" style="font-size:20px; color:#16a34a; display:block; margin-bottom:6px;"></i>
                <p style="font-size:15px; font-weight:700; color:#15803d; margin:0;">{{ cashTotal() | currencyTr }}</p>
                <p style="font-size:11px; color:#16a34a; margin:4px 0 0;">Nakit</p>
              </div>
              <div style="text-align:center; padding:14px 8px; background:#eff6ff; border-radius:12px;">
                <i class="pi pi-credit-card" style="font-size:20px; color:#3b82f6; display:block; margin-bottom:6px;"></i>
                <p style="font-size:15px; font-weight:700; color:#1d4ed8; margin:0;">{{ cardTotal() | currencyTr }}</p>
                <p style="font-size:11px; color:#3b82f6; margin:4px 0 0;">Kart</p>
              </div>
              <div style="text-align:center; padding:14px 8px; background:#fef2f2; border-radius:12px;">
                <i class="pi pi-users" style="font-size:20px; color:#ef4444; display:block; margin-bottom:6px;"></i>
                <p style="font-size:15px; font-weight:700; color:#dc2626; margin:0;">{{ creditTotal() | currencyTr }}</p>
                <p style="font-size:11px; color:#ef4444; margin:4px 0 0;">Veresiye</p>
              </div>
              <div style="text-align:center; padding:14px 8px; background:#fdf4ff; border-radius:12px;">
                <i class="pi pi-sync" style="font-size:20px; color:#a855f7; display:block; margin-bottom:6px;"></i>
                <p style="font-size:15px; font-weight:700; color:#9333ea; margin:0;">{{ mixedTotal() | currencyTr }}</p>
                <p style="font-size:11px; color:#a855f7; margin:4px 0 0;">Karma</p>
              </div>
            </div>
          </div>

          <!-- Sales list -->
          <div style="background:#fff; border-radius:16px; border:1px solid #f1f5f9; overflow:hidden;">
            <div style="padding:14px 20px; border-bottom:1px solid #f1f5f9;">
              <h3 style="font-size:14px; font-weight:600; color:#1e293b; margin:0;">Satışlar ({{ sales().length }})</h3>
            </div>

            @if (sales().length === 0) {
              <div style="padding:48px 20px; text-align:center;">
                <i class="pi pi-inbox" style="font-size:40px; color:#cbd5e1; display:block; margin-bottom:12px;"></i>
                <p style="color:#94a3b8; margin:0; font-size:14px;">Bu dönemde satış bulunamadı</p>
              </div>
            } @else {
              @for (sale of sales(); track sale.id; let last = $last) {
                <div [style]="'padding:14px 20px; display:flex; align-items:center; justify-content:space-between;' + (last ? '' : 'border-bottom:1px solid #f8fafc;')">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <div [style]="'width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;' + paymentBg(sale.paymentMethod)">
                      <i [class]="'pi ' + paymentIcon(sale.paymentMethod)" [style]="'font-size:15px;' + paymentColor(sale.paymentMethod)"></i>
                    </div>
                    <div>
                      <p style="font-size:13px; font-weight:600; color:#1e293b; margin:0;">{{ sale.saleNumber }}</p>
                      <p style="font-size:11px; color:#94a3b8; margin:2px 0 0;">{{ sale.customerName || 'Peşin Müşteri' }} · {{ formatTime(sale.createdAt) }}</p>
                    </div>
                  </div>
                  <div style="text-align:right; flex-shrink:0;">
                    <p style="font-size:14px; font-weight:700; color:#1e293b; margin:0 0 3px;">{{ sale.totalAmount | currencyTr }}</p>
                    <span [style]="'font-size:11px; font-weight:600; padding:2px 8px; border-radius:6px;' + paymentBadge(sale.paymentMethod)">{{ paymentLabel(sale.paymentMethod) }}</span>
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
export class SalesReportPage implements OnInit {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly expenseSvc = inject(ExpenseService);

  readonly period = signal<Period>('today');
  readonly loading = signal(false);
  readonly sales = signal<Sale[]>([]);
  readonly allExpenses = signal<{ amount: number; date: any }[]>([]);

  readonly periods = [
    { value: 'today' as Period, label: 'Bugün' },
    { value: 'week' as Period, label: 'Bu Hafta' },
    { value: 'month' as Period, label: 'Bu Ay' },
  ];

  readonly totalRevenue = computed(() => this.sales().reduce((s, x) => s + x.totalAmount, 0));
  readonly avgBasket = computed(() => this.sales().length ? this.totalRevenue() / this.sales().length : 0);
  readonly cashTotal = computed(() => this.sales().reduce((s, x) => s + (x.cashPaid ?? 0), 0));
  readonly cardTotal = computed(() => this.sales().reduce((s, x) => s + (x.cardPaid ?? 0), 0));
  readonly creditTotal = computed(() => this.sales().reduce((s, x) => s + (x.creditAmount ?? 0), 0));
  readonly mixedTotal = computed(() => this.sales()
    .filter(x => x.paymentMethod === 'mixed')
    .reduce((s, x) => s + x.totalAmount, 0));
  readonly totalExpenses = computed(() => {
    const startMs = this.getStartDate().getTime();
    return this.allExpenses()
      .filter(e => (e.date?.toMillis?.() ?? 0) >= startMs)
      .reduce((s, e) => s + e.amount, 0);
  });
  readonly profit = computed(() => this.totalRevenue() - this.totalExpenses());

  ngOnInit(): void {
    this.load();
    this.expenseSvc.getAll$().subscribe(list => this.allExpenses.set(list));
  }

  async setPeriod(p: Period): Promise<void> {
    this.period.set(p);
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const tenantId = this.auth.currentTenantId();
      const startMs = this.getStartDate().getTime();

      const snap = await getDocs(
        query(
          collection(this.firestore, 'sales'),
          where('tenantId', '==', tenantId),
          limit(1000)
        )
      );

      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
      const filtered = all
        .filter(s => (s.createdAt?.toMillis?.() ?? 0) >= startMs)
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

      this.sales.set(filtered);
    } catch (e) {
      console.error('[Raporlar] yüklenemedi:', e);
    } finally {
      this.loading.set(false);
    }
  }

  private getStartDate(): Date {
    const d = new Date();
    if (this.period() === 'today') {
      d.setHours(0, 0, 0, 0);
    } else if (this.period() === 'week') {
      const day = d.getDay();
      const diff = day === 0 ? 6 : day - 1;
      d.setDate(d.getDate() - diff);
      d.setHours(0, 0, 0, 0);
    } else {
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
    }
    return d;
  }

  formatTime(ts: any): string {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  paymentIcon(method: string): string {
    const m: Record<string, string> = { cash: 'pi-money-bill', card: 'pi-credit-card', credit: 'pi-users', mixed: 'pi-sync' };
    return m[method] ?? 'pi-dollar';
  }

  paymentBg(method: string): string {
    const m: Record<string, string> = { cash: 'background:#f0fdf4;', card: 'background:#eff6ff;', credit: 'background:#fef2f2;', mixed: 'background:#fdf4ff;' };
    return m[method] ?? 'background:#f8fafc;';
  }

  paymentColor(method: string): string {
    const m: Record<string, string> = { cash: 'color:#16a34a;', card: 'color:#3b82f6;', credit: 'color:#ef4444;', mixed: 'color:#a855f7;' };
    return m[method] ?? 'color:#64748b;';
  }

  paymentBadge(method: string): string {
    const m: Record<string, string> = {
      cash: 'background:#f0fdf4; color:#16a34a;',
      card: 'background:#eff6ff; color:#3b82f6;',
      credit: 'background:#fef2f2; color:#ef4444;',
      mixed: 'background:#fdf4ff; color:#a855f7;',
    };
    return m[method] ?? 'background:#f1f5f9; color:#64748b;';
  }

  paymentLabel(method: string): string {
    const m: Record<string, string> = { cash: 'Nakit', card: 'Kart', credit: 'Veresiye', mixed: 'Karma' };
    return m[method] ?? method;
  }
}
