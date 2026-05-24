import Dexie, { type EntityTable } from 'dexie';

export interface LocalProduct {
  id: string;
  tenantId: string;
  name: string;
  barcode: string;
  gtsNo: string | null;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  category: string;
  brand: string | null;
  isActive: boolean;
  expiryDate: number | null;
  updatedAt: number;
}

export interface LocalSale {
  id: string;
  tenantId: string;
  saleNumber: string;
  customerId: string | null;
  totalAmount: number;
  status: string;
  createdAt: number;
  synced: boolean;
  data: string; // JSON stringified full sale
}

export interface LocalCustomer {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  phone: string;
  balance: number;
  updatedAt: number;
}

export interface SyncQueueItem {
  id?: number;
  operation: 'create' | 'update' | 'delete';
  collection: string;
  documentId: string;
  data: string; // JSON stringified
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'synced' | 'failed';
}

export class LocalDatabase extends Dexie {
  products!: EntityTable<LocalProduct, 'id'>;
  sales!: EntityTable<LocalSale, 'id'>;
  customers!: EntityTable<LocalCustomer, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;

  constructor() {
    super('AgriMarketDB');
    this.version(1).stores({
      products: 'id, barcode, gtsNo, category, isActive, tenantId, updatedAt',
      sales: 'id, saleNumber, customerId, status, createdAt, tenantId, synced',
      customers: 'id, phone, tenantId, updatedAt',
      syncQueue: '++id, status, collection, timestamp',
    });
  }
}

export const localDb = new LocalDatabase();
