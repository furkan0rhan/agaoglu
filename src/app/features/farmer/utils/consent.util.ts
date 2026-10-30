import { FarmerConsent, FarmerLink, FARMER_CONSENT_TEXT_VERSION, RecommendationItem } from '../../../shared/models/farmer.model';

/**
 * İzin (KVKK açık rıza) ve paylaşım yardımcıları. Çiftçi dokümanlarındaki `sharedTenantIds`
 * yalnızca AKTİF bağlantı + ilgili izin açıkken bayiyi içerir (kurallar bu alana bakar).
 */

export function defaultConsent(now: Date = new Date()): FarmerConsent {
  return { purchases: true, fields: false, logs: false, notifications: false, textVersion: FARMER_CONSENT_TEXT_VERSION, grantedAt: now, updatedAt: now };
}

export interface ShareTargets {
  /** tarlalar + sezonlar */
  fields: string[];
  /** uygulama defteri */
  logs: string[];
}

export function computeShareTargets(links: readonly Pick<FarmerLink, 'tenantId' | 'status' | 'consent'>[]): ShareTargets {
  const active = links.filter(l => l.status === 'active');
  const uniq = (xs: string[]) => [...new Set(xs)].sort();
  return {
    fields: uniq(active.filter(l => l.consent.fields).map(l => l.tenantId)),
    logs: uniq(active.filter(l => l.consent.logs).map(l => l.tenantId)),
  };
}

export function sameTenantSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every(x => s.has(x));
}

/** İzin metni sürümü değiştiyse çiftçiden yeniden onay istenir. */
export function needsReconsent(c: Pick<FarmerConsent, 'textVersion'>): boolean {
  return c.textVersion !== FARMER_CONSENT_TEXT_VERSION;
}

// ---------------------------------------------------------------------------
// Öneri (bayideki yetkili kişi) doğrulaması — kurallardaki kontrolün istemci karşılığı
// ---------------------------------------------------------------------------

export type RecommendationError =
  | 'not-prescriber' | 'no-license' | 'no-target' | 'no-items' | 'too-many-items'
  | 'item-incomplete' | 'prescription-required' | 'link-inactive';

export const MAX_RECOMMENDATION_ITEMS = 5;

export function recommendationNeedsPrescription(items: readonly Pick<RecommendationItem, 'requiresPrescription'>[]): boolean {
  return items.some(i => i.requiresPrescription);
}

export function validateRecommendation(input: {
  canPrescribe: boolean;
  licenseNo: string | null | undefined;
  linkActive: boolean;
  target: string;
  items: readonly RecommendationItem[];
  prescriptionNo: string | null | undefined;
}): RecommendationError[] {
  const errs: RecommendationError[] = [];
  if (!input.canPrescribe) errs.push('not-prescriber');
  if (!input.licenseNo?.trim()) errs.push('no-license');
  if (!input.linkActive) errs.push('link-inactive');
  if (!input.target.trim()) errs.push('no-target');
  if (input.items.length === 0) errs.push('no-items');
  if (input.items.length > MAX_RECOMMENDATION_ITEMS) errs.push('too-many-items');
  if (input.items.some(i => !i.productName.trim() || !i.dose.trim())) errs.push('item-incomplete');
  if (recommendationNeedsPrescription(input.items) && (input.prescriptionNo ?? '').trim().length < 4) errs.push('prescription-required');
  return errs;
}
