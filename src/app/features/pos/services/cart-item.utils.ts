import { Product } from '../../../shared/models/product.model';
import { CartItem } from '../../../shared/models/sale.model';
import { expiryInfo } from '../../../shared/utils/batch.utils';
import { isPlantProtection, productRequiresPrescription } from '../../../shared/utils/regulatory.utils';
import { productUnit, roundQty } from './sale.utils';

/**
 * Satılabilir stok. Bitki koruma ürünlerinde SKT'si geçmiş birimler satılamaz (BKÜ satış yön. md. 21/b),
 * bu yüzden sepet sınırı `stok - süresi geçmiş birim`. Diğer ürünlerde stoğun tamamı.
 */
export function sellableStock(product: Product, now: number = Date.now()): number {
  const stock = Number(product.stock) || 0;
  if (!isPlantProtection(product)) return stock;
  return Math.max(0, roundQty(stock - expiryInfo(product.batches, now).expiredQty));
}

export interface CodeHit {
  product: Product;
  /** Kod bir GTS/karekod birimiyse o GTS; ürün barkoduysa null. */
  gtsNo: string | null;
}

/**
 * Okutulan/yazılan kodu çöz: önce ürün barkodu (tam eşleşme), sonra stoktaki (miktarı > 0) bir GTS birimi.
 * Pasif ürünler atlanır. Boş kod → null.
 */
export function findByCode(products: readonly Product[], code: string | null | undefined): CodeHit | null {
  const c = (code ?? '').trim();
  if (!c) return null;
  const active = products.filter(p => p.isActive !== false);
  const byBarcode = active.find(p => (p.barcode ?? '').trim() === c);
  if (byBarcode) return { product: byBarcode, gtsNo: null };
  for (const p of active) {
    if ((p.batches ?? []).some(b => b.gtsNo === c && b.quantity > 0)) return { product: p, gtsNo: c };
  }
  return null;
}

/** Üründen 1 birimlik sepet kalemi. `gtsNo` verilirse o birim okutulmuş sayılır (satışta o parti düşer). */
export function cartItemFromProduct(product: Product, gtsNo: string | null = null, now: number = Date.now()): Omit<CartItem, '_tempId'> {
  const item: Omit<CartItem, '_tempId'> = {
    productId: product.id,
    productName: product.name,
    barcode: product.barcode ?? '',
    quantity: 1,
    unit: productUnit(product),
    unitPrice: product.salePrice,
    discount: 0,
    discountType: 'percent',
    totalPrice: product.salePrice,
    costPrice: product.purchasePrice ?? null,
    stock: sellableStock(product, now),
  };
  if (gtsNo) item.gtsNos = [gtsNo];
  if (productRequiresPrescription(product)) item.requiresPrescription = true;
  return item;
}
