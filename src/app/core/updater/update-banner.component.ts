import { ChangeDetectionStrategy, Component, DestroyRef, inject, input } from '@angular/core';
import { UpdaterService } from './updater.service';
import { injectUpdaterTexts } from './updater.i18n';

/**
 * Masaüstü güncelleme bildirimi (sağ altta, işi bölmeyen kart).
 * Kabuk (main-layout) yalnız Tauri masaüstünde ve `@defer` ile yükler; denetimi de bu bileşen başlatır.
 */
@Component({
  selector: 'app-update-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let m = updater.mode();
    @if (m !== 'hidden' || updater.installError()) {
      <div role="status" aria-live="polite"
        class="fixed bottom-4 right-4 z-sheet w-[min(380px,calc(100vw-2rem))] animate-sheet-up rounded-token-xl border border-line-strong bg-surface p-3.5 shadow-overlay max-lg:bottom-[calc(84px+var(--safe-bottom))]">
        <div class="flex items-start gap-3">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-token-md bg-brand-soft text-brand-text">
            <i class="pi" [class]="m === 'progress' ? 'pi-spin pi-spinner' : 'pi-download'" aria-hidden="true"></i>
          </span>
          <div class="min-w-0 flex-1">
            @if (m === 'progress') {
              <p class="m-0 text-sm font-semibold text-fg">{{ updater.downloaded() ? u().installing : u().downloading }}</p>
              <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted" role="progressbar"
                [attr.aria-valuenow]="updater.progress()" aria-valuemin="0" aria-valuemax="100">
                <div class="h-full rounded-full bg-brand transition-[width]"
                  [style.width.%]="updater.progress() ?? 100" [class.animate-pulse]="updater.progress() === null"></div>
              </div>
              @if (updater.progress() !== null) {
                <p class="num m-0 mt-1 text-12 text-fg-muted">%{{ updater.progress() }}</p>
              }
            } @else if (updater.installError()) {
              <p class="m-0 text-sm font-semibold text-danger-text">{{ u().failed }}</p>
              <div class="mt-2.5 flex flex-wrap gap-2">
                @if (m === 'prompt') {
                  <button type="button" (click)="install()"
                    class="tap inline-flex cursor-pointer items-center gap-2 rounded-token-md border-0 bg-brand px-3 text-sm font-semibold text-brand-contrast">{{ u().updateNow }}</button>
                }
                <button type="button" (click)="later()"
                  class="tap inline-flex cursor-pointer items-center rounded-token-md border border-line bg-surface px-3 text-sm font-semibold text-fg-secondary hover:bg-surface-hover">{{ u().later }}</button>
              </div>
            } @else {
              <p class="m-0 text-sm font-semibold text-fg">{{ u().available(updater.availableVersion() ?? '') }}</p>
              <p class="m-0 mt-0.5 text-12.5 text-fg-muted">{{ m === 'notice' ? u().saleNotice : u().availableDesc }}</p>
              <div class="mt-2.5 flex flex-wrap gap-2">
                @if (m === 'prompt') {
                  <button type="button" (click)="install()"
                    class="tap inline-flex cursor-pointer items-center gap-2 rounded-token-md border-0 bg-brand px-3 text-sm font-semibold text-brand-contrast">
                    <i class="pi pi-refresh" aria-hidden="true"></i>{{ u().updateNow }}</button>
                }
                <button type="button" (click)="later()"
                  class="tap inline-flex cursor-pointer items-center rounded-token-md border border-line bg-surface px-3 text-sm font-semibold text-fg-secondary hover:bg-surface-hover">{{ u().later }}</button>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class UpdateBannerComponent {
  readonly updater = inject(UpdaterService);
  readonly u = injectUpdaterTexts();
  /** Satış sürüyor mu (kabuk: POS sepeti dolu). Doluyken kurulum butonu gösterilmez. */
  readonly saleInProgress = input(false);

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(this.updater.registerSaleInProgress(() => this.saleInProgress()));
    this.updater.start(destroyRef);
  }

  install(): void { void this.updater.install(); }

  later(): void {
    this.updater.installError.set(false);
    this.updater.dismiss();
  }
}
