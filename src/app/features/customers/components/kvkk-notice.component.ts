import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { LangService } from '../../../core/i18n/lang.service';
import { TenantInfoService } from '../../settings/business/tenant-info.service';
import { KVKK_TEXT_VERSION } from '../services/customer.utils';
import { LEGAL_TEXT_URL, fillLegalTemplate, renderLegalMarkdown } from '../services/legal-text';

/** Aydınlatma metni (src/assets/legal/aydinlatma-metni.md), işletme bilgileriyle doldurulmuş. */
@Component({
  selector: 'app-kvkk-notice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  styles: [`
    .legal :is(h2) { font-size: 1.1rem; font-weight: 800; margin: 0 0 .5rem; color: var(--p-text-color, inherit); }
    .legal :is(h3) { font-size: .95rem; font-weight: 700; margin: 1rem 0 .35rem; }
    .legal p, .legal li { font-size: .875rem; line-height: 1.6; }
    .legal p { margin: .35rem 0; }
    .legal ul, .legal ol { margin: .25rem 0 .5rem; padding-left: 1.25rem; }
    .legal hr { border: 0; border-top: 1px solid currentColor; opacity: .15; margin: 1rem 0; }
  `],
  template: `
    @if (html(); as h) {
      <div class="legal text-fg-secondary" [innerHTML]="h"></div>
    } @else if (failed()) {
      <p class="m-0 text-sm text-danger-text">{{ t().customers.kvkkLoadFailed }}</p>
    } @else {
      <div class="flex flex-col gap-2" aria-hidden="true">
        @for (i of [1, 2, 3, 4, 5]; track i) { <div class="h-4 animate-pulse rounded bg-surface-muted"></div> }
      </div>
    }
  `,
})
export class KvkkNoticeComponent implements OnInit {
  readonly t = inject(LangService).t;
  private readonly tenantInfo = inject(TenantInfoService);
  readonly html = signal<string>('');
  readonly failed = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      const [res, info] = await Promise.all([
        fetch(new URL(LEGAL_TEXT_URL, document.baseURI).toString()),
        this.tenantInfo.get().catch(() => null),
      ]);
      if (!res.ok) throw new Error('LEGAL_TEXT_LOAD_FAILED');
      const md = fillLegalTemplate(await res.text(), {
        ISLETME_ADI: info?.name ?? '',
        ISLETME_ADRES: info?.address ?? '',
        ISLETME_TELEFON: info?.phone ?? '',
        SURUM: KVKK_TEXT_VERSION,
      });
      this.html.set(renderLegalMarkdown(md));
    } catch {
      this.failed.set(true);
    }
  }
}
