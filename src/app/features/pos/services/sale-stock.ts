import { Batch, Product } from '../../../shared/models/product.model';
import { CartItem } from '../../../shared/models/sale.model';
import { isPlantProtection } from '../../../shared/utils/regulatory.utils';
import { roundQty } from '../../../shared/utils/batch.utils';
import { allocateFEFO, Allocation } from './sale.utils';

/**
 * Satışın stok planı (2.2) — Firestore'dan bağımsız, saf. Aynı plan iki yerde kullanılır:
 * - çevrimiçi: `runTransaction` içinde SUNUCUDAN okunan ürünlerle (iki kasa aynı anda satsa da doğru),
 * - çevrimdışı: yerel önbellekteki ürünlerle (yazım `increment` + `arrayRemove/arrayUnion` ile yapılır).
 * Aynı ürün sepette birden fazla kalemde olabilir: kalemler aynı ürünün güncel partilerinden sırayla düşer.
 */

/** Kullanıcı onayı gerektiren durumlar (süresi geçmiş birim / parti kaydı yetersiz). */
export interface SaleWarnings {
  expired: { productName: string; quantity: number }[];
  batchShortfall: { productName: string; quantity: number }[];
}

export type SaleStockProblem =
  | { kind: 'insufficient'; productName: string; missing: number }
  | { kind: 'gts-missing'; productName: string; gtsNos: string[] }
  | { kind: 'expired-blocked'; productName: string; quantity: number; gtsNos: string[] };

export interface SaleStockLine {
  item: Pick<CartItem, 'quantity' | 'gtsNos'>;
  product: Product;
}

export interface ProductStockChange {
  product: Product;
  /** Bu satışta üründen düşülen toplam miktar */
  quantity: number;
  /** Düşüm sonrası partiler */
  batches: Batch[];
}

export interface SaleStockPlan {
  /** Kalem başına parti dağılımı (satış kaydındaki `batches` ve iptal için) */
  allocations: Allocation[];
  /** Kalem başına hareket kaydı için önceki / sonraki stok (aynı ürünün kalemleri zincirlenir) */
  movements: { previousStock: number; newStock: number }[];
  /** Ürün başına toplam değişim (ürün id → değişim) */
  products: Map<string, ProductStockChange>;
  warnings: SaleWarnings;
}

export function planSaleStock(lines: readonly SaleStockLine[], now: number = Date.now()):
  { plan: SaleStockPlan; problem: null } | { plan: null; problem: SaleStockProblem } {
  const products = new Map<string, ProductStockChange>();
  const warnings: SaleWarnings = { expired: [], batchShortfall: [] };
  const allocations: Allocation[] = [];
  const movements: { previousStock: number; newStock: number }[] = [];

  for (const { item, product } of lines) {
    const state = products.get(product.id) ?? { product, quantity: 0, batches: product.batches ?? [] };
    const qty = roundQty(item.quantity);
    const sold = roundQty(state.quantity + qty);
    const stock = roundQty(Number(product.stock) || 0);
    if (sold > stock) {
      return { plan: null, problem: { kind: 'insufficient', productName: product.name, missing: roundQty(sold - stock) } };
    }
    const a = allocateFEFO(state.batches, qty, now, {
      preferredGts: item.gtsNos ?? [],
      skipExpired: isPlantProtection(product),
    });
    if (a.missingGts.length) return { plan: null, problem: { kind: 'gts-missing', productName: product.name, gtsNos: a.missingGts } };
    if (a.expiredGts.length || a.expiredBlocked > 0) {
      return {
        plan: null,
        problem: { kind: 'expired-blocked', productName: product.name, quantity: a.expiredBlocked || a.expiredGts.length, gtsNos: a.expiredGts },
      };
    }
    if (a.expiredUsed > 0) warnings.expired.push({ productName: product.name, quantity: a.expiredUsed });
    if (a.shortfall > 0) warnings.batchShortfall.push({ productName: product.name, quantity: a.shortfall });
    movements.push({ previousStock: roundQty(stock - state.quantity), newStock: roundQty(stock - sold) });
    allocations.push(a);
    products.set(product.id, { product, quantity: sold, batches: a.remaining });
  }
  return { plan: { allocations, movements, products, warnings }, problem: null };
}
