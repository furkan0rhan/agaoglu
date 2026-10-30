import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { LicenseService } from '../../../core/license/license.service';
import { SUPPORT_CONTACT } from '../../../core/license/license.config';
import { LICENSE_TEXTS } from '../../../core/license/license.i18n';

/**
 * Ana kabuğun üstündeki kalıcı şeritler (v2: tam genişlik, köşesiz C şeridi):
 *  1. Destek modu (superadmin bir işletmeyi açtıysa) — kapatılamaz, "Çık" ile biter.
 *  2. Lisans: süresi dolmuş/askıda → kırmızı salt-okunur şeridi; 7 gün kala → sarı uyarı (kapatılabilir).
 * main-layout şablonuna tek satırla eklenir: <app-support-banner />
 */
@Component({
  selector: 'app-support-banner',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @if (auth.inSupportMode()) {
      <div role="alert" aria-live="polite"
        class="flex min-h-[44px] shrink-0 items-center gap-3 bg-danger px-3 py-1.5 text-sm font-semibold text-fg-inverse lg:px-6">
        <i class="pi pi-shield shrink-0 text-base" aria-hidden="true"></i>
        <span class="min-w-0 flex-1 truncate" [title]="x().supportHint">
          {{ x().supportMode }}: {{ auth.supportSession()?.tenantName }}
        </span>
        <button type="button" (click)="exit()" [disabled]="exiting()"
          class="h-8 shrink-0 cursor-pointer rounded-token-md border border-current bg-transparent px-3 text-xs font-bold text-fg-inverse hover:bg-danger-line">
          {{ x().supportExit }}
        </button>
      </div>
    }

    @if (license.readOnly()) {
      <div role="alert"
        class="flex min-h-[40px] shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-danger-line bg-danger-soft px-3 py-2 text-13 text-danger-text lg:px-6">
        <i class="pi pi-lock text-sm" aria-hidden="true"></i>
        <span class="font-bold">{{ license.state() === 'suspended' ? x().suspendedTitle : x().expiredTitle }}</span>
        <span>{{ x().contact }}: <a class="num font-semibold text-danger-text" [href]="'tel:' + contact.phone">{{ contact.phone }}</a></span>
        <a routerLink="/license" class="ml-auto font-semibold text-danger-text">{{ x().details }}</a>
      </div>
    } @else if (license.showWarning() && !dismissed()) {
      <div role="status"
        class="flex min-h-[40px] shrink-0 items-center gap-2 border-b border-warning-line bg-warning-soft px-3 py-1.5 text-13 text-warning-text lg:px-6">
        <i class="pi pi-clock text-sm" aria-hidden="true"></i>
        <span class="min-w-0 flex-1"><b class="font-semibold">{{ warningText() }}</b> {{ x().contact }}: <span class="num">{{ contact.phone }}</span></span>
        <a routerLink="/license" class="hidden shrink-0 font-semibold text-warning-text sm:inline">{{ x().details }}</a>
        <button type="button" (click)="dismissed.set(true)" [attr.aria-label]="x().supportExit"
          class="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-token-md border-0 bg-transparent text-warning-text hover:bg-warning-line"><i class="pi pi-times text-xs" aria-hidden="true"></i></button>
      </div>
    }
  `,
})
export class SupportBannerComponent {
  readonly auth = inject(AuthService);
  readonly license = inject(LicenseService);
  private readonly lang = inject(LangService);
  readonly x = computed(() => LICENSE_TEXTS[this.lang.lang()]);
  readonly contact = SUPPORT_CONTACT;
  readonly exiting = signal(false);
  readonly dismissed = signal(false);

  readonly warningText = computed(() => {
    const info = this.license.info();
    const d = Math.max(0, info.daysLeft ?? 0);
    return info.plan === 'trial' ? this.x().trialWarning(d) : this.x().warning(d);
  });

  async exit(): Promise<void> {
    this.exiting.set(true);
    try { await this.auth.exitSupportMode(); } finally { this.exiting.set(false); }
  }
}
