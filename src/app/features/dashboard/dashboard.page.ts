import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { SetupNudgeComponent } from '../../core/onboarding/setup-nudge.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { CurrencyTrPipe } from '../../shared/pipes/currency-tr.pipe';
import { DashboardStore } from './store/dashboard.store';
import { ProductStore } from '../products/store/product.store';
import { LangService } from '../../core/i18n/lang.service';
import { AuthService } from '../../core/auth/services/auth.service';
import { LicenseService } from '../../core/license/license.service';
import { LICENSE_TEXTS } from '../../core/license/license.i18n';
import { CreditService } from '../credit/services/credit.service';
import { OverdueSummary } from '../credit/services/credit.utils';
import { BackupService } from '../backup/services/backup.service';
import { ReportDataService } from '../reports/services/report-data.service';
import { productMap, summarizeSales, toDate } from '../reports/services/report-calc';
import { endOfDay, getPeriodRange, startOfDay } from '../../shared/utils/date-range.util';
import { ShellStatusService } from '../../layout/shell-status.service';
import { PaymentMethod, Sale } from '../../shared/models/sale.model';
import { methodLabel } from '../sales/services/sales.helpers';
import { Product } from '../../shared/models/product.model';
import {
  EmptyStateComponent, GlassCardComponent, KbdComponent, PageHeaderComponent, SegmentedComponent,
  StatCardComponent, StatusBadgeComponent, TONE_SOFT, UiSegmentOption, UiTone,
} from '../../shared/ui';
import { SalesTrendChartComponent } from './sales-trend-chart.component';
import { FarmersDashboardTileComponent } from '../farmers/farmers-dashboard-tile.component';
import { dailySeries, percentChange, salesOfDay } from './home-calc';
import { injectPermissions } from '../../core/auth/permissions';

interface QuickAction { label: string; icon: string; link: string; hero?: boolean; kbd?: string }
interface AlertRow { id: string; icon: string; tone: UiTone; name: string; sub: string; badge: string }

