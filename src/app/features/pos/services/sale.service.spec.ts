import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { AuthService } from '../../../core/auth/services/auth.service';
import { NetworkService } from '../../../core/offline/network.service';
import { PrescriptionMode } from '../../../core/settings/tenant-settings.model';
import { TenantSettingsService } from '../../../core/settings/tenant-settings.service';
import { Batch, Product } from '../../../shared/models/product.model';
import { ProductStore } from '../../products/store/product.store';
import { CartStore } from '../store/cart.store';
import { cartItemFromProduct } from './cart-item.utils';
import { FarmerSyncService } from './farmer-sync.service';
import {
  ExpiredPlantProtectionError, GtsUnavailableError, PrescriptionRequiredError, SaleNeedsConfirmationError, SaleService,
} from './sale.service';

/**
 * Satış öncesi mevzuat doğrulamaları (Firestore'a hiç yazmadan fırlatılır). Firestore sahte ({}) olduğu için
 * doğrulamayı geçen satış, referans oluştururken başka bir hatayla düşer — testler yalnızca hata türüne bakar.
 */
const ts = (ms: number) => ({ toMillis: () => ms }) as unknown as Batch['expiryDate'];
const batch = (id: string, quantity: number, exp: number | null, gtsNo: string | null = null): Batch =>
  ({ id, quantity, expiryDate: exp == null ? null : ts(exp), gtsNo, addedAt: ts(0) as never, supplierId: null });

const ilac = (extra: Partial<Product> = {}): Product => ({
  id: 'ilac', name: 'İlaç A', barcode: '111', stock: 2, minStock: 0, purchasePrice: 5, salePrice: 10, category: 'Zirai İlaç',
  productType: 'bitki_koruma', requiresPrescription: true, isActive: true,
  batches: [batch('g1', 1, null, 'GTS-1'), batch('g2', 1, null, 'GTS-2')], ...extra,
}) as Product;

describe('SaleService — e-reçete, GTS ve SKT engeli', () => {
  let products: Product[];
  const mode = signal<PrescriptionMode>('required');

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    products = [ilac()];
    mode.set('required');
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: AuthService, useValue: { currentTenantId: () => 't1', currentUserId: () => 'u1', sessionKey: () => 'u1|t1', onSessionChange: () => () => undefined } },
        { provide: ProductStore, useValue: { products: () => products } },
        { provide: TenantSettingsService, useValue: { prescriptionMode: mode } },
        { provide: NetworkService, useValue: { isOnline: () => true } },
        { provide: FarmerSyncService, useValue: { syncCustomer: () => Promise.resolve(0) } },
      ],
    });
  });

  const setup = () => ({ svc: TestBed.inject(SaleService), cart: TestBed.inject(CartStore) });

  it('required: reçeteli ürün müşterisiz ve reçete nosuz satılamaz; sepet geri yüklenir', async () => {
    const { svc, cart } = setup();
    cart.addItem(cartItemFromProduct(products[0]));
    const err = await svc.completeSale().catch(e => e);
    expect(err).toBeInstanceOf(PrescriptionRequiredError);
    expect((err as PrescriptionRequiredError).missing).toEqual(['customer', 'number']);
    expect(cart.items()).toHaveLength(1);
  });

  it('required: müşteri var, numara yoksa yine engellenir', async () => {
    const { svc, cart } = setup();
    cart.addItem(cartItemFromProduct(products[0]));
    cart.setCustomer('c1', 'Ali Veli');
    const err = await svc.completeSale().catch(e => e);
    expect((err as PrescriptionRequiredError).missing).toEqual(['number']);
  });

  it('required: müşteri + e-reçete no ile reçete kontrolünden geçer', async () => {
    const { svc, cart } = setup();
    cart.addItem(cartItemFromProduct(products[0]));
    cart.setCustomer('c1', 'Ali Veli');
    cart.setPrescription('RX-2026-1');
    const err = await svc.completeSale().catch(e => e);
    expect(err).not.toBeInstanceOf(PrescriptionRequiredError);
  });

  it('warn ve off modlarında reçetesiz satış engellenmez', async () => {
    for (const m of ['warn', 'off'] as const) {
      mode.set(m);
      const { svc, cart } = setup();
      cart.clearCart();
      cart.addItem(cartItemFromProduct(products[0]));
      const err = await svc.completeSale().catch(e => e);
      expect(err).not.toBeInstanceOf(PrescriptionRequiredError);
    }
  });

  it('okutulan GTS stokta yoksa satış engellenir', async () => {
    mode.set('off');
    const { svc, cart } = setup();
    cart.addItem({ ...cartItemFromProduct(products[0]), gtsNos: ['GTS-YOK'] });
    const err = await svc.completeSale().catch(e => e);
    expect(err).toBeInstanceOf(GtsUnavailableError);
  });

  it('SKT geçmiş bitki koruma ürünü onayla bile satılamaz (engel)', async () => {
    mode.set('off');
    products = [ilac({ stock: 1, batches: [batch('old', 1, 1000, 'GTS-OLD')] })];
    const { svc, cart } = setup();
    // stok sınırını atlamak için kalemi doğrudan ekle (sellableStock 0 olurdu)
    cart.addItem({ ...cartItemFromProduct(products[0]), stock: 1 });
    const err = await svc.completeSale(undefined, { confirmed: true }).catch(e => e);
    expect(err).toBeInstanceOf(ExpiredPlantProtectionError);
  });

  it('SKT geçmiş gübre: mevcut onay akışı (engel değil)', async () => {
    mode.set('off');
    products = [ilac({ productType: 'gubre', category: 'Gübre', requiresPrescription: false, stock: 1, batches: [batch('old', 1, 1000)] })];
    const { svc, cart } = setup();
    cart.addItem({ ...cartItemFromProduct(products[0]), stock: 1 });
    const err = await svc.completeSale().catch(e => e);
    expect(err).toBeInstanceOf(SaleNeedsConfirmationError);
  });
});
