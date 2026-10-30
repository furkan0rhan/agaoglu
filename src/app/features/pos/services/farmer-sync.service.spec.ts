import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { AuthService } from '../../../core/auth/services/auth.service';
import { NetworkService } from '../../../core/offline/network.service';
import { DEALER_FARMER_REPOSITORY } from '../../farmer/data/repositories';
import { FarmerSyncService } from './farmer-sync.service';

describe('FarmerSyncService (satış sonrası çiftçi ambarı)', () => {
  const link = { id: 't1_f1', tenantId: 't1', farmerId: 'f1', customerId: 'c1', status: 'active' };
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
        { provide: Firestore, useValue: {} },
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

  it('çiftçiye bağlı olmayan müşteride hiçbir şey yapılmaz', async () => {
    expect(await TestBed.inject(FarmerSyncService).syncCustomer('c1', null)).toBe(0);
    expect(repo.findLinkForCustomer).not.toHaveBeenCalled();
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
