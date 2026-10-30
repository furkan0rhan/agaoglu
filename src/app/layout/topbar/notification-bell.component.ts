import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PopoverModule } from 'primeng/popover';
import { LangService } from '../../core/i18n/lang.service';
import { LicenseService } from '../../core/license/license.service';
import { LICENSE_TEXTS } from '../../core/license/license.i18n';
import { ProductStore } from '../../features/products/store/product.store';
import { ShellStatusService } from '../shell-status.service';
import { TONE_SOFT, UiTone } from '../../shared/ui/tone';

interface BellItem { icon: string; tone: UiTone; text: string; link: string }

/**
 * Uyarı zili: kritik stok, SKT yaklaşan, gecikmiş veresiye (biliniyorsa), lisans uyarısı.
 * Ek sorgu açmaz; zaten yüklü store'ları okur. `dark`: mobil koyu üst çubuk için.
 */
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [RouterLink, PopoverModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    <button type="button" (click)="pop.toggle($event)" aria-haspopup="dialog"
      [attr.aria-label]="t().shell.notifications + (count() ? ' (' + count() + ')' : '')"
      class="relative grid shrink-0 cursor-pointer place-items-center rounded-[9px] transition-colors"
      [class]="dark()
        ? 'h-[42px] w-[42px] border-0 bg-transparent text-side-text hover:bg-side-2'
        : 'h-11 w-11 border border-line bg-surface text-fg-secondary hover:bg-surface-muted'">
      <i class="pi pi-bell text-17" aria-hidden="true"></i>
      @if (count()) {
        <span class="num absolute flex h-[19px] min-w-[19px] items-center justify-center rounded-token-sm bg-side-count px-1 text-11 font-bold leading-none text-white"
          [class]="dark() ? 'right-0.5 top-0.5' : '-right-1.5 -top-1.5'">{{ count() > 99 ? '99+' : count() }}</span>
      }
    </button>
    <p-popover #pop appendTo="body" styleClass="w-[300px] max-w-[calc(100vw-24px)]">
      <p class="eyebrow m-0 mb-2 text-fg-muted">{{ t().shell.notifications }}</p>
      @if (items().length) {
        <ul class="m-0 flex list-none flex-col gap-1 p-0">
          @for (i of items(); track i.text) {
            <li>
              <a [routerLink]="i.link" (click)="pop.hide()"
                class="flex min-h-[48px] items-center gap-3 rounded-token-md px-2 py-1.5 text-sm font-medium text-fg no-underline hover:bg-surface-hover">
                <span class="grid h-9 w-9 shrink-0 place-items-center rounded-token-md" [class]="soft(i.tone)">
                  <i class="pi text-sm" [class]="i.icon" aria-hidden="true"></i>
                </span>
                <span class="min-w-0 flex-1">{{ i.text }}</span>
                <i class="pi pi-chevron-right text-10 text-fg-muted" aria-hidden="true"></i>
              </a>
            </li>
          }
        </ul>
      } @else {
        <p class="m-0 flex items-center gap-2 py-2 text-sm text-fg-secondary">
          <i class="pi pi-check-circle text-success-text" aria-hidden="true"></i>{{ t().home.allClear }}
        </p>
      }
    </p-popover>
  `,
})
export class NotificationBellComponent {
  private readonly products = inject(ProductStore);
  private readonly status = inject(ShellStatusService);
  private readonly license = inject(LicenseService);
  private readonly lang = inject(LangService);
  readonly t = this.lang.t;
  readonly dark = input(false);

  readonly items = computed<BellItem[]>(() => {
    const h = this.t().home;
    const out: BellItem[] = [];
    const low = this.products.lowStockCount();
    const exp = this.products.expiringProducts().length;
    const od = this.status.overdueCustomers() ?? 0;
    if (low) out.push({ icon: 'pi-exclamation-triangle', tone: 'danger', text: h.criticalStock(low), link: '/products' });
    if (exp) out.push({ icon: 'pi-clock', tone: 'warning', text: h.expiring(exp), link: '/products' });
    if (od) out.push({ icon: 'pi-book', tone: 'accent', text: h.overdueCustomers(od), link: '/credit' });
    if (this.license.showWarning() || this.license.readOnly()) {
      const x = LICENSE_TEXTS[this.lang.lang()];
      out.push({ icon: 'pi-lock', tone: 'info', text: x.pageTitle, link: '/license' });
    }
    return out;
  });

  readonly count = computed(() =>
    this.products.lowStockCount() + this.products.expiringProducts().length + (this.status.overdueCustomers() ?? 0));

  soft(t: UiTone): string { return TONE_SOFT[t]; }
}
