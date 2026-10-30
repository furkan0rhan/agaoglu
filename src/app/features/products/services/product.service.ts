import { inject, Injectable } from '@angular/core';
import { doc, limit, orderBy, serverTimestamp, Timestamp, where } from '@angular/fire/firestore';
import { firstValueFrom, Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/services/auth.service';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { Batch, CreateProductDto, Product, StockMovement } from '../../../shared/models/product.model';
import { batchTotal, consumeFEFO, duplicateValues, type LotInput, lotFor, nearestExpiry, normalizeLotNo, roundQty, withLot } from '../../../shared/utils/batch.utils';

const PRODUCTS = 'products';
const MOVEMENTS = 'stockMovements';

/** Ürün belgesinde stok/partilere dokunmayan, serbestçe güncellenebilir alanlar */
export type ProductInfoChanges = Partial<Omit<Product, 'id' | 'tenantId' | 'stock' | 'batches' | 'expiryDate' | 'createdAt' | 'updatedAt' | 'createdBy'>>;

export type ProductStockErrorCode = 'duplicate-gts' | 'batch-not-found' | 'invalid-quantity';

export class ProductStockError extends Error {
  constructor(readonly code: ProductStockErrorCode, readonly detail: string | null = null) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'ProductStockError';
  }
}

export interface StockWriteResult {
  /** FEFO düşümünde partilerin karşılayamadığı miktar (0 = stok ve partiler tutarlı düştü) */
  shortfall: number;
  newStock: number;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly fs = inject(FirestoreService);
  private readonly auth = inject(AuthService);

  getAll$(): Observable<Product[]> {
    return this.fs.query$<Product>(
      PRODUCTS,
      where('tenantId', '==', this.auth.currentTenantId()),
      where('isActive', '==', true),
      orderBy('name')
    );
  }

  /** Pasif (isActive == false) ürünler — yönetim/geri aktifleştirme için */
  getPassive$(): Observable<Product[]> {
    return this.fs.query$<Product>(
      PRODUCTS,
      where('tenantId', '==', this.auth.currentTenantId()),
      where('isActive', '==', false),
      orderBy('name')
    );
  }

  getById$(id: string): Observable<Product | null> {
    return this.fs.getById<Product>(PRODUCTS, id);
  }

  /** Stok hareketleri (en yeni önce). Varsayılan en fazla 200 kayıt. */
  getMovements$(productId: string, max = 200): Observable<StockMovement[]> {
    return this.fs.query$<StockMovement>(
      MOVEMENTS,
      where('tenantId', '==', this.auth.currentTenantId()),
      where('productId', '==', productId),
      orderBy('createdAt', 'desc'),
      limit(max)
    );
  }

