import { describe, expect, it } from 'vitest';
import { businessDay, cancelDenial, isValidCancelReason } from './cancel-policy';

const admin = { id: 'A', role: 'admin' as const };
const cashier = { id: 'C', role: 'cashier' as const };
const staff = { id: 'S', role: 'staff' as const };
// 30.10.2026 14:00 Türkiye = 11:00 UTC
const NOW = new Date(Date.UTC(2026, 9, 30, 11, 0));

describe('cancel-policy (Y4)', () => {
  it('yönetici her tamamlanmış satışı iptal eder', () => {
    expect(cancelDenial({ status: 'completed', createdBy: 'C', createdAt: new Date(Date.UTC(2026, 9, 1)) }, admin, NOW)).toBeNull();
    expect(cancelDenial({ status: 'cancelled', createdBy: 'C', createdAt: NOW }, admin, NOW)).toBe('not-completed');
  });

  it('kasiyer: yalnız kendi ve bugünkü satış', () => {
    expect(cancelDenial({ status: 'completed', createdBy: 'C', createdAt: new Date(NOW.getTime() - 3600_000) }, cashier, NOW)).toBeNull();
    expect(cancelDenial({ status: 'completed', createdBy: 'X', createdAt: NOW }, cashier, NOW)).toBe('not-own');
    // dün 23:30 Türkiye = 20:30 UTC (29.10)
    expect(cancelDenial({ status: 'completed', createdBy: 'C', createdAt: new Date(Date.UTC(2026, 9, 29, 20, 30)) }, cashier, NOW)).toBe('not-today');
    // bugün 00:30 Türkiye = dün 21:30 UTC → aynı iş günü
    expect(cancelDenial({ status: 'completed', createdBy: 'C', createdAt: new Date(Date.UTC(2026, 9, 29, 21, 30)) }, cashier, NOW)).toBeNull();
    expect(cancelDenial({ status: 'completed', createdBy: 'C', createdAt: { toDate: () => NOW } }, cashier, NOW)).toBeNull();
    expect(cancelDenial({ status: 'completed', createdBy: 'C', createdAt: null }, cashier, NOW)).toBe('not-today');
  });

  it('personel ve oturumsuz kullanıcı iptal edemez', () => {
    expect(cancelDenial({ status: 'completed', createdBy: 'S', createdAt: NOW }, staff, NOW)).toBe('role');
    expect(cancelDenial({ status: 'completed', createdBy: 'S', createdAt: NOW }, null, NOW)).toBe('role');
  });

  it('neden zorunlu: 3-200 karakter', () => {
    expect(isValidCancelReason('')).toBe(false);
    expect(isValidCancelReason('  ab ')).toBe(false);
    expect(isValidCancelReason('Yanlış ürün')).toBe(true);
    expect(isValidCancelReason('x'.repeat(201))).toBe(false);
  });

  it('iş günü Türkiye saatine göre', () => {
    expect(businessDay(new Date(Date.UTC(2026, 9, 29, 21, 0)))).toBe(businessDay(new Date(Date.UTC(2026, 9, 30, 20, 59))));
  });
});
