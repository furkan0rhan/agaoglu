import { describe, expect, it } from 'vitest';
import { permissionsFor } from './permissions';
import { parsePermissionOverrides } from '../../shared/models/user.model';

describe('permissionsFor (Y5)', () => {
  it('yönetici her şey; kasiyer varsayılan hiçbiri', () => {
    expect(permissionsFor('admin')).toEqual({ seeCosts: true, manageProducts: true, exportData: true, cancelAnySale: true });
    expect(permissionsFor('cashier')).toEqual({ seeCosts: false, manageProducts: false, exportData: false, cancelAnySale: false });
  });

  it('kullanıcı bazlı ek yetki: alış fiyatı (kasiyer / personel), her satışı iptal (yalnız kasiyer)', () => {
    expect(permissionsFor('cashier', { seeCosts: true, cancelAnySale: true })).toMatchObject({ seeCosts: true, cancelAnySale: true, manageProducts: false });
    expect(permissionsFor('staff', { seeCosts: true, cancelAnySale: true })).toMatchObject({ seeCosts: true, cancelAnySale: false });
  });

  it('ham değer: yalnız bilinen anahtarlar ve true', () => {
    expect(parsePermissionOverrides({ seeCosts: true, cancelAnySale: 'yes', manageProducts: true })).toEqual({ seeCosts: true });
    expect(parsePermissionOverrides({ seeCosts: false })).toBeUndefined();
    expect(parsePermissionOverrides(null)).toBeUndefined();
  });
});
