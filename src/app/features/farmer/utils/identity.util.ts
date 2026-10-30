import { FARMER_EMAIL_DOMAIN, FarmerInvite } from '../../../shared/models/farmer.model';

/**
 * Çiftçi kimliği: telefon + 6 haneli PIN, Firebase e-posta/şifre üzerinde sentetik e-posta ile
 * (Spark planda SMS OTP yok — docs/CIFTCI-MODULU.md §2.2).
 *
 * E-posta: 90XXXXXXXXXX@ciftci.tarimmarket.app. PIN sıfırlama (bayinin yeni daveti) sentetik e-posta
 * yeniden kullanılamadığı için yeni bir "yuva" açar: 90XXXXXXXXXX.1@…, .2@… (en fazla MAX_SLOTS).
 * Girişte yuvalar sırayla denenir.
 */

export const MAX_PHONE_SLOTS = 5;

/** Türkiye numarasını 90XXXXXXXXXX biçimine getirir. Geçersizse null. */
export function normalizeTrPhone(input: string | null | undefined): string | null {
  let d = (input ?? '').replace(/\D/g, '');
  if (d.startsWith('0090')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = '90' + d.slice(1);
  else if (d.length === 10) d = '90' + d;
  if (!/^90[2-5]\d{9}$/.test(d)) return null;
  return d;
}

/** Görüntü: 0555 123 45 67 */
export function formatTrPhone(phone90: string | null | undefined): string {
  const p = normalizeTrPhone(phone90);
  if (!p) return phone90 ?? '';
  const n = '0' + p.slice(2);
  return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7, 9)} ${n.slice(9)}`;
}

export function phoneLast4(input: string | null | undefined): string {
  return (input ?? '').replace(/\D/g, '').slice(-4);
}

/** Sentetik e-posta. slot 0 = ilk hesap, 1.. = PIN sıfırlama sonrası hesaplar. */
export function farmerSyntheticEmail(phone90: string, slot = 0): string {
  if (!/^90\d{10}$/.test(phone90)) throw new Error('invalid-phone');
  if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_PHONE_SLOTS) throw new Error('invalid-slot');
  return slot === 0 ? `${phone90}@${FARMER_EMAIL_DOMAIN}` : `${phone90}.${slot}@${FARMER_EMAIL_DOMAIN}`;
}

/** Sentetik e-postadan telefonu çıkarır (kuraldaki eşleştirmenin istemci karşılığı). */
export function phoneFromSyntheticEmail(email: string | null | undefined): string | null {
  const m = /^(90\d{10})(?:\.\d)?@/.exec((email ?? '').toLowerCase());
  return m && (email ?? '').toLowerCase().endsWith('@' + FARMER_EMAIL_DOMAIN) ? m[1] : null;
}

/** 6 haneli PIN; tümü aynı rakam (111111) veya ardışık (123456, 654321) kabul edilmez. */
export function isValidPin(pin: string | null | undefined): boolean {
  if (!/^\d{6}$/.test(pin ?? '')) return false;
  const p = pin as string;
  if (/^(\d)\1{5}$/.test(p)) return false;
  const asc = '0123456789012345';
  const desc = '9876543210987654';
  return !asc.includes(p) && !desc.includes(p);
}

/** Karışmayan harf/rakamlar (0/O, 1/I yok). 32 karakter → bayt & 31 ile sapmasız seçim. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 10;

/** 10 karakterlik kriptografik rastgele davet kodu (~50 bit). */
export function generateInviteCode(rng: (bytes: Uint8Array) => Uint8Array = b => crypto.getRandomValues(b)): string {
  const bytes = rng(new Uint8Array(INVITE_CODE_LENGTH));
  let out = '';
  for (const b of bytes) out += CODE_ALPHABET[b & 31];
  return out;
}

export function isInviteCodeFormat(code: string | null | undefined): boolean {
  return new RegExp(`^[${CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`).test(code ?? '');
}

export type InviteState = 'valid' | 'used' | 'expired' | 'revoked' | 'missing';

export function inviteState(invite: Pick<FarmerInvite, 'used' | 'revoked' | 'expiresAt'> | null | undefined, now: Date = new Date()): InviteState {
  if (!invite) return 'missing';
  if (invite.revoked) return 'revoked';
  if (invite.used) return 'used';
  if (invite.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'valid';
}

/** Girilen telefon, davetteki (bayinin kayıtlı numarası) son 4 haneyle eşleşiyor mu? */
export function phoneMatchesInvite(phone90: string | null, invite: Pick<FarmerInvite, 'phoneLast4'>): boolean {
  return !!phone90 && invite.phoneLast4.length === 4 && phone90.endsWith(invite.phoneLast4);
}

/** Davet linki. Tauri/yerel kökenlerde barındırma adresi kullanılır (WhatsApp'tan açılabilsin). */
export function buildInviteUrl(publicBaseUrl: string, code: string): string {
  return `${publicBaseUrl.replace(/\/+$/, '')}/ciftci/davet/${encodeURIComponent(code)}`;
}

/** wa.me linki (API değil; mesajı bayi kendisi gönderir). */
export function whatsappUrl(phone: string | null | undefined, text: string): string {
  const p = normalizeTrPhone(phone);
  return `https://wa.me/${p ?? ''}?text=${encodeURIComponent(text)}`;
}

/**
 * Çiftçinin yapıştırdığı / QR'dan okunan metinden davet kodunu çıkarır: tam link (`…/ciftci/davet/KOD`),
 * yalnız kod (küçük harf, boşluk/tire olabilir). Tanınmazsa null.
 */
export function parseInviteInput(text: string | null | undefined): string | null {
  const raw = (text ?? '').trim();
  if (!raw) return null;
  const m = /\/ciftci\/davet\/([^/?#\s]+)/i.exec(raw);
  let candidate = m ? decodeURIComponent(m[1]) : raw;
  candidate = candidate.replace(/[\s-]/g, '').toUpperCase();
  return isInviteCodeFormat(candidate) ? candidate : null;
}

/** Tek bir yuva (slot) giriş denemesinin sonucu. */
export type SlotAttempt = 'ok' | 'not-owner' | 'bad-password' | 'missing' | 'unknown';

/**
 * Telefonun giriş yuvalarını tarar. Yuvalar sırayla açılır (PIN sıfırlama bir sonraki boş yuvaya yeni hesap açar),
 * dolayısıyla güncel hesap en yüksek dolu yuvadır:
 *  - `start` (bu cihazda son başarılı yuva) ile başlanır; yoksa 0.
 *  - 'missing' (hesap yok) kesin sondur: üstteki yuvalar da boştur → durulur. Yalnız `start` > 0 iken ilk deneme
 *    'missing' ise (hatırlanan yuva yanlış) 0'dan baştan taranır.
 *  - 'bad-password' / 'not-owner' / 'unknown' (e-posta koruması açıkken ayırt edilemez) → bir üst yuvaya geçilir.
 * Döner: giriş yapılan yuva veya null. Tek yanlış PIN'de tipik deneme sayısı 2'dir (eskiden 5).
 */
export async function scanPhoneSlots(start: number | null, attempt: (slot: number) => Promise<SlotAttempt>): Promise<number | null> {
  const first = start != null && Number.isInteger(start) && start > 0 && start < MAX_PHONE_SLOTS ? start : 0;
  for (let slot = first; slot < MAX_PHONE_SLOTS; slot++) {
    const r = await attempt(slot);
    if (r === 'ok') return slot;
    if (r === 'missing') {
      if (slot === first && first > 0) return scanPhoneSlots(0, s => (s < first ? attempt(s) : Promise.resolve('missing')));
      return null;
    }
  }
  return null;
}
