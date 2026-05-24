import { Timestamp } from '@angular/fire/firestore';

export interface Batch {
  id: string;
  quantity: number;
  expiryDate: Timestamp | null;
  addedAt: Timestamp;
}

export interface Product {
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
  description: string | null;
  expiryDate: Timestamp | null;
  vatRate: number | null;
  batches: Batch[];
  imageUrl: string | null;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface StockMovement {
  id: string;
  tenantId: string;
  productId: string;
  productName: string;
  type: 'in' | 'out' | 'adjustment' | 'return';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  reference: string | null;
  createdAt: Timestamp;
  createdBy: string;
}

export type CreateProductDto = Omit<Product, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'createdBy'>;