/**
 * Ana sayfa — tasarım v2 "Saha / Komuta" + B'nin büyük ciro kartı.
 * Veriler: DashboardStore (satışlar, değişmedi), ProductStore, CreditService.overdueSummary$(),
 * BackupService.isBackupOverdue(), LicenseService. Trend için store aralığından eski günler
 * (en fazla 30 gün) sayfada bir kez ek okunur.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink, CurrencyTrPipe, PageHeaderComponent, StatCardComponent, GlassCardComponent, EmptyStateComponent,
    StatusBadgeComponent, KbdComponent, SegmentedComponent, SalesTrendChartComponent, FarmersDashboardTileComponent,
    SetupNudgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ui-page-header [title]="greeting()" [subtitle]="todayText()" />

    <div class="page-body">

      <!-- Uyarılar: yedek, lisans -->
      @if (backupOverdue() || licenseWarn()) {
        <div class="flex flex-col gap-2">
          @if (backupOverdue()) {
            <div role="status" class="flex flex-wrap items-center gap-3 rounded-token-lg border border-warning-line bg-warning-soft px-3.5 py-3">
              <span class="grid h-10 w-10 shrink-0 place-items-center rounded-[9px] bg-warning text-fg-inverse">
                <i class="pi pi-cloud-download" aria-hidden="true"></i>
              </span>
              <div class="min-w-0 flex-1">
                <p class="m-0 text-14.5 font-bold text-warning-text">{{ h().backupTitle }}</p>
                <p class="m-0 text-13 text-fg-secondary">{{ h().backupDesc }}</p>
              </div>
              <a routerLink="/settings/backup"
                class="inline-flex h-10 items-center gap-2 rounded-token-md border border-line-strong bg-surface px-4 text-sm font-semibold text-fg no-underline hover:bg-surface-muted">
                <i class="pi pi-download text-sm" aria-hidden="true"></i>{{ h().backupAction }}
              </a>
            </div>
          }
          @if (licenseWarn()) {
            <div role="status" class="flex flex-wrap items-center gap-3 rounded-token-lg border border-info-line bg-info-soft px-3.5 py-3">
              <span class="grid h-10 w-10 shrink-0 place-items-center rounded-[9px] bg-info text-fg-inverse">
                <i class="pi pi-verified" aria-hidden="true"></i>
              </span>
              <p class="m-0 min-w-0 flex-1 text-14.5 font-semibold text-info-text">{{ licenseText() }}</p>
              <a routerLink="/license"
                class="inline-flex h-10 items-center rounded-token-md border border-line-strong bg-surface px-4 text-sm font-semibold text-fg no-underline hover:bg-surface-muted">
                {{ h().licenseAction }}
              </a>
            </div>
          }
        </div>
      }

      <!-- Ürün turu sonrası: kurulum kısayolu (admin, kurulum eksikse) -->
      <app-setup-nudge />

      <!-- 1. Ciro kartı (B) + durum blokları (C) -->
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
        <section aria-labelledby="rev-title"
          class="field-dark flex min-h-[260px] flex-col overflow-hidden rounded-token-lg border border-side-line">
          <div class="flex items-center gap-2.5 px-4 pt-4 sm:px-5">
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-token-md bg-side-active text-side-em">
              <i class="pi pi-chart-line" aria-hidden="true"></i>
            </span>
            <h2 id="rev-title" class="m-0 font-display text-15 font-bold">{{ h().todayRevenue }}</h2>
            @if (trend() !== null && !dashStore.loading()) {
              <span class="num ml-auto inline-flex h-7 items-center gap-1 rounded-token-sm px-2.5 text-13 font-bold"
                [class]="trend()! >= 0 ? 'bg-side-active text-side-em' : 'bg-side-danger-soft text-side-danger'">
                <i class="pi text-10" [class]="trend()! >= 0 ? 'pi-arrow-up-right' : 'pi-arrow-down-right'" aria-hidden="true"></i>
                %{{ trendAbs() }}
              </span>
            }
          </div>

          <div class="px-4 pt-3 sm:px-5">
            @if (dashStore.loading()) {
              <div class="h-12 w-2/3 animate-pulse rounded-token-md bg-side-2" aria-hidden="true"></div>
            } @else {
              <p class="num-xl m-0 text-[2.5rem] text-side-text sm:text-[3rem]">
                {{ heroInt() }}<small class="ml-0.5 text-22 font-bold text-side-muted sm:text-26">{{ heroDec() }} ₺</small>
              </p>
              <p class="m-0 mt-1 text-13.5 text-side-soft">
                {{ h().saleCount(today().saleCount) }}@if (trend() !== null) { · {{ h().vsYesterday }} }
              </p>
              <div class="mt-3 flex flex-wrap gap-2 text-13.5 font-semibold">
                <span class="rounded-token-md bg-side-2 px-2.5 py-1.5">{{ h().salesPart }} <span class="num">{{ today().revenue | currencyTr }}</span></span>
                @if (today().interestIncome > 0) {
                  <span class="rounded-token-md bg-side-2 px-2.5 py-1.5">+ {{ h().interestPart }} <span class="num">{{ today().interestIncome | currencyTr }}</span></span>
                }
              </div>
            }
          </div>

          <dl class="m-0 mt-auto grid grid-cols-3 border-t border-side-line pt-0">
            @for (p of payBreakdown(); track p.label) {
              <div class="min-w-0 border-r border-side-line px-3 py-3 last:border-r-0 sm:px-5">
                <dt class="flex items-center gap-1.5 text-12.5 font-semibold text-side-soft">
                  <i class="pi text-12" [class]="p.icon" aria-hidden="true"></i>{{ p.label }}
                </dt>
                <dd class="num m-0 mt-0.5 truncate text-15 font-extrabold text-side-text sm:text-17">{{ p.value | currencyTr }}</dd>
              </div>
            }
          </dl>
        </section>

        <div class="grid grid-cols-2 gap-3 lg:gap-4">
          <!-- Y5: kâr ve aylık ciro yalnız yöneticiye; kasiyer bugünkü satış adedini görür -->
          @if (seeCosts()) {
            <ui-stat-card icon="pi-percentage" tone="brand"
              [label]="h().grossProfit"
              [value]="dashStore.todayGrossProfit() | currencyTr"
              [hint]="marginText()"
              [highlight]="dashStore.todayGrossProfit() < 0" [loading]="dashStore.loading()" />
          } @else {
            <ui-stat-card icon="pi-receipt" tone="brand"
              [label]="t().dashboard.todaySales"
              [value]="'' + dashStore.todaySaleCount()"
              [loading]="dashStore.loading()" />
          }

          @if (canSell()) {
            <ui-stat-card icon="pi-clock" [tone]="overdueTotal() > 0 ? 'danger' : 'brand'" [tinted]="overdueTotal() > 0"
              [label]="h().overdueTitle"
              [value]="overdue() ? (overdueTotal() | currencyTr) : '—'"
              [hint]="overdueTotal() > 0 ? h().overdueCustomers(overdue()!.customerCount) : h().overdueNone"
              [loading]="overdue() === undefined" link="/credit" />
          }

          <ui-stat-card icon="pi-exclamation-triangle" [tone]="alertCount() > 0 ? 'danger' : 'brand'" [tinted]="alertCount() > 0"
            [label]="h().attentionTitle"
            [value]="alertCount() > 0 ? alertCount() + ' ' + h().alertsUnit : h().allClear"
            link="/products">
            @if (dashStore.lowStockCount() > 0) {
              <ui-status-badge tone="danger" class="whitespace-normal">{{ h().criticalStock(dashStore.lowStockCount()) }}</ui-status-badge>
            }
            @if (dashStore.expiringCount() > 0) {
              <ui-status-badge tone="warning">{{ h().expiring(dashStore.expiringCount()) }}</ui-status-badge>
            }
          </ui-stat-card>

          @if (seeCosts()) {
            <ui-stat-card icon="pi-calendar" tone="brand"
              [label]="t().dashboard.monthSales"
              [value]="dashStore.monthlySales() | currencyTr"
              [hint]="t().dashboard.weekSales + ' ' + (dashStore.weeklySales() | currencyTr)"
              [loading]="dashStore.loading()" />
          }
        </div>
      </div>

      <!-- 2. Satış trendi + hızlı işlemler -->
      <div class="grid grid-cols-1 gap-3 lg:gap-4" [class]="seeCosts() ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : ''">
        @if (seeCosts()) {
        <ui-glass-card [title]="h().trendTitle" [subtitle]="h().trendMeta" icon="pi-chart-bar" padding="none">
          <ui-segmented card-actions size="sm" [options]="periodOptions()" [(value)]="days" [ariaLabel]="h().trendTitle" />
          <div class="flex flex-wrap gap-x-6 gap-y-2 px-4 pb-1 pt-3">
            <div class="text-12.5 text-fg-muted">{{ h().periodTotal(days() ?? 14) }}
              <b class="num block text-17 font-extrabold text-fg">{{ trendTotal() | currencyTr }}</b>
            </div>
            <div class="text-12.5 text-fg-muted">
              <span class="mr-1.5 inline-block w-[18px] border-t-2 border-dashed border-fg-secondary align-middle" aria-hidden="true"></span>{{ h().dailyAvg }}
              <b class="num block text-17 font-extrabold text-fg">{{ trendAvg() | currencyTr }}</b>
            </div>
            @if (bestDay(); as b) {
              <div class="hidden text-12.5 text-fg-muted sm:block">{{ h().bestDay }}
                <b class="num block text-17 font-extrabold text-fg">{{ b.value | currencyTr }} · {{ b.label }}</b>
              </div>
            }
          </div>
          @if (trendLoading()) {
            <div class="mx-4 mb-4 mt-2 h-[200px] animate-pulse rounded-token-md bg-surface-muted" aria-hidden="true"></div>
          } @else {
            <app-sales-trend-chart [points]="series()" [locale]="t().dashboard.dateFormat"
              [todayLabel]="h().today" [soFarLabel]="h().soFar" [ariaLabel]="chartAria()" />
          }
        </ui-glass-card>
        }

        <ui-glass-card [title]="h().quickTitle" icon="pi-th-large" tone="accent" padding="none">
          <div class="grid grid-cols-2 gap-2.5 p-3.5">
            @for (a of quickActions(); track a.link) {
              <a [routerLink]="a.link" [attr.aria-keyshortcuts]="a.kbd || null"
                class="relative flex min-h-[96px] flex-col items-start gap-2.5 rounded-[9px] border p-3.5 no-underline transition-colors"
                [class]="a.hero
                  ? 'border-accent bg-accent text-accent-contrast hover:bg-accent-hover'
                  : 'border-line bg-surface text-fg hover:border-brand hover:bg-brand-soft'">
                <span class="grid h-[38px] w-[38px] place-items-center rounded-token-md"
                  [class]="a.hero ? 'bg-white/45' : 'bg-brand-soft text-brand-text'">
                  <i class="pi text-17" [class]="a.icon" aria-hidden="true"></i>
                </span>
                <b class="font-display text-14.5 font-bold leading-tight">{{ a.label }}</b>
                @if (a.kbd) {
                  <ui-kbd class="absolute right-3 top-3" [tone]="a.hero ? 'inverse' : 'default'">{{ a.kbd }}</ui-kbd>
                }
              </a>
            }
          </div>
        </ui-glass-card>
      </div>

      <!-- Çiftçi modülü özeti (yalnız paylaşılan veriden; admin + kasiyer) -->
      @if (canSell()) {
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4"><app-farmers-dashboard-tile /></div>
      }

      <!-- 3. Son satışlar + kritik stok/SKT -->
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-4">
        <ui-glass-card [title]="t().dashboard.recentSales" icon="pi-receipt" padding="none" clip>
          @if (canSell()) {
            <a card-actions routerLink="/sales" class="inline-flex min-h-[40px] items-center gap-1 px-1 text-13.5 font-semibold text-brand-text no-underline hover:underline">
              {{ t().dashboard.viewAll }}<i class="pi pi-chevron-right text-10" aria-hidden="true"></i>
            </a>
          }
          @if (dashStore.loading()) {
            <div class="flex flex-col gap-3 p-4" aria-hidden="true">
              @for (i of [1, 2, 3, 4]; track i) {
                <div class="h-9 animate-pulse rounded-token-md bg-surface-muted"></div>
              }
            </div>
          } @else if (dashStore.recentSales().length === 0) {
            <ui-empty-state icon="pi-shopping-bag" tone="brand"
              [title]="t().dashboard.noSalesToday" [description]="t().dashboard.firstSaleHint" />
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full border-collapse text-14.5">
                <thead>
                  <tr class="bg-surface-muted text-left text-12 font-semibold uppercase tracking-[0.03em] text-fg-muted">
                    <th class="h-10 whitespace-nowrap border-b border-line px-3 sm:px-3.5">{{ h().colTime }}</th>
                    <th class="h-10 border-b border-line px-3 sm:px-3.5">{{ h().colCustomer }}</th>
                    <th class="hidden h-10 border-b border-line px-3.5 2xl:table-cell">{{ h().colReceipt }}</th>
                    <th class="h-10 border-b border-line px-3 sm:px-3.5">{{ h().colPayment }}</th>
                    <th class="h-10 border-b border-line px-3 text-right sm:px-3.5">{{ h().colAmount }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (s of dashStore.recentSales(); track s.id) {
                    <tr class="list-row border-b border-line last:border-b-0">
                      <td class="num h-[52px] whitespace-nowrap px-3 text-fg-secondary sm:px-3.5">{{ formatTime(s.createdAt) }}</td>
                      <td class="max-w-[160px] truncate px-3 font-semibold text-fg sm:px-3.5">{{ s.customerName || t().reports.cashCustomer }}</td>
                      <td class="num hidden whitespace-nowrap px-3.5 text-12.5 2xl:table-cell">
                        @if (canSell()) {
                          <a [routerLink]="['/sales', s.id]" class="text-fg-muted no-underline hover:text-brand-text hover:underline">{{ s.saleNumber }}</a>
                        } @else {
                          <span class="text-fg-muted">{{ s.saleNumber }}</span>
                        }
                      </td>
                      <td class="px-3 sm:px-3.5">
                        <ui-status-badge [tone]="payTone(s.paymentMethod)" [icon]="payIcon(s.paymentMethod)">{{ payLabel(s) }}</ui-status-badge>
                      </td>
                      <td class="num whitespace-nowrap px-3 text-right font-extrabold text-fg sm:px-3.5">{{ s.totalAmount | currencyTr }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </ui-glass-card>

        <ui-glass-card [title]="h().stockAlertsTitle" icon="pi-exclamation-triangle" tone="danger" padding="none" clip>
          @if (alertRows().length) {
            <a card-actions routerLink="/products" class="inline-flex min-h-[40px] items-center gap-1 px-1 text-13.5 font-semibold text-brand-text no-underline hover:underline">
              {{ h().goProducts }}<i class="pi pi-chevron-right text-10" aria-hidden="true"></i>
            </a>
          }
          @if (alertRows().length) {
            <ul class="m-0 list-none p-0">
              @for (r of alertRows(); track r.id + r.icon) {
                <li class="border-b border-line last:border-b-0">
                  <a [routerLink]="['/products', r.id]" class="list-row flex min-h-[58px] items-center gap-3 px-4 py-2.5 no-underline">
                    <span class="grid h-9 w-9 shrink-0 place-items-center rounded-token-md" [class]="soft(r.tone)">
                      <i class="pi text-15" [class]="r.icon" aria-hidden="true"></i>
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="line-clamp-2 break-words text-14.5 font-semibold leading-snug text-fg">{{ r.name }}</span>
                      <span class="num block truncate text-12.5 text-fg-muted">{{ r.sub }}</span>
                    </span>
                    <ui-status-badge [tone]="r.tone">{{ r.badge }}</ui-status-badge>
                  </a>
                </li>
              }
            </ul>
          } @else {
            <ui-empty-state compact icon="pi-check-circle" tone="success" [title]="t().dashboard.stockOk" [description]="t().dashboard.noExpiring" />
          }
        </ui-glass-card>
      </div>
    </div>
  `,
})
export class DashboardPage implements OnInit {
  readonly dashStore = inject(DashboardStore);
  readonly productStore = inject(ProductStore);
  private readonly lang = inject(LangService);
  readonly t = this.lang.t;
  readonly h = computed(() => this.t().home);
  private readonly auth = inject(AuthService);
  private readonly license = inject(LicenseService);
  private readonly credit = inject(CreditService);
  private readonly backup = inject(BackupService);
  private readonly reportData = inject(ReportDataService);
  private readonly shellStatus = inject(ShellStatusService);

  private readonly role = computed(() => this.auth.currentUser()?.role ?? 'admin');
  readonly canSell = computed(() => this.role() === 'admin' || this.role() === 'cashier');
  readonly isAdmin = computed(() => this.role() === 'admin');
  /** Y5: kâr / aylık ciro / trend — yönetici ya da yetki verilmiş kullanıcı. */
  private readonly can = injectPermissions();
  readonly seeCosts = computed(() => this.can().seeCosts);

  /** Store aralığından (hafta/ay başı) eski günler — trend için bir kez okunur. */
  private readonly olderSales = signal<Sale[]>([]);
  readonly trendLoading = signal(true);
  readonly days = signal<number | null>(14);
  readonly backupOverdue = signal(false);

  /** undefined: yükleniyor · null: okunamadı/yetki yok. */
  readonly overdue = toSignal(
    this.canSell() ? this.credit.overdueSummary$().pipe(catchError(() => of(null))) : of<OverdueSummary | null>(null),
  );
  readonly overdueTotal = computed(() => this.overdue()?.totalOverdue ?? 0);

  private readonly now = computed(() => new Date(this.dashStore.loadedAt() || Date.now()));
  private readonly allSales = computed(() => [...this.dashStore.sales(), ...this.olderSales()]);
  readonly today = computed(() => summarizeSales(salesOfDay(this.allSales(), this.now()), productMap(this.productStore.products())));

  private readonly heroParts = computed(() => {
    const total = this.today().revenue + this.today().interestIncome;
    const s = total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const i = s.lastIndexOf(',');
    return { int: s.slice(0, i), dec: s.slice(i) };
  });
  readonly heroInt = computed(() => this.heroParts().int);
  readonly heroDec = computed(() => this.heroParts().dec);

  /** Düne göre: dünün AYNI SAATE kadarki cirosu ile karşılaştırılır (yarım günü tam günle kıyaslamamak için). */
  readonly trend = computed(() => {
    const now = this.now();
    const y = new Date(now.getTime() - 86_400_000);
    const ySales = salesOfDay(this.allSales(), y).filter(s => (toDate(s.createdAt)?.getTime() ?? 0) <= y.getTime());
    const prev = ySales.reduce((a, s) => a + (s.totalAmount ?? 0), 0);
    return percentChange(this.today().revenue, prev);
  });
  readonly trendAbs = computed(() => Math.abs(this.trend() ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 }));

  readonly payBreakdown = computed(() => {
    const h = this.h();
    const d = this.today();
    return [
      { label: h.cash, icon: 'pi-money-bill', value: d.cash },
      { label: h.card, icon: 'pi-credit-card', value: d.card },
      { label: h.credit, icon: 'pi-book', value: d.credit },
    ];
  });

  readonly marginText = computed(() => {
    const rev = this.dashStore.todayNetSales();
    if (!(rev > 0)) return this.t().common.today;
    const pct = (this.dashStore.todayGrossProfit() / rev) * 100;
    const txt = this.h().margin(pct.toLocaleString('tr-TR', { maximumFractionDigits: 1 }));
    return this.dashStore.todayCostEstimated() ? `${txt} *` : txt;
  });

  readonly alertCount = computed(() => this.dashStore.lowStockCount() + this.dashStore.expiringCount());

  readonly licenseWarn = computed(() => this.license.showWarning());
  readonly licenseText = computed(() => {
    const info = this.license.info();
    const x = LICENSE_TEXTS[this.lang.lang()];
    const d = Math.max(0, info.daysLeft ?? 0);
    return info.plan === 'trial' ? x.trialWarning(d) : x.warning(d);
  });

  readonly periodOptions = computed<UiSegmentOption<number | null>[]>(() =>
    [7, 14, 30].map(d => ({ value: d, label: this.h().periodLabel(d) })));

  readonly series = computed(() => dailySeries(this.allSales(), this.days() ?? 14, this.now()));
  readonly trendTotal = computed(() => this.series().reduce((a, p) => a + p.value, 0));
  readonly trendAvg = computed(() => this.trendTotal() / Math.max(1, this.series().length));
  readonly bestDay = computed(() => {
    const s = this.series();
    if (!s.length) return null;
    const b = s.reduce((m, p) => (p.value > m.value ? p : m), s[0]);
    if (!(b.value > 0)) return null;
    return { value: b.value, label: b.date.toLocaleDateString(this.t().dashboard.dateFormat, { day: 'numeric', month: 'short' }) };
  });
  readonly chartAria = computed(() => {
    const s = this.series();
    const last = s[s.length - 1];
    return `${this.h().trendTitle}: ${this.h().periodTotal(s.length)} ${Math.round(this.trendTotal())} ₺, ${this.h().today} ${Math.round(last?.value ?? 0)} ₺`;
  });

  readonly quickActions = computed<QuickAction[]>(() => {
    const d = this.t().dashboard;
    const h = this.h();
    const list: QuickAction[] = [];
    if (this.canSell()) {
      list.push({ label: d.newSale, icon: 'pi-shopping-cart', link: '/pos', hero: true, kbd: 'F2' });
      list.push({ label: d.collect, icon: 'pi-wallet', link: '/credit' });
    }
    if (this.isAdmin()) {
      list.push({ label: d.addProduct, icon: 'pi-plus', link: '/products/new' });
      list.push({ label: h.purchase, icon: 'pi-truck', link: '/purchases/new' });
      list.push({ label: h.addExpense, icon: 'pi-minus-circle', link: '/expenses' });
      list.push({ label: h.stockCount, icon: 'pi-barcode', link: '/stock-count' });
    }
    // 5.11: alış fiyatı yetkili (yönetici olmayan) kullanıcı stok değer raporuna buradan ulaşır (yönetici: Raporlar)
    if (!this.isAdmin() && this.seeCosts()) list.push({ label: this.t().inventory.stockValue, icon: 'pi-wallet', link: '/reports/stock-value' });
    if (!list.length) list.push({ label: this.t().nav.products, icon: 'pi-box', link: '/products' });
    return list;
  });

  readonly alertRows = computed<AlertRow[]>(() => {
    const h = this.h();
    const low: AlertRow[] = this.productStore.products()
      .filter(p => p.stock <= p.minStock)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 4)
      .map(p => ({
        id: p.id, icon: 'pi-box', tone: 'danger' as UiTone, name: p.name,
        sub: h.stockShort(p.stock, p.minStock), badge: p.stock <= 0 ? h.outOfStock : h.critical,
      }));
    const exp: AlertRow[] = [...this.productStore.expiringProducts()]
      .sort((a, b) => this.expiryDays(a) - this.expiryDays(b))
      .slice(0, 6 - low.length)
      .map(p => ({
        id: p.id, icon: 'pi-clock', tone: (this.expiryDays(p) <= this.productStore.expiryCriticalDays() ? 'danger' : 'warning') as UiTone, name: p.name,
        sub: [p.brand || p.barcode, p.expiryDate?.toDate().toLocaleDateString(this.t().dashboard.dateFormat)].filter(Boolean).join(' · '),
        badge: this.expiryText(p),
      }));
    return [...low, ...exp];
  });

  readonly greeting = computed(() => {
    const d = this.t().dashboard;
    const hr = new Date().getHours();
    const hello = hr < 12 ? d.goodMorning : hr < 18 ? d.goodAfternoon : d.goodEvening;
    const first = (this.auth.currentUser()?.displayName ?? '').trim().split(/\s+/)[0] ?? '';
    const name = first ? first.charAt(0).toLocaleUpperCase('tr') + first.slice(1).toLocaleLowerCase('tr') : '';
    return name ? `${hello}, ${name}` : hello;
  });

  readonly todayText = computed(() => new Date().toLocaleDateString(this.t().dashboard.dateFormat, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }));

  constructor() {
    // Gecikmiş müşteri sayısını kabuğa (sidebar/zil rozeti) ilet — ek sorgu açmadan
    effect(() => {
      const o = this.overdue();
      if (o !== undefined) this.shellStatus.overdueCustomers.set(o?.customerCount ?? null);
    });
  }

  ngOnInit(): void {
    this.dashStore.loadStats();
    this.productStore.ensureLoaded();
    void this.loadOlderSales();
    if (this.isAdmin()) void this.backup.isBackupOverdue().then(v => this.backupOverdue.set(v));
  }

  /** Trend 30 güne kadar: store'un yüklediği aralığın (hafta/ay başı) öncesini bir kez oku. */
  private async loadOlderSales(): Promise<void> {
    try {
      const now = new Date();
      const start30 = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
      const week = getPeriodRange('week', now).start;
      const month = getPeriodRange('month', now).start;
      const storeStart = week < month ? week : month;
      if (start30 < storeStart) {
        const end = endOfDay(new Date(storeStart.getFullYear(), storeStart.getMonth(), storeStart.getDate() - 1));
        this.olderSales.set(await this.reportData.getSales({ start: start30, end }));
      }
    } catch (e) {
      console.warn('[Dashboard] trend verisi okunamadı:', e);
    } finally {
      this.trendLoading.set(false);
    }
  }

  formatTime(ts: unknown): string {
    const d = toDate(ts);
    if (!d) return '';
    const sameDay = d.toDateString() === new Date().toDateString();
    return d.toLocaleString(this.t().dashboard.dateFormat, sameDay
      ? { hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  /** 5.4: karma ödemede bileşenler ("Nakit + Kart"). */
  payLabel(s: Pick<Sale, 'paymentMethod' | 'cashPaid' | 'cardPaid' | 'creditAmount'>): string {
    return methodLabel(this.t(), s.paymentMethod, s);
  }

  payTone(m: PaymentMethod): UiTone {
    return ({ cash: 'success', card: 'info', credit: 'accent', mixed: 'neutral' } as Record<PaymentMethod, UiTone>)[m] ?? 'neutral';
  }

  payIcon(m: PaymentMethod): string {
    return ({ cash: 'pi-money-bill', card: 'pi-credit-card', credit: 'pi-book', mixed: 'pi-wallet' } as Record<PaymentMethod, string>)[m] ?? 'pi-wallet';
  }

  soft(t: UiTone): string { return TONE_SOFT[t]; }

  expiryDays(p: Product): number {
    const d = p.expiryDate?.toDate();
    return d ? Math.ceil((d.getTime() - Date.now()) / 86400000) : Number.POSITIVE_INFINITY;
  }

  expiryText(p: Product): string {
    const d = this.expiryDays(p);
    const dash = this.t().dashboard;
    if (d < 0) return dash.expired;
    if (d === 0) return dash.expiresToday;
    return `${d} ${dash.daysLeft}`;
  }
}
