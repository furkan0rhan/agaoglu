import { FARMER_EMAIL_DOMAIN, FarmerInvite, isFarmerEmail } from '../../../shared/models/farmer.model';
import {
  buildInviteUrl, farmerSyntheticEmail, formatTrPhone, generateInviteCode, inviteState, isInviteCodeFormat, isValidPin,
  normalizeTrPhone, phoneFromSyntheticEmail, phoneMatchesInvite, whatsappUrl,
} from './identity.util';

const invite = (over: Partial<FarmerInvite> = {}): FarmerInvite => ({
  code: 'ABCDEFGHJK', tenantId: 't', tenantName: 'Bayi', customerId: 'c', customerName: 'Ali', phoneLast4: '4567', farmerId: null,
  expiresAt: new Date(Date.now() + 86400000), used: false, usedBy: null, usedFarmerId: null, revoked: false, createdBy: 'u', createdAt: null,
  ...over,
});

describe('identity.util (telefon + PIN, davet)', () => {
  it('telefon normalizasyonu', () => {
    expect(normalizeTrPhone('0555 123 45 67')).toBe('905551234567');
    expect(normalizeTrPhone('+90 (555) 123-45-67')).toBe('905551234567');
    expect(normalizeTrPhone('5551234567')).toBe('905551234567');
    expect(normalizeTrPhone('00905551234567')).toBe('905551234567');
    expect(normalizeTrPhone('12345')).toBeNull();
    expect(normalizeTrPhone('')).toBeNull();
    expect(formatTrPhone('905551234567')).toBe('0555 123 45 67');
  });

  it('sentetik e-posta ve yuvalar (PIN sıfırlama)', () => {
    expect(farmerSyntheticEmail('905551234567')).toBe(`905551234567@${FARMER_EMAIL_DOMAIN}`);
    expect(farmerSyntheticEmail('905551234567', 2)).toBe(`905551234567.2@${FARMER_EMAIL_DOMAIN}`);
    expect(() => farmerSyntheticEmail('0555', 0)).toThrow();
    expect(() => farmerSyntheticEmail('905551234567', 9)).toThrow();
    expect(phoneFromSyntheticEmail(`905551234567.1@${FARMER_EMAIL_DOMAIN}`)).toBe('905551234567');
    expect(phoneFromSyntheticEmail('905551234567@gmail.com')).toBeNull();
    expect(isFarmerEmail(`905551234567@${FARMER_EMAIL_DOMAIN}`)).toBe(true);
    expect(isFarmerEmail('admin@test.local')).toBe(false);
  });

  it('PIN: 6 rakam, kolay PIN yok', () => {
    expect(isValidPin('482915')).toBe(true);
    expect(isValidPin('111111')).toBe(false);
    expect(isValidPin('123456')).toBe(false);
    expect(isValidPin('987654')).toBe(false);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('12a456')).toBe(false);
  });

  it('davet kodu: 10 karakter, karışmayan alfabe, kriptografik kaynaktan', () => {
    const code = generateInviteCode();
    expect(isInviteCodeFormat(code)).toBe(true);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    expect(new Set(Array.from({ length: 50 }, () => generateInviteCode())).size).toBe(50);
    expect(generateInviteCode(b => b.fill(0))).toBe('AAAAAAAAAA');
    expect(generateInviteCode(b => b.fill(255))).toBe('9999999999');
    expect(isInviteCodeFormat('ABCDEFGHI0')).toBe(false);
  });

  it('davet durumu: geçerli / kullanılmış / süresi dolmuş / iptal / yok', () => {
    expect(inviteState(invite())).toBe('valid');
    expect(inviteState(invite({ used: true }))).toBe('used');
    expect(inviteState(invite({ revoked: true, used: true }))).toBe('revoked');
    expect(inviteState(invite({ expiresAt: new Date(Date.now() - 1000) }))).toBe('expired');
    expect(inviteState(null)).toBe('missing');
  });

  it('telefon son 4 hane eşleşmesi', () => {
    expect(phoneMatchesInvite('905551234567', invite())).toBe(true);
    expect(phoneMatchesInvite('905551230000', invite())).toBe(false);
    expect(phoneMatchesInvite(null, invite())).toBe(false);
    expect(phoneMatchesInvite('905551234567', invite({ phoneLast4: '' }))).toBe(false);
  });

  it('davet ve WhatsApp linkleri', () => {
    expect(buildInviteUrl('https://x.web.app/', 'ABCDEFGHJK')).toBe('https://x.web.app/ciftci/davet/ABCDEFGHJK');
    const wa = whatsappUrl('0555 123 45 67', 'Merhaba https://x/y');
    expect(wa.startsWith('https://wa.me/905551234567?text=')).toBe(true);
    expect(decodeURIComponent(wa.split('text=')[1])).toBe('Merhaba https://x/y');
  });
});
