import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { computed } from '@angular/core';
import { CartItem, DiscountType, PaymentMethod } from '../../../shared/models/sale.model';

interface CartState {
  items: CartItem[];
  customerId: string | null;
  customerName: string | null;
  globalDiscount: number;
  globalDiscountType: DiscountType;
  paymentMethod: PaymentMethod;
  cashPaid: number;
  cardPaid: number;
  notes: string;
}

const initial: CartState = {
  items: [],
  customerId: null,
  customerName: null,
  globalDiscount: 0,
  globalDiscountType: 'percent',
  paymentMethod: 'cash',
  cashPaid: 0,
  cardPaid: 0,
  notes: '',
};

export const CartStore = signalStore(
  { providedIn: 'root' },
  withState(initial),

  withComputed(({ items, globalDiscount, globalDiscountType, cashPaid, cardPaid }) => ({
    subtotal: computed(() =>
      items().reduce((s, i) => s + i.unitPrice * i.quantity, 0)
    ),
    itemsDiscount: computed(() =>
      items().reduce((s, i) => {
        const d = i.discountType === 'percent'
          ? i.unitPrice * i.quantity * (i.discount / 100)
          : i.discount * i.quantity;
        return s + d;
      }, 0)
    ),
    totalAmount: computed(() => {
      const sub = items().reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const itemDisc = items().reduce((s, i) => {
        const d = i.discountType === 'percent'
          ? i.unitPrice * i.quantity * (i.discount / 100)
          : i.discount * i.quantity;
        return s + d;
      }, 0);
      const afterItems = sub - itemDisc;
      const gDisc = globalDiscountType() === 'percent'
        ? afterItems * (globalDiscount() / 100)
        : globalDiscount();
      return Math.max(0, afterItems - gDisc);
    }),
    change: computed(() => {
      const paid = cashPaid() + cardPaid();
      const sub = items().reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const itemDisc = items().reduce((s, i) => {
        const d = i.discountType === 'percent'
          ? i.unitPrice * i.quantity * (i.discount / 100)
          : i.discount * i.quantity;
        return s + d;
      }, 0);
      const afterItems = sub - itemDisc;
      const gDisc = globalDiscountType() === 'percent'
        ? afterItems * (globalDiscount() / 100)
        : globalDiscount();
      const total = Math.max(0, afterItems - gDisc);
      return Math.max(0, paid - total);
    }),
    creditAmount: computed(() => {
      const sub = items().reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const itemDisc = items().reduce((s, i) => {
        const d = i.discountType === 'percent'
          ? i.unitPrice * i.quantity * (i.discount / 100)
          : i.discount * i.quantity;
        return s + d;
      }, 0);
      const afterItems = sub - itemDisc;
      const gDisc = globalDiscountType() === 'percent'
        ? afterItems * (globalDiscount() / 100)
        : globalDiscount();
      const total = Math.max(0, afterItems - gDisc);
      return Math.max(0, total - cashPaid() - cardPaid());
    }),
    itemCount: computed(() => items().reduce((s, i) => s + i.quantity, 0)),
  })),

  withMethods(store => ({
    addItem(item: Omit<CartItem, '_tempId'>): void {
      const existing = store.items().find(i => i.productId === item.productId);
      if (existing) {
        const newQty = Math.min(existing.quantity + item.quantity, item.stock);
        if (newQty === existing.quantity) return;
        patchState(store, {
          items: store.items().map(i =>
            i.productId === item.productId
              ? { ...i, quantity: newQty, totalPrice: i.unitPrice * newQty }
              : i
          ),
        });
      } else {
        const qty = Math.min(item.quantity, item.stock);
        if (qty <= 0) return;
        patchState(store, {
          items: [...store.items(), { ...item, quantity: qty, _tempId: crypto.randomUUID() }],
        });
      }
    },

    updateQuantity(tempId: string, quantity: number): void {
      if (quantity <= 0) {
        patchState(store, { items: store.items().filter(i => i._tempId !== tempId) });
        return;
      }
      patchState(store, {
        items: store.items().map(i => {
          if (i._tempId !== tempId) return i;
          const capped = Math.min(quantity, i.stock);
          return { ...i, quantity: capped, totalPrice: i.unitPrice * capped };
        }),
      });
    },

    removeItem(tempId: string): void {
      patchState(store, { items: store.items().filter(i => i._tempId !== tempId) });
    },

    setCustomer(id: string | null, name: string | null): void {
      patchState(store, { customerId: id, customerName: name });
    },

    setPayment(method: PaymentMethod, cash = 0, card = 0): void {
      patchState(store, { paymentMethod: method, cashPaid: cash, cardPaid: card });
    },

    setGlobalDiscount(discount: number, type: DiscountType): void {
      patchState(store, { globalDiscount: discount, globalDiscountType: type });
    },

    clearCart(): void {
      patchState(store, { ...initial });
    },
  }))
);
