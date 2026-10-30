import { computed, inject, Injectable, signal } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
  EmailAuthProvider,
  User as FirebaseUser,
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  getDoc,
  getDocFromCache,
  getDocFromServer,
  setDoc,
  updateDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { LoggerService } from '../../logging/logger.service';
import { AppUser, DEFAULT_MAX_USERS, Invite, isUserRole, TRIAL_DAYS, UserRole } from '../../../shared/models/user.model';
import { AuditLogService } from './audit-log.service';
import { isFarmerEmail } from '../../../shared/models/farmer.model';
import { environment } from '../../../../environments/environment';
import { fetchProfileWithRetry, isPermissionDenied, ProfileFetchOptions } from './profile-loader';

/**
 * E-posta doğrulaması zorunlu mu? `environment.requireEmailVerification` (varsayılan true).
 * false: doğrulanmamış (eski) hesaplar doğrulama ekranına takılmadan girer. Davetle katılım yine doğrulama ister.
 */
export function emailVerificationRequired(): boolean {
  const env = environment as { requireEmailVerification?: boolean };
  return env.requireEmailVerification !== false;
}

/** Uygulamaya özgü auth hata kodları (Firebase kodlarıyla aynı biçimde). */
export const APP_AUTH_ERRORS = {
  inactive: 'app/user-inactive',
  profileUnavailable: 'app/profile-unavailable',
  profileRetry: 'app/profile-retry',
  supportDisabled: 'app/support-disabled',
} as const;

/**
 * inactive: hesap pasif (oturum kapatıldı) · profile-unavailable: profil okunamadı/oluşturulamadı (oturum kapatıldı)
 * · profile-retry: sunucuya geçici olarak ulaşılamadı; Firebase oturumu AÇIK kalır, "Tekrar dene" ile yeniden yüklenir.
 */
export type AuthNotice = 'inactive' | 'profile-unavailable' | 'profile-retry' | null;

class AppAuthError extends Error {
  constructor(readonly code: string) { super(code); }
}

const PROFILE_CACHE_KEY = 'tm.profile.';
/** Destek modu oturumu: sekmeye özgü (sessionStorage), sekme kapanınca biter. */
const SUPPORT_SESSION_KEY = 'tm.support';

/** Superadmin'in destek amacıyla açtığı işletme. */
export interface SupportSession {
  tenantId: string;
  tenantName: string;
  startedAt: number;
}

/** Yeni işletme için deneme lisansı alanları (kurallar: plan 'trial', en fazla 31 gün). */
export function newTrialLicenseFields(now = Date.now()): Record<string, unknown> {
  return {
    plan: 'trial',
    status: 'active',
    trialEndsAt: Timestamp.fromMillis(now + TRIAL_DAYS * 86_400_000),
    maxUsers: DEFAULT_MAX_USERS.trial,
    supportAccess: true,
  };
}

