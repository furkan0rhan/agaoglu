import { computed, Injectable, signal } from '@angular/core';

/**
 * Çevrimdışı yazma takibi. Firestore yazmaları yerel önbelleğe hemen düşer; sunucuya ulaşınca promise çözülür.
 * Arayüz "Gönderilmeyi bekliyor" rozetini `pending()` ile gösterir; reddedilen yazma `lastError()`'a düşer.
 */
@Injectable({ providedIn: 'root' })
export class FarmerSyncTracker {
  private readonly count = signal(0);
  readonly pending = computed(() => this.count() > 0);
  readonly lastError = signal<unknown>(null);

  track(p: Promise<unknown>): void {
    this.count.update(n => n + 1);
    p.then(
      () => undefined,
      err => this.lastError.set(err),
    ).finally(() => this.count.update(n => Math.max(0, n - 1)));
  }

  clearError(): void {
    this.lastError.set(null);
  }
}
