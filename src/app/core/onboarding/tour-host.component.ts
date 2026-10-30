import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { AuthService } from '../auth/services/auth.service';
import { LogoMarkComponent } from '../../shared/ui/logo-mark.component';
import { formatDisplayName } from '../../layout/nav-items';
import { injectOnboardingTexts } from './onboarding.i18n';
import { TourService } from './tour.service';

/**
 * Uygulama kökünde (app.ts) bir kez: sayfa değişince TourService.autoCheck() ve ilk girişte karşılama modalı
 * ("Kısa bir tur ister misiniz? (2 dk)" — Başla / Sonra / Bir daha gösterme). Telefonda alt sayfa biçiminde.
 */
@Component({
  selector: 'app-tour-host',
  standalone: true,
  imports: [ButtonModule, DialogModule, LogoMarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="!!tour.welcome()" (visibleChange)="!$event && tour.welcome() && tour.laterWelcome()"
      [modal]="true" [draggable]="false" [resizable]="false" [closable]="true" [dismissableMask]="false"
      [position]="mobile() ? 'bottom' : 'center'" appendTo="body"
      [styleClass]="mobile() ? 'w-[calc(100vw-1rem)] !m-2' : 'w-[440px] max-w-[calc(100vw-2rem)]'"
      [header]="x().welcomeTitle(name())" (onShow)="focusStart()">
      <div class="flex items-start gap-3">
        <ui-logo-mark [size]="44" class="mt-0.5" />
        <p class="m-0 leading-relaxed text-fg-secondary" [class]="farmer() ? 'text-18' : 'text-15'">{{ body() }}</p>
      </div>
      <div class="mt-5 flex flex-col gap-2 sm:flex-row-reverse sm:items-center">
        <p-button id="tm-welcome-start" [label]="x().start" icon="pi pi-play" [size]="farmer() || mobile() ? 'large' : undefined"
          styleClass="w-full sm:w-auto" (onClick)="tour.acceptWelcome()" />
        <p-button [label]="x().later" severity="secondary" [size]="farmer() || mobile() ? 'large' : undefined"
          styleClass="w-full sm:w-auto" (onClick)="tour.laterWelcome()" />
        <span class="hidden flex-1 sm:block"></span>
        <p-button [label]="x().never" [text]="true" severity="secondary" styleClass="w-full sm:w-auto !text-13.5"
          (onClick)="tour.neverWelcome()" />
      </div>
    </p-dialog>
  `,
})
export class TourHostComponent {
  readonly tour = inject(TourService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly x = injectOnboardingTexts();

  readonly mobile = signal(typeof window !== 'undefined' && window.innerWidth < 640);
  readonly farmer = computed(() => this.tour.welcome()?.audience === 'farmer');
  readonly name = computed(() => formatDisplayName(this.auth.currentUser()?.displayName).split(' ')[0] ?? '');
  readonly body = computed(() => {
    const a = this.tour.welcome()?.audience;
    if (a === 'farmer') return this.x().welcomeFarmerBody;
    if (a === 'superadmin') return this.x().welcomeAdminBody;
    return this.x().welcomeBody;
  });

  private readonly url = toSignal(
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), map(e => e.urlAfterRedirects)),
    { initialValue: '' },
  );

  constructor() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const url = this.url();
      const ready = !this.auth.isLoading() && (!!this.auth.currentUser() || this.auth.isSuperAdmin());
      if (!url || !ready) return;
      clearTimeout(timer);
      // Sayfa ve verisi otursun (skeleton yerine gerçek öğeler vurgulansın)
      timer = setTimeout(() => untracked(() => void this.tour.autoCheck(url)), 900);
    });
    const onResize = () => this.mobile.set(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    inject(DestroyRef).onDestroy(() => { clearTimeout(timer); window.removeEventListener('resize', onResize); });
  }

  focusStart(): void {
    setTimeout(() => (document.querySelector('#tm-welcome-start button') as HTMLElement | null)?.focus(), 0);
  }
}