function readSupportSession(): SupportSession | null {
  try {
    const raw = sessionStorage.getItem(SUPPORT_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SupportSession;
    return typeof s?.tenantId === 'string' && s.tenantId ? s : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly router = inject(Router);
  private readonly logger = inject(LoggerService);
  private readonly audit = inject(AuditLogService);

  /** users/{uid}'den okunan gerçek profil. */
  private readonly profile = signal<AppUser | null>(null);
  /** platformAdmins/{uid} var mı (yalnız Firebase Console'dan eklenir). */
  readonly isSuperAdmin = signal(false);
  /** Superadmin destek modundaysa açılan işletme. */
  readonly supportSession = signal<SupportSession | null>(readSupportSession());
  readonly inSupportMode = computed(() => this.isSuperAdmin() && this.supportSession() !== null);

  /**
   * Uygulamanın gördüğü kullanıcı. Destek modunda: seçilen işletme + admin yetkisi
   * (yazmalarda createdBy yine superadmin'in kendi uid'si olur: currentUserId()).
   */
  readonly currentUser = computed<AppUser | null>(() => {
    const u = this.profile();
    const sup = this.supportSession();
    if (u && sup && this.isSuperAdmin()) return { ...u, tenantId: sup.tenantId, role: 'admin', isActive: true };
    return u;
  });
  readonly isLoading = signal(true);
  /** Davetli kullanıcı, e-postasını doğrulayınca işletmeye katılacak. */
  readonly pendingInvite = signal(false);
  /** Oturum zorla kapatıldığında giriş sayfasında gösterilecek uyarı. */
  readonly authNotice = signal<AuthNotice>(null);

  /** Aynı uid için profil yüklemesini tekilleştirir (login + onAuthStateChanged çift getDoc yapmasın). */
  private profileLoad: { uid: string; promise: Promise<AppUser | null> } | null = null;
  /** Kayıt sürerken onAuthStateChanged profil oluşturmasın diye. */
  private registering: Promise<AppUser | null> | null = null;
  private unsubProfile: (() => void) | null = null;
  /** Testlerde beklemeleri kısaltmak için. */
  protected profileFetchOptions: ProfileFetchOptions = {};

  constructor() {
    // Bağlantı geri gelince geçici hatayla yüklenemeyen profili kendiliğinden yeniden dene
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (this.authNotice() === 'profile-retry') void this.retryProfileLoad().catch(() => undefined);
      });
    }
    onAuthStateChanged(this.auth, async (firebaseUser) => {
      if (firebaseUser) {
        const appUser = this.registering
          ? await this.registering.catch(() => null)
          : await this.ensureProfile(firebaseUser);
        // Bu arada başka kullanıcıya geçildiyse yok say
        if (this.auth.currentUser?.uid === firebaseUser.uid) this.profile.set(appUser);
      } else {
        this.stopProfileWatch();
        this.profileLoad = null;
        this.pendingInvite.set(false);
        this.isSuperAdmin.set(false);
        this.profile.set(null);
      }
      this.isLoading.set(false);
    });
  }

  currentUserId(): string {
    return this.auth.currentUser?.uid ?? '';
  }

  /** Verinin ait olduğu işletme. Personel için işletme sahibinin uid'si. */
  currentTenantId(): string {
    return this.currentUser()?.tenantId ?? '';
  }

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  hasRole(...roles: UserRole[]): boolean {
    const role = this.currentUser()?.role;
    return role ? roles.includes(role) : false;
  }

  async login(email: string, password: string, rememberMe = false): Promise<void> {
    this.authNotice.set(null);
    await setPersistence(this.auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    const cred = await signInWithEmailAndPassword(this.auth, email.trim(), password);
    const user = await this.ensureProfile(cred.user);
    if (!user) {
      const notice = this.authNotice();
      const code = notice === 'inactive' ? APP_AUTH_ERRORS.inactive
        : notice === 'profile-retry' ? APP_AUTH_ERRORS.profileRetry : APP_AUTH_ERRORS.profileUnavailable;
      throw new AppAuthError(code);
    }
    await this.afterSignIn(user, cred.user);
  }

  /**
   * Giriş sayfasındaki "Tekrar dene": Firebase oturumu açık ama profil geçici hatayla yüklenemediyse
   * profili yeniden yükler ve uygulamaya geçer. Oturum yoksa false döner (kullanıcı yeniden giriş yapmalı).
   */
  async retryProfileLoad(): Promise<boolean> {
    const fbUser = this.auth.currentUser;
    if (!fbUser) { this.authNotice.set(null); return false; }
    this.authNotice.set(null);
    this.profileLoad = null;
    const user = await this.ensureProfile(fbUser);
    if (!user) return false;
    if (this.auth.currentUser?.uid !== fbUser.uid) return false;
    await this.afterSignIn(user, fbUser);
    return true;
  }

  /** Oturum açık mı (profil yüklenemese bile)? Giriş sayfası "Tekrar dene" için. */
  hasFirebaseSession(): boolean {
    return !!this.auth.currentUser;
  }

  /** Profil yüklendikten sonra: son giriş/aktivite (best-effort) ve yönlendirme. */
  private async afterSignIn(user: AppUser, fbUser: FirebaseUser): Promise<void> {
    this.profile.set(user);
    if (user.tenantId) {
      updateDoc(doc(this.firestore, 'users', fbUser.uid), { lastLogin: serverTimestamp() })
        .catch(err => this.logger.warn('lastLogin yazılamadı', err));
      // Yönetim paneli "son aktivite" için (kurallar: üye yalnız bu alanı yazabilir)
      updateDoc(doc(this.firestore, 'tenants', user.tenantId), { lastActiveAt: serverTimestamp() })
        .catch(err => this.logger.warn('lastActiveAt yazılamadı', err));
    }
    if (user.accountType === 'farmer') { await this.router.navigate(['/ciftci']); return; }
    if (this.isSuperAdmin()) {
      await this.router.navigate([this.inSupportMode() ? '/dashboard' : '/admin']);
      return;
    }
    const needsVerify = emailVerificationRequired() && !fbUser.emailVerified;
    await this.router.navigate([needsVerify || this.pendingInvite() ? '/verify-email' : '/dashboard']);
  }

  formatDisplayName(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w.charAt(0).toLocaleUpperCase('tr') + w.slice(1).toLocaleLowerCase('tr'))
      .join(' ');
  }

  async register(email: string, password: string, displayName: string): Promise<void> {
    this.authNotice.set(null);
    const formattedName = this.formatDisplayName(displayName);
    let resolveReg!: (u: AppUser | null) => void;
    let rejectReg!: (e: unknown) => void;
    this.registering = new Promise<AppUser | null>((res, rej) => { resolveReg = res; rejectReg = rej; });
    this.registering.catch(() => undefined);

    try {
      await setPersistence(this.auth, browserLocalPersistence);
      const cred = await createUserWithEmailAndPassword(this.auth, email.trim(), password);
      let appUser: AppUser;
      try {
        await updateProfile(cred.user, { displayName: formattedName });
        appUser = await this.createProfile(cred.user, formattedName);
      } catch (err) {
        // 2.39: Firestore yazılamadıysa yarım hesap bırakma
        this.logger.error('Kayıt profili oluşturulamadı, Auth hesabı geri alınıyor', err);
        try { await cred.user.delete(); } catch { await signOut(this.auth).catch(() => undefined); }
        throw err;
      }
      this.profile.set(appUser);
      resolveReg(appUser);
      if (appUser.tenantId) this.startProfileWatch(cred.user.uid);
      try { await sendEmailVerification(cred.user); } catch { /* verify-email sayfasından tekrar gönderilebilir */ }
      await this.router.navigate(['/verify-email']);
    } catch (err) {
      rejectReg(err);
      throw err;
    } finally {
      this.registering = null;
    }
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email.trim());
  }

  async updateDisplayName(displayName: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Kullanıcı bulunamadı');
    const formatted = this.formatDisplayName(displayName);
    await updateProfile(user, { displayName: formatted });
    await updateDoc(doc(this.firestore, 'users', user.uid), { displayName: formatted });
    this.profile.update(u => u ? { ...u, displayName: formatted } : null);
  }

  async reloadUser(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Kullanıcı bulunamadı');
    await user.reload();
  }

  isEmailVerified(): boolean {
    return this.auth.currentUser?.emailVerified ?? false;
  }

  /**
   * E-posta doğrulandıktan sonra çağrılır: token'ı yeniler (email_verified claim'i için)
   * ve bekleyen davet varsa işletmeye katılır.
   */
  async completeEmailVerification(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || !user.emailVerified) return;
    await user.getIdToken(true);
    if (this.pendingInvite()) {
      this.profileLoad = null;
      const appUser = await this.ensureProfile(user);
      this.profile.set(appUser);
      if (!appUser || !appUser.tenantId) throw new AppAuthError(APP_AUTH_ERRORS.profileUnavailable);
    }
  }

  async resendVerificationEmail(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Kullanıcı bulunamadı');
    await sendEmailVerification(user);
  }

  async updateEmail(currentPassword: string, newEmail: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || !user.email) throw new Error('Kullanıcı bulunamadı');
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await verifyBeforeUpdateEmail(user, newEmail.trim());
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || !user.email) throw new Error('Kullanıcı bulunamadı');
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPassword);
  }

  async logout(): Promise<void> {
    if (this.inSupportMode()) await this.exitSupportMode(false).catch(() => undefined);
    this.stopProfileWatch();
    const uid = this.auth.currentUser?.uid;
    if (uid) this.clearCachedProfile(uid);
    await signOut(this.auth);
    this.profile.set(null);
    await this.router.navigate(['/auth/login']);
  }

  // ---------------------------------------------------------------------------
  // Superadmin / destek modu
  // ---------------------------------------------------------------------------

  /**
   * Superadmin bir işletmeyi destek modunda açar. İşletme supportAccess'i kapattıysa reddedilir
   * (kurallar da veri erişimini reddeder). Oturum auditLogs'a yazılır; uygulama tam yeniden yüklenir
   * ki bellekteki önceki işletme verisi (store'lar) temizlensin.
   */
  async enterSupportMode(tenantId: string, tenantName: string): Promise<void> {
    if (!this.isSuperAdmin()) throw new AppAuthError('app/not-super-admin');
    const snap = await getDoc(doc(this.firestore, 'tenants', tenantId));
    if (!snap.exists()) throw new AppAuthError('app/tenant-not-found');
    if (snap.data()['supportAccess'] === false) throw new AppAuthError(APP_AUTH_ERRORS.supportDisabled);
    if (this.supportSession()) await this.exitSupportMode(false);
    await this.audit.log(tenantId, 'support_start', `Destek modu açıldı: ${tenantName}`);
    const session: SupportSession = { tenantId, tenantName, startedAt: Date.now() };
    try { sessionStorage.setItem(SUPPORT_SESSION_KEY, JSON.stringify(session)); } catch { /* yok say */ }
    this.supportSession.set(session);
    this.hardNavigate('/dashboard');
  }

  /** Destek modundan çıkar (auditLogs: support_end) ve yönetim paneline döner. */
  async exitSupportMode(navigate = true): Promise<void> {
    const sup = this.supportSession();
    if (sup && this.isSuperAdmin()) {
      const mins = Math.max(1, Math.round((Date.now() - sup.startedAt) / 60_000));
      await this.audit.log(sup.tenantId, 'support_end', `Destek modu kapatıldı: ${sup.tenantName} (~${mins} dk)`)
        .catch(err => this.logger.warn('support_end kaydı yazılamadı', err));
    }
    this.clearSupportSession();
    if (navigate) this.hardNavigate('/admin');
  }

  private clearSupportSession(): void {
    try { sessionStorage.removeItem(SUPPORT_SESSION_KEY); } catch { /* yok say */ }
    this.supportSession.set(null);
  }

  /** Tam sayfa geçişi: işletme değişince bellekteki tüm store'lar sıfırlansın. */
  private hardNavigate(path: string): void {
    window.location.assign(new URL(path.replace(/^\//, ''), document.baseURI).href);
  }

  private async checkPlatformAdmin(uid: string): Promise<boolean> {
    try {
      return (await getDoc(doc(this.firestore, 'platformAdmins', uid))).exists();
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Profil yükleme
  // ---------------------------------------------------------------------------

  private ensureProfile(firebaseUser: FirebaseUser): Promise<AppUser | null> {
    if (this.profileLoad?.uid === firebaseUser.uid) return this.profileLoad.promise;
    const promise = this.loadProfile(firebaseUser);
    this.profileLoad = { uid: firebaseUser.uid, promise };
    // Hata/çıkış durumunda bir sonraki denemede yeniden yüklensin
    promise.then(u => { if (!u && this.profileLoad?.promise === promise) this.profileLoad = null; });
    return promise;
  }

  private async loadProfile(firebaseUser: FirebaseUser): Promise<AppUser | null> {
    const uid = firebaseUser.uid;
    let appUser: AppUser;
    // Best-effort: eski kurallarda platformAdmins yok → permission-denied → false (girişi engellemez)
    const superAdmin = await this.checkPlatformAdmin(uid);
    this.isSuperAdmin.set(superAdmin);
    if (!superAdmin) this.clearSupportSession();

    const res = await fetchProfileWithRetry(
      () => this.readUserDocFromServer(uid),
      () => this.readUserDocFromCache(uid),
      {
        ...this.profileFetchOptions,
        onRetry: (n, err) => this.logger.warn(`Profil okunamadı, yeniden deneniyor (${n})`, err),
      },
    );

    if (res.status !== 'ok') {
      this.logger.error('Kullanıcı profili okunamadı', res.error);
      // Çevrimdışıysa daha önce sunucudan okunmuş profil (localStorage) kullanılabilir. 2.36: admin varsayma.
      const cached = res.status === 'unavailable' ? this.readCachedProfile(uid) : null;
      if (cached) return cached.isActive ? cached : this.forceSignOut('inactive');
      if (res.status === 'denied') return this.forceSignOut('profile-unavailable');
      // Geçici hata: oturumu KAPATMA; giriş sayfası "Tekrar dene" gösterir (bağlantı gelince otomatik denenir)
      this.authNotice.set('profile-retry');
      return null;
    }

    try {
      const snap = res.snap;
      if (snap.exists()) {
        const data = snap.data() ?? {};
        appUser = this.toAppUser(uid, data);
        if (!res.fromCache) this.backfillLegacyFields(uid, data);
        if (firebaseUser.email && firebaseUser.email !== appUser.email) {
          updateDoc(doc(this.firestore, 'users', uid), { email: firebaseUser.email })
            .catch(err => this.logger.warn('E-posta senkronize edilemedi', err));
          appUser.email = firebaseUser.email;
        }
        if (appUser.tenantId === uid && appUser.role === 'admin') {
          this.ensureTenantDoc(uid, appUser.displayName);
        }
      } else if (superAdmin) {
        // Superadmin bir işletmeye bağlı olmak zorunda değil: tenant OLUŞTURMA.
        appUser = {
          id: uid, tenantId: '', email: firebaseUser.email ?? '',
          displayName: firebaseUser.displayName || 'Destek', role: 'admin', isActive: true, createdAt: new Date(),
        };
      } else {
        // Eski hesap (users dokümanı yok) veya yarım kalmış kayıt / davet
        appUser = await this.createProfile(firebaseUser, firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Kullanıcı');
      }
    } catch (err) {
      this.logger.error('Kullanıcı profili oluşturulamadı', err);
      if (!isPermissionDenied(err)) {
        // Geçici (ağ) hatası: oturumu açık bırak, "Tekrar dene"
        this.authNotice.set('profile-retry');
        return null;
      }
      return this.forceSignOut('profile-unavailable');
    }

    if (!appUser.isActive) return this.forceSignOut('inactive');
    if (appUser.tenantId) {
      this.writeCachedProfile(appUser);
      this.startProfileWatch(uid);
    }
    return appUser;
  }

  /** Sunucudan users/{uid} (testlerde değiştirilebilir). */
  protected readUserDocFromServer(uid: string) {
    return getDocFromServer(doc(this.firestore, 'users', uid));
  }

  /** Yalnız yerel önbellekten users/{uid} (yoksa hata atar). */
  protected readUserDocFromCache(uid: string) {
    return getDocFromCache(doc(this.firestore, 'users', uid));
  }

  /**
   * Eski sürümün yazdığı eksik alanları tamamlar (best-effort, sessiz):
   *  - `tenantId` yoksa (eski sahip) → tenantId = uid, role yoksa 'admin'
   *  - `isActive` yoksa → true
   * Eski (canlı) kurallar kendi dokümanına yazmaya izin verir; yeni kurallar reddeder (zararsız).
   * Böylece yeni kurallar deploy edildiğinde bu kullanıcılar veriye erişebilir.
   */
  private backfillLegacyFields(uid: string, data: Record<string, unknown>): void {
    const patch: Record<string, unknown> = {};
    if (typeof data['tenantId'] !== 'string' || !data['tenantId']) {
      patch['tenantId'] = uid;
      if (!isUserRole(data['role'])) patch['role'] = 'admin';
    }
    if (data['isActive'] === undefined) patch['isActive'] = true;
    if (!Object.keys(patch).length) return;
    const warn = (err: unknown) => this.logger.warn('Eski profil alanları tamamlanamadı (yeni kurallarda beklenen)', err);
    try {
      updateDoc(doc(this.firestore, 'users', uid), patch)
        .then(() => this.logger.warn('Eski profil alanları tamamlandı', Object.keys(patch)))
        .catch(warn);
    } catch (err) { warn(err); }
  }

  /**
   * users/{uid} yoksa oluşturur:
   *  - invites/{email} varsa ve e-posta doğrulanmışsa davetin işletmesine katılır,
   *  - davet var ama doğrulanmamışsa bekleyen davet olarak işaretler (tenantId boş),
   *  - aksi halde kişi kendi işletmesinin sahibi olur (tenantId = uid, role admin).
   */
  private async createProfile(firebaseUser: FirebaseUser, displayName: string): Promise<AppUser> {
    const uid = firebaseUser.uid;
    const email = firebaseUser.email ?? '';
    const emailKey = email.toLocaleLowerCase('en');
    // Çiftçi modülü: profil/bağlantı davet akışında yazılır (features/farmer); işletme (tenant) OLUŞTURULMAZ.
    if (isFarmerEmail(email)) return { id: uid, tenantId: '', email, displayName, role: 'staff', isActive: true, createdAt: new Date(), accountType: 'farmer' };

    let invite: Invite | null = null;
    if (emailKey) {
      try {
        const inv = await getDoc(doc(this.firestore, 'invites', emailKey));
        if (inv.exists()) invite = inv.data() as Invite;
      } catch (err) {
        this.logger.warn('Davet kontrol edilemedi', err);
      }
    }

    const base = { email, displayName, isActive: true, createdAt: serverTimestamp() };

    if (invite && isUserRole(invite.role) && invite.tenantId) {
      if (!firebaseUser.emailVerified) {
        this.pendingInvite.set(true);
        return { id: uid, tenantId: '', email, displayName, role: invite.role, isActive: true, createdAt: new Date() };
      }
      await firebaseUser.getIdToken(true); // email_verified claim'i kurallara ulaşsın
      const batch = writeBatch(this.firestore);
      batch.set(doc(this.firestore, 'users', uid), { ...base, tenantId: invite.tenantId, role: invite.role });
      batch.delete(doc(this.firestore, 'invites', emailKey));
      await batch.commit();
      this.pendingInvite.set(false);
      return { id: uid, tenantId: invite.tenantId, email, displayName, role: invite.role, isActive: true, createdAt: new Date() };
    }

    const batch = writeBatch(this.firestore);
    batch.set(doc(this.firestore, 'users', uid), { ...base, tenantId: uid, role: 'admin' });
    batch.set(doc(this.firestore, 'tenants', uid), {
      name: displayName, ownerId: uid, createdAt: serverTimestamp(), ...newTrialLicenseFields(),
    });
    try {
      await batch.commit();
    } catch (err) {
      if (!isPermissionDenied(err)) throw err;
      // Eski (canlı) kurallarda `tenants` koleksiyonu yok → batch reddedilir. Yalnız users dokümanını yaz;
      // tenants dokümanı yeni kurallar deploy edilince ilk girişte ensureTenantDoc ile oluşur.
      this.logger.warn('tenants yazılamadı (eski kurallar?); yalnız users dokümanı oluşturuluyor', err);
      await setDoc(doc(this.firestore, 'users', uid), { ...base, tenantId: uid, role: 'admin' });
    }
    this.pendingInvite.set(false);
    return { id: uid, tenantId: uid, email, displayName, role: 'admin', isActive: true, createdAt: new Date() };
  }

  /** Eski hesaplarda tenants/{uid} dokümanı yoksa oluşturur (sessiz, hata yutulur). */
  private ensureTenantDoc(uid: string, name: string): void {
    const key = PROFILE_CACHE_KEY + 'tenant.' + uid;
    try { if (localStorage.getItem(key)) return; } catch { /* yok say */ }
    const ref = doc(this.firestore, 'tenants', uid);
    getDoc(ref)
      .then(async snap => {
        if (!snap.exists()) await setDoc(ref, { name, ownerId: uid, createdAt: serverTimestamp(), ...newTrialLicenseFields() });
        try { localStorage.setItem(key, '1'); } catch { /* yok say */ }
      })
      .catch(err => this.logger.warn('tenants dokümanı kontrol edilemedi', err));
  }

  /** Kendi users dokümanını dinler: rol değişikliği anında yansır, pasife alınırsa oturum kapanır. */
  private startProfileWatch(uid: string): void {
    this.stopProfileWatch();
    this.unsubProfile = onSnapshot(
      doc(this.firestore, 'users', uid),
      snap => {
        if (!snap.exists() || snap.metadata.fromCache) return;
        const fresh = this.toAppUser(uid, snap.data());
        if (!fresh.isActive) { void this.forceSignOut('inactive', true); return; }
        this.writeCachedProfile(fresh);
        const cur = this.profile();
        if (cur && (cur.role !== fresh.role || cur.displayName !== fresh.displayName || cur.tenantId !== fresh.tenantId)) {
          this.profile.set({ ...cur, role: fresh.role, displayName: fresh.displayName, tenantId: fresh.tenantId });
        }
      },
      err => this.logger.warn('Profil dinleyicisi hatası', err),
    );
  }

  private stopProfileWatch(): void {
    this.unsubProfile?.();
    this.unsubProfile = null;
  }

  private async forceSignOut(notice: Exclude<AuthNotice, null>, navigate = false): Promise<null> {
    this.stopProfileWatch();
    const uid = this.auth.currentUser?.uid;
    if (uid) this.clearCachedProfile(uid);
    this.authNotice.set(notice);
    this.profile.set(null);
    await signOut(this.auth).catch(() => undefined);
    if (navigate) await this.router.navigate(['/auth/login']);
    return null;
  }

  private toAppUser(uid: string, data: Record<string, unknown>): AppUser {
    const created = data['createdAt'];
    const lastLogin = data['lastLogin'];
    // Eski kayıt kodu sahibe tenantId = uid yazıyordu; alan hiç yoksa eski sahip kabul et
    const legacyOwner = typeof data['tenantId'] !== 'string' || !data['tenantId'];
    return {
      id: uid,
      tenantId: legacyOwner ? uid : (data['tenantId'] as string),
      email: (data['email'] as string) ?? '',
      displayName: (data['displayName'] as string) ?? '',
      // 2.36: rol yoksa/geçersizse en düşük yetki — eski sahip (tenantId yok) hariç: eski sürüm onu admin sayıyordu
      role: isUserRole(data['role']) ? data['role'] : legacyOwner ? 'admin' : 'staff',
      // Alan YOKSA aktif (eski kayıtlar); yalnız açıkça false ise pasif
      isActive: data['isActive'] !== false,
      createdAt: created instanceof Timestamp ? created.toDate() : created instanceof Date ? created : new Date(),
      lastLogin: lastLogin instanceof Timestamp ? lastLogin.toDate() : undefined,
      accountType: data['accountType'] === 'farmer' ? 'farmer' : 'dealer',
    };
  }

  private readCachedProfile(uid: string): AppUser | null {
    try {
      const raw = localStorage.getItem(PROFILE_CACHE_KEY + uid);
      if (!raw) return null;
      const p = JSON.parse(raw) as AppUser;
      if (p.id !== uid || !p.tenantId || !isUserRole(p.role)) return null;
      return { ...p, createdAt: new Date(p.createdAt) };
    } catch {
      return null;
    }
  }

  private writeCachedProfile(u: AppUser): void {
    try { localStorage.setItem(PROFILE_CACHE_KEY + u.id, JSON.stringify(u)); } catch { /* yok say */ }
  }

  private clearCachedProfile(uid: string): void {
    try { localStorage.removeItem(PROFILE_CACHE_KEY + uid); } catch { /* yok say */ }
  }
}
