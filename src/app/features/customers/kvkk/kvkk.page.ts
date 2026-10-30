import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { LangService } from '../../../core/i18n/lang.service';
import { GlassCardComponent, PageHeaderComponent } from '../../../shared/ui';
import { KvkkNoticeComponent } from '../components/kvkk-notice.component';

/** Uygulama içinde aydınlatma metni (/customers/kvkk). Müşteriye ekrandan gösterilebilir veya yazdırılabilir. */
@Component({
  selector: 'app-kvkk-page',
  standalone: true,
  imports: [ButtonModule, PageHeaderComponent, GlassCardComponent, KvkkNoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ui-page-header [title]="t().customers.kvkkTitle" icon="pi-shield" backLink="/customers" [backLabel]="t().common.back">
      <p-button icon="pi pi-print" [label]="t().customers.print" severity="secondary" [outlined]="true" (onClick)="print()" />
    </ui-page-header>
    <div class="page-body">
      <ui-glass-card padding="lg" class="w-full max-w-3xl">
        <app-kvkk-notice />
      </ui-glass-card>
    </div>
  `,
})
export class KvkkPage {
  readonly t = inject(LangService).t;
  print(): void { window.print(); }
}
