import { Injectable, inject } from '@angular/core';
import { orderBy, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/services/auth.service';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { Customer, CreateCustomerDto } from '../../../shared/models/customer.model';
import { firstValueFrom } from 'rxjs';

const COL = 'customers';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly fs = inject(FirestoreService);
  private readonly auth = inject(AuthService);

  getAll$(): Observable<Customer[]> {
    return this.fs.query$<Customer>(
      COL,
      where('tenantId', '==', this.auth.currentTenantId()),
      where('isActive', '==', true),
      orderBy('firstName')
    );
  }

  getById$(id: string): Observable<Customer | null> {
    return this.fs.getById<Customer>(COL, id);
  }

  async create(dto: CreateCustomerDto): Promise<string> {
    return firstValueFrom(this.fs.add<Customer>(COL, {
      ...dto,
      tenantId: this.auth.currentTenantId(),
      totalDebt: 0,
      totalPaid: 0,
      balance: 0,
      isActive: true,
    } as any));
  }

  async update(id: string, changes: Partial<Customer>): Promise<void> {
    await firstValueFrom(this.fs.update(COL, id, changes));
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(this.fs.update(COL, id, { isActive: false }));
  }
}
