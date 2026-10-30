import { inject, InjectionToken } from '@angular/core';
import {
  AccountType, ApplicationLog, FarmerConsent, FarmerInvite, FarmerLink, FarmerProfile, FarmerPurchase, FarmField,
  PrescriberInfo, Recommendation, Season,
} from '../../../shared/models/farmer.model';
import { ShareTargets } from '../utils/consent.util';
import {
  FirestoreApplicationLogRepository, FirestoreFarmerAccountRepository, FirestoreFarmerLinkRepository,
  FirestoreFarmerPurchaseRepository, FirestoreFieldRepository, FirestoreRecommendationRepository, FirestoreSeasonRepository,
} from './firestore-farmer.repository';
import { FirestoreDealerFarmerRepository } from './firestore-dealer.repository';

/**
 * Çiftçi modülünün veri erişim sözleşmeleri (TASKS.md 6.1 deseni).
 * Sayfalar ve servisler YALNIZCA bu arayüzleri enjekte eder; Firestore yalnızca `firestore-*.repository.ts`
 * içinde. Kendi sunucuya (REST + PostgreSQL) geçişte ikinci bir implementasyon yazılıp token'lar değiştirilir.
 *
 * Yazma metotları çevrimdışı çalışır: istek yerel önbelleğe yazılır, senkronizasyon `FarmerSyncTracker` ile izlenir.
 */

export interface UserAccount { accountType: AccountType; farmerId: string | null; isActive: boolean }

export interface AcceptInviteInput {
  uid: string;
  email: string;
  invite: FarmerInvite;
  /** Bu kullanıcının zaten bağlı olduğu çiftçi profili (ikinci bayiye bağlanma) */
  existingFarmerId: string | null;
  /** users/{uid} zaten var mı */
  hasUserDoc: boolean;
  displayName: string;
  phone: string;
  consent: FarmerConsent;
}

export interface FarmerAccountRepository {
  getUserAccount(uid: string): Promise<UserAccount | null>;
  getFarmer(farmerId: string): Promise<FarmerProfile | null>;
  updateFarmer(farmerId: string, patch: Partial<Pick<FarmerProfile, 'displayName' | 'city' | 'district' | 'village' | 'cksNo'>>): Promise<void>;
  requestDeletion(farmerId: string): Promise<void>;
  getInvite(code: string): Promise<FarmerInvite | null>;
  /** Tek atomik yazım: farmers + users + farmerLinks + davet kullanıldı. Döner: farmerId */
  acceptInvite(input: AcceptInviteInput): Promise<string>;
}

export type NewField = Omit<FarmField, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>;
export type NewSeason = Omit<Season, 'id' | 'createdAt' | 'updatedAt'>;
export type NewApplicationLog = Omit<ApplicationLog, 'id' | 'createdAt' | 'updatedAt'>;

export interface FieldRepository {
  listByFarmer(farmerId: string): Promise<FarmField[]>;
  get(id: string): Promise<FarmField | null>;
  create(data: NewField): string;
  update(id: string, patch: Partial<NewField>): void;
  archive(id: string): void;
}

export interface SeasonRepository {
  listByFarmer(farmerId: string): Promise<Season[]>;
  create(data: NewSeason): string;
  update(id: string, patch: Partial<NewSeason>): void;
}

export interface ApplicationLogRepository {
  listByFarmer(farmerId: string, max?: number): Promise<ApplicationLog[]>;
  /** Kayıt + (ambardan seçildiyse) kalan miktarın düşülmesi tek yazımda. */
  create(data: NewApplicationLog, purchaseRemaining?: { purchaseId: string; index: number; remaining: number }): string;
  delete(id: string): void;
}

export interface FarmerLinkRepository {
  listByFarmer(farmerId: string): Promise<FarmerLink[]>;
  updateConsent(linkId: string, consent: FarmerConsent): Promise<void>;
  revoke(linkId: string): Promise<void>;
  /** İzinlere göre tarla/sezon/defter dokümanlarının `sharedTenantIds` alanını günceller. Döner: güncellenen doküman sayısı. */
  applySharing(farmerId: string, targets: ShareTargets): Promise<number>;
}

export interface FarmerPurchaseRepository {
  listByFarmer(farmerId: string, max?: number): Promise<FarmerPurchase[]>;
  listByFarmerAndTenant(farmerId: string, tenantId: string, max?: number): Promise<FarmerPurchase[]>;
}

export interface RecommendationRepository {
  listByFarmer(farmerId: string): Promise<Recommendation[]>;
}

// ---------------------------------------------------------------------------
// Bayi tarafı
// ---------------------------------------------------------------------------

export interface DealerProductOption {
  id: string;
  name: string;
  productType: string | null;
  /** Satış birimi (adet / kg / lt …) */
  unit: string | null;
  requiresPrescription: boolean;
  phiDays: number | null;
  activeIngredient: string | null;
}

export interface NewInvite {
  tenantId: string;
  tenantName: string;
  customerId: string;
  customerName: string;
  phoneLast4: string;
  farmerId: string | null;
  createdBy: string;
}

export type NewRecommendation = Omit<Recommendation, 'id' | 'createdAt' | 'status'>;

/** Bağlantı izleyicisinin müşteri kartından okuduğu alanlar. */
export interface CustomerLinkInfo { balance: number | null; farmerId: string | null }

