import { signalStore, withState, withComputed, withMethods, withHooks, patchState, getState } from '@ngrx/signals';
import { computed, effect } from '@angular/core';
import { CartItem, DiscountType, PaymentMethod } from '../../../shared/models/sale.model';
import { isDecimalUnit, lineAmounts, normalizeQty, round2, roundQty } from '../services/sale.utils';

export interface CartState {
  items: CartItem[];
  customerId: string | null;
  customerName: string | null;
  globalDiscount: number;
  globalDiscountType: DiscountType;
  paymentMethod: PaymentMethod;
  cashPaid: number;
  cardPaid: number;
  notes: string;
  /** E-reçete numarası (sepette reçeteli ürün varsa ödeme öncesi alınır). */
  prescriptionNo: string;
  /** Reçeteyi yazan (opsiyonel). */
  prescriberName: string;
}

export const CART_STORAGE_KEY = 'tm.cart.v1';

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
  prescriptionNo: '',
  prescriberName: '',
};

/** Okutulan GTS listesi miktarı aşamaz (sondan kırpılır). */
function trimGts(item: CartItem): CartItem {
  const g = item.gtsNos;
  if (!g?.length) return item;
  const max = Math.floor(item.quantity);
  return g.length > max ? { ...item, gtsNos: g.slice(0, max) } : item;
}

/** Kalemin totalPrice'ını indirimli ve yuvarlı olarak yeniden hesapla. */
function priced(item: CartItem): CartItem {
  return { ...item, totalPrice: lineAmounts(item).total };
}

function loadPersisted(): Partial<CartState> | null {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CartState>;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return { ...parsed, items: parsed.items.map(priced) };
  } catch {
    return null;
  }
}

function persist(state: CartState): void {
  try {
    if (state.items.length === 0 && !state.customerId) localStorage.removeItem(CART_STORAGE_KEY);
    else localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* depolama yok/kapalı — sepet yalnızca bellekte kalır */
  }
}

/** duplicate: aynı GTS zaten sepette */
export type AddItemResult = 'added' | 'limit' | 'outOfStock' | 'duplicate';
/** updated: istenen miktar uygulandı · clamped: stok sınırına indirildi · removed: satır silindi */
export type UpdateQtyResult = 'updated' | 'clamped' | 'removed';

