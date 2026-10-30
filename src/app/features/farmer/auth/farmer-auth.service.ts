import { inject, Injectable } from '@angular/core';
import {
  Auth, browserLocalPersistence, createUserWithEmailAndPassword, setPersistence, signInWithEmailAndPassword, signOut,
  updateProfile,
} from '@angular/fire/auth';
import { FarmerConsent, FarmerInvite } from '../../../shared/models/farmer.model';
import { FARMER_ACCOUNT_REPOSITORY, FARMER_LINK_REPOSITORY } from '../data/repositories';
import { computeShareTargets } from '../utils/consent.util';
import {
  farmerSyntheticEmail, inviteState, isValidPin, MAX_PHONE_SLOTS, normalizeTrPhone, phoneMatchesInvite, scanPhoneSlots, SlotAttempt,
} from '../utils/identity.util';
import { FarmerSession } from './farmer-session.service';

/** Çiftçi girişinin uygulamaya özgü hata kodları (i18n: farmer.errors). */
export type FarmerAuthErrorCode =
  | 'invalid-phone' | 'invalid-pin' | 'phone-mismatch' | 'invite-invalid' | 'phone-exists' | 'invalid-login'
  | 'too-many-requests' | 'network' | 'slots-full' | 'not-farmer' | 'unknown';

export class FarmerAuthError extends Error {
  constructor(readonly code: FarmerAuthErrorCode) { super(code); }
}

function firebaseCode(err: unknown): string {
  return typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
}

function mapError(err: unknown): FarmerAuthError {
  if (err instanceof FarmerAuthError) return err;
  const c = firebaseCode(err);
  if (c === 'auth/too-many-requests') return new FarmerAuthError('too-many-requests');
  if (c === 'auth/network-request-failed' || c === 'unavailable') return new FarmerAuthError('network');
  if (c === 'permission-denied') return new FarmerAuthError('invite-invalid');
  return new FarmerAuthError('unknown');
}

/** Bu cihazda telefonun son başarılı giriş yuvası (deneme sayısını azaltır; gizli bilgi değildir). */
const SLOT_KEY = 'tm.farmer.slot.';

function rememberedSlot(phone: string): number | null {
  try {
    const v = Number(localStorage.getItem(SLOT_KEY + phone));
    return Number.isInteger(v) && v >= 0 && v < MAX_PHONE_SLOTS ? v : null;
  } catch {
    return null;
  }
}

function rememberSlot(phone: string, slot: number): void {
  try { localStorage.setItem(SLOT_KEY + phone, String(slot)); } catch { /* yok say */ }
}

/** Firebase giriş hatası → yuva taraması kararı. null: tarama durur, hata kullanıcıya gösterilir (ağ, hız sınırı …). */
export function classifySignInError(code: string): SlotAttempt | null {
  if (code === 'auth/user-not-found') return 'missing';
  if (code === 'auth/wrong-password') return 'bad-password';
  // E-posta numaralandırma koruması açıkken "hesap yok" ile "yanlış şifre" ayırt edilemez
  if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') return 'unknown';
  return null;
}

/**
 * Telefon + 6 haneli PIN girişi. Firebase e-posta/şifre üzerinde sentetik e-posta (90XXXXXXXXXX@ciftci…).
 * Spark planda SMS OTP ve Cloud Functions olmadığı için hesap yalnızca BAYİ DAVETİYLE açılır (§2.2).
 */
@Injectable({ providedIn: 'root' })
export class FarmerAuthService {
  private readonly auth = inject(Auth);
  private readonly accounts = inject(FARMER_ACCOUNT_REPOSITORY);
  private readonly linkRepo = inject(FARMER_LINK_REPOSITORY);
  private readonly session = inject(FarmerSession);

  getInvite(code: string): Promise<FarmerInvite | null> {
    return this.accounts.getInvite(code);
  }

  /**
   * Telefon + PIN ile giriş. PIN sıfırlama yuvaları `scanPhoneSlots` kuralıyla denenir (hatırlanan yuvadan başlar,
   * "hesap yok" görünce durur); profilin sahibi olan hesap seçilir. Hız sınırı / ağ hatasında tarama hemen kesilir
   * (rapor #13: tek yanlış PIN eskiden 5 Auth isteği yapıyordu).
   */
  async signIn(phoneInput: string, pin: string): Promise<void> {
    const phone = normalizeTrPhone(phoneInput);
    if (!phone) throw new FarmerAuthError('invalid-phone');
    if (!/^\d{6}$/.test(pin)) throw new FarmerAuthError('invalid-pin');
    await setPersistence(this.auth, browserLocalPersistence);
    const slot = await scanPhoneSlots(rememberedSlot(phone), async s => {
      try {
        await signInWithEmailAndPassword(this.auth, farmerSyntheticEmail(phone, s), pin);
      } catch (err) {
        const r = classifySignInError(firebaseCode(err));
        if (r) return r;
        throw mapError(err);
      }
      const state = await this.session.ensureLoaded(true);
      if (state === 'ready') return 'ok';
      await signOut(this.auth).catch(() => undefined);
      this.session.clear();
      if (state === 'dealer') throw new FarmerAuthError('not-farmer');
      if (state === 'error') throw new FarmerAuthError('network');
      return 'not-owner';
    });
    if (slot === null) throw new FarmerAuthError('invalid-login');
    rememberSlot(phone, slot);
  }

