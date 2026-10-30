import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationCancellationCode, NavigationEnd, NavigationError, Router, RouterOutlet } from '@angular/router';
import { TourHostComponent } from './core/onboarding/tour-host.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TourHostComponent],
  // Ürün turu kökü (karşılama modalı + Dialog) ilk yüklemeye girmesin: tarayıcı boşta kalınca yüklenir.
  // #31: ilk gezinme (oturum + profil + guard'lar) bitene kadar boş ekran yerine açılış ekranı
  // (index.html'deki .tm-boot ile aynı görünüm; stiller orada).
  template: `
    @if (!ready()) {
      <div class="tm-boot" role="status" aria-live="polite">
        <div class="tm-boot-in">
          <div class="tm-boot-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 21v-8" /><path d="M12 13C12 8 9 5 4 5c0 5 3 8 8 8z" /><path d="M12 15c0-4 3-7 8-7 0 5-3 7-8 7z" />
            </svg>
          </div>
          <div>Tarım Market Pro</div>
          <div class="tm-boot-bar" aria-hidden="true"></div>
          <span class="sr-only">Yükleniyor…</span>
        </div>
      </div>
    }
    <router-outlet />@defer (on idle) { <app-tour-host /> }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  /** İlk gezinme tamamlandı mı (başarılı, iptal ya da hata — her durumda açılış ekranı kalkar). */
  readonly ready = signal(false);

  constructor() {
    inject(Router).events.pipe(takeUntilDestroyed()).subscribe(e => {
      // Guard yönlendirmesi (UrlTree) yeni gezinme başlatır: açılış ekranı onun sonuna kadar kalsın
      if (e instanceof NavigationCancel && e.code === NavigationCancellationCode.Redirect) return;
      if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) this.ready.set(true);
    });
  }
}