export const CartStore = signalStore(
  { providedIn: 'root' },
  withState(initial),

  // Tek hesap zinciri: satır → ara toplam → indirimler → toplam → ödeme
  withComputed(({ items, globalDiscount, globalDiscountType, cashPaid, cardPaid }) => {
    const lines = computed(() => items().map(lineAmounts));
    const subtotal = computed(() => round2(lines().reduce((s, l) => s + l.gross, 0)));
    const itemsDiscount = computed(() => round2(lines().reduce((s, l) => s + l.discount, 0)));
    const afterItems = computed(() => round2(subtotal() - itemsDiscount()));
    const globalDiscountAmount = computed(() => {
      const g = Math.max(0, globalDiscount() || 0);
      const raw = globalDiscountType() === 'percent' ? afterItems() * (g / 100) : g;
      return round2(Math.min(raw, afterItems()));
    });
    const totalDiscount = computed(() => round2(itemsDiscount() + globalDiscountAmount()));
    const totalAmount = computed(() => round2(Math.max(0, afterItems() - globalDiscountAmount())));
    const paid = computed(() => round2((cashPaid() || 0) + (cardPaid() || 0)));
    const change = computed(() => round2(Math.max(0, paid() - totalAmount())));
    const creditAmount = computed(() => round2(Math.max(0, totalAmount() - paid())));
    /** Rozet sayacı: adetli kalemlerde miktar, kg/lt/metre kalemlerinde 1 satır. */
    const itemCount = computed(() => items().reduce((s, i) => s + (isDecimalUnit(i.unit) ? 1 : i.quantity), 0));
    return { subtotal, itemsDiscount, globalDiscountAmount, totalDiscount, totalAmount, change, creditAmount, itemCount };
  }),

  withMethods(store => ({
    /** Ürünü sepete ekler. Stok sınırındaysa 'limit', stok yoksa 'outOfStock' döner. */
    /**
     * Ürünü sepete ekler. Stok sınırındaysa 'limit', stok yoksa 'outOfStock' döner.
     * `item.gtsNos` doluysa (GTS okutuldu) o birimler kaleme eklenir; aynı GTS zaten sepetteyse 'duplicate'.
     */
    addItem(item: Omit<CartItem, '_tempId'>): AddItemResult {
      const scanned = (item.gtsNos ?? []).filter(Boolean);
      if (scanned.some(g => store.items().some(i => i.gtsNos?.includes(g)))) return 'duplicate';
      const existing = store.items().find(i => i.productId === item.productId);
      if (existing) {
        const newQty = roundQty(Math.min(existing.quantity + item.quantity, item.stock));
        if (newQty <= existing.quantity) return 'limit';
        const gtsNos = scanned.length ? [...(existing.gtsNos ?? []), ...scanned] : existing.gtsNos;
        patchState(store, {
          items: store.items().map(i =>
            i.productId === item.productId
              ? trimGts(priced({ ...i, stock: item.stock, quantity: newQty, ...(gtsNos ? { gtsNos } : {}) }))
              : i
          ),
        });
        return 'added';
      }
      const qty = roundQty(Math.min(item.quantity, item.stock));
      if (qty <= 0) return 'outOfStock';
      patchState(store, {
        items: [...store.items(), trimGts(priced({ ...item, quantity: qty, _tempId: crypto.randomUUID() }))],
      });
      return 'added';
    },

    /**
     * Miktarı ayarlar. Birime göre normalleştirir (kg/lt/metre 2 hane, diğerleri tam sayı),
     * stoğu aşarsa stoğa indirir ('clamped'), 0 ve altı satırı siler ('removed').
     */
    updateQuantity(tempId: string, quantity: number): UpdateQtyResult {
      const current = store.items().find(i => i._tempId === tempId);
      const qty = normalizeQty(quantity, current?.unit);
      if (!current || qty <= 0) {
        patchState(store, { items: store.items().filter(i => i._tempId !== tempId) });
        return 'removed';
      }
      const capped = roundQty(Math.min(qty, current.stock));
      patchState(store, {
        items: store.items().map(i => (i._tempId !== tempId ? i : trimGts(priced({ ...i, quantity: capped })))),
      });
      return capped < qty ? 'clamped' : 'updated';
    },

    removeItem(tempId: string): void {
      patchState(store, { items: store.items().filter(i => i._tempId !== tempId) });
    },

    setCustomer(id: string | null, name: string | null): void {
      patchState(store, { customerId: id, customerName: name });
    },

    /** E-reçete bilgisi (boş string = yok). */
    setPrescription(prescriptionNo: string, prescriberName = ''): void {
      patchState(store, { prescriptionNo: prescriptionNo.trim(), prescriberName: prescriberName.trim() });
    },

    /** Okutulan bir GTS'yi kalemden çıkar (miktar değişmez; satışta FEFO tamamlar). */
    removeGts(tempId: string, gtsNo: string): void {
      patchState(store, {
        items: store.items().map(i => (i._tempId !== tempId ? i : { ...i, gtsNos: (i.gtsNos ?? []).filter(g => g !== gtsNo) })),
      });
    },

    setPayment(method: PaymentMethod, cash = 0, card = 0): void {
      patchState(store, { paymentMethod: method, cashPaid: round2(cash), cardPaid: round2(card) });
    },

    setGlobalDiscount(discount: number, type: DiscountType): void {
      patchState(store, { globalDiscount: Math.max(0, discount || 0), globalDiscountType: type });
    },

    /** Mevcut sepetin kopyası (satış sırasında geri yükleme için). */
    snapshot(): CartState {
      return structuredClone(getState(store)) as CartState;
    },

    restore(state: CartState): void {
      patchState(store, { ...state, items: state.items.map(priced) });
    },

    clearCart(): void {
      patchState(store, { ...initial });
    },
  })),

  withHooks({
    onInit(store) {
      const saved = loadPersisted();
      if (saved) patchState(store, { ...initial, ...saved });
      effect(() => persist(getState(store) as CartState));
    },
  })
);
