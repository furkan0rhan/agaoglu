/**
 * Çiftçi modülü modelleri (docs/CIFTCI-MODULU.md §5.2).
 *
 * İlkeler:
 *  - Çiftçi verisi tenant verisi değildir; her doküman `farmerId` ile çiftçiye bağlıdır.
 *  - `farmerId` ≠ Firebase `uid` (PIN sıfırlamada yeni uid aynı çiftçi profiline bağlanır).
 *  - Tarihler `Date`; Firestore `Timestamp` dönüşümü yalnızca repository katmanında (features/farmer/data).
 *  - Uygulama ilaç/doz ÖNERMEZ. Öneriyi yalnızca bayideki yetkili kişi (`canPrescribe`) yazar (Recommendation).
 */

/** Hesap türü. users/{uid}.accountType alanı yoksa 'dealer' kabul edilir. */
export type AccountType = 'dealer' | 'farmer';

/** Sentetik e-posta alan adı: 90XXXXXXXXXX@ciftci.tarimmarket.app (telefon + 6 haneli PIN girişi). */
export const FARMER_EMAIL_DOMAIN = 'ciftci.tarimmarket.app';

/** Bu e-posta çiftçi giriş sistemine ait sentetik bir adres mi? */
export function isFarmerEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith('@' + FARMER_EMAIL_DOMAIN);
}

/** KVKK izin metni sürümü (metin değişirse artırılır, çiftçiden yeniden onay istenir). */
export const FARMER_CONSENT_TEXT_VERSION = 'v1';

/** Davet geçerlilik süresi (gün). */
export const FARMER_INVITE_TTL_DAYS = 7;

