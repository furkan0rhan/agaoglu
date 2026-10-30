import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';
import { filter } from 'rxjs';
import { AuthService } from '../auth/services/auth.service';
import { LoggerService } from '../logging/logger.service';
import { ThemeService } from '../theme/theme.service';
import { injectOnboardingTexts } from './onboarding.i18n';
import {
  OnboardingState, TourAudience, TourDef, TourId, completedVersion, emptyState, markCompleted, matchesPage, mergeStates,
  parseState, stepsToShow, tourFor,
} from './onboarding.model';
import { TOURS, TOUR_LIST } from './tours';
import type { RunnerHandle, RunnerStep } from './tour-runner';

const LOCAL_PREFIX = 'tm.onboarding.';
const LATER_KEY = 'tm.onboarding.later';

/** Kitlenin karşılama turu. */
export function welcomeTourId(a: TourAudience): TourId {
  switch (a) {
    case 'admin': return 'welcome-admin';
    case 'farmer': return 'farmer';
    case 'superadmin': return 'superadmin';
    default: return 'welcome-cashier';
  }
}

/** Görünür mü (display:none / gizli üst öğe / sıfır boyut değil). */
function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none';
}

/** `data-tour` adlarından ilk görünen öğe. */
export function findTarget(names: string | string[] | undefined, root: ParentNode = document): Element | null {
  if (!names) return null;
  for (const n of Array.isArray(names) ? names : [names]) {
    for (const el of Array.from(root.querySelectorAll(`[data-tour="${n}"]`))) {
      if (isVisible(el)) return el;
    }
  }
  return null;
}

