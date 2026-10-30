import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/auth/services/auth.service';
import { NetworkService } from '../../../core/offline/network.service';
import { DEALER_FARMER_REPOSITORY } from '../../farmer/data/repositories';
import { FarmerSyncService } from './farmer-sync.service';

describe('FarmerSyncService (satış sonrası çiftçi ambarı)', () => {
  const link = { id: 't1_f1', tenantId: 't1', farmerId: 'f1', customerId: 'c1', status: 'active', tenantName: 'X' };
  let repo: { findLinkForCustomer: ReturnType<typeof vi.fn>; getTenantName: ReturnType<typeof vi.fn>; syncCustomerToFarmer: ReturnType<typeof vi.fn> };
  let online = true;

  beforeEach(() => {
    online = true;
    repo = {
      findLinkForCustomer: vi.fn().mockResolvedValue(link),
      getTenantName: vi.fn().mockResolvedValue('Ağaoğlu Tarım'),
      syncCustomerToFarmer: vi.fn().mockResolvedValue(2),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { currentTenantId: () => 't1' } },
        { provide: NetworkService, useValue: { isOnline: () => online } },
        { provide: DEALER_FARMER_REPOSITORY, useValue: repo },
      ],
    });
  });

  it('bağlı müşteride aktif bağlantıyla senkron çağrılır', async () => {
    const n = await TestBed.inject(FarmerSyncService).syncCustomer('c1', 'f1');
    expect(n).toBe(2);
    expect(repo.syncCustomerToFarmer).toHaveBeenCalledWith(link, 'Ağaoğlu Tarım');
  });

  it('müşteri kartında farmerId YOKSA da (gerçek davet akışı) bağlantı bulunup senkronlanır', async () => {
    const n = await TestBed.inject(FarmerSyncService).syncCustomer('c1', null);
    expect(repo.findLinkForCustomer).toHaveBeenCalledWith('t1', 'c1');
    expect(n).toBe(2);
  });

  it('bağlantı yoksa ya da koparılmışsa senkron yapılmaz', async () => {
    const svc = TestBed.inject(FarmerSyncService);
    repo.findLinkForCustomer.mockResolvedValueOnce(null);
    expect(await svc.syncCustomer('c1')).toBe(0);
    repo.findLinkForCustomer.mockResolvedValueOnce({ ...link, status: 'revoked' });
    expect(await svc.syncCustomer('c1')).toBe(0);
    expect(repo.syncCustomerToFarmer).not.toHaveBeenCalled();
  });

  it('aynı müşteri için eşzamanlı istekler birleştirilir (en fazla bir tekrar)', async () => {
    let release!: () => void;
    repo.syncCustomerToFarmer.mockImplementationOnce(() => new Promise(r => { release = () => r(1); }));
    const svc = TestBed.inject(FarmerSyncService);
    const a = svc.syncLink(link as never);
    const b = svc.syncLink(link as never);
    const c = svc.syncLink(link as never);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    release();
    expect(await a).toBe(3);
    expect(await b).toBe(3);
    expect(await c).toBe(3);
    expect(repo.syncCustomerToFarmer).toHaveBeenCalledTimes(2);
  });

  it('hata fırlatmaz (satış bozulmaz); çevrimdışıyken denemez', async () => {
    repo.syncCustomerToFarmer.mockRejectedValue(new Error('permission-denied'));
    const svc = TestBed.inject(FarmerSyncService);
    await expect(svc.syncCustomer('c1', 'f1')).resolves.toBe(0);
    online = false;
    repo.findLinkForCustomer.mockClear();
    await svc.syncCustomer('c1', 'f1');
    expect(repo.findLinkForCustomer).not.toHaveBeenCalled();
  });
});