/** farmers/{farmerId} */
export interface FarmerProfile {
  id: string;
  /** Bu profile erişebilen Auth kullanıcıları (normalde 1; PIN sıfırlamada yenisiyle değiştirilir). */
  ownerUids: string[];
  displayName: string;
  /** 90XXXXXXXXXX (yalnız rakam) */
  phone: string;
  city: string | null;
  district: string | null;
  village: string | null;
  cksNo: string | null;
  /** Hesap/veri silme talebi (MVP: talep kaydı, işlem manuel). */
  deletionRequestedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/** farmerInvites/{code} — bayinin ürettiği tek kullanımlık davet. */
export interface FarmerInvite {
  code: string;
  tenantId: string;
  tenantName: string;
  customerId: string;
  customerName: string;
  /** Müşteri kaydındaki telefonun son 4 hanesi (kuralda sentetik e-posta ile eşleştirilir). */
  phoneLast4: string;
  /** Doluysa: mevcut çiftçiye yeni cihaz / PIN sıfırlama daveti. */
  farmerId: string | null;
  expiresAt: Date;
  used: boolean;
  usedBy: string | null;
  usedFarmerId: string | null;
  /** Yeni davet üretilince eskisi iptal edilir. */
  revoked: boolean;
  createdBy: string;
  createdAt: Date | null;
}

export interface FarmerConsent {
  /** Bayi alışverişlerimi ve borcumu bana gösterebilir (zorunlu — hizmetin kendisi). */
  purchases: true;
  /** Bayi tarlalarımı ve ekim planımı görebilir. */
  fields: boolean;
  /** Bayi uygulama defterimi (ilaçlama/gübreleme kayıtları) görebilir. */
  logs: boolean;
  /** Bayi bana hatırlatma gönderebilir. */
  notifications: boolean;
  textVersion: string;
  grantedAt: Date | null;
  updatedAt: Date | null;
}

export type FarmerLinkStatus = 'active' | 'revoked';

/** farmerLinks/{tenantId}_{farmerId} — açık rızayla kurulan çiftçi ↔ bayi bağlantısı. */
export interface FarmerLink {
  id: string;
  tenantId: string;
  farmerId: string;
  customerId: string;
  inviteCode: string;
  status: FarmerLinkStatus;
  consent: FarmerConsent;
  tenantName: string;
  farmerName: string;
  /** Bayinin müşteri kaydındaki veresiye bakiyesi (bayi tarafı senkronlar). */
  balance: number | null;
  balanceUpdatedAt: Date | null;
  /** Sıradaki (gecikmemiş) ödenmemiş taksit — bayi senkronlar. Eski bağlantılarda yok (null). */
  nextDue: { date: Date; amount: number } | null;
  /** Vadesi geçmiş, ödenmemiş toplam (bayi senkronlar). */
  overdueAmount: number | null;
  /** Taksit takvimi (ödenmemişler + son ödenenler, vadeye göre). Bayi senkronlar; eski bağlantılarda boş. */
  schedule: FarmerInstallment[];
  createdAt: Date | null;
}

/** Çiftçiye gösterilen taksit (bayinin veresiye kayıtlarından hesaplanır; tahsilatlar en eski vadeden düşülür). */
export interface FarmerInstallment {
  /** Vadesiz eski borçta null */
  dueDate: Date | null;
  amount: number;
  /** Ödenmemiş kalan */
  remaining: number;
  /** Taksit no / borçtaki taksit sayısı */
  no: number;
  count: number;
  /** Bağlı satışın fiş numarası (biliniyorsa) */
  saleNumber: string | null;
}

export function farmerLinkId(tenantId: string, farmerId: string): string {
  return `${tenantId}_${farmerId}`;
}

export type IrrigationType = 'irrigated' | 'dry';

export interface GeoPoint { lat: number; lng: number }

/** fields/{fieldId} */
export interface FarmField {
  id: string;
  farmerId: string;
  name: string;
  areaDecare: number;
  city: string | null;
  district: string | null;
  village: string | null;
  ada: string | null;
  parsel: string | null;
  location: GeoPoint | null;
  irrigation: IrrigationType;
  /** consent.fields == true olan aktif bayiler */
  sharedTenantIds: string[];
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type SeasonStatus = 'planned' | 'active' | 'harvested';

/** seasons/{seasonId} — bir tarlada bir ürün dönemi. */
export interface Season {
  id: string;
  farmerId: string;
  fieldId: string;
  /** crops.ts'teki kod: 'wheat', 'maize', 'tomato' … */
  crop: string;
  variety: string | null;
  sowingDate: Date | null;
  expectedHarvestDate: Date | null;
  harvestDate: Date | null;
  status: SeasonStatus;
  sharedTenantIds: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type ApplicationType = 'pesticide' | 'fertilizer' | 'irrigation' | 'tillage' | 'sowing' | 'other';
export const APPLICATION_TYPES: readonly ApplicationType[] = ['pesticide', 'fertilizer', 'irrigation', 'tillage', 'sowing', 'other'];

/**
 * PHI (hasat öncesi bekleme süresi) bilgisinin kaynağı:
 *  - 'dealer': bayinin ürün kartına girdiği etiket bilgisi (Product.phiDays) — satın alma kaydından
 *  - 'recommendation': bayideki yetkili kişinin yazdığı öneri
 *  - 'manual': çiftçinin ürün etiketinden kendisinin girdiği değer
 */
export type PhiSource = 'dealer' | 'recommendation' | 'manual';

/** applicationLogs/{logId} — çiftçinin KİŞİSEL defteri (resmî ÜKD değildir). */
export interface ApplicationLog {
  id: string;
  farmerId: string;
  fieldId: string;
  seasonId: string | null;
  type: ApplicationType;
  date: Date;
  /** Ambardan seçildiyse: farmerPurchases/{purchaseId} + kalem sırası */
  purchaseId: string | null;
  purchaseItemIndex: number | null;
  productName: string | null;
  quantity: number | null;
  unit: string | null;
  areaDecare: number | null;
  /** quantity / areaDecare (aritmetik; öneri değildir) */
  dosePerDecare: number | null;
  appliedBy: string | null;
  notes: string | null;
  phiDays: number | null;
  phiSource: PhiSource | null;
  earliestHarvestDate: Date | null;
  recommendationId: string | null;
  sharedTenantIds: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

/** Satın alınan kalem (bayi satışından türetilir; fiyatlar satış belgesindeki gibidir). */
export interface FarmerPurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  /** 'bitki_koruma' | 'gubre' | 'tohum' | 'fide' | 'diger' (bayi ürün kartından) */
  productType: string | null;
  requiresPrescription: boolean;
  prescriptionNo: string | null;
  activeIngredient: string | null;
  licenseNo: string | null;
  /** Bayinin ürün kartındaki etiket bilgisi (gün). Yoksa null → "etiketi kontrol edin". */
  phiDays: number | null;
  gtsNos: string[];
  expiryDate: Date | null;
}

/** farmerPurchases/{saleId} — bayi yazar (satış projeksiyonu, maliyet fiyatı İÇERMEZ), çiftçi okur. */
export interface FarmerPurchase {
  id: string;
  farmerId: string;
  tenantId: string;
  tenantName: string;
  saleId: string;
  saleNumber: string;
  purchasedAt: Date;
  status: 'completed' | 'cancelled' | 'refunded';
  items: FarmerPurchaseItem[];
  totalAmount: number;
  /** Veresiyeye yazılan kısım */
  creditAmount: number;
  /** Çiftçinin ambarında kalan miktar (kalem sırası → miktar). Yoksa = quantity. */
  remaining: Record<string, number>;
  syncedAt: Date | null;
}

export interface RecommendationItem {
  productId: string | null;
  productName: string;
  /** Doz metni bayideki yetkili kişi tarafından yazılır (ör. "50 ml / 100 lt su"). */
  dose: string;
  phiDays: number | null;
  requiresPrescription: boolean;
  /**
   * Ürün kartındaki tür ('bitki_koruma' | 'gubre' | 'tohum' | 'fide' | 'diger') ve satış birimi — çiftçi defterinde
   * kayıt türü / birim buradan seçilir. Eski önerilerde yoktur (null → çiftçi seçer).
   */
  productType?: string | null;
  unit?: string | null;
}

/** recommendations/{recId} — bayideki yetkili kişinin (canPrescribe) yazdığı, sonradan DEĞİŞTİRİLEMEZ öneri. */
export interface Recommendation {
  id: string;
  tenantId: string;
  tenantName: string;
  farmerId: string;
  fieldId: string | null;
  seasonId: string | null;
  /** Zararlı / hastalık / besin eksikliği */
  target: string;
  items: RecommendationItem[];
  /** Reçeteli ürün içeriyorsa zorunlu (e-reçete numarası) */
  prescriptionNo: string | null;
  windowStart: Date | null;
  windowEnd: Date | null;
  notes: string | null;
  authorUid: string;
  authorName: string;
  authorLicenseNo: string;
  status: 'active' | 'withdrawn';
  createdAt: Date | null;
}

/** users/{uid} içindeki reçete/öneri yetkisi alanları (bayi personeli). */
export interface PrescriberInfo {
  uid: string;
  displayName: string;
  role: string;
  canPrescribe: boolean;
  prescriberLicenseNo: string | null;
}
