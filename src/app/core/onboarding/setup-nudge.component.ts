import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../auth/services/auth.service';
import { ProgressRingComponent } from '../../shared/ui/progress-ring.component';
import { SetupProgressService } from '../../features/settings/setup-progress.service';
import { completedVersion } from './onboarding.model';
import { injectOnboardingTexts } from './onboarding.i18n';
import { TourService } from './tour.service';

/**
 * Dashboard'da kurulum kısayolu: karşılama turu bittikten (ya da atlandıktan) sonra, kurulum %100 değilse
 * Ayarlar'daki kurulum ilerlemesine götürür. Yalnız işletme admini; "Gizle" kalıcıdır (onboarding.nudgeHidden).
 */
@Component({
  selector: 'app-setup-nudge',
  standalone: true,
  imports: [ButtonModule, ProgressRingComponent],
  providers: [SetupProgressService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @if (show()) {
      <section data-tour="setup-nudge" aria-labelledby="tm-nudge-title" aria-live="polite"
        class="ui-card flex flex-wrap items-center gap-3 border-brand-line p-3.5 sm:gap-4 sm:p-4">
        <ui-progress-ring [value]="setup.percent()" [size]="52" [ariaLabel]="x().nudgeTitle(setup.percent())" />
        <div class="min-w-0 flex-1 basis-[240px]">
          <h2 id="tm-nudge-title" class="m-0 font-display text-16 font-extrabold text-fg">{{ x().nudgeTitle(setup.percent()) }}</h2>
          <p class="m-0 mt-0.5 text-13.5 text-fg-secondary">{{ x().nudgeBody }}</p>
        </div>
        <div class="flex w-full gap-2 sm:w-auto">
          <p-button [label]="x().nudgeHide" severity="secondary" [text]="true" styleClass="flex-1 sm:flex-none" (onClick)="tour.hideNudge()" />
          <p-button [label]="x().nudgeBtn" icon="pi pi-arrow-right" iconPos="right" styleClass="flex-1 sm:flex-none" (onClick)="go()" />
        </div>
      </section>
    }
  `,
})
export class SetupNudgeComponent {
  readonly tour = inject(TourService);
  readonly setup = inject(SetupProgressService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly x = injectOnboardingTexts();

  private readonly isOwnerAdmin = computed(() => this.auth.currentUser()?.role === 'admin' && !this.auth.inSupportMode());

  /** Karşılama turu görüldü (tamamlandı/atlandı ya da şimdi bitti). */
  private readonly welcomeSeen = computed(() => {
    const st = this.tour.state();
    return !!st && (completedVersion(st, 'welcome-admin') > 0 || this.tour.lastFinished() === 'welcome-admin');
  });

  readonly show = computed(() => this.isOwnerAdmin() && this.welcomeSeen() && !this.tour.state()?.nudgeHidden
    && !this.tour.running() && this.setup.loaded() && this.setup.percent() < 100);

  constructor() {
    effect(() => {
      if (this.isOwnerAdmin() && this.auth.currentTenantId()) untracked(() => this.setup.start());
    });
  }

  go(): void {
    const next = this.setup.missing()[0];
    // Ayarlar'da kurulum kartı her bölümün üstünde: ilk eksik bölüme (ürün/müşteri gibi rota adımlarında İşletme'ye) git
    void this.router.navigate(['/settings', next?.section ?? 'business']);
  }
}
