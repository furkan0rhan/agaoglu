import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/services/auth.service';
import { FarmerLink } from '../../shared/models/farmer.model';
import { CustomerLinkInfo, DEALER_FARMER_REPOSITORY } from '../farmer/data/repositories';
import { FarmerSyncService } from '../pos/services/farmer-sync.service';
import { FarmerLinkWatcher, linkSyncReason } from './farmer-link-watcher.service';

const consent = { purchases: true as const, fields: false, logs: false, notifications: false, textVersion: 'v1', grantedAt: null, updatedAt: null };
const mk = (over: Partial<FarmerLink> = {}): FarmerLink => ({
  id: 't1_f1', tenantId: 't1', farmerId: 'f1', customerId: 'c1', inviteCode: 'X', status: 'active', consent,
  tenantName: 'Bayi', farmerName: 'Hüseyin', balance: null, balanceUpdatedAt: null, nextDue: null, overdueAmount: null,
  schedule: [], createdAt: new Date(), ...over,
});

describe('linkSyncReason', () => {
  const cust = (balance: number | null, farmerId: string | null = null): CustomerLinkInfo => ({ balance, farmerId });

  it('davetle yeni bağlanan (hiç senkronlanmamış) bağlantı ilk senkronu ister (Y6)', () => {
    expect(linkSyncReason(mk(), cust(6430))).toBe('initial');
  });
  it('bakiye farkı → balance; aynıysa ve vade alanları varsa → yok', () => {
    const synced = mk({ balance: 6430, balanceUpdatedAt: new Date(), overdueAmount: 0 });
    expect(linkSyncReason(synced, cust(4000))).toBe('balance');
    expect(linkSyncReason(synced, cust(6430.001))).toBeNull();
  });
  it('vade alanları olmayan eski bağlantı bir kez yükseltilir', () => {
    expect(linkSyncReason(mk({ balance: 0, balanceUpdatedAt: new Date() }), cust(0))).toBe('upgrade');
  });
  it('koparılmış bağlantı ya da okunamayan müşteri senkron istemez', () => {
    expect(linkSyncReason(mk({ status: 'revoked' }), cust(10))).toBeNull();
    expect(linkSyncReason(mk(), null)).toBeNull();
  });
});

describe('FarmerLinkWatcher', () => {
  let linksCb: (l: FarmerLink[]) => void;
  const custCbs = new Map<string, (c: CustomerLinkInfo | null) => void>();
  let repo: Record<string, ReturnType<typeof vi.fn>>;
  let sync: { syncLink: ReturnType<typeof vi.fn> };
  const user = signal<{ tenantId: string; role: string; accountType?: string } | null>(null);

  beforeEach(() => {
    custCbs.clear();
    user.set(null);
    repo = {
      watchTenantLinks: vi.fn((_t: string, next: (l: FarmerLink[]) => void) => { linksCb = next; return () => undefined; }),
      watchCustomer: vi.fn((id: string, next: (c: CustomerLinkInfo | null) => void) => { custCbs.set(id, next); return () => undefined; }),
      setCustomerFarmerId: vi.fn().mockResolvedValue(undefined),
    };
    sync = { syncLink: vi.fn().mockResolvedValue(1) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { currentUser: user } },
        { provide: FarmerSyncService, useValue: sync },
        { provide: DEALER_FARMER_REPOSITORY, useValue: repo },
      ],
    });
  });

  it('yeni bağlantıyı senkronlar, müşteri kartına farmerId yazar; aynı durumda tekrar denemez', () => {
    const w = TestBed.inject(FarmerLinkWatcher);
    w.start('t1');
    linksCb([mk()]);
    custCbs.get('c1')!({ balance: 6430, farmerId: null });
    expect(sync.syncLink).toHaveBeenCalledTimes(1);
    expect(repo['setCustomerFarmerId']).toHaveBeenCalledWith('c1', 'f1');
    // Aynı anlık görüntü tekrar gelirse (ör. başarısız senkron) döngüye girmez
    custCbs.get('c1')!({ balance: 6430, farmerId: 'f1' });
    linksCb([mk()]);
    expect(sync.syncLink).toHaveBeenCalledTimes(1);
    // Senkron sonrası bağlantı güncel → yeni bakiye (tahsilat) gelince tekrar
    linksCb([mk({ balance: 6430, balanceUpdatedAt: new Date(), overdueAmount: 0 })]);
    expect(sync.syncLink).toHaveBeenCalledTimes(1);
    custCbs.get('c1')!({ balance: 4000, farmerId: 'f1' });
    expect(sync.syncLink).toHaveBeenCalledTimes(2);
  });

  it('koparılan bağlantıda müşteri kartındaki farmerId temizlenir', () => {
    const w = TestBed.inject(FarmerLinkWatcher);
    w.start('t1');
    linksCb([mk({ balance: 0, balanceUpdatedAt: new Date(), overdueAmount: 0 })]);
    custCbs.get('c1')!({ balance: 0, farmerId: 'f1' });
    linksCb([mk({ status: 'revoked' })]);
    expect(repo['setCustomerFarmerId']).toHaveBeenCalledWith('c1', null);
  });

  it('yalnız bayi admin/kasiyer oturumunda çalışır', () => {
    const w = TestBed.inject(FarmerLinkWatcher);
    const detach = w.attachToSession();
    user.set({ tenantId: 'uid', role: 'staff', accountType: 'farmer' });
    TestBed.tick();
    expect(repo['watchTenantLinks']).not.toHaveBeenCalled();
    user.set({ tenantId: 't1', role: 'cashier' });
    TestBed.tick();
    expect(repo['watchTenantLinks']).toHaveBeenCalledWith('t1', expect.any(Function), expect.any(Function));
    detach();
  });
});
