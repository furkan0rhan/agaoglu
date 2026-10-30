import { CartState } from './cart.store';
import { HELD_CARTS_KEY, holdCart, loadHeldCarts, MAX_HELD_CARTS, removeHeldCart, takeHeldCart } from './held-carts';

const state = (n = 1): CartState => ({
  items: Array.from({ length: n }, (_, i) => ({
    _tempId: `t${i}`, productId: `p${i}`, productName: `Ürün ${i}`, barcode: '', quantity: 1, unitPrice: 10,
    discount: 0, discountType: 'percent', totalPrice: 10, stock: 5,
  })),
  customerId: null, customerName: null, globalDiscount: 0, globalDiscountType: 'percent', paymentMethod: 'cash',
  cashPaid: 0, cardPaid: 0, notes: '', prescriptionNo: '', prescriberName: '',
});

describe('held-carts (Beklet)', () => {
  beforeEach(() => localStorage.clear());

  it('sepeti adıyla saklar ve geri çağırınca listeden çıkarır', () => {
    const r = holdCart('Ali amca', state(2), 1000);
    expect(r.ok).toBe(true);
    expect(loadHeldCarts()).toHaveLength(1);
    const id = r.ok ? r.cart.id : '';
    const back = takeHeldCart(id);
    expect(back?.name).toBe('Ali amca');
    expect(back?.state.items).toHaveLength(2);
    expect(loadHeldCarts()).toHaveLength(0);
    expect(localStorage.getItem(HELD_CARTS_KEY)).toBeNull();
  });

  it(`en fazla ${MAX_HELD_CARTS} sepet; boş sepet bekletilmez`, () => {
    for (let i = 0; i < MAX_HELD_CARTS; i++) expect(holdCart(`S${i}`, state(), i).ok).toBe(true);
    expect(holdCart('fazla', state(), 99)).toEqual({ ok: false, reason: 'full' });
    expect(holdCart('boş', state(0), 100)).toEqual({ ok: false, reason: 'empty' });
  });

  it('yeniden eskiye sıralar, siler, bozuk veride boş döner', () => {
    holdCart('eski', state(), 1);
    const yeni = holdCart('yeni', state(), 2);
    expect(loadHeldCarts().map(h => h.name)).toEqual(['yeni', 'eski']);
    if (yeni.ok) removeHeldCart(yeni.cart.id);
    expect(loadHeldCarts().map(h => h.name)).toEqual(['eski']);
    localStorage.setItem(HELD_CARTS_KEY, '{bozuk');
    expect(loadHeldCarts()).toEqual([]);
  });
});
