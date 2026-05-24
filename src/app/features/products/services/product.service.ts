import { inject, Injectable } from '@angular/core';
import { orderBy, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/services/auth.service';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { NetworkService } from '../../../core/offline/network.service';
import { SyncQueueService } from '../../../core/offline/sync/sync-queue.service';
import { localDb } from '../../../core/offline/db/local.db';
import { Batch, CreateProductDto, Product, StockMovement } from '../../../shared/models/product.model';
import { firstValueFrom } from 'rxjs';
import { serverTimestamp, Timestamp } from '@angular/fire/firestore';
import { applyFEFO, nearestExpiry } from '../../../shared/utils/batch.utils';

const PRODUCTS = 'products';
const MOVEMENTS = 'stockMovements';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly fs = inject(FirestoreService);
  private readonly auth = inject(AuthService);
  private readonly network = inject(NetworkService);
  private readonly queue = inject(SyncQueueService);

  getAll$(): Observable<Product[]> {
    return this.fs.query$<Product>(
      PRODUCTS,
      where('tenantId', '==', this.auth.currentTenantId()),
      where('isActive', '==', true),
      orderBy('name')
    );
  }

  getByBarcode$(barcode: string): Observable<Product[]> {
    return this.fs.query$<Product>(
      PRODUCTS,
      where('tenantId', '==', this.auth.currentTenantId()),
      where('barcode', '==', barcode)
    );
  }

  async create(dto: CreateProductDto): Promise<string> {
    const data = {
      ...dto,
      tenantId: this.auth.currentTenantId(),
      createdBy: this.auth.currentUserId(),
    };
    return firstValueFrom(this.fs.add<Product>(PRODUCTS, data as any));
  }

  async update(id: string, changes: Partial<Product>): Promise<void> {
    await firstValueFrom(this.fs.update(PRODUCTS, id, changes));
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(this.fs.update(PRODUCTS, id, { isActive: false }));
  }

  async adjustStock(product: Product, delta: number, reason: string, reference: string | null = null, expiryDate?: Date | null): Promise<void> {
    const newStock = product.stock + delta;
    const movement: Partial<StockMovement> = {
      tenantId: this.auth.currentTenantId(),
      productId: product.id,
      productName: product.name,
      type: delta > 0 ? 'in' : 'out',
      quantity: Math.abs(delta),
      previousStock: product.stock,
      newStock,
      reason,
      reference,
      createdBy: this.auth.currentUserId(),
    };

    const writeBatch = this.fs.batch();
    const productRef = this.fs.docRef(`${PRODUCTS}/${product.id}`);
    const productUpdate: any = { stock: newStock, updatedAt: serverTimestamp() };

    const currentBatches: Batch[] = product.batches ?? [];

    if (delta > 0) {
      const newBatch: Batch = {
        id: crypto.randomUUID(),
        quantity: delta,
        expiryDate: expiryDate ? Timestamp.fromDate(expiryDate) : null,
        addedAt: Timestamp.now(),
      };
      const updatedBatches = [...currentBatches, newBatch];
      productUpdate.batches = updatedBatches;
      productUpdate.expiryDate = nearestExpiry(updatedBatches);
    } else if (delta < 0) {
      const updatedBatches = applyFEFO(currentBatches, Math.abs(delta));
      productUpdate.batches = updatedBatches;
      productUpdate.expiryDate = nearestExpiry(updatedBatches);
    }

    writeBatch.update(productRef, productUpdate);

    const movRef = this.fs.docRef(`${MOVEMENTS}/${crypto.randomUUID()}`);
    writeBatch.set(movRef, { ...movement, createdAt: serverTimestamp() } as any);

    await writeBatch.commit();
  }

  getById$(id: string): Observable<Product | null> {
    return this.fs.getById<Product>(PRODUCTS, id);
  }

  getMovements$(productId: string): Observable<StockMovement[]> {
    return this.fs.query$<StockMovement>(
      MOVEMENTS,
      where('tenantId', '==', this.auth.currentTenantId()),
      where('productId', '==', productId),
      orderBy('createdAt', 'desc')
    );
  }
}