export interface DealerFarmerRepository {
  getTenantName(tenantId: string): Promise<string>;
  findLinkForCustomer(tenantId: string, customerId: string): Promise<FarmerLink | null>;
  /** Aynı müşterinin kullanılmamış davetlerini iptal eder, yenisini oluşturur. */
  createInvite(input: NewInvite): Promise<FarmerInvite>;
  listOpenInvites(tenantId: string, customerId: string): Promise<FarmerInvite[]>;
  listSharedFields(tenantId: string, farmerId: string): Promise<FarmField[]>;
  listSharedSeasons(tenantId: string, farmerId: string): Promise<Season[]>;
  listSharedLogs(tenantId: string, farmerId: string, max: number): Promise<ApplicationLog[]>;
  listRecommendations(tenantId: string, farmerId: string): Promise<Recommendation[]>;
  createRecommendation(data: NewRecommendation): Promise<string>;
  withdrawRecommendation(id: string, uid: string): Promise<void>;
  getPrescriber(uid: string): Promise<PrescriberInfo | null>;
  listTenantStaff(tenantId: string): Promise<PrescriberInfo[]>;
  setPrescriber(uid: string, canPrescribe: boolean, licenseNo: string | null): Promise<void>;
  listPrescriptionProducts(tenantId: string): Promise<DealerProductOption[]>;
  /**
   * Müşterinin son satışlarını çiftçinin ambarına (farmerPurchases — maliyet fiyatı içermez) ve
   * veresiye bakiyesini bağlantıya yansıtır. Döner: yazılan satış sayısı.
   */
  syncCustomerToFarmer(link: FarmerLink, tenantName: string): Promise<number>;
  /**
   * Müşteri kartına bağlı çiftçiyi işaretler (`customers.farmerId`; koparılınca null). Yalnız bilgi amaçlı ipucu —
   * senkron her zaman `farmerLinks` üzerinden bağlantıyı bulur.
   */
  setCustomerFarmerId(customerId: string, farmerId: string | null): Promise<void>;
  /** İşletmenin bağlantılarını canlı izler (yalnız sunucu onaylı anlık görüntüler). Döner: aboneliği bitir. */
  watchTenantLinks(tenantId: string, next: (links: FarmerLink[]) => void, error: (err: unknown) => void): () => void;
  /** Tek müşteri kartının bakiye / farmerId alanlarını canlı izler. */
  watchCustomer(customerId: string, next: (c: CustomerLinkInfo | null) => void, error: (err: unknown) => void): () => void;

  // --- İşletme geneli ("Çiftçiler" sayfası ve ana sayfa kutusu, TASKS 14.9). Paylaşım izni kuralda zorlanır. ---
  /** İşletmenin tüm çiftçi bağlantıları (aktif + koparılmış). */
  listTenantLinks(tenantId: string): Promise<FarmerLink[]>;
  /** Kullanılmamış ve iptal edilmemiş davetler (süresi geçmişler dahil; ekranda ayrılır). */
  listTenantOpenInvites(tenantId: string): Promise<FarmerInvite[]>;
  revokeInvite(code: string): Promise<void>;
  /** Son öneri/reçete kayıtları (yeniden eskiye). */
  listTenantRecommendations(tenantId: string, max: number): Promise<Recommendation[]>;
  /** Bu işletmeyle paylaşılan aktif tarlalar (tüm çiftçiler). */
  listTenantSharedFields(tenantId: string): Promise<FarmField[]>;
  listTenantSharedSeasons(tenantId: string): Promise<Season[]>;
  /** Paylaşılan son defter kayıtları (tarihe göre yeniden eskiye). */
  listTenantRecentLogs(tenantId: string, max: number): Promise<ApplicationLog[]>;
  /** Hasat bekleme süresi `from` tarihinde/sonrasında biten paylaşılan kayıtlar. */
  listTenantPhiLogs(tenantId: string, from: Date, max: number): Promise<ApplicationLog[]>;
}

export const FARMER_ACCOUNT_REPOSITORY = new InjectionToken<FarmerAccountRepository>('FarmerAccountRepository', {
  providedIn: 'root', factory: () => inject(FirestoreFarmerAccountRepository),
});
export const FIELD_REPOSITORY = new InjectionToken<FieldRepository>('FieldRepository', {
  providedIn: 'root', factory: () => inject(FirestoreFieldRepository),
});
export const SEASON_REPOSITORY = new InjectionToken<SeasonRepository>('SeasonRepository', {
  providedIn: 'root', factory: () => inject(FirestoreSeasonRepository),
});
export const APPLICATION_LOG_REPOSITORY = new InjectionToken<ApplicationLogRepository>('ApplicationLogRepository', {
  providedIn: 'root', factory: () => inject(FirestoreApplicationLogRepository),
});
export const FARMER_LINK_REPOSITORY = new InjectionToken<FarmerLinkRepository>('FarmerLinkRepository', {
  providedIn: 'root', factory: () => inject(FirestoreFarmerLinkRepository),
});
export const FARMER_PURCHASE_REPOSITORY = new InjectionToken<FarmerPurchaseRepository>('FarmerPurchaseRepository', {
  providedIn: 'root', factory: () => inject(FirestoreFarmerPurchaseRepository),
});
export const RECOMMENDATION_REPOSITORY = new InjectionToken<RecommendationRepository>('RecommendationRepository', {
  providedIn: 'root', factory: () => inject(FirestoreRecommendationRepository),
});
export const DEALER_FARMER_REPOSITORY = new InjectionToken<DealerFarmerRepository>('DealerFarmerRepository', {
  providedIn: 'root', factory: () => inject(FirestoreDealerFarmerRepository),
});
