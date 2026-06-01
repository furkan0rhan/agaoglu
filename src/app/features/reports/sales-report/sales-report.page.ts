import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Firestore, collection, query, where, limit, getDocs } from '@angular/fire/firestore';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/services/auth.service';
import { Sale } from '../../../shared/models/sale.model';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { SkeletonModule } from 'primeng/skeleton';
import { ChartModule } from 'primeng/chart';
import { ExpenseService } from '../../expenses/services/expense.service';
import { LangService } from '../../../core/i18n/lang.service';

type Period = 'today' | 'week' | 'month';

@Component({
  selector: 'app-sales-report',
  standalone: true,
  imports: [CurrencyTrPipe, SkeletonModule, RouterLink, ChartModule],
  template: `
    <div class="flex flex-col h-full bg-gray-50">

      <!-- Header -->
      <div style="background:var(--bg-surface); border-bottom:1px solid var(--border); padding:16px 24px; display:flex; align-items:center; gap:12px; flex-shrink:0;">
        <div style="width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg,#3b82f6,#1d4ed8); display:flex; align-items:center; justify-content:center;">
          <i class="pi pi-chart-bar" style="color:white; font-size:16px;"></i>
        </div>
        <div>
          <h1 style="font-size:18px; font-weight:700; color:var(--text-primary); margin:0;">{{ t().reports.title }}</h1>
          <p style="font-size:12px; color:var(--text-secondary); margin:0;">{{ t().reports.subtitle }}</p>
        </div>
      </div>

      <!-- Period selector -->
      <div style="background:var(--bg-surface); border-bottom:1px solid var(--border); padding:12px 24px; display:flex; gap:8px; flex-shrink:0;">
        @for (p of periods(); track p.value) {
          <button
            (click)="setPeriod(p.value)"
            [style]="period() === p.value
              ? 'padding:6px 18px; border-radius:20px; border:none; background:#3b82f6; color:#fff; font-size:13px; font-weight:600; cursor:pointer;'
              : 'padding:6px 18px; border-radius:20px; border:1px solid var(--border-mid); background:var(--bg-surface); color:var(--text-secondary); font-size:13px; font-weight:500; cursor:pointer;'"
          >{{ p.label }}</button>
        }
      </div>

      <!-- Content -->
      <div style="flex:1; overflow-y:auto; padding:20px 24px; display:flex; flex-direction:column; gap:16px;">

        @if (loading()) {
          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px;">
            @for (i of [1,2,3]; track i) {
              <div style="background:var(--bg-surface); border-radius:16px; padding:20px; border:1px solid var(--border);">
                <p-skeleton height="16px" styleClass="mb-3" width="60%"></p-skeleton>
                <p-skeleton height="28px" width="80%"></p-skeleton>
              </div>
            }
          </div>
        } @else {

          <!-- Stat cards -->
          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px;">
            <div style="background:var(--bg-surface); border-radius:16px; padding:20px; border:1px solid var(--border);">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                <div style="width:32px; height:32px; border-radius:8px; background:#f0fdf4; display:flex; align-items:center; justify-content:center;">
                  <i class="pi pi-dollar" style="font-size:14px; color:#16a34a;"></i>
                </div>
                <span style="font-size:12px; color:var(--text-secondary); font-weight:500;">{{ t().reports.totalRevenue }}</span>
              </div>
              <p style="font-size:22px; font-weight:700; color:var(--text-primary); margin:0;">{{ totalRevenue() | currencyTr }}</p>
            </div>

            <div style="background:var(--bg-surface); border-radius:16px; padding:20px; border:1px solid var(--border);">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                <div style="width:32px; height:32px; border-radius:8px; background:#eff6ff; display:flex; align-items:center; justify-content:center;">
                  <i class="pi pi-receipt" style="font-size:14px; color:#3b82f6;"></i>
                </div>
                <span style="font-size:12px; color:var(--text-secondary); font-weight:500;">{{ t().reports.saleCount }}</span>
              </div>
              <p style="font-size:22px; font-weight:700; color:var(--text-primary); margin:0;">{{ sales().length }}</p>
            </div>

            <div style="background:var(--bg-surface); border-radius:16px; padding:20px; border:1px solid var(--border);">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                <div style="width:32px; height:32px; border-radius:8px; background:#fff7ed; display:flex; align-items:center; justify-content:center;">
                  <i class="pi pi-wallet" style="font-size:14px; color:#f97316;"></i>
                </div>
                <span style="font-size:12px; color:var(--text-secondary); font-weight:500;">{{ t().reports.avgSale }}</span>
              </div>
              <p style="font-size:22px; font-weight:700; color:var(--text-primary); margin:0;">{{ avgBasket() | currencyTr }}</p>
            </div>
          </div>

          <!-- Satış Trendi -->
          <div style="background:var(--bg-surface); border-radius:16px; padding:20px; border:1px solid var(--border);">
            <h3 style="font-size:14px; font-weight:600; color:var(--text-primary); margin:0 0 16px;">
              {{ t().reports.salesTrend }}
              <span style="font-size:11px; font-weight:400; color:var(--text-muted); margin-left:8px;">{{ trendLabel() }}</span>
            </h3>
            <p-chart type="bar" [data]="trendChartData()" [options]="trendChartOptions" style="display:block;" />
          </div>

          <!-- Kâr özeti -->
          <div style="background:var(--bg-surface); border-radius:16px; padding:20px; border:1px solid var(--border); display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
            <div style="flex:1; min-width:140px;">
              <p style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin:0 0 6px;">{{ t().reports.totalRevenue }}</p>
              <p style="font-size:20px; font-weight:700; color:var(--text-primary); margin:0;">{{ totalRevenue() | currencyTr }}</p>
            </div>
            <i class="pi pi-minus" style="color:#cbd5e1; font-size:12px;"></i>
            <div style="flex:1; min-width:140px;">
              <div style="display:flex; align-items:center; justify-content:space-between;">
                <p style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin:0 0 6px;">{{ t().reports.expenseTotal }}</p>
                <a routerLink="/expenses" style="font-size:11px; color:#f97316; text-decoration:none; font-weight:600;">→</a>
              </div>
              <p style="font-size:20px; font-weight:700; color:#ea580c; margin:0;">{{ totalExpenses() | currencyTr }}</p>
            </div>
            <i class="pi pi-equals" style="color:#cbd5e1; font-size:12px;"></i>
            <div style="flex:1; min-width:140px; background:#f0fdf4; border-radius:12px; padding:12px 16px;">
              <p style="font-size:11px; font-weight:600; color:#16a34a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 6px;">{{ t().reports.netProfit }}</p>
              <p style="font-size:22px; font-weight:700; margin:0;" [style.color]="profit() >= 0 ? '#15803d' : '#dc2626'">{{ profit() | currencyTr }}</p>
            </div>
          </div>

          <!-- Payment breakdown + Doughnut -->
          <div style="background:var(--bg-surface); border-radius:16px; padding:20px; border:1px solid var(--border); display:flex; gap:24px; align-items:center; flex-wrap:wrap;">
            <div style="flex:1; min-width:240px;">
              <h3 style="font-size:14px; font-weight:600; color:var(--text-primary); margin:0 0 14px;">{{ t().reports.paymentTypes }}</h3>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div style="text-align:center; padding:14px 8px; background:#f0fdf4; border-radius:12px;">
                  <i class="pi pi-money-bill" style="font-size:20px; color:#16a34a; display:block; margin-bottom:6px;"></i>
                  <p style="font-size:15px; font-weight:700; color:#15803d; margin:0;">{{ cashTotal() | currencyTr }}</p>
                  <p style="font-size:11px; color:#16a34a; margin:4px 0 0;">{{ t().reports.cash }}</p>
                </div>
                <div style="text-align:center; padding:14px 8px; background:#eff6ff; border-radius:12px;">
                  <i class="pi pi-credit-card" style="font-size:20px; color:#3b82f6; display:block; margin-bottom:6px;"></i>
                  <p style="font-size:15px; font-weight:700; color:#1d4ed8; margin:0;">{{ cardTotal() | currencyTr }}</p>
                  <p style="font-size:11px; color:#3b82f6; margin:4px 0 0;">{{ t().reports.card }}</p>
                </div>
                <div style="text-align:center; padding:14px 8px; background:#fef2f2; border-radius:12px;">
                  <i class="pi pi-users" style="font-size:20px; color:#ef4444; display:block; margin-bottom:6px;"></i>
                  <p style="font-size:15px; font-weight:700; color:#dc2626; margin:0;">{{ creditTotal() | currencyTr }}</p>
                  <p style="font-size:11px; color:#ef4444; margin:4px 0 0;">{{ t().reports.credit }}</p>
                </div>
                <div style="text-align:center; padding:14px 8px; background:#fdf4ff; border-radius:12px;">
                  <i class="pi pi-sync" style="font-size:20px; color:#a855f7; display:block; margin-bottom:6px;"></i>
                  <p style="font-size:15px; font-weight:700; color:#9333ea; margin:0;">{{ mixedTotal() | currencyTr }}</p>
                  <p style="font-size:11px; color:#a855f7; margin:4px 0 0;">{{ t().reports.mixed }}</p>
                </div>
              </div>
            </div>
            @if (totalRevenue() > 0) {
              <div style="width:200px; flex-shrink:0; display:flex; justify-content:center;">
                <p-chart type="doughnut" [data]="paymentChartData()" [options]="paymentChartOptions" style="width:180px;" />
              </div>
            }
          </div>

          <!-- Sales list -->
          <div style="background:var(--bg-surface); border-radius:16px; border:1px solid var(--border); overflow:hidden;">
            <div style="padding:14px 20px; border-bottom:1px solid var(--border);">
              <h3 style="font-size:14px; font-weight:600; color:var(--text-primary); margin:0;">{{ t().reports.sale }} ({{ sales().length }})</h3>
            </div>

            @if (sales().length === 0) {
              <div style="padding:48px 20px; text-align:center;">
                <i class="pi pi-inbox" style="font-size:40px; color:#cbd5e1; display:block; margin-bottom:12px;"></i>
                <p style="color:var(--text-muted); margin:0; font-size:14px;">{{ t().reports.noData }}</p>
              </div>
            } @else {
              @for (sale of sales(); track sale.id; let last = $last) {
                <div [style]="'padding:14px 20px; display:flex; align-items:center; justify-content:space-between;' + (last ? '' : 'border-bottom:1px solid var(--border);')">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <div [style]="'width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;' + paymentBg(sale.paymentMethod)">
                      <i [class]="'pi ' + paymentIcon(sale.paymentMethod)" [style]="'font-size:15px;' + paymentColor(sale.paymentMethod)"></i>
                    </div>
                    <div>
                      <p style="font-size:13px; font-weight:600; color:var(--text-primary); margin:0;">{{ sale.saleNumber }}</p>
                      <p style="font-size:11px; color:var(--text-muted); margin:2px 0 0;">{{ sale.customerName || t().reports.cashCustomer }} · {{ formatTime(sale.createdAt) }}</p>
                    </div>
                  </div>
                  <div style="text-align:right; flex-shrink:0;">
                    <p style="font-size:14px; font-weight:700; color:var(--text-primary); margin:0 0 3px;">{{ (sale.totalWithInterest ?? sale.totalAmount) | currencyTr }}</p>
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
  readonly t = inject(LangService).t;

  readonly period = signal<Period>('today');
  readonly loading = signal(false);
  readonly sales = signal<Sale[]>([]);
  readonly allExpenses = signal<{ amount: number; date: any }[]>([]);

  readonly periods = computed(() => {
    const r = this.t().reports;
    return [
      { value: 'today' as Period, label: r.today },
      { value: 'week' as Period, label: r.thisWeek },
      { value: 'month' as Period, label: r.thisMonth },
    ];
  });

  private effectiveAmount(s: Sale): number { return s.totalWithInterest ?? s.totalAmount; }
  readonly totalRevenue = computed(() => this.sales().reduce((sum, x) => sum + this.effectiveAmount(x), 0));
  readonly avgBasket = computed(() => this.sales().length ? this.totalRevenue() / this.sales().length : 0);
  readonly cashTotal = computed(() => this.sales().reduce((s, x) => s + (x.cashPaid ?? 0), 0));
  readonly cardTotal = computed(() => this.sales().reduce((s, x) => s + (x.cardPaid ?? 0), 0));
  readonly creditTotal = computed(() => this.sales().filter(x => x.paymentMethod === 'credit').reduce((s, x) => s + this.effectiveAmount(x), 0));
  readonly mixedTotal = computed(() => this.sales()
    .filter(x => x.paymentMethod === 'mixed')
    .reduce((s, x) => s + this.effectiveAmount(x), 0));
  readonly trendLabel = computed(() => {
    const r = this.t().reports;
    const map: Record<Period, string> = { today: r.hourly, week: r.daily, month: r.daily };
    return map[this.period()];
  });

  readonly trendChartData = computed(() => {
    const p = this.period();
    const salesList = this.sales();
    let labels: string[] = [];
    let values: number[] = [];

    if (p === 'today') {
      labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
      values = Array(24).fill(0);
      salesList.forEach(s => {
        const h = s.createdAt?.toDate?.()?.getHours?.() ?? 0;
        values[h] += s.totalAmount;
      });
    } else if (p === 'week') {
      labels = this.t().reports.weekDays.split(',');
      values = Array(7).fill(0);
      salesList.forEach(s => {
        const d = s.createdAt?.toDate?.();
        if (!d) return;
        const day = d.getDay();
        const idx = day === 0 ? 6 : day - 1;
        values[idx] += s.totalAmount;
      });
    } else {
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
      values = Array(daysInMonth).fill(0);
      salesList.forEach(s => {
        const d = s.createdAt?.toDate?.();
        if (!d) return;
        values[d.getDate() - 1] += s.totalAmount;
      });
    }

    return {
      labels,
      datasets: [{
        label: this.t().reports.chartSales + ' (₺)',
        data: values,
        backgroundColor: 'rgba(22, 163, 74, 0.15)',
        borderColor: '#16a34a',
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: 'rgba(22, 163, 74, 0.3)',
      }],
    };
  });

  readonly trendChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `₺${ctx.raw.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#94a3b8' } },
      y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 }, color: '#94a3b8', callback: (v: any) => `₺${v.toLocaleString('tr-TR')}` } },
    },
  };

  readonly paymentChartData = computed(() => ({
    labels: [this.t().reports.cash, this.t().reports.card, this.t().reports.credit, this.t().reports.mixed],
    datasets: [{
      data: [this.cashTotal(), this.cardTotal(), this.creditTotal(), this.mixedTotal()],
      backgroundColor: ['#16a34a', '#3b82f6', '#ef4444', '#a855f7'],
      hoverBackgroundColor: ['#15803d', '#1d4ed8', '#dc2626', '#9333ea'],
      borderWidth: 0,
    }],
  }));

  readonly paymentChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 11 }, color: '#64748b', padding: 12, usePointStyle: true } },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ₺${ctx.raw.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
        },
      },
    },
    cutout: '65%',
  };

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
      console.error('[Reports] load error:', e);
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
    return m[method] ?? 'background:var(--bg-page);';
  }

  paymentColor(method: string): string {
    const m: Record<string, string> = { cash: 'color:#16a34a;', card: 'color:#3b82f6;', credit: 'color:#ef4444;', mixed: 'color:#a855f7;' };
    return m[method] ?? 'color:var(--text-secondary);';
  }

  paymentBadge(method: string): string {
    const m: Record<string, string> = {
      cash: 'background:#f0fdf4; color:#16a34a;',
      card: 'background:#eff6ff; color:#3b82f6;',
      credit: 'background:#fef2f2; color:#ef4444;',
      mixed: 'background:#fdf4ff; color:#a855f7;',
    };
    return m[method] ?? 'background:var(--bg-muted); color:var(--text-secondary);';
  }

  paymentLabel(method: string): string {
    const r = this.t().reports;
    const m: Record<string, string> = { cash: r.cash, card: r.card, credit: r.credit, mixed: r.mixed };
    return m[method] ?? method;
  }
}
