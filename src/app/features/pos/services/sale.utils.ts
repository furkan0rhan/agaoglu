import { Batch, Product } from '../../../shared/models/product.model';
import { isBatchExpired, roundQty, sortFEFO } from '../../../shared/utils/batch.utils';
import {
  CartItem, DECIMAL_UNITS, DiscountType, SALE_UNITS, SaleItem, SaleItemBatch, SaleUnit,
} from '../../../shared/models/sale.model';

export { roundQty };

/** Kuruşa yuvarla. */
export function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/** Ürünün satış birimi (Product.unit opsiyonel; yoksa / tanınmıyorsa null = adet). */
export function productUnit(p: Product): SaleUnit | null {
  const u = (p as unknown as { unit?: unknown }).unit;
  return typeof u === 'string' && (SALE_UNITS as readonly string[]).includes(u) ? (u as SaleUnit) : null;
}

/** kg / lt / metre → ondalıklı miktar. */
export function isDecimalUnit(unit: SaleUnit | null | undefined): boolean {
  return !!unit && DECIMAL_UNITS.includes(unit);
}

/**
 * Girilen miktarı birime göre normalleştir: ondalıklı birimde 2 haneye, diğerlerinde
 * aşağı tam sayıya yuvarla. Negatif / geçersiz → 0.
 */
export function normalizeQty(qty: number | null | undefined, unit: SaleUnit | null | undefined): number {
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return isDecimalUnit(unit) ? roundQty(Math.round(n * 100) / 100) : Math.floor(roundQty(n));
}

/**
 * Tutarı `count` taksite kuruş hassasiyetinde böl. İlk n-1 taksit eşit (aşağı yuvarlı),
 * kalan kuruş farkı son taksite eklenir; toplam her zaman `total`'e eşittir.
 * Ör. 1727 / 3 → [575.66, 575.66, 575.68].
 */
export function splitInstallments(total: number, count: number): number[] {
  const n = Math.max(1, Math.floor(count || 1));
  const cents = Math.round((total || 0) * 100);
  const base = Math.floor(cents / n);
  const last = cents - base * (n - 1);
  return [...Array.from({ length: n - 1 }, () => base / 100), last / 100];
}

/** Bir sepet kaleminin brüt tutarı, indirimi ve net toplamı. */
export function lineAmounts(i: { unitPrice: number; quantity: number; discount: number; discountType: DiscountType }) {
  const gross = round2(i.unitPrice * i.quantity);
  const rawDisc = i.discountType === 'percent'
    ? gross * ((i.discount || 0) / 100)
    : (i.discount || 0) * i.quantity;
  const discount = round2(Math.min(Math.max(0, rawDisc), gross));
  return { gross, discount, total: round2(gross - discount) };
}

/**
 * Sepet kalemine karşılık gelen ürünü bul. Önce productId, sonra (boş değilse) barkod.
 * Bulunamazsa null.
 */
export function resolveProduct(item: Pick<SaleItem, 'productId' | 'barcode'>, products: Product[]): Product | null {
  const byId = products.find(p => p.id === item.productId);
  if (byId) return byId;
  const code = item.barcode?.trim();
  if (!code) return null;
  return products.find(p => p.barcode === code) ?? null;
}

export interface AllocateOptions {
  /**
   * Önce düşülecek GTS'ler (satışta okutulan karekodlar, 2.11). Bulunamayanlar `missingGts`'e yazılır;
   * kalan miktar FEFO ile tamamlanır.
   */
  preferredGts?: readonly string[];
  /**
   * Süresi geçmiş partileri hiç kullanma (bitki koruma ürünleri: SKT geçmiş ürün satılamaz, md. 21/b).
   * Karşılanamayan miktarın süresi geçmiş partilerde bekleyen kısmı `expiredBlocked` ile döner.
   */
  skipExpired?: boolean;
}

export interface Allocation {
  /** Düşüm sonrası kalan partiler (FEFO sıralı, tükenenler çıkarılır). */
  remaining: Batch[];
  /** Hangi partiden ne kadar alındığı (iptalde geri yüklemek için). */
  taken: SaleItemBatch[];
  /** Partilerin karşılayamadığı miktar. */
  shortfall: number;
  /** Süresi geçmiş partilerden düşülen miktar (skipExpired=false iken). */
  expiredUsed: number;
  /** İstenen ama stokta (partilerde) bulunamayan GTS'ler. */
  missingGts: string[];
  /** skipExpired iken: okutulan ama SKT'si geçmiş GTS'ler. */
  expiredGts: string[];
  /** skipExpired iken: shortfall'un süresi geçmiş partilerde bekleyen kısmı (satış engellenir). */
  expiredBlocked: number;
}

/**
 * Partilerden `quantity` kadar düş: önce `preferredGts` (okutulan birimler), sonra FEFO
 * (SKT'si en yakın önce, SKT'siz en sonda). Girdi değiştirilmez.
 */
