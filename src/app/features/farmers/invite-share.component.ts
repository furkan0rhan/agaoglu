import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { LangService } from '../../core/i18n/lang.service';
import { FarmerInvite } from '../../shared/models/farmer.model';
import { environment } from '../../../environments/environment';
import { QrCodeComponent } from '../farmer/dealer/qr-code.component';
import { fmt } from '../farmer/i18n/farmer.i18n';
import { fmtDate } from '../farmer/layout/farmer-ui';
import { buildInviteUrl, whatsappUrl } from '../farmer/utils/identity.util';

/** Davet paylaşımı: QR + link + WhatsApp + kopyala (Çiftçiler sayfası). */
@Component({
  selector: 'app-invite-share',
  standalone: true,
  imports: [ButtonModule, QrCodeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center gap-3 rounded-token-lg border border-line bg-surface-muted p-3 sm:flex-row sm:items-start">
      <div class="shrink-0 rounded-token-md border border-line bg-surface p-2">
        <app-qr-code [value]="url()" [size]="168" [label]="d().qrHint" />
      </div>
      <div class="flex w-full min-w-0 flex-1 flex-col gap-2">
        <p class="m-0 text-sm font-semibold text-fg">{{ title() }}</p>
        <p class="m-0 text-13 text-fg-secondary">{{ d().qrHint }}</p>
        <code class="block break-all rounded-token-sm border border-line bg-surface px-2 py-1.5 font-mono text-xs text-fg-secondary" data-testid="invite-url">{{ url() }}</code>
        <small class="flex items-center gap-1.5 text-fg-muted"><i class="pi pi-clock text-11" aria-hidden="true"></i>{{ expires() }}</small>
        <div class="flex flex-wrap gap-2">
          @if (phone()) {
            <a [href]="waUrl()" target="_blank" rel="noopener" class="p-button p-button-success p-button-sm no-underline">
              <i class="pi pi-whatsapp mr-2" aria-hidden="true"></i>{{ d().whatsapp }}</a>
          }
          <p-button size="small" severity="secondary" icon="pi pi-copy" [label]="d().copy" (onClick)="copy()" />
        </div>
      </div>
    </div>
  `,
})
export class InviteShareComponent {
  private readonly lang = inject(LangService);
  readonly t = this.lang.t;
  readonly d = computed(() => this.t().farmer.dealer);
  private readonly toast = inject(MessageService, { optional: true });

  readonly invite = input.required<FarmerInvite>();
  readonly phone = input<string | null>(null);

  readonly url = computed(() => buildInviteUrl(publicBaseUrl(), this.invite().code));
  readonly title = computed(() => fmt(this.t().farmer.farmers.inviteFor, { name: this.invite().customerName }));
  readonly expires = computed(() => fmt(this.d().expires, { date: fmtDate(this.invite().expiresAt, this.lang.lang()) }));
  readonly waUrl = computed(() => whatsappUrl(this.phone(), fmt(this.d().waText, { dealer: this.invite().tenantName || '', link: this.url() })));

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.url());
      this.toast?.add({ severity: 'success', summary: '', detail: this.d().copied, life: 2000 });
    } catch { /* pano yok */ }
  }
}

/** WhatsApp'tan açılabilen genel adres. Tauri/yerel kökende Firebase Hosting adresi kullanılır. */
export function publicBaseUrl(): string {
  const loc = typeof location !== 'undefined' ? location : null;
  if (loc && /^https?:$/.test(loc.protocol) && loc.hostname !== 'tauri.localhost') return loc.origin;
  return `https://${environment.firebase.projectId}.web.app`;
}
