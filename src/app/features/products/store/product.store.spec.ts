import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { ProductStore } from './product.store';
import { ProductService } from '../services/product.service';
import { TenantSettingsService } from '../../../core/settings/tenant-settings.service';
import { AuthService } from '../../../core/auth/services/auth.service';
import { FakeSessionAuth } from '../../../core/auth/services/fake-session-auth.testing';
import { Product } from '../../../shared/models/product.model';

const product = (id: string, tenantId: string): Product => ({
  id, tenantId, name: id, barcode: '', category: 'Gübre', unit: 'adet', purchasePrice: 10, salePrice: 12,
  stock: 1, minStock: 0, isActive: true,
} as unknown as Product);

describe('ProductStore — oturum sıfırlama (Y1)', () => {
  let auth: FakeSessionAuth;
  /** Her getAll$ çağrısı: o anki tenant + kendi Subject'i + abonelik durumu. */
  let streams: { tenant: string; subject: Subject<Product[]>; closed: boolean }[];

  beforeEach(() => {
    TestBed.resetTestingModule();
    auth = new FakeSessionAuth();
    streams = [];
    const svc = {
      getAll$: () => {
        const entry = { tenant: auth.currentTenantId(), subject: new Subject<Product[]>(), closed: false };
        streams.push(entry);
        return new Observable<Product[]>(sub => {
          const s = entry.subject.subscribe(sub);
          return () => { entry.closed = true; s.unsubscribe(); };
        });
      },
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: ProductService, useValue: svc },
        {
          provide: TenantSettingsService,
          useValue: { ensureLoaded: () => undefined, expiryWarnDays: signal(30), expiryCriticalDays: signal(7) },
        },
      ],
    });
  });

  it('çıkış + başka işletmeyle giriş: önceki ürünler silinir, yeni işletmeye yeniden abone olunur', () => {
    const store = TestBed.inject(ProductStore);
    store.ensureLoaded();
    expect(streams.length).toBe(1);
    streams[0].subject.next([product('a1', 't1'), product('a2', 't1')]);
    expect(store.products().length).toBe(2);

    auth.switchTo(''); // çıkış
    expect(store.products()).toEqual([]);
    expect(store.loaded()).toBe(false);
    expect(streams[0].closed).toBe(true);

    auth.switchTo('u2|t2'); // başka işletmenin kasiyeri
    store.ensureLoaded();
    const last = streams[streams.length - 1];
    expect(last.tenant).toBe('t2');
    expect(store.products()).toEqual([]);
    last.subject.next([product('b1', 't2')]);
    expect(store.products().map(p => p.id)).toEqual(['b1']);
  });

  it('abonelik açıkken işletme değişirse (destek modu) hemen yeni işletmeye geçer', () => {
    const store = TestBed.inject(ProductStore);
    store.ensureLoaded();
    streams[0].subject.next([product('a1', 't1')]);
    auth.switchTo('u1|t9');
    expect(store.products()).toEqual([]);
    expect(streams[0].closed).toBe(true);
    expect(streams[1].tenant).toBe('t9');
    streams[1].subject.next([product('z1', 't9')]);
    expect(store.products().map(p => p.id)).toEqual(['z1']);
  });

  it('eski dinleyicinin yetki hatası ham mesaj olarak gösterilmez', () => {
    const store = TestBed.inject(ProductStore);
    store.ensureLoaded();
    streams[0].subject.error(Object.assign(new Error("false for 'list' @ L267"), { code: 'permission-denied', name: 'FirebaseError' }));
    expect(store.error()).not.toContain('@ L267');
    expect(store.error()).toBeTruthy();
  });

  it('ensureLoaded aynı oturumda ikinci kez abone olmaz', () => {
    const store = TestBed.inject(ProductStore);
    store.ensureLoaded();
    store.ensureLoaded();
    expect(streams.length).toBe(1);
  });
});
