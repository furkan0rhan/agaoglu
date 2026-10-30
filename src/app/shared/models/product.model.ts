import { Timestamp } from '@angular/fire/firestore';

export interface Batch {
  id: string;
  quantity: number;
  expiryDate: Timestamp | null;
  gtsNo: string | null;
  /** Karekod AI (10) parti / şarj no. Eski kayıtlarda yoktur. */
  lotNo?: string | null;
  addedAt: Timestamp;
  supplierId: string | null;
}

/** Satış/stok birimi. Alan yoksa 'adet' kabul edilir. */
export type ProductUnit = 'adet' | 'kg' | 'lt' | 'paket' | 'cuval' | 'metre' | 'viyol' | 'kasa' | 'demet' | 'sise';

/** Seçim sırası (form, detay) */
export const PRODUCT_UNITS: readonly ProductUnit[] = ['adet', 'kg', 'lt', 'paket', 'cuval', 'metre', 'viyol', 'kasa', 'demet', 'sise'];

/** Ondalıklı miktar kabul eden birimler (12,5 kg; 2,5 lt; 3,2 metre) */
export const DECIMAL_UNITS: readonly ProductUnit[] = ['kg', 'lt', 'metre'];

export const DEFAULT_PRODUCT_UNIT: ProductUnit = 'adet';

/** Ürünün birimi (eski kayıtlarda alan yok → 'adet') */
export function productUnit(p: Pick<Product, 'unit'> | null | undefined): ProductUnit {
  const u = p?.unit;
  return u && PRODUCT_UNITS.includes(u) ? u : DEFAULT_PRODUCT_UNIT;
}

/** Bu birimde stok/miktar ondalıklı olabilir mi? */
export function isDecimalUnit(unit: ProductUnit | null | undefined): boolean {
  return !!unit && DECIMAL_UNITS.includes(unit);
}

/**
 * Mevzuat açısından ürün türü. Bitki koruma ürünleri (zirai ilaç) 13.12.2025 tarihli BKÜ satış yönetmeliğine
 * tabidir: reçete zorunluluğu (Bakanlık listesi), SKT geçmiş ürün satış yasağı, karekod takibi.
 */
export type ProductType = 'bitki_koruma' | 'gubre' | 'tohum' | 'fide' | 'diger';
export const PRODUCT_TYPES: readonly ProductType[] = ['bitki_koruma', 'gubre', 'tohum', 'fide', 'diger'];

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  barcode: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  category: string;
  brand: string | null;
  description: string | null;
  expiryDate: Timestamp | null;
  vatRate: number | null;
  /**
   * Alış fiyatı KDV dahil mi? Yoksa / false = KDV hariç (varsayılan). Satış fiyatı her zaman KDV dahildir.
   * Kâr hesabı: bkz. shared/utils/pricing.ts.
   */
  purchasePriceIncludesVat?: boolean;
  /** Birim (opsiyonel, varsayılan 'adet'). kg / lt / metre ürünlerde stok ondalıklı olabilir. */
  unit?: ProductUnit;
  /** Varsayılan tedarikçi (yeni partilerde önden seçili gelir). */
  supplierId?: string | null;
  // ---- Mevzuat (opsiyonel; eski kayıtlarda yok) ----
  /** Ürün türü. Yoksa kategoriden tahmin edilir (bkz. regulatory.utils.productTypeOf). */
  productType?: ProductType;
  /** E-reçete zorunlu mu (Bakanlık BKÜ Veri Tabanı'ndaki listeye göre bayi işaretler). */
  requiresPrescription?: boolean;
  /** Ruhsat numarası (bitki koruma ürünlerinde). */
  licenseNo?: string | null;
  /** Etken madde (ör. "Abamectin 18 g/l"). */
  activeIngredient?: string | null;
  /** Hasat öncesi bekleme süresi (gün) — etiketteki bilgi, bayi girer; bilgi amaçlıdır. */
  phiDays?: number | null;
  /** Toksisite / tehlike sınıfı (etiketteki, opsiyonel). */
  toxicityClass?: string | null;
  batches: Batch[];
  imageUrl: string | null;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface StockMovement {
  id: string;
  tenantId: string;
  productId: string;
  productName: string;
  type: 'in' | 'out';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  reference: string | null;
  /** Bekleyen serverTimestamp() yerel snapshot'ta null gelebilir */
  createdAt: Timestamp | null;
  createdBy: string;
}

export type CreateProductDto = Omit<Product, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'createdBy'>;
