import { FARMER_EMAIL_DOMAIN, FarmerInvite, isFarmerEmail } from '../../../shared/models/farmer.model';
import {
  buildInviteUrl, farmerSyntheticEmail, formatTrPhone, generateInviteCode, inviteState, isInviteCodeFormat, isValidPin,
  normalizeTrPhone, parseInviteInput, phoneFromSyntheticEmail, phoneMatchesInvite, scanPhoneSlots, whatsappUrl,
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

describe('parseInviteInput', () => {
  it('tam linkten, yalnız koddan ve küçük harf / boşluklu yazımdan kodu çıkarır', () => {
    expect(parseInviteInput('https://demo.web.app/ciftci/davet/ABCDEFGHJK')).toBe('ABCDEFGHJK');
    expect(parseInviteInput('Merhaba, linkiniz: http://127.0.0.1:4443/ciftci/davet/ABCDEFGHJK?x=1 iyi günler')).toBe('ABCDEFGHJK');
    expect(parseInviteInput('  abcde fghjk ')).toBe('ABCDEFGHJK');
    expect(parseInviteInput('ABCDE-FGHJK')).toBe('ABCDEFGHJK');
  });
  it('geçersiz metin → null (0/O, 1/I içeren veya kısa kod)', () => {
    expect(parseInviteInput('')).toBeNull();
    expect(parseInviteInput('ABC')).toBeNull();
    expect(parseInviteInput('ABCDEFGH10')).toBeNull();
    expect(parseInviteInput('https://x/ciftci/giris')).toBeNull();
  });
});

describe('scanPhoneSlots (çiftçi girişi yuva taraması)', () => {
  const run = async (start: number | null, results: Record<number, string>) => {
    const tried: number[] = [];
    const slot = await scanPhoneSlots(start, async s => { tried.push(s); return (results[s] ?? 'missing') as never; });
    return { slot, tried };
  };

  it('tek yanlış PIN: 1 yanlış şifre + 1 "hesap yok" = 2 deneme (eskiden 5)', async () => {
    expect(await run(null, { 0: 'bad-password' })).toEqual({ slot: null, tried: [0, 1] });
  });
  it('PIN sıfırlanmış hesap: eski yuva yanlış şifre, yeni yuvada giriş', async () => {
    expect(await run(null, { 0: 'bad-password', 1: 'ok' })).toEqual({ slot: 1, tried: [0, 1] });
  });
  it('hatırlanan yuvadan başlar; alttaki eski hesapları denemez', async () => {
    expect(await run(2, { 0: 'bad-password', 1: 'not-owner', 2: 'ok' })).toEqual({ slot: 2, tried: [2] });
    expect(await run(2, { 2: 'bad-password' })).toEqual({ slot: null, tried: [2, 3] });
  });
  it('hatırlanan yuva yoksa baştan taranır', async () => {
    expect(await run(3, { 0: 'ok' })).toEqual({ slot: 0, tried: [3, 0] });
  });
  it('ayırt edilemeyen hata (e-posta koruması) üst yuvaya geçer', async () => {
    expect((await run(null, { 0: 'unknown', 1: 'unknown', 2: 'ok' })).slot).toBe(2);
  });
});
