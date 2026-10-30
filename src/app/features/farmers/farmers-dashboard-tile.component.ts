import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { AuthService } from '../../core/auth/services/auth.service';
import { LangService } from '../../core/i18n/lang.service';
import { StatCardComponent, StatusBadgeComponent } from '../../shared/ui';
import { DEALER_FARMER_REPOSITORY } from '../farmer/data/repositories';
import { fmt } from '../farmer/i18n/farmer.i18n';
import { addDays } from '../farmer/utils/phi.util';
import { phiWarningFieldCount } from './farmers-calc';

/**
 * Ana sayfadaki küçük "Çiftçiler" kutusu (TASKS 14.9): bağlı çiftçi sayısı + bu hafta hasat bekleme (PHI)
 * uyarısı olan tarla sayısı. Yalnız çiftçinin bu işletmeyle paylaştığı kayıtlardan; 3 tek seferlik sorgu.
 */
@Component({
  selector: 'app-farmers-dashboard-tile',
  standalone: true,
  imports: [StatCardComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-stat-card icon="pi-users" [tone]="phiFields() > 0 ? 'warning' : 'success'" [tinted]="phiFields() > 0"
      [label]="x().title" [value]="linked() + ' ' + x().dashLinked" [hint]="x().dashOnlyShared"
      [loading]="loading()" link="/farmers">
      <ui-status-badge [tone]="phiFields() > 0 ? 'warning' : 'neutral'" [icon]="phiFields() > 0 ? 'pi-exclamation-triangle' : 'pi-check'" class="whitespace-normal">
        {{ phiFields() > 0 ? phiText() : x().dashPhiNone }}</ui-status-badge>
    </ui-stat-card>
  `,
})
export class FarmersDashboardTileComponent implements OnInit {
  readonly t = inject(LangService).t;
  readonly x = computed(() => this.t().farmer.farmers);
  private readonly repo = inject(DEALER_FARMER_REPOSITORY);
  private readonly auth = inject(AuthService);

  readonly linked = signal(0);
  readonly phiFields = signal(0);
  readonly loading = signal(true);
  readonly phiText = computed(() => fmt(this.x().dashPhi, { n: this.phiFields() }));

  ngOnInit(): void { void this.load(); }

  private async load(): Promise<void> {
    const tid = this.auth.currentTenantId();
    try {
      const links = await this.repo.listTenantLinks(tid);
      this.linked.set(links.filter(l => l.status === 'active').length);
      if (links.some(l => l.status === 'active' && l.consent.logs)) {
        const today = new Date();
        const [logs, seasons] = await Promise.all([
          this.repo.listTenantPhiLogs(tid, addDays(today, 1), 300),
          this.repo.listTenantSharedSeasons(tid).catch(() => []),
        ]);
        this.phiFields.set(phiWarningFieldCount(logs, seasons, today));
      }
    } catch (e) {
      console.warn('[Dashboard] çiftçi özeti okunamadı:', e);
    } finally {
      this.loading.set(false);
    }
  }
}