  /**
   * Davetle yeni hesap: Auth hesabı + tek atomik yazım (farmers, users, farmerLinks, davet kullanıldı).
   * Yazım reddedilirse yarım hesap bırakılmaz (Auth hesabı silinir).
   */
  async registerWithInvite(invite: FarmerInvite, phoneInput: string, pin: string, displayName: string, consent: FarmerConsent): Promise<void> {
    const phone = normalizeTrPhone(phoneInput);
    if (!phone) throw new FarmerAuthError('invalid-phone');
    if (!isValidPin(pin)) throw new FarmerAuthError('invalid-pin');
    if (inviteState(invite) !== 'valid') throw new FarmerAuthError('invite-invalid');
    if (!phoneMatchesInvite(phone, invite)) throw new FarmerAuthError('phone-mismatch');
    await setPersistence(this.auth, browserLocalPersistence);

    let created: Awaited<ReturnType<typeof createUserWithEmailAndPassword>> | null = null;
    let email = '';
    for (let slot = 0; slot < MAX_PHONE_SLOTS && !created; slot++) {
      email = farmerSyntheticEmail(phone, slot);
      try {
        created = await createUserWithEmailAndPassword(this.auth, email, pin);
      } catch (err) {
        if (firebaseCode(err) !== 'auth/email-already-in-use') throw mapError(err);
        // Yeni çiftçi daveti ama numara zaten kayıtlı → PIN ile giriş yapıp daveti kabul etmeli
        if (!invite.farmerId) throw new FarmerAuthError('phone-exists');
      }
    }
    if (!created) throw new FarmerAuthError('slots-full');
    const createdSlot = Number(/\.(\d)@/.exec(email)?.[1] ?? 0);

    const name = displayName.trim() || invite.customerName;
    try {
      await updateProfile(created.user, { displayName: name }).catch(() => undefined);
      await this.accounts.acceptInvite({
        uid: created.user.uid, email, invite, existingFarmerId: null, hasUserDoc: false, displayName: name, phone, consent,
      });
    } catch (err) {
      try { await created.user.delete(); } catch { await signOut(this.auth).catch(() => undefined); }
      this.session.clear();
      throw mapError(err);
    }
    rememberSlot(phone, createdSlot);
    await this.afterLink();
  }

  /** Oturumu açık çiftçi yeni bir bayinin davetini kabul eder (ikinci bayi). */
  async acceptWithCurrentAccount(invite: FarmerInvite, consent: FarmerConsent): Promise<void> {
    if (inviteState(invite) !== 'valid') throw new FarmerAuthError('invite-invalid');
    const state = await this.session.ensureLoaded(true);
    const user = this.auth.currentUser;
    const farmer = this.session.farmer();
    if (state !== 'ready' || !user || !farmer) throw new FarmerAuthError('not-farmer');
    if (!phoneMatchesInvite(farmer.phone, invite)) throw new FarmerAuthError('phone-mismatch');
    if (invite.farmerId && invite.farmerId !== farmer.id) throw new FarmerAuthError('invite-invalid');
    try {
      await this.accounts.acceptInvite({
        uid: user.uid, email: user.email ?? '', invite, existingFarmerId: farmer.id, hasUserDoc: true,
        displayName: farmer.displayName, phone: farmer.phone, consent,
      });
    } catch (err) {
      throw mapError(err);
    }
    await this.afterLink();
  }

  /** Bağlantı sonrası: oturumu yenile, izinlere göre mevcut kayıtların paylaşımını güncelle. */
  private async afterLink(): Promise<void> {
    const state = await this.session.ensureLoaded(true);
    const fid = this.session.farmerId();
    if (state === 'ready' && fid) {
      await this.linkRepo.applySharing(fid, computeShareTargets(this.session.links())).catch(() => undefined);
    }
  }

  /** Bu tarayıcıda açık oturumun e-postası (davet sayfası: bayi oturumunu sessizce değiştirmemek için, rapor Y17). */
  currentEmail(): string | null {
    return this.auth.currentUser?.email ?? null;
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
    this.session.clear();
  }
}
