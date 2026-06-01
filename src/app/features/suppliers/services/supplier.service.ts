import { Injectable, inject } from '@angular/core';
import { where } from '@angular/fire/firestore';
import { Observable, firstValueFrom, map } from 'rxjs';
import { AuthService } from '../../../core/auth/services/auth.service';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { Supplier, CreateSupplierDto } from '../../../shared/models/supplier.model';

const COL = 'suppliers';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private readonly fs = inject(FirestoreService);
  private readonly auth = inject(AuthService);

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
    return firstValueFrom(this.fs.add<Supplier>(COL, {
      ...dto,
      tenantId: this.auth.currentTenantId(),
      isActive: true,
    } as any));
  }

  async update(id: string, changes: Partial<Supplier>): Promise<void> {
    await firstValueFrom(this.fs.update(COL, id, changes));
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(this.fs.update(COL, id, { isActive: false }));
  }
}
