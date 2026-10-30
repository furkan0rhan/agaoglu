import { inject, Injectable } from '@angular/core';
import {
  arrayUnion, doc, Firestore, increment, limit, orderBy, runTransaction, serverTimestamp, Timestamp, Transaction, where,
} from '@angular/fire/firestore';
import { firstValueFrom, Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/services/auth.service';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { Batch, CreateProductDto, Product, StockMovement } from '../../../shared/models/product.model';
import { duplicateValues, type LotInput, lotFor, nearestExpiry, normalizeLotNo, roundQty, withLot } from '../../../shared/utils/batch.utils';
import { NetworkService } from '../../../core/offline/network.service';
import { LoggerService } from '../../../core/logging/logger.service';
import { LicenseService } from '../../../core/license/license.service';
import {
  checkNewGts, planCount, planReconcile, planRemoveBatch, planStockIn, planStockOut, ProductStockError, type StockPlan,
} from './stock-plan';
import { type BatchPick, type BatchPickResult, pickFromBatches } from '../../../shared/utils/batch-pick.utils';

const PRODUCTS = 'products';
const MOVEMENTS = 'stockMovements';

/** Ürün belgesinde stok/partilere dokunmayan, serbestçe güncellenebilir alanlar */
export type ProductInfoChanges = Partial<Omit<Product, 'id' | 'tenantId' | 'stock' | 'batches' | 'expiryDate' | 'createdAt' | 'updatedAt' | 'createdBy'>>;

export { ProductStockError, type ProductStockErrorCode } from './stock-plan';

export interface StockWriteResult {
  /** FEFO düşümünde partilerin karşılayamadığı miktar (0 = stok ve partiler tutarlı düştü) */
  shortfall: number;
  newStock: number;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly fs = inject(FirestoreService);
  private readonly auth = inject(AuthService);
  private readonly firestore = inject(Firestore);
  private readonly net = inject(NetworkService);
  private readonly logger = inject(LoggerService);
  private readonly license = inject(LicenseService);

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
   * Yeni belge olduğu için yarış yoktur: çevrimdışında beklemeden döner (yazım kuyruğa alınır, 3.8).
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
    await this.write(() => writeBatch.commit(), 'create');
    return productRef.id;
  }

  /**
   * Ürün bilgilerini güncelle. Stok ve partiler bu yoldan ASLA yazılmaz
   * (adjustStock / removeBatch / reconcileStock kullanın) — GTS birimleri korunur.
   */
  async update(id: string, changes: ProductInfoChanges): Promise<void> {
    const safe: Record<string, unknown> = { ...changes };
    for (const k of ['stock', 'batches', 'expiryDate', 'tenantId', 'createdAt', 'createdBy', 'id', 'lastSaleId']) delete safe[k];
    await this.write(() => firstValueFrom(this.fs.update(PRODUCTS, id, safe)), 'update');
  }

  /** Ürünü aktif/pasif yap (soft — satış ve listeden gizler ama veriyi korur) */
  async setActive(id: string, isActive: boolean): Promise<void> {
    await this.write(() => firstValueFrom(this.fs.update(PRODUCTS, id, { isActive })), 'setActive');
  }

  /**
   * Stok ekle/çıkar.
   * - Giriş (delta > 0): çevrimiçi → transaction (GTS tekrarı sunucudaki partilere göre); çevrimdışı →
   *   `increment` + `arrayUnion(yeni partiler)` ile beklemeden (yalnız ekleme: başka kasanın yazımını ezmez).
   * - Çıkış (delta < 0): yalnız çevrimiçi (transaction: FEFO düşümü sunucudaki partilerden); çevrimdışında
   *   `ProductStockError('offline')` (2.2 / 3.8).
   * @param gtsNumbers GTS/karekod listesi. Doluysa her GTS için ayrı bir birim (quantity:1) parti oluşturulur
   *                   ve delta = gtsNumbers.length kabul edilir. Boşsa tek parti (quantity:delta) eklenir.
   * @param lotNo parti / şarj no (AI 10): tek değer tüm yeni partilere, `{ gts: lot }` eşlemesi GTS başına yazılır.
   * @returns çıkışta partilerin karşılayamadığı miktar (`shortfall`) — 0 değilse stok ≠ Σ parti demektir.
   */
  async adjustStock(product: Product, delta: number, reason: string, reference: string | null = null, expiryDate?: Date | null, gtsNumbers?: string[] | null, supplierId?: string | null, lotNo?: LotInput): Promise<StockWriteResult> {
    const gtsList = (gtsNumbers ?? []).map(g => g.trim()).filter(Boolean);
    if (gtsList.length > 0) {
      checkNewGts(product, gtsList);
      delta = gtsList.length;
    }
    if (!Number.isFinite(delta) || delta === 0) throw new ProductStockError('invalid-quantity');

    if (delta < 0) {
      this.requireOnline();
      return this.stockTx(product.id, fresh => planStockOut(fresh, Math.abs(delta)), reason, reference);
    }

    const expiryTs = expiryDate ? Timestamp.fromDate(expiryDate) : null;
    const addedAt = Timestamp.now();
    const supplier = supplierId || null;
    const newBatches: Batch[] = gtsList.length > 0
      // Her GTS = kendi benzersiz GTS'li tek birim (quantity:1)
      ? gtsList.map(g => withLot({ id: crypto.randomUUID(), quantity: 1, expiryDate: expiryTs, gtsNo: g, addedAt, supplierId: supplier }, lotFor(lotNo, g)))
      // GTS'siz toplu ekleme — tek parti
      : [withLot({ id: crypto.randomUUID(), quantity: roundQty(delta), expiryDate: expiryTs, gtsNo: null, addedAt, supplierId: supplier }, lotFor(lotNo, null))];

    if (this.net.isOnline()) {
      return this.stockTx(product.id, fresh => {
        checkNewGts(fresh, gtsList);
        return planStockIn(fresh, newBatches);
      }, reason, reference);
    }

    // Çevrimdışı giriş: yalnız ekleme (increment + arrayUnion) — sunucudaki başka yazımlar korunur
    this.license.assertWritable();
    const plan = planStockIn(product, newBatches);
    const writeBatch = this.fs.batch();
    writeBatch.update(this.fs.docRef(`${PRODUCTS}/${product.id}`), {
      stock: increment(plan.quantity),
      batches: arrayUnion(...newBatches),
      expiryDate: nearestExpiry(plan.batches),
      updatedAt: serverTimestamp(),
    });
    this.addMovement(writeBatch, {
      productId: product.id, productName: product.name, type: 'in',
      quantity: plan.quantity, previousStock: plan.previousStock, newStock: plan.stock, reason, reference,
    });
    await this.write(() => writeBatch.commit(), 'adjustStock');
    return { shortfall: 0, newStock: plan.stock };
  }

  /**
   * Tek bir partinin/GTS biriminin SKT, tedarikçi veya GTS'sini güncelle (ürün içi GTS tekrarı reddedilir).
   * Parti dizisi yazıldığı için çevrimiçi transaction gerekir (çevrimdışında `ProductStockError('offline')`).
   */
  async updateBatch(product: Product, batchId: string, changes: { expiryDate?: Date | null; supplierId?: string | null; gtsNo?: string | null; lotNo?: string | null }): Promise<void> {
    this.requireOnline();
    const newGts = changes.gtsNo !== undefined ? (changes.gtsNo?.trim() || null) : undefined;
    await runTransaction(this.firestore, async tx => {
      const ref = this.fs.docRef(`${PRODUCTS}/${product.id}`);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new ProductStockError('product-not-found');
      const current = ((snap.data() as Product).batches ?? []);
      if (!current.some(b => b.id === batchId)) throw new ProductStockError('batch-not-found');
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
      tx.update(ref, { batches, expiryDate: nearestExpiry(batches), updatedAt: serverTimestamp() });
    });
  }

  /**
   * Bir partiden birim çıkar — stok düşer, çıkış hareketi kaydedilir (çevrimiçi transaction).
   * GTS'li birim (quantity:1) tamamen silinir; GTS'siz toplu partide `quantity` kadar düşülür (varsayılan: tamamı).
   * @returns `shortfall` > 0 ise ürün stoğu çıkarılan miktardan azdı (stok ≠ Σ parti); stok 0'a sabitlendi.
   */
  async removeBatch(product: Product, batchId: string, reason: string, quantity?: number): Promise<StockWriteResult> {
    this.requireOnline();
    return this.stockTx(product.id, fresh => {
      const plan = planRemoveBatch(fresh, batchId, quantity);
      return { ...plan, reason: plan.batch.gtsNo ? `${reason}: ${plan.batch.gtsNo}` : reason };
    }, reason, null);
  }

  /**
   * stock ≠ Σ batch.quantity uzlaştırması (çevrimiçi transaction; fark sunucudaki güncel hâlden hesaplanır).
   * - 'stockToBatches': stok, partilerin toplamına eşitlenir (fark kadar giriş/çıkış hareketi yazılır).
   * - 'addMissingBatch': stok > Σ parti ise fark kadar GTS'siz, SKT'siz parti eklenir (stok değişmez, hareket yazılmaz).
   */
  async reconcileStock(product: Product, mode: 'stockToBatches' | 'addMissingBatch', reason: string): Promise<void> {
    this.requireOnline();
    await this.stockTx(product.id, fresh => planReconcile(fresh, mode, qty => ({
      id: crypto.randomUUID(), quantity: qty, expiryDate: null, gtsNo: null, addedAt: Timestamp.now(), supplierId: null,
    })), reason, null);
  }

  /**
   * Stok sayımı: sayılan miktar MUTLAK hedeftir; fark transaction içinde sunucudaki güncel stoka göre
   * hesaplanır (sayım ekranı açıkken başka kasada yapılan satış ezilmez). Fazla → GTS'siz parti, eksik → FEFO.
   * Çevrimiçi gerekir. @returns uygulanan fark (0 = değişiklik yok)
   */
  async applyCount(product: Product, counted: number, reason: (delta: number) => string): Promise<StockWriteResult & { delta: number }> {
    this.requireOnline();
    let delta = 0;
    const res = await this.stockTx(product.id, fresh => {
      const plan = planCount(fresh, counted, qty => ({
        id: crypto.randomUUID(), quantity: qty, expiryDate: null, gtsNo: null, addedAt: Timestamp.now(), supplierId: null,
      }));
      delta = plan ? (plan.direction === 'in' ? plan.quantity : -plan.quantity) : 0;
      return plan ? { ...plan, reason: reason(delta) } : null;
    }, '', null);
    return { ...res, delta };
  }

  /** Transaction gerektiren stok işlemleri çevrimdışında beklemez: anlaşılır hata (3.8). */
  private requireOnline(): void {
    if (!this.net.isOnline()) throw new ProductStockError('offline');
  }

  /**
   * Ürünü transaction içinde SUNUCUDAN oku, `plan` ile yeni stok/partileri hesapla, ürün + stok hareketini
   * birlikte yaz. Çakışmada SDK yeniden dener; `plan` her denemede güncel veriyle baştan çalışır (2.2).
   */
  private async stockTx(productId: string, plan: (fresh: Product) => (StockPlan & { reason?: string }) | null, reason: string, reference: string | null): Promise<StockWriteResult> {
    this.license.assertWritable();
    return runTransaction(this.firestore, async tx => {
      const ref = this.fs.docRef(`${PRODUCTS}/${productId}`);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new ProductStockError('product-not-found');
      const fresh = { ...(snap.data() as Product), id: snap.id };
      const p = plan(fresh);
      if (!p) return { shortfall: 0, newStock: roundQty(Number(fresh.stock) || 0) };
      tx.update(ref, { stock: p.stock, batches: p.batches, expiryDate: nearestExpiry(p.batches), updatedAt: serverTimestamp() });
      if (p.quantity > 0) {
        tx.set(this.fs.docRef(`${MOVEMENTS}/${crypto.randomUUID()}`), {
          productId, productName: fresh.name, type: p.direction, quantity: roundQty(p.quantity),
          previousStock: p.previousStock, newStock: p.stock, reason: p.reason ?? reason, reference,
          tenantId: this.auth.currentTenantId(), createdBy: this.auth.currentUserId(), createdAt: serverTimestamp(),
        });
      }
      return { shortfall: p.shortfall, newStock: p.stock };
    });
  }

  /** Online ise sunucu onayını bekler; offline ise yazmayı yerel kuyruğa bırakıp hemen döner (3.8). */
  private async write(run: () => Promise<unknown>, op: string): Promise<void> {
    this.license.assertWritable();
    const p = run();
    if (this.net.isOnline()) { await p; return; }
    p.catch(err => this.logger.error(`product ${op} (offline) failed`, err));
  }

  /**
   * 11.13 (firmaya iade): seçilen partilerden / GTS birimlerinden çıkış, ÇAĞIRANIN transaction'ında.
   * Ürün tx içinde güncel okunur (bayat stok yazılmaz); ürün stok + partiler ve `stockMovements` 'out'
   * (reference) yazılır. Transaction kuralı: çağıran diğer okumalarını bundan ÖNCE yapmalı, ek belgesini sonra yazar.
   */
  async removePickedInTx(tx: Transaction, productId: string, picks: BatchPick[], reason: string, reference: string): Promise<{ product: Product; result: BatchPickResult }> {
    const ref = this.fs.docRef<Product>(`${PRODUCTS}/${productId}`);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new ProductStockError('batch-not-found', productId);
    const product = { ...snap.data(), id: snap.id } as Product;
    const result = pickFromBatches(Number(product.stock) || 0, product.batches ?? [], picks);
    tx.update(ref, { stock: result.newStock, batches: result.batches, expiryDate: result.expiryDate, updatedAt: serverTimestamp() });
    tx.set(this.fs.docRef(`${MOVEMENTS}/${crypto.randomUUID()}`), {
      productId: product.id, productName: product.name, type: 'out',
      quantity: roundQty((Number(product.stock) || 0) - result.newStock), previousStock: Number(product.stock) || 0,
      newStock: result.newStock, reason, reference,
      tenantId: this.auth.currentTenantId(), createdBy: this.auth.currentUserId(), createdAt: serverTimestamp(),
    });
    return { product, result };
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

