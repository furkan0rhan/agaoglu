import type { Product, ProductType } from '../models/product.model';
import type { Sale, SaleItem } from '../models/sale.model';
import type { PrescriptionMode } from '../../core/settings/tenant-settings.model';

/**
 * Mevzuat yardımcıları (saf fonksiyonlar, Firestore'a bağımsız).
 * Kaynak: 13.12.2025 tarihli, 33106 sayılı RG — Bitki Koruma Ürünlerinin Toptan ve Perakende Satılması ile
 * Depolanması Hakkında Yönetmelik (md. 5/5, 18/4, 21/b, 21/o). Uygulama ilaç/doz ÖNERMEZ; yalnızca kayıt tutar.
 */

const lower = (s: string | null | undefined) => (s ?? '').toLocaleLowerCase('tr-TR');

const TYPE_KEYWORDS: readonly [ProductType, readonly string[]][] = [
  ['bitki_koruma', ['ilaç', 'ilac', 'bitki koruma', 'pestisit', 'insektisit', 'fungisit', 'herbisit', 'akarisit', 'nematisit', 'bkü']],
  ['gubre', ['gübre', 'gubre']],
  ['tohum', ['tohum']],
  ['fide', ['fide', 'fidan']],
];

/** Kategori adından ürün türü önerisi ("Zirai İlaç" → bitki_koruma, "Gübre" → gubre, ...). */
export function suggestProductType(category: string | null | undefined): ProductType {
  const c = lower(category);
  if (!c) return 'diger';
  for (const [type, words] of TYPE_KEYWORDS) {
    if (words.some(w => c.includes(w))) return type;
  }
  return 'diger';
}

/** Ürünün türü: kayıtlı değer, yoksa kategoriden tahmin. */
export function productTypeOf(p: Pick<Product, 'productType' | 'category'>): ProductType {
  return p.productType ?? suggestProductType(p.category);
}

/** Bitki koruma ürünü mü? (SKT geçmişse satış ENGEL — md. 21/b) */
export function isPlantProtection(p: Pick<Product, 'productType' | 'category'>): boolean {
  return productTypeOf(p) === 'bitki_koruma';
}

/** Tür seçildiğinde reçete bayrağının varsayılanı: bitki koruma ürünlerinde true. */
export function defaultRequiresPrescription(type: ProductType): boolean {
  return type === 'bitki_koruma';
}

/**
 * Ürün e-reçete gerektiriyor mu? Açık bayrak varsa o; yoksa yalnızca türü açıkça 'bitki_koruma'
 * kaydedilmişse true. (Eski, türü girilmemiş ürünler satışı aniden kilitlemesin diye false.)
 */
export function productRequiresPrescription(p: Pick<Product, 'requiresPrescription' | 'productType'>): boolean {
  if (typeof p.requiresPrescription === 'boolean') return p.requiresPrescription;
  return p.productType === 'bitki_koruma';
}

/** E-reçete numarasını normalize et (boşluk kırp, büyük harf). */
export function normalizePrescriptionNo(v: string | null | undefined): string {
  return (v ?? '').replace(/\s+/g, '').toLocaleUpperCase('tr-TR');
}

/** E-reçete numarası biçim kontrolü: 4-40 karakter, harf/rakam/-/. */
export function isValidPrescriptionNo(v: string | null | undefined): boolean {
  return /^[0-9A-ZÇĞİÖŞÜ./-]{4,40}$/.test(normalizePrescriptionNo(v));
}

export type PrescriptionGap = 'customer' | 'number';

export interface PrescriptionCheck {
  /** Sepette reçeteli ürün var ve mod 'off' değil → reçete sorulmalı. */
  needed: boolean;
  /** Eksik bilgiler (müşteri seçilmemiş / numara yok veya geçersiz). */
  missing: PrescriptionGap[];
  /** Satışı engelleyen eksikler (yalnızca 'required' modda = missing). */
  blocking: PrescriptionGap[];
}

/**
 * Reçeteli satış kontrolü. Reçeteli satış anonim yapılamaz (müşteri zorunlu) ve e-reçete numarası
 * üzerinden işlem yapılır (md. 18/4).
 */
export function checkPrescription(input: {
  mode: PrescriptionMode;
  hasPrescriptionItems: boolean;
  customerId: string | null | undefined;
  prescriptionNo: string | null | undefined;
}): PrescriptionCheck {
  if (input.mode === 'off' || !input.hasPrescriptionItems) return { needed: false, missing: [], blocking: [] };
  const missing: PrescriptionGap[] = [];
  if (!input.customerId) missing.push('customer');
  if (!isValidPrescriptionNo(input.prescriptionNo)) missing.push('number');
  return { needed: true, missing, blocking: input.mode === 'required' ? missing : [] };
}