/**
 * Ürün turu servisi: tur durumu (kullanıcı + cihaz), karşılama modalı, başlat / atla / bitir.
 * Durum `users/{uid}.onboarding`'e yazılır; yazılamazsa (superadmin'in users dokümanı yok, çevrimdışı,
 * eski kurallar) localStorage'da kalır. Kütüphane (driver.js) yalnız tur başlarken dinamik yüklenir.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly logger = inject(LoggerService);
  private readonly theme = inject(ThemeService);
  private readonly texts = injectOnboardingTexts();

  /** null = henüz yüklenmedi. */
  readonly state = signal<OnboardingState | null>(null);
  private loadedUid = '';
  private loading: Promise<void> | null = null;

  /** Çalışan tur. */
  readonly running = signal<TourId | null>(null);
  /** Karşılama modalı (kitle + tur). */
  readonly welcome = signal<{ audience: TourAudience; tour: TourId } | null>(null);
  /** Son biten tur (dashboard kurulum kısayolu için). */
  readonly lastFinished = signal<TourId | null>(null);
  private handle: RunnerHandle | null = null;
  private autoBusy = false;

  readonly dismissed = computed(() => !!this.state()?.dismissed);

  constructor() {
    // Tur sürerken sayfadan ayrılınca (F2, geri tuşu…) turu kapat: öğeler artık ekranda değil
    const sub = this.router.events.pipe(filter(e => e instanceof NavigationStart)).subscribe(() => this.handle?.destroy());
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  // ---------------------------------------------------------------- kitle / turlar

  /** URL'ye göre kitle (bayi rolü, çiftçi, superadmin). Oturum yoksa ya da destek modundaysa null. */
  audienceFor(url: string): TourAudience | null {
    const clean = url.split(/[?#]/)[0];
    if (clean.startsWith('/auth') || clean.startsWith('/verify-email') || clean.startsWith('/ciftci/giris') || clean.startsWith('/ciftci/davet')) return null;
    if (clean.startsWith('/admin')) return this.auth.isSuperAdmin() ? 'superadmin' : null;
    const u = this.auth.currentUser();
    if (!u || this.auth.inSupportMode()) return null;
    if (clean.startsWith('/ciftci')) return u.accountType === 'farmer' ? 'farmer' : null;
    if (u.accountType === 'farmer') return null;
    return u.role;
  }

  /** Bu sayfaya özgü tur (varsa) — "Bu sayfayı tanı". */
  pageTourFor(url: string): TourDef | null {
    const a = this.audienceFor(url);
    if (!a) return null;
    return TOUR_LIST.find(d => tourFor(d, a) && (d.pages?.length ?? 0) > 0 && matchesPage(d, url)) ?? null;
  }

  /** "Bu sayfayı tanı" gösterilsin mi: sayfa turu var ve karşılama turuyla aynı değil ("Turu başlat" zaten açar). */
  hasPageTour(url: string): boolean {
    const def = this.pageTourFor(url);
    const a = this.audienceFor(url);
    return !!def && !!a && def.id !== welcomeTourId(a);
  }

  // ---------------------------------------------------------------- durum

  /** Kullanıcının durumunu yükler (hesap + cihaz birleşimi). Aynı uid için bir kez. */
  ensureLoaded(): Promise<void> {
    const uid = this.auth.currentUserId();
    if (!uid) return Promise.resolve();
    if (this.loadedUid === uid && this.state()) return Promise.resolve();
    if (this.loading && this.loadedUid === uid) return this.loading;
    this.loadedUid = uid;
    this.state.set(null);
    this.loading = (async () => {
      const local = this.readLocal(uid);
      let remote = emptyState();
      try {
        const snap = await getDoc(doc(this.firestore, 'users', uid));
        if (snap.exists()) remote = parseState(snap.data()['onboarding']);
      } catch (err) {
        this.logger.warn('Onboarding durumu okunamadı (yerel kullanılıyor)', err);
      }
      if (this.loadedUid === uid) this.state.set(mergeStates(local, remote));
    })().finally(() => { this.loading = null; });
    return this.loading;
  }

  private readLocal(uid: string): OnboardingState {
    try { return parseState(JSON.parse(localStorage.getItem(LOCAL_PREFIX + uid) ?? 'null')); } catch { return emptyState(); }
  }

  private save(next: OnboardingState): void {
    this.state.set(next);
    const uid = this.loadedUid;
    if (!uid) return;
    try { localStorage.setItem(LOCAL_PREFIX + uid, JSON.stringify(next)); } catch { /* yoksay */ }
    if (this.auth.inSupportMode()) return; // destek modunda işletme kullanıcısı adına yazma
    updateDoc(doc(this.firestore, 'users', uid), { onboarding: next })
      .catch(err => this.logger.warn('Onboarding durumu hesaba yazılamadı (cihazda saklandı)', err));
  }

  private laterThisSession(): boolean {
    try { return sessionStorage.getItem(LATER_KEY) === '1'; } catch { return false; }
  }

  // ---------------------------------------------------------------- otomatik akış

  /**
   * Sayfa değişince çağrılır: ilk girişte karşılama modalı; karşılama görüldüyse sayfaya özgü turun
   * ilk gösterimi (ör. POS'a ilk giriş) ya da tur sürümü arttıysa yalnız yeni adımlar.
   */
  async autoCheck(url: string): Promise<void> {
    if (this.autoBusy || this.running() || this.welcome()) return;
    const audience = this.audienceFor(url);
    if (!audience) return;
    this.autoBusy = true;
    try {
      await this.ensureLoaded();
      const st = this.state();
      if (!st || st.dismissed || this.laterThisSession() || this.running()) return;
      if (this.router.url.split(/[?#]/)[0] !== url.split(/[?#]/)[0]) return; // bu arada sayfa değişti

      const welcomeId = welcomeTourId(audience);
      if (completedVersion(st, welcomeId) === 0) {
        this.welcome.set({ audience, tour: welcomeId });
        return;
      }
      const page = this.pageTourFor(url);
      if (!page) return;
      const done = this.isDone(st, page.id);
      if (done === 0 || stepsToShow(page, done, false).length) {
        await this.start(page.id, { full: false, auto: true });
      }
    } finally {
      this.autoBusy = false;
    }
  }

  /** Tamamlanan sürüm; kasiyer turu POS turunun ilk sürümünü de karşılar. */
  private isDone(st: OnboardingState, id: TourId): number {
    const v = completedVersion(st, id);
    if (id === 'pos' && v === 0 && completedVersion(st, 'welcome-cashier') > 0) return 1;
    return v;
  }

  // ---------------------------------------------------------------- karşılama modalı

  acceptWelcome(): void {
    const w = this.welcome();
    this.welcome.set(null);
    if (w) void this.start(w.tour, { full: true });
  }

  laterWelcome(): void {
    this.welcome.set(null);
    try { sessionStorage.setItem(LATER_KEY, '1'); } catch { /* yoksay */ }
  }

  neverWelcome(): void {
    const w = this.welcome();
    this.welcome.set(null);
    const st = this.state() ?? emptyState();
    this.save({ ...(w ? markCompleted(st, w.tour, TOURS[w.tour].version) : st), dismissed: true });
  }

  hideNudge(): void {
    this.save({ ...(this.state() ?? emptyState()), nudgeHidden: true });
  }

  // ---------------------------------------------------------------- başlat / bitir

  /** Mevcut kullanıcının karşılama turunu baştan başlatır (menü / Ayarlar > Hakkında). */
  restartWelcome(): void {
    const a = this.audienceFor(this.router.url) ?? this.fallbackAudience();
    if (a) void this.start(welcomeTourId(a), { full: true });
  }

  /** "Bu sayfayı tanı". */
  startPageTour(): void {
    const def = this.pageTourFor(this.router.url);
    if (def) void this.start(def.id, { full: true });
  }

  private fallbackAudience(): TourAudience | null {
    const u = this.auth.currentUser();
    if (u?.accountType === 'farmer') return 'farmer';
    if (u?.role) return u.role;
    return this.auth.isSuperAdmin() ? 'superadmin' : null;
  }

  async start(id: TourId, opts: { full: boolean; auto?: boolean }): Promise<void> {
    if (this.running()) return;
    const def = TOURS[id];
    await this.ensureLoaded();
    const st = this.state() ?? emptyState();
    const defs = stepsToShow(def, opts.full ? 0 : this.isDone(st, id), opts.full);
    if (!defs.length) return;

    this.running.set(id);
    try {
      if (!matchesPage(def, this.router.url)) {
        const ok = await this.router.navigateByUrl(def.route);
        if (!ok) return;
      }
      // Sayfa çizilsin: ilk hedef görünene kadar en çok ~3 sn bekle
      const firstTarget = defs.find(s => s.target)?.target;
      await waitFor(() => !firstTarget || !!findTarget(firstTarget), 3000);
      if (opts.auto && this.welcome()) return;

      const tx = this.texts();
      const steps: RunnerStep[] = [];
      for (const s of defs) {
        const el = findTarget(s.target);
        if (s.target && !el) continue; // bu ekranda yok (rol / ekran genişliği) → atla
        const text = tx.tours[id][s.key];
        steps.push({ element: el ?? undefined, title: text?.title ?? '', body: text?.body ?? '', side: s.side, align: s.align });
      }
      if (!steps.length) return;

      const { runTour } = await import('./tour-runner');
      this.handle = runTour(steps, {
        next: tx.next, prev: tx.prev, done: tx.done, close: tx.close, progress: tx.progress,
      }, { dark: this.theme.isDark(), large: def.area === 'farmer' });
      await this.handle.finished;
      // Bitti ya da atlandı: bir daha kendiliğinden açılmasın (menüden her zaman açılır)
      this.save(markCompleted(this.state() ?? emptyState(), id, def.version));
      this.lastFinished.set(id);
    } catch (err) {
      this.logger.warn('Tur başlatılamadı', err);
    } finally {
      this.handle = null;
      this.running.set(null);
    }
  }
}

function waitFor(cond: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise(resolve => {
    const t0 = Date.now();
    const tick = () => {
      if (cond() || Date.now() - t0 > timeoutMs) { setTimeout(resolve, 120); return; }
      setTimeout(tick, 100);
    };
    tick();
  });
}
