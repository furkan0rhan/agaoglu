import type { Timestamp } from '@angular/fire/firestore';
import type { Batch, Product } from '../models/product.model';

/**
 * Parti/GTS yardımcıları.
 * Kural: GTS'li her birim = quantity:1 olan ayrı bir Batch; GTS'siz toplu giriş = tek quantity:N Batch.
 * Bu dosya Firestore'a bağımlı değildir (Timestamp sadece tip olarak kullanılır) → saf fonksiyonlar, test edilebilir.
 */

const DAY_MS = 86_400_000;

/**
 * Miktarı 3 ondalığa yuvarla (kg / lt / metre birimlerinde 0,1 + 0,2 = 0,30000000000000004 kaymasını önler).
 * Tam sayılar değişmez.
 */
export function roundQty(n: number): number {
  return Math.round((Number(n) || 0) * 1000) / 1000;
}

/** FEFO sıralaması: SKT'si en yakın önce, SKT'siz partiler en sonda. Girdi değiştirilmez. */
export function sortFEFO<T extends Pick<Batch, 'expiryDate'>>(batches: readonly T[]): T[] {
  return [...batches].sort((a, b) => {
    if (!a.expiryDate && !b.expiryDate) return 0;
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    return a.expiryDate.toMillis() - b.expiryDate.toMillis();
  });
}

/** FEFO'ya göre ilk düşülecek (miktarı > 0) parti */
export function firstFEFO(batches: readonly Batch[]): Batch | null {
  return sortFEFO(batches.filter(b => b.quantity > 0))[0] ?? null;
}

/** Partilerdeki toplam birim sayısı */
export function batchTotal(batches: readonly Batch[] | null | undefined): number {
  return roundQty((batches ?? []).reduce((s, b) => s + (b.quantity > 0 ? b.quantity : 0), 0));
}

export interface FefoResult {
  /** Düşüm sonrası kalan partiler (tükenen partiler çıkarılır) */
  batches: Batch[];
  /** Partilerin karşılayamadığı miktar (0 = tamamı partilerden düşüldü) */
  shortfall: number;
  /** Süresi geçmiş partilerden düşülen birim sayısı */
  expiredUsed: number;
}

/**
 * FEFO düşümü. Yetersiz partide sessizce yetinmez: karşılanamayan miktarı `shortfall` ile döndürür.
 * @param now süre kontrolü için referans zaman (ms)
 */
export function consumeFEFO(batches: readonly Batch[], quantity: number, now: number = Date.now()): FefoResult {
  let remaining = Math.max(0, quantity);
  let expiredUsed = 0;
  const result: Batch[] = [];
  for (const b of sortFEFO(batches)) {
    if (b.quantity <= 0) continue;
    if (remaining <= 0) { result.push(b); continue; }
    const take = Math.min(b.quantity, remaining);
    if (isBatchExpired(b, now)) expiredUsed += take;
    remaining = roundQty(remaining - take);
    if (b.quantity > take) result.push({ ...b, quantity: roundQty(b.quantity - take) });
  }
  return { batches: result, shortfall: remaining, expiredUsed };
}

/**
 * Geriye dönük uyumlu FEFO düşümü (sadece kalan partileri döndürür).
 * Yetersiz partide konsola uyarı yazar; sonucu kullanmak için `consumeFEFO` tercih edin.
 */
export function applyFEFO(batches: Batch[], quantity: number): Batch[] {
  const r = consumeFEFO(batches, quantity);
  if (r.shortfall > 0) {
    console.warn(`[FEFO] Partiler yetersiz: ${r.shortfall} birim partilerden düşülemedi (stok ≠ Σ parti).`);
  }
  return r.batches;
}

/** SKT'si `now` anından önce mi? (SKT günü sonuna kadar geçerli sayılır) */
export function isBatchExpired(b: Pick<Batch, 'expiryDate'>, now: number = Date.now()): boolean {
  if (!b.expiryDate) return false;
  return endOfDay(b.expiryDate.toMillis()) < now;
}

/** SKT'ye kalan gün (bugün = 0, geçmişte negatif). SKT yoksa null. */
export function daysUntilExpiry(b: Pick<Batch, 'expiryDate'>, now: number = Date.now()): number | null {
  if (!b.expiryDate) return null;
  return Math.round((startOfDay(b.expiryDate.toMillis()) - startOfDay(now)) / DAY_MS);
}

/**
 * Stoktaki (quantity > 0) partiler arasında en yakın SKT. Süresi geçmiş partiler dahildir
 * (ürün kartında "SKT geçmiş" uyarısı için). Geçmişleri ayırmak için `expiryInfo` kullanın.
 */
export function nearestExpiry(batches: readonly Batch[]): Timestamp | null {
  return sortFEFO(batches.filter(b => b.expiryDate && b.quantity > 0))[0]?.expiryDate ?? null;
}

export interface ExpiryInfo {
  /** En yakın SKT (geçmiş dahil) — nearestExpiry ile aynı */
  nearest: Timestamp | null;
  /** Henüz geçmemiş en yakın SKT */
  nearestValid: Timestamp | null;
  /** Süresi geçmiş birim sayısı */
  expiredQty: number;
  /** Süresi geçmiş parti sayısı */
  expiredBatchCount: number;
}

/** SKT özeti: geçmiş SKT'ler ayrıca işaretlenir */
export function expiryInfo(batches: readonly Batch[] | null | undefined, now: number = Date.now()): ExpiryInfo {
  const dated = sortFEFO((batches ?? []).filter(b => b.expiryDate && b.quantity > 0));
  const expired = dated.filter(b => isBatchExpired(b, now));
  const valid = dated.filter(b => !isBatchExpired(b, now));
  return {
    nearest: dated[0]?.expiryDate ?? null,
    nearestValid: valid[0]?.expiryDate ?? null,
    expiredQty: expired.reduce((s, b) => s + b.quantity, 0),
    expiredBatchCount: expired.length,
  };
}