  /**
   * Yeni ürün. `dto.stock > 0` ise ürün ve ilk 'in' stok hareketi aynı yazma grubunda (atomik) kaydedilir.
   * @param initialReason ilk stok hareketinin nedeni (i18n metni çağıran taraftan gelir)
   */
  async create(dto: CreateProductDto, initialReason: string): Promise<string> {
    const tenantId = this.auth.currentTenantId();
    const createdBy = this.auth.currentUserId();
    const dupes = duplicateValues((dto.batches ?? []).map(b => b.gtsNo).filter((g): g is string => !!g));
    if (dupes.length) throw new ProductStockError('duplicate-gts', dupes.join(', '));

    const stock = Number(dto.stock) || 0;
    const productRef = doc(this.fs.col(PRODUCTS));
    const writeBatch = this.fs.batch();
    writeBatch.set(productRef, {
      ...dto,
      stock,
      expiryDate: nearestExpiry(dto.batches ?? []),
      tenantId,
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (stock > 0) {
      this.addMovement(writeBatch, {
        productId: productRef.id, productName: dto.name, type: 'in', quantity: stock,
        previousStock: 0, newStock: stock, reason: initialReason, reference: null,
      });
    }
    await writeBatch.commit();
    return productRef.id;
  }

  /**
   * Ürün bilgilerini güncelle. Stok ve partiler bu yoldan ASLA yazılmaz
   * (adjustStock / removeBatch / reconcileStock kullanın) — GTS birimleri korunur.
   */
  async update(id: string, changes: ProductInfoChanges): Promise<void> {
    const safe: Record<string, unknown> = { ...changes };
    for (const k of ['stock', 'batches', 'expiryDate', 'tenantId', 'createdAt', 'createdBy', 'id']) delete safe[k];
    await firstValueFrom(this.fs.update(PRODUCTS, id, safe));
  }

  /** Ürünü aktif/pasif yap (soft — satış ve listeden gizler ama veriyi korur) */
  async setActive(id: string, isActive: boolean): Promise<void> {
    await firstValueFrom(this.fs.update(PRODUCTS, id, { isActive }));
  }

  /**
   * Stok ekle/çıkar.
   * @param gtsNumbers GTS/karekod listesi. Doluysa her GTS için ayrı bir birim (quantity:1) parti oluşturulur
   *                   ve delta = gtsNumbers.length kabul edilir. Boşsa tek parti (quantity:delta) eklenir.
   * @param lotNo parti / şarj no (AI 10): tek değer tüm yeni partilere, `{ gts: lot }` eşlemesi GTS başına yazılır.
   * @returns çıkışta partilerin karşılayamadığı miktar (`shortfall`) — 0 değilse stok ≠ Σ parti demektir.
   */
  async adjustStock(product: Product, delta: number, reason: string, reference: string | null = null, expiryDate?: Date | null, gtsNumbers?: string[] | null, supplierId?: string | null, lotNo?: LotInput): Promise<StockWriteResult> {
    const gtsList = (gtsNumbers ?? []).map(g => g.trim()).filter(Boolean);
    if (gtsList.length > 0) {
      const existing = new Set((product.batches ?? []).filter(b => b.quantity > 0 && b.gtsNo).map(b => b.gtsNo!));
      const dupes = [...duplicateValues(gtsList), ...gtsList.filter(g => existing.has(g))];
      if (dupes.length) throw new ProductStockError('duplicate-gts', [...new Set(dupes)].join(', '));
      delta = gtsList.length;
    }
    if (!Number.isFinite(delta) || delta === 0) throw new ProductStockError('invalid-quantity');

    const newStock = roundQty(product.stock + delta);
    const productUpdate: Record<string, unknown> = { stock: newStock, updatedAt: serverTimestamp() };
    const currentBatches: Batch[] = product.batches ?? [];
    let shortfall = 0;

    if (delta > 0) {
      const expiryTs = expiryDate ? Timestamp.fromDate(expiryDate) : null;
      const addedAt = Timestamp.now();
      const supplier = supplierId || null;
      const newBatches: Batch[] = gtsList.length > 0
        // Her GTS = kendi benzersiz GTS'li tek birim (quantity:1)
        ? gtsList.map(g => withLot({ id: crypto.randomUUID(), quantity: 1, expiryDate: expiryTs, gtsNo: g, addedAt, supplierId: supplier }, lotFor(lotNo, g)))
        // GTS'siz toplu ekleme — tek parti
        : [withLot({ id: crypto.randomUUID(), quantity: delta, expiryDate: expiryTs, gtsNo: null, addedAt, supplierId: supplier }, lotFor(lotNo, null))];
      const updatedBatches = [...currentBatches, ...newBatches];
      productUpdate['batches'] = updatedBatches;
      productUpdate['expiryDate'] = nearestExpiry(updatedBatches);
    } else {
      const r = consumeFEFO(currentBatches, Math.abs(delta));
      shortfall = r.shortfall;
      productUpdate['batches'] = r.batches;
      productUpdate['expiryDate'] = nearestExpiry(r.batches);
    }

    const writeBatch = this.fs.batch();
    writeBatch.update(this.fs.docRef(`${PRODUCTS}/${product.id}`), productUpdate);
    this.addMovement(writeBatch, {
      productId: product.id, productName: product.name, type: delta > 0 ? 'in' : 'out',
      quantity: roundQty(Math.abs(delta)), previousStock: product.stock, newStock, reason, reference,
    });
    await writeBatch.commit();
    return { shortfall, newStock };
  }

  /** Tek bir partinin/GTS biriminin SKT, tedarikçi veya GTS'sini güncelle (ürün içi GTS tekrarı reddedilir) */
  async updateBatch(product: Product, batchId: string, changes: { expiryDate?: Date | null; supplierId?: string | null; gtsNo?: string | null; lotNo?: string | null }): Promise<void> {
    const current = product.batches ?? [];
    if (!current.some(b => b.id === batchId)) throw new ProductStockError('batch-not-found');
    const newGts = changes.gtsNo !== undefined ? (changes.gtsNo?.trim() || null) : undefined;
    if (newGts && current.some(b => b.id !== batchId && b.quantity > 0 && b.gtsNo === newGts)) {
      throw new ProductStockError('duplicate-gts', newGts);
    }
    const batches: Batch[] = current.map(b => {
      if (b.id !== batchId) return b;
      return {
        ...b,
        ...(changes.expiryDate !== undefined ? { expiryDate: changes.expiryDate ? Timestamp.fromDate(changes.expiryDate) : null } : {}),
        ...(changes.supplierId !== undefined ? { supplierId: changes.supplierId || null } : {}),
        ...(newGts !== undefined ? { gtsNo: newGts } : {}),
        ...(changes.lotNo !== undefined ? { lotNo: normalizeLotNo(changes.lotNo) } : {}),
      };
    });
    await firstValueFrom(this.fs.update(PRODUCTS, product.id, {
      batches,
      expiryDate: nearestExpiry(batches),
    }));
  }

  /**
   * Bir partiden birim çıkar — stok düşer, çıkış hareketi kaydedilir.
   * GTS'li birim (quantity:1) tamamen silinir; GTS'siz toplu partide `quantity` kadar düşülür (varsayılan: tamamı).
   * @returns `shortfall` > 0 ise ürün stoğu çıkarılan miktardan azdı (stok ≠ Σ parti); stok 0'a sabitlendi.
   */
  async removeBatch(product: Product, batchId: string, reason: string, quantity?: number): Promise<StockWriteResult> {
    const batches = product.batches ?? [];
    const target = batches.find(b => b.id === batchId);
    if (!target) throw new ProductStockError('batch-not-found');
    // kg / lt / metre partilerinde ondalıklı çıkış olabilir (adet birimde çağıran taraf tam sayı gönderir)
    const removeQty = quantity == null ? target.quantity : roundQty(quantity);
    if (!(removeQty > 0) || removeQty > target.quantity) throw new ProductStockError('invalid-quantity');

    const remaining = removeQty === target.quantity
      ? batches.filter(b => b.id !== batchId)
      : batches.map(b => (b.id === batchId ? { ...b, quantity: roundQty(b.quantity - removeQty) } : b));
    const rawStock = roundQty(product.stock - removeQty);
    const newStock = Math.max(0, rawStock);

    const writeBatch = this.fs.batch();
    writeBatch.update(this.fs.docRef(`${PRODUCTS}/${product.id}`), {
      stock: newStock,
      batches: remaining,
      expiryDate: nearestExpiry(remaining),
      updatedAt: serverTimestamp(),
    });
    this.addMovement(writeBatch, {
      productId: product.id, productName: product.name, type: 'out',
      quantity: roundQty(product.stock - newStock), previousStock: product.stock, newStock,
      reason: target.gtsNo ? `${reason}: ${target.gtsNo}` : reason, reference: null,
    });
    await writeBatch.commit();
    return { shortfall: rawStock < 0 ? -rawStock : 0, newStock };
  }

  /**
   * stock ≠ Σ batch.quantity uzlaştırması.
   * - 'stockToBatches': stok, partilerin toplamına eşitlenir (fark kadar giriş/çıkış hareketi yazılır).
   * - 'addMissingBatch': stok > Σ parti ise fark kadar GTS'siz, SKT'siz parti eklenir (stok değişmez, hareket yazılmaz).
   */
  async reconcileStock(product: Product, mode: 'stockToBatches' | 'addMissingBatch', reason: string): Promise<void> {
    const batches = product.batches ?? [];
    const total = batchTotal(batches);
    const diff = product.stock - total;
    if (diff === 0) return;
    const productRef = this.fs.docRef(`${PRODUCTS}/${product.id}`);
    const writeBatch = this.fs.batch();

    if (mode === 'addMissingBatch') {
      if (diff < 0) throw new ProductStockError('invalid-quantity');
      const updated: Batch[] = [...batches, {
        id: crypto.randomUUID(), quantity: diff, expiryDate: null, gtsNo: null, addedAt: Timestamp.now(), supplierId: null,
      }];
      writeBatch.update(productRef, { batches: updated, expiryDate: nearestExpiry(updated), updatedAt: serverTimestamp() });
    } else {
      // Tükenmiş (quantity <= 0) partileri de temizle
      const cleaned = batches.filter(b => b.quantity > 0);
      writeBatch.update(productRef, { stock: total, batches: cleaned, expiryDate: nearestExpiry(cleaned), updatedAt: serverTimestamp() });
      this.addMovement(writeBatch, {
        productId: product.id, productName: product.name, type: diff < 0 ? 'in' : 'out',
        quantity: roundQty(Math.abs(diff)), previousStock: product.stock, newStock: total, reason, reference: null,
      });
    }
    await writeBatch.commit();
  }

  private addMovement(
    writeBatch: ReturnType<FirestoreService['batch']>,
    m: Omit<StockMovement, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>,
  ): void {
    const movRef = this.fs.docRef(`${MOVEMENTS}/${crypto.randomUUID()}`);
    writeBatch.set(movRef, {
      ...m,
      tenantId: this.auth.currentTenantId(),
      createdBy: this.auth.currentUserId(),
      createdAt: serverTimestamp(),
    });
  }
}

