import { resolveSection, sectionsForRole } from './settings-sections';
import { tenantSetupFlags } from './setup-flags';

describe('settings sections', () => {
  it('kasiyer/personel yalnız kendi bölümlerini görür', () => {
    const keys = sectionsForRole('cashier').map(s => s.key);
    expect(keys).toEqual(['appearance', 'language', 'profile', 'security', 'about']);
    expect(sectionsForRole('staff').map(s => s.key)).toEqual(keys);
  });

  it('admin tüm bölümleri görür, ilki işletme', () => {
    const keys = sectionsForRole('admin').map(s => s.key);
    expect(keys[0]).toBe('business');
    expect(keys).toContain('backup');
    expect(keys).toContain('team');
  });

  it('yetkisiz / bilinmeyen anahtar ilk bölüme düşer', () => {
    expect(resolveSection('backup', 'cashier')).toBe('appearance');
    expect(resolveSection('xyz', 'admin')).toBe('business');
    expect(resolveSection('team', 'admin')).toBe('team');
    expect(resolveSection(null, 'staff', 'profile')).toBe('profile');
  });
});

describe('tenantSetupFlags', () => {
  it('boş işletme: hiçbiri tamam değil', () => {
    expect(tenantSetupFlags(null)).toEqual({ business: false, receipt: false, backup: false });
  });
  it('alanlar dolunca tamam', () => {
    expect(tenantSetupFlags({
      name: 'A', phone: '1', address: 'x', taxNo: '9', receiptFooter: '', lastBackupAt: {},
      settings: { receipt: { headerNote: 'Bayi' } },
    })).toEqual({ business: true, receipt: true, backup: true });
  });
  it('eksik vergi no → işletme eksik', () => {
    expect(tenantSetupFlags({ name: 'A', phone: '1', address: 'x', taxNo: ' ' }).business).toBe(false);
  });
});
