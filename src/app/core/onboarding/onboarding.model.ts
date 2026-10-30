/**
 * Ürün turu (onboarding) — saf tipler ve yardımcılar (Angular'sız, test edilebilir).
 * Kalıcı durum: `users/{uid}.onboarding` (kurallar: kullanıcı kendi dokümanında yalnız bu alanı + profil alanlarını yazar)
 * ve cihazda localStorage yedeği (yazma başarısızsa, superadmin'in users dokümanı yoksa, çevrimdışı).
 */

/** Tur kimlikleri. Yeni tur eklerken `TOURS` (tours.ts) ve i18n'e de ekleyin. */
export type TourId = 'welcome-admin' | 'welcome-cashier' | 'pos' | 'farmer' | 'superadmin';

/** Turun çalıştığı alan (kabuk). */
export type TourArea = 'dealer' | 'farmer' | 'admin';

/** Kimin gördüğü (bayi rolü / çiftçi / superadmin). */
export type TourAudience = 'admin' | 'cashier' | 'staff' | 'farmer' | 'superadmin';

/** Kalıcı onboarding durumu (Firestore + localStorage). */
export interface OnboardingState {
  /** Şema sürümü (alan yapısı değişirse artar). */
  version: number;
  /** Tamamlanan / atlanan turlar `"<id>@<sürüm>"` biçiminde (ör. `pos@1`). */
  completedTours: string[];
  /** "Bir daha gösterme": otomatik karşılama ve otomatik turlar kapalı (menüden yine başlatılabilir). */
  dismissed?: boolean;
  /** Dashboard'daki "kurulumu tamamla" kısayolu kapatıldı. */
  nudgeHidden?: boolean;
}

export const ONBOARDING_SCHEMA = 1;

export function emptyState(): OnboardingState {
  return { version: ONBOARDING_SCHEMA, completedTours: [] };
}

/** Bilinmeyen veriyi güvenle duruma çevirir (bozuk/eksik alanlar yok sayılır). */
export function parseState(raw: unknown): OnboardingState {
  const s = emptyState();
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Record<string, unknown>;
  if (typeof r['version'] === 'number') s.version = r['version'];
  if (Array.isArray(r['completedTours'])) {
    s.completedTours = r['completedTours'].filter((x): x is string => typeof x === 'string' && /^[a-z-]+@\d+$/.test(x)).slice(0, 50);
  }
  if (r['dismissed'] === true) s.dismissed = true;
  if (r['nudgeHidden'] === true) s.nudgeHidden = true;
  return s;
}

/** İki kaynağı birleştirir (cihaz + hesap): tamamlananların birleşimi, bayraklar VEYA. */
export function mergeStates(a: OnboardingState, b: OnboardingState): OnboardingState {
  const set = new Set([...a.completedTours, ...b.completedTours]);
  const out: OnboardingState = {
    version: Math.max(a.version, b.version, ONBOARDING_SCHEMA),
    completedTours: [...set].sort(),
  };
  if (a.dismissed || b.dismissed) out.dismissed = true;
  if (a.nudgeHidden || b.nudgeHidden) out.nudgeHidden = true;
  return out;
}

/** Turun tamamlanan en yüksek sürümü (hiç yoksa 0). */
export function completedVersion(state: OnboardingState, id: TourId): number {
  let v = 0;
  for (const entry of state.completedTours) {
    const [tid, ver] = entry.split('@');
    if (tid === id) v = Math.max(v, Number(ver) || 0);
  }
  return v;
}

/** Turu (verilen sürümle) tamamlandı işaretler; aynı turun eski kayıtları silinir. */
export function markCompleted(state: OnboardingState, id: TourId, version: number): OnboardingState {
  const rest = state.completedTours.filter(e => e.split('@')[0] !== id);
  return { ...state, completedTours: [...rest, `${id}@${version}`].sort() };
}

/** Adım tanımı. `target` = `data-tour` adı(ları); ilk GÖRÜNÜR olan vurgulanır. Yoksa ortada bilgi kartı. */
export interface TourStepDef {
  key: string;
  target?: string | string[];
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** Bu adım hangi tur sürümünde eklendi (varsayılan 1). Sürüm artınca yalnız yeni adımlar gösterilebilir. */
  since?: number;
}

export interface TourDef {
  id: TourId;
  /** Adım eklenince/değişince artırın: kullanıcıya yeni adımlar ("yenilikler") gösterilir. */
  version: number;
  area: TourArea;
  audience: TourAudience[];
  /** Turun çalıştığı rota (başlatınca oraya gidilir). */
  route: string;
  /** Bu rotalarda "Bu sayfayı tanı" bu turu açar (önek eşleşmesi). */
  pages?: string[];
  steps: TourStepDef[];
}

/**
 * Gösterilecek adımlar: tur hiç tamamlanmadıysa (ya da `full`) hepsi; eski sürüm tamamlandıysa yalnız
 * o sürümden sonra eklenenler (hiç yeni adım yoksa boş).
 */
export function stepsToShow(def: TourDef, doneVersion: number, full: boolean): TourStepDef[] {
  if (full || doneVersion <= 0) return def.steps;
  if (doneVersion >= def.version) return [];
  return def.steps.filter(s => (s.since ?? 1) > doneVersion);
}

/** Tur bu kitleye mi? */
export function tourFor(def: TourDef, audience: TourAudience): boolean {
  return def.audience.includes(audience);
}

/** URL bu turun sayfası mı (sorgu/parça hariç önek eşleşmesi). */
export function matchesPage(def: TourDef, url: string): boolean {
  const clean = url.split(/[?#]/)[0];
  return (def.pages ?? [def.route]).some(p => clean === p || clean.startsWith(p + '/'));
}
