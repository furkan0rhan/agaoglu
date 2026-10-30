import { TestBed } from '@angular/core/testing';
import { CART_STORAGE_KEY, CartStore } from './cart.store';
import { CartItem } from '../../../shared/models/sale.model';

const item = (id: string, unitPrice: number, extra: Partial<CartItem> = {}): Omit<CartItem, '_tempId'> => ({
  productId: id, productName: id, barcode: '', quantity: 1, unitPrice,
  discount: 0, discountType: 'percent', totalPrice: unitPrice, stock: 5, ...extra,
});

describe('CartStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  const create = () => TestBed.inject(CartStore);

  it('toplamlar kuruşa yuvarlanır ve totalPrice indirimi içerir', () => {
    const cart = create();
    cart.addItem(item('A', 0.1));
    cart.addItem(item('B', 0.2));
    expect(cart.totalAmount()).toBe(0.3);
    cart.addItem(item('C', 100, { discount: 10 }));
    const c = cart.items().find(i => i.productId === 'C')!;
    expect(c.totalPrice).toBe(90);
    expect(cart.itemsDiscount()).toBe(10);
    expect(cart.totalAmount()).toBe(90.3);
  });

  it('genel indirim totalDiscount ve toplam içinde', () => {
    const cart = create();
    cart.addItem(item('A', 200));
    cart.setGlobalDiscount(10, 'percent');
    expect(cart.globalDiscountAmount()).toBe(20);
    expect(cart.totalDiscount()).toBe(20);
    expect(cart.totalAmount()).toBe(180);
  });

  it('kısmi nakitte kalan veresiye olur, para üstü 0', () => {
    const cart = create();
    cart.addItem(item('A', 100));
    cart.setPayment('mixed', 50, 0);
    expect(cart.creditAmount()).toBe(50);
    expect(cart.change()).toBe(0);
  });

  it('stok sınırında limit döner', () => {
    const cart = create();
    expect(cart.addItem(item('A', 10, { stock: 1 }))).toBe('added');
    expect(cart.addItem(item('A', 10, { stock: 1 }))).toBe('limit');
    expect(cart.addItem(item('B', 10, { stock: 0 }))).toBe('outOfStock');
  });

  it('snapshot / restore', () => {
    const cart = create();
    cart.addItem(item('A', 10));
    const snap = cart.snapshot();
    cart.clearCart();
    expect(cart.items().length).toBe(0);
    cart.restore(snap);
    expect(cart.items().length).toBe(1);
  });

  it('sepet localStorage a yazılır ve geri yüklenir', () => {
    const cart = create();
    cart.addItem(item('A', 10));
    TestBed.tick();
    expect(localStorage.getItem(CART_STORAGE_KEY)).toContain('"productId":"A"');
    TestBed.resetTestingModule();
    expect(TestBed.inject(CartStore).items().length).toBe(1);
  });

  it('miktar doğrudan yazılır; stok aşılırsa clamped, 0 silinir', () => {
    const cart = create();
    cart.addItem(item('A', 10, { stock: 100 }));
    const id = cart.items()[0]._tempId;
    expect(cart.updateQuantity(id, 40)).toBe('updated');
    expect(cart.items()[0].quantity).toBe(40);
    expect(cart.totalAmount()).toBe(400);
    expect(cart.updateQuantity(id, 250)).toBe('clamped');
    expect(cart.items()[0].quantity).toBe(100);
    expect(cart.updateQuantity(id, 0)).toBe('removed');
    expect(cart.items().length).toBe(0);
  });

  it('kg biriminde ondalıklı miktar (2 hane), adette tam sayı', () => {
    const cart = create();
    cart.addItem(item('G', 18.4, { stock: 50, unit: 'kg' }));
    cart.addItem(item('F', 5, { stock: 50 }));
    const [g, f] = cart.items();
    cart.updateQuantity(g._tempId, 12.456);
    cart.updateQuantity(f._tempId, 2.7);
    expect(cart.items()[0].quantity).toBe(12.46);
    expect(cart.items()[1].quantity).toBe(2);
    expect(cart.items()[0].totalPrice).toBe(229.26);
    // rozet: kg kalemi 1 satır sayılır
    expect(cart.itemCount()).toBe(3);
  });

  it('okutulan GTS kaleme eklenir, aynı GTS ikinci kez eklenemez', () => {
    const cart = create();
    expect(cart.addItem(item('I', 10, { gtsNos: ['G1'] }))).toBe('added');
    expect(cart.addItem(item('I', 10, { gtsNos: ['G2'] }))).toBe('added');
    expect(cart.addItem(item('I', 10, { gtsNos: ['G1'] }))).toBe('duplicate');
    expect(cart.items()[0].quantity).toBe(2);
    expect(cart.items()[0].gtsNos).toEqual(['G1', 'G2']);
  });

  it('miktar azalınca okutulan GTS listesi miktarı aşmaz', () => {
    const cart = create();
    cart.addItem(item('I', 10, { gtsNos: ['G1'] }));
    cart.addItem(item('I', 10, { gtsNos: ['G2'] }));
    cart.updateQuantity(cart.items()[0]._tempId, 1);
    expect(cart.items()[0].gtsNos).toEqual(['G1']);
  });

  it('e-reçete bilgisi sepette tutulur, sepet temizlenince silinir', () => {
    const cart = create();
    cart.addItem(item('I', 10));
    cart.setPrescription(' RX1 ', 'Müh. A');
    expect(cart.prescriptionNo()).toBe('RX1');
    cart.clearCart();
    expect(cart.prescriptionNo()).toBe('');
  });
});
