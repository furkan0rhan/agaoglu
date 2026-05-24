import { inject, Injectable } from '@angular/core';
import { Firestore, doc, writeBatch, serverTimestamp, collection, increment } from '@angular/fire/firestore';
import { AuthService } from '../../../core/auth/services/auth.service';
import { CartStore } from '../store/cart.store';
import { ProductStore } from '../../products/store/product.store';
import { Sale } from '../../../shared/models/sale.model';
import { LoggerService } from '../../../core/logging/logger.service';
import { applyFEFO, nearestExpiry } from '../../../shared/utils/batch.utils';

@Injectable({ providedIn: 'root' })
export class SaleService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartStore);
  private readonly productStore = inject(ProductStore);
  private readonly logger = inject(LoggerService);

  async completeSale(creditOptions?: { interestRate: number | null; installmentCount: number | null; installmentAmount: number | null; totalWithInterest: number | null }): Promise<string> {
    const tenantId = this.auth.currentTenantId();
    const saleNumber = this.generateSaleNumber();
    const batch = writeBatch(this.firestore);
    const saleRef = doc(collection(this.firestore, 'sales'));

    const sale: Omit<Sale, 'id'> = {
      tenantId,
      saleNumber,
      customerId: this.cart.customerId(),
      customerName: this.cart.customerName(),
      items: this.cart.items(),
      subtotal: this.cart.subtotal(),
      totalDiscount: this.cart.itemsDiscount(),
      totalAmount: this.cart.totalAmount(),
      paymentMethod: this.cart.paymentMethod(),
      cashPaid: this.cart.cashPaid(),
      cardPaid: this.cart.cardPaid(),
      creditAmount: this.cart.creditAmount(),
      change: this.cart.change(),
      status: 'completed',
      notes: this.cart.notes() || null,
      interestRate: creditOptions?.interestRate ?? null,
      installmentCount: creditOptions?.installmentCount ?? null,
      installmentAmount: creditOptions?.installmentAmount ?? null,
      createdAt: serverTimestamp() as any,
      createdBy: this.auth.currentUserId(),
      cancelledAt: null,
    };

    batch.set(saleRef, sale);

    // Stok düşür
    for (const item of this.cart.items()) {
      const product = this.productStore.findByBarcode(item.barcode)
        ?? this.productStore.products().find(p => p.id === item.productId);
      if (product) {
        const productRef = doc(this.firestore, 'products', product.id);
        const updatedBatches = applyFEFO(product.batches ?? [], item.quantity);
        batch.update(productRef, {
          stock: product.stock - item.quantity,
          batches: updatedBatches,
          expiryDate: nearestExpiry(updatedBatches),
          updatedAt: serverTimestamp(),
        });

        // Stok hareketi
        const movRef = doc(collection(this.firestore, 'stockMovements'));
        batch.set(movRef, {
          tenantId,
          productId: product.id,
          productName: product.name,
          type: 'out',
          quantity: item.quantity,
          previousStock: product.stock,
          newStock: product.stock - item.quantity,
          reason: `Satış: ${saleNumber}`,
          reference: saleRef.id,
          createdAt: serverTimestamp(),
          createdBy: this.auth.currentUserId(),
        });
      }
    }

    // Veresiye ise müşteri bakiyesi güncelle
    if (this.cart.creditAmount() > 0 && this.cart.customerId()) {
      const creditAmount = creditOptions?.totalWithInterest ?? this.cart.creditAmount();
      const creditRef = doc(collection(this.firestore, 'creditTransactions'));
      batch.set(creditRef, {
        tenantId,
        customerId: this.cart.customerId(),
        customerName: this.cart.customerName(),
        saleId: saleRef.id,
        type: 'debt',
        amount: creditAmount,
        originalAmount: creditOptions?.totalWithInterest ? this.cart.creditAmount() : null,
        description: `Satış: ${saleNumber} · ${this.cart.items().map(i => `${i.productName} (${i.quantity} adet)`).join(', ')}`,
        paymentMethod: null,
        balance: creditAmount,
        interestRate: creditOptions?.interestRate ?? null,
        installmentCount: creditOptions?.installmentCount ?? null,
        installmentAmount: creditOptions?.installmentAmount ?? null,
        createdAt: serverTimestamp(),
        createdBy: this.auth.currentUserId(),
      });

      const customerRef = doc(this.firestore, 'customers', this.cart.customerId()!);
      batch.update(customerRef, {
        totalDebt: increment(creditAmount),
        balance: increment(creditAmount),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    this.cart.clearCart();
    return saleRef.id;
  }

  private generateSaleNumber(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `S-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }
}
