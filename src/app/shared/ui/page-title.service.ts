import { computed, Injectable, signal } from '@angular/core';

export interface PageTitle {
  title: string;
  subtitle: string;
  backLink: string | unknown[] | null;
  backLabel: string;
}

/**
 * Sayfa başlığını kabuğa taşır (v2 "Saha / Komuta": başlık topbar'da / mobil koyu üst çubukta).
 *
 * - Kabuk (main-layout) `attachHost()` ile kendini kaydeder → `hosted()` true olur.
 * - `<ui-page-header>` hosted iken başlığını buraya yazar ve kendisi yalnız aksiyon satırını çizer.
 * - Kabuksuz yerlerde (superadmin paneli vb.) `<ui-page-header>` başlığı kendisi çizer.
 */
@Injectable({ providedIn: 'root' })
export class PageTitleService {
  private readonly hosts = signal(0);
  private owner: object | null = null;

  readonly hosted = computed(() => this.hosts() > 0);
  readonly current = signal<PageTitle | null>(null);

  /** Kabuk açılınca çağırır; dönen fonksiyon kabuk kapanınca çağrılır. */
  attachHost(): () => void {
    this.hosts.update(n => n + 1);
    return () => this.hosts.update(n => Math.max(0, n - 1));
  }

  set(owner: object, title: PageTitle): void {
    this.owner = owner;
    this.current.set(title);
  }

  clear(owner: object): void {
    if (this.owner !== owner) return;
    this.owner = null;
    this.current.set(null);
  }
}