// ---- Reçeteli satış kaydı (Bakanlık denetimi için dışa aktarma) ----

export interface PrescriptionRecordRow {
  date: Date | null;
  saleNumber: string;
  status: Sale['status'];
  customerName: string;
  tcNo: string;
  cksNo: string;
  productName: string;
  licenseNo: string;
  quantity: number;
  unit: string;
  gtsNos: string;
  /** Parti / şarj no'ları (virgülle) */
  lotNos: string;
  prescriptionNo: string;
  prescriberName: string;
}

/** Satış reçeteli kalem içeriyor mu? (eski kayıtlarda hasPrescriptionItems yok → kalemlere bakılır) */
export function isPrescriptionSale(s: Pick<Sale, 'hasPrescriptionItems' | 'items' | 'prescriptionNo'>): boolean {
  return !!s.hasPrescriptionItems || !!s.prescriptionNo || (s.items ?? []).some(i => !!i.requiresPrescription || !!i.prescriptionNo);
}

export interface CustomerIdLookup {
  tcNo?: string | null;
  cksNo?: string | null;
}

/**
 * Reçeteli satışlardan kalem bazlı kayıt satırları. Müşteri TC/ÇKS önce satış anındaki kopyadan,
 * yoksa güncel müşteri kaydından alınır.
 */
export function buildPrescriptionRows(
  sales: readonly Sale[],
  customers: ReadonlyMap<string, CustomerIdLookup> = new Map(),
  unitLabel: (u: SaleItem['unit']) => string = u => u ?? 'adet',
): PrescriptionRecordRow[] {
  const rows: PrescriptionRecordRow[] = [];
  for (const s of sales) {
    if (!isPrescriptionSale(s)) continue;
    const c = s.customerId ? customers.get(s.customerId) : undefined;
    for (const i of s.items ?? []) {
      if (!i.requiresPrescription && !i.prescriptionNo) continue;
      rows.push({
        date: s.createdAt?.toDate?.() ?? null,
        saleNumber: s.saleNumber,
        status: s.status,
        customerName: s.customerName ?? '',
        tcNo: s.customerTcNo ?? c?.tcNo ?? '',
        cksNo: s.customerCksNo ?? c?.cksNo ?? '',
        productName: i.productName,
        licenseNo: i.licenseNo ?? '',
        quantity: i.quantity,
        unit: unitLabel(i.unit),
        gtsNos: (i.gtsNos ?? []).join(', '),
        lotNos: (i.lotNos?.length ? i.lotNos : [...new Set((i.batches ?? []).map(b => b.lotNo).filter((l): l is string => !!l))]).join(', '),
        prescriptionNo: i.prescriptionNo ?? s.prescriptionNo ?? '',
        prescriberName: s.prescriberName ?? '',
      });
    }
  }
  return rows;
}

// ---- Ürün formu "Mevzuat" bölümü ----

export interface RegulatoryForm {
  productType: ProductType;
  requiresPrescription: boolean;
  licenseNo: string;
  activeIngredient: string;
  phiDays: number | null;
  toxicityClass: string;
}

/** Üründen form değeri (eski ürünlerde tür kategoriden tahmin edilir). */
export function regulatoryFromProduct(
  p: Partial<Pick<Product, 'productType' | 'category' | 'requiresPrescription' | 'licenseNo' | 'activeIngredient' | 'phiDays' | 'toxicityClass'>> | null,
): RegulatoryForm {
  const productType = p?.productType ?? suggestProductType(p?.category);
  return {
    productType,
    requiresPrescription: typeof p?.requiresPrescription === 'boolean' ? p.requiresPrescription : defaultRequiresPrescription(productType),
    licenseNo: p?.licenseNo ?? '',
    activeIngredient: p?.activeIngredient ?? '',
    phiDays: p?.phiDays ?? null,
    toxicityClass: p?.toxicityClass ?? '',
  };
}

/** Form değerinden Firestore'a yazılacak alanlar (undefined yok; boş metin → null). */
export function regulatoryToChanges(f: RegulatoryForm): Required<Pick<Product,
  'productType' | 'requiresPrescription' | 'licenseNo' | 'activeIngredient' | 'phiDays' | 'toxicityClass'>> {
  const phi = f.phiDays == null || f.phiDays === ('' as unknown) ? null : Math.floor(Number(f.phiDays));
  return {
    productType: f.productType,
    requiresPrescription: !!f.requiresPrescription,
    licenseNo: f.licenseNo.trim() || null,
    activeIngredient: f.activeIngredient.trim() || null,
    phiDays: phi != null && Number.isFinite(phi) && phi >= 0 ? phi : null,
    toxicityClass: f.toxicityClass.trim() || null,
  };
}