export function allocateFEFO(
  batches: readonly Batch[], quantity: number, now: number = Date.now(), opts: AllocateOptions = {},
): Allocation {
  const work = batches.filter(b => b.quantity > 0).map(b => ({ ...b }));
  const takenQty = new Map<string, number>();
  const missingGts: string[] = [];
  const expiredGts: string[] = [];
  let remaining = roundQty(Math.max(0, quantity));
  let expiredUsed = 0;

  const take = (b: Batch, q: number) => {
    if (q <= 0) return;
    b.quantity = roundQty(b.quantity - q);
    takenQty.set(b.id, roundQty((takenQty.get(b.id) ?? 0) + q));
    remaining = roundQty(remaining - q);
    if (isBatchExpired(b, now)) expiredUsed = roundQty(expiredUsed + q);
  };

  for (const g of new Set((opts.preferredGts ?? []).map(x => x.trim()).filter(Boolean))) {
    if (remaining <= 0) break;
    const b = work.find(x => x.gtsNo === g && x.quantity > 0);
    if (!b) { missingGts.push(g); continue; }
    if (opts.skipExpired && isBatchExpired(b, now)) { expiredGts.push(g); continue; }
    take(b, Math.min(b.quantity, remaining));
  }

  for (const b of sortFEFO(work)) {
    if (remaining <= 0) break;
    if (b.quantity <= 0) continue;
    if (opts.skipExpired && isBatchExpired(b, now)) continue;
    take(b, Math.min(b.quantity, remaining));
  }

  const expiredLeft = opts.skipExpired
    ? work.filter(b => b.quantity > 0 && isBatchExpired(b, now)).reduce((s, b) => s + b.quantity, 0)
    : 0;

  const taken: SaleItemBatch[] = [];
  for (const b of sortFEFO(batches)) {
    const q = takenQty.get(b.id);
    if (q && q > 0) taken.push({ batchId: b.id, quantity: q, gtsNo: b.gtsNo ?? null, expiryDate: b.expiryDate ?? null });
  }
  return {
    remaining: sortFEFO(work.filter(b => b.quantity > 0)),
    taken,
    shortfall: remaining,
    expiredUsed,
    missingGts,
    expiredGts,
    expiredBlocked: roundQty(Math.min(remaining, expiredLeft)),
  };
}

/** Satılan partilerin GTS numaraları (tekrarsız, okutma/FEFO sırasıyla). */
export function takenGtsNos(taken: readonly SaleItemBatch[]): string[] {
  return [...new Set(taken.map(t => t.gtsNo).filter((g): g is string => !!g))];
}

/**
 * İptal/iadede kalemi partilere geri yükle. Satılan partiler biliniyorsa onları
 * geri koyar (aynı id varsa miktarı artırır), bilinmiyorsa GTS'siz yeni parti açar.
 */
export function restoreBatches(
  current: Batch[],
  item: Pick<SaleItem, 'quantity' | 'batches'>,
  now: Batch['addedAt'],
  newId: () => string,
): Batch[] {
  const result = current.map(b => ({ ...b }));
  const sold = item.batches ?? [];
  let accounted = 0;
  for (const s of sold) {
    accounted = roundQty(accounted + s.quantity);
    const existing = result.find(b => b.id === s.batchId);
    if (existing) {
      existing.quantity = roundQty(existing.quantity + s.quantity);
    } else {
      result.push({ id: s.batchId, quantity: s.quantity, expiryDate: s.expiryDate ?? null, gtsNo: s.gtsNo ?? null, addedAt: now, supplierId: null });
    }
  }
  const rest = roundQty(item.quantity - accounted);
  if (rest > 0) {
    result.push({ id: newId(), quantity: rest, expiryDate: null, gtsNo: null, addedAt: now, supplierId: null });
  }
  return result;
}

/** Firestore'a yazılacak satış kalemi (_tempId ve stock olmadan). */
export function toSaleItem(
  item: CartItem, product: Product | null, taken: SaleItemBatch[],
  rx: { requiresPrescription: boolean; prescriptionNo: string | null } = { requiresPrescription: false, prescriptionNo: null },
): SaleItem {
  const { total } = lineAmounts(item);
  const gtsNos = takenGtsNos(taken);
  const out: SaleItem = {
    productId: item.productId,
    productName: item.productName,
    barcode: item.barcode ?? '',
    quantity: roundQty(item.quantity),
    unit: item.unit ?? null,
    unitPrice: item.unitPrice,
    discount: item.discount ?? 0,
    discountType: item.discountType ?? 'percent',
    totalPrice: total,
    costPrice: product?.purchasePrice ?? null,
    batches: taken,
  };
  if (gtsNos.length) out.gtsNos = gtsNos;
  if (rx.requiresPrescription) {
    out.requiresPrescription = true;
    out.prescriptionNo = rx.prescriptionNo;
    out.licenseNo = product?.licenseNo ?? null;
  }
  return out;
}

/** Çakışmasız satış numarası: S-YYYYMMDD-HHMMSS-<uid ilk 4>-<rastgele 3>. */
export function generateSaleNumber(now: Date, uid: string, rand: string = randomCode(3)): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const u = (uid || 'xxxx').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase().padEnd(4, 'X');
  return `S-${date}-${time}-${u}-${rand}`;
}

export function randomCode(len: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, n => chars[n % chars.length]).join('');
}
