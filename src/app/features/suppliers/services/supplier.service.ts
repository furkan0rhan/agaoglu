import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, updateDoc, serverTimestamp, where } from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { AuthService } from '../../../core/auth/services/auth.service';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { NetworkService } from '../../../core/offline/network.service';
import { LoggerService } from '../../../core/logging/logger.service';
import { Supplier, CreateSupplierDto } from '../../../shared/models/supplier.model';

const COL = 'suppliers';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private readonly fs = inject(FirestoreService);
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly net = inject(NetworkService);
  private readonly logger = inject(LoggerService);

  getAll$(): Observable<Supplier[]> {
    return this.fs.query$<Supplier>(
      COL,
      where('tenantId', '==', this.auth.currentTenantId()),
    ).pipe(
      map(list => list
        .filter(s => s.isActive)
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      )
    );
  }

  getById$(id: string): Observable<Supplier | null> {
    return this.fs.getById<Supplier>(COL, id);
  }

  async create(dto: CreateSupplierDto): Promise<string> {
    const ref = doc(this.fs.col(COL));
    await this.write(setDoc(ref, {
      ...dto,
      tenantId: this.auth.currentTenantId(),
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }), 'create');
    return ref.id;
  }

  async update(id: string, changes: Partial<Supplier>): Promise<void> {
    const { id: _id, tenantId: _t, createdAt: _c, ...rest } = changes;
    await this.write(updateDoc(doc(this.firestore, COL, id), { ...rest, updatedAt: serverTimestamp() }), 'update');
  }

  /** Soft delete. Çağıran, partilerde bu tedarikçiye referans olmadığını kontrol etmelidir. */
  async delete(id: string): Promise<void> {
    await this.write(updateDoc(doc(this.firestore, COL, id), { isActive: false, updatedAt: serverTimestamp() }), 'delete');
  }

  /** Online ise sunucu onayını bekler; offline ise yazmayı yerel kuyruğa bırakıp hemen döner. */
  private async write(p: Promise<unknown>, op: string): Promise<void> {
    if (this.net.isOnline()) { await p; return; }
    p.catch(err => this.logger.error(`supplier ${op} (offline) failed`, err));
  }
}