// ---- Uzlaştırma (stock ↔ Σ batch.quantity) ----

export interface StockReconciliation {
  stock: number;
  batchTotal: number;
  /** stock - Σ batch (pozitif: partisiz stok var, negatif: stok partilerden az) */
  diff: number;
  ok: boolean;
}

export function checkStockVsBatches(product: Pick<Product, 'stock' | 'batches'>): StockReconciliation {
  const total = batchTotal(product.batches);
  const stock = Number(product.stock) || 0;
  const diff = roundQty(stock - total);
  return { stock, batchTotal: total, diff, ok: diff === 0 };
}

// ---- Benzersizlik (aynı tenant'ın yüklü ürünleri genelinde) ----

export interface GtsConflict { product: Pick<Product, 'id' | 'name'>; batchId: string }

/**
 * GTS başka bir birimde (aynı veya farklı üründe) kullanılıyor mu?
 * @param ignore hariç tutulacak birim (düzenlenen satır)
 */
export function findGtsConflict(
  products: readonly Pick<Product, 'id' | 'name' | 'batches'>[],
  gtsNo: string,
  ignore?: { productId: string; batchId: string },
): GtsConflict | null {
  const g = gtsNo.trim();
  if (!g) return null;
  for (const p of products) {
    for (const b of p.batches ?? []) {
      if (b.gtsNo !== g || b.quantity <= 0) continue;
      if (ignore && ignore.productId === p.id && ignore.batchId === b.id) continue;
      return { product: { id: p.id, name: p.name }, batchId: b.id };
    }
  }
  return null;
}

/** Barkod başka bir üründe (barkod veya GTS olarak) kullanılıyor mu? */
export function findBarcodeConflict(
  products: readonly Pick<Product, 'id' | 'name' | 'barcode' | 'batches'>[],
  barcode: string,
  excludeProductId?: string,
): Pick<Product, 'id' | 'name'> | null {
  const code = barcode.trim();
  if (!code) return null;
  const hit = products.find(p =>
    p.id !== excludeProductId &&
    ((p.barcode ?? '').trim() === code || (p.batches ?? []).some(b => b.gtsNo === code && b.quantity > 0))
  );
  return hit ? { id: hit.id, name: hit.name } : null;
}

/** Liste içindeki tekrar eden GTS'ler */
export function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) dup.add(v);
    seen.add(v);
  }
  return [...dup];
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** `adjustStock` parti no girdisi: tek değer (hepsine) ya da GTS → parti no eşlemesi. */
export type LotInput = string | null | undefined | Readonly<Record<string, string | null | undefined>>;

/** Parti no'yu kırp, büyük harfe çevir (BKÜ kılavuzu: 0-9 A-Z), en çok 20 karakter; boşsa null. */
export function normalizeLotNo(v: string | null | undefined): string | null {
  const s = (v ?? '').trim().toUpperCase().slice(0, 20);
  return s || null;
}

/** Bir GTS (ya da GTS'siz parti) için parti no. */
export function lotFor(lot: LotInput, gts: string | null): string | null {
  if (lot == null || typeof lot === 'string') return normalizeLotNo(lot);
  return gts ? normalizeLotNo(lot[gts]) : null;
}

/** Parti no varsa partiye ekle (yoksa alan hiç yazılmaz — eski kayıtlarla aynı biçim). */
export function withLot(b: Batch, lot: string | null): Batch {
  return lot ? { ...b, lotNo: lot } : b;
}

// ---- Çevrimdışı parti yazımı (2.2): arrayRemove / arrayUnion için tam nesne farkı ----

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  const ta = a as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
  const tb = b as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
  if (typeof ta.toMillis === 'function' || typeof tb.toMillis === 'function') {
    if (typeof ta.seconds === 'number' && typeof tb.seconds === 'number') {
      return ta.seconds === tb.seconds && ta.nanoseconds === tb.nanoseconds;
    }
    return typeof ta.toMillis === 'function' && typeof tb.toMillis === 'function' && ta.toMillis() === tb.toMillis();
  }
  const ka = Object.keys(a).filter(k => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b).filter(k => (b as Record<string, unknown>)[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every(k => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** İki parti nesnesi alan alan aynı mı? (Firestore arrayRemove'un eşitlik anlayışı: tüm alanlar) */
export function sameBatch(a: Batch, b: Batch): boolean {
  return sameValue(a, b);
}

/**
 * `before` → `after` parti listesi farkı: `removed` = artık olmayan (ya da değişen) partilerin ESKİ hâli,
 * `added` = yeni ya da değişen partilerin YENİ hâli. Çevrimdışı yazımda partiler dizinin tamamı yerine
 * `arrayRemove(...removed)` + `arrayUnion(...added)` ile yazılır; böylece iki kasa aynı ürünün FARKLI
 * GTS birimlerini (quantity:1) sattığında biri diğerinin sattığı birimi geri getiremez (çoğalma / kayıp yok).
 * Sıra önemsizdir (FEFO okurken sıralanır).
 */
export function diffBatches(before: readonly Batch[], after: readonly Batch[]): { removed: Batch[]; added: Batch[] } {
  const removed = before.filter(b => !after.some(a => sameBatch(a, b)));
  const added = after.filter(a => !before.some(b => sameBatch(a, b)));
  return { removed, added };
}
