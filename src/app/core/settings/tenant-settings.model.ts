/**
 * İşletme ayarları: `tenants/{tenantId}.settings` (harita alanı).
 * Okuma: işletmedeki herkes; yazma: yalnızca admin (firestore.rules tenant update kuralı `settings`
 * alanına izin verir; `prescriptionMode` değeri kurallarda doğrulanır).
 *
 * Alan haritası (diğer modüller bu adlarla okur — `TenantSettingsService` sinyalleri):
 * - `settings.prescriptionMode`            'required' | 'warn' | 'off'  (POS e-reçete)
 * - `settings.expiryWarnDays`              number (SKT "yakın" eşiği, gün; varsayılan 30)
 * - `settings.expiryCriticalDays`          number (SKT "kritik" eşiği, gün; varsayılan 7)
 * - `settings.receipt.paperWidth`          58 | 80 (mm)
 * - `settings.receipt.headerNote`          string (fiş başlığında işletme adının altına ek satır)
 * - `settings.receipt.showDealerLicense`   boolean (başlıkta bitki koruma bayi izin no — `tenants.dealerLicenseNo`)
 * - `settings.receipt.showLicenseNo`       boolean (kalemde ürün ruhsat no)
 * - `settings.receipt.showGts`             boolean (kalemde GTS no listesi)
 * - `settings.receipt.logo`                string (data:image/png;base64…, ≤ ~60 KB; boş = logo yok)
 *   Fiş alt notu: mevcut `tenants.receiptFooter` alanı (TenantInfo) — fiş zaten okuyor.
 * - `settings.credit.defaultDueDays`       number (veresiye satışta önerilen vade, gün; varsayılan 30)
 * - `settings.credit.defaultCreditLimit`   number | null (yeni müşteri kredi limiti; null = limitsiz)
 * - `settings.credit.reminderTemplate`     string (boş = yerleşik metin; değişkenler: reminder-template.ts)
 */

/**
 * E-reçete modu (bitki koruma ürünleri, 13.12.2025 / 33106 RG satış yönetmeliği md. 18, 21/o):
 * - `required`: reçeteli ürün satışında müşteri + e-reçete no zorunlu (varsayılan, mevzuat).
 * - `warn`: sorulur ama atlanabilir (bayinin sorumluluğunda).
 * - `off`: sorulmaz.
 */
export type PrescriptionMode = 'required' | 'warn' | 'off';
export const PRESCRIPTION_MODES: readonly PrescriptionMode[] = ['required', 'warn', 'off'];

export type ReceiptPaperWidth = 58 | 80;

export interface ReceiptSettings {
  paperWidth: ReceiptPaperWidth;
  headerNote: string;
  showDealerLicense: boolean;
  showLicenseNo: boolean;
  showGts: boolean;
  logo: string;
}

export interface CreditSettings {
  defaultDueDays: number;
  defaultCreditLimit: number | null;
  reminderTemplate: string;
}

export interface TenantSettings {
  prescriptionMode: PrescriptionMode;
  expiryWarnDays: number;
  expiryCriticalDays: number;
  receipt: ReceiptSettings;
  credit: CreditSettings;
}

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  paperWidth: 80,
  headerNote: '',
  showDealerLicense: true,
  showLicenseNo: true,
  showGts: true,
  logo: '',
};

export const DEFAULT_CREDIT_SETTINGS: CreditSettings = {
  defaultDueDays: 30,
  defaultCreditLimit: null,
  reminderTemplate: '',
};

export const DEFAULT_TENANT_SETTINGS: TenantSettings = {
  prescriptionMode: 'required',
  expiryWarnDays: 30,
  expiryCriticalDays: 7,
  receipt: DEFAULT_RECEIPT_SETTINGS,
  credit: DEFAULT_CREDIT_SETTINGS,
};

/** Sınırlar (UI ve doğrulama ortak). */
export const SETTINGS_LIMITS = {
  expiryDays: { min: 1, max: 365 },
  dueDays: { min: 1, max: 365 },
  creditLimit: { min: 0, max: 100_000_000 },
  headerNote: 60,
  reminderTemplate: 500,
  /** data URL uzunluğu (≈ 60 KB): tenant dokümanı küçük kalsın, her okumada taşınıyor. */
  logoChars: 80_000,
} as const;

function obj(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function intIn(v: unknown, min: number, max: number, def: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : def;
}

function bool(v: unknown, def: boolean): boolean {
  return typeof v === 'boolean' ? v : def;
}

function str(v: unknown, max: number, def = ''): string {
  return typeof v === 'string' ? v.slice(0, max) : def;
}

export function parseReceiptSettings(raw: unknown): ReceiptSettings {
  const o = obj(raw);
  const d = DEFAULT_RECEIPT_SETTINGS;
  const logo = o['logo'];
  return {
    paperWidth: o['paperWidth'] === 58 ? 58 : 80,
    headerNote: str(o['headerNote'], SETTINGS_LIMITS.headerNote),
    showDealerLicense: bool(o['showDealerLicense'], d.showDealerLicense),
    showLicenseNo: bool(o['showLicenseNo'], d.showLicenseNo),
    showGts: bool(o['showGts'], d.showGts),
    logo: typeof logo === 'string' && logo.startsWith('data:image/') && logo.length <= SETTINGS_LIMITS.logoChars ? logo : '',
  };
}

export function parseCreditSettings(raw: unknown): CreditSettings {
  const o = obj(raw);
  const L = SETTINGS_LIMITS;
  const limit = o['defaultCreditLimit'];
  return {
    defaultDueDays: intIn(o['defaultDueDays'], L.dueDays.min, L.dueDays.max, DEFAULT_CREDIT_SETTINGS.defaultDueDays),
    defaultCreditLimit: typeof limit === 'number' && Number.isFinite(limit) && limit > 0 && limit <= L.creditLimit.max ? limit : null,
    reminderTemplate: str(o['reminderTemplate'], L.reminderTemplate),
  };
}

/** Firestore'dan gelen ham `settings` haritasını doğrular; bilinmeyen/eksik alanlar varsayılana döner. */
export function parseTenantSettings(raw: unknown): TenantSettings {
  const o = obj(raw);
  const mode = o['prescriptionMode'];
  const { min, max } = SETTINGS_LIMITS.expiryDays;
  const warn = intIn(o['expiryWarnDays'], min, max, DEFAULT_TENANT_SETTINGS.expiryWarnDays);
  // Kritik eşik uyarı eşiğinden büyük olamaz
  const critical = Math.min(intIn(o['expiryCriticalDays'], min, max, DEFAULT_TENANT_SETTINGS.expiryCriticalDays), warn);
  return {
    prescriptionMode: typeof mode === 'string' && (PRESCRIPTION_MODES as readonly string[]).includes(mode)
      ? (mode as PrescriptionMode)
      : DEFAULT_TENANT_SETTINGS.prescriptionMode,
    expiryWarnDays: warn,
    expiryCriticalDays: critical,
    receipt: parseReceiptSettings(o['receipt']),
    credit: parseCreditSettings(o['credit']),
  };
}
