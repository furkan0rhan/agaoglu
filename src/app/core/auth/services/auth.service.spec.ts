import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AuditLogService } from './audit-log.service';
import { ProfileSnap } from './profile-loader';

/**
 * Canlı giriş sorunu (30.10.2026): ilk açılışta getDoc "client is offline" atınca kullanıcı oturumdan atılıyordu.
 * Firestore sahte ({}); users okuması `readUserDocFromServer` üzerinden taklit edilir.
 */
interface Internals {
  loadProfile(u: unknown): Promise<unknown>;
  readUserDocFromServer(uid: string): Promise<ProfileSnap>;
  readUserDocFromCache(uid: string): Promise<ProfileSnap>;
  startProfileWatch(uid: string): void;
  forceSignOut(n: string): Promise<null>;
  profileFetchOptions: unknown;
}

const offline = () => Object.assign(new Error('Failed to get document because the client is offline.'), { code: 'unavailable' });
const snap = (data: Record<string, unknown> | null): ProfileSnap => ({ exists: () => data !== null, data: () => data ?? undefined });
const fbUser = { uid: 'u1', email: 'kasa@test.local', emailVerified: true, displayName: 'Kasa' };

describe('AuthService — profil yükleme dayanıklılığı', () => {
  let svc: AuthService;
  let internals: Internals;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: { currentUser: null, onAuthStateChanged: () => () => undefined } },
        { provide: Firestore, useValue: {} },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
        { provide: AuditLogService, useValue: { log: () => Promise.resolve() } },
      ],
    });
    svc = TestBed.inject(AuthService);
    internals = svc as unknown as Internals;
    internals.profileFetchOptions = { delays: [1, 1, 1, 1, 1], sleep: () => Promise.resolve() };
    vi.spyOn(internals, 'startProfileWatch').mockImplementation(() => undefined);
    vi.spyOn(internals, 'readUserDocFromCache').mockRejectedValue(offline());
  });

  it('getDoc ilk 2 çağrıda unavailable, 3.de başarılı → profil yüklenir, çıkış yok', async () => {
    let calls = 0;
    const read = vi.spyOn(internals, 'readUserDocFromServer').mockImplementation(() =>
      ++calls <= 2
        ? Promise.reject(offline())
        : Promise.resolve(snap({ tenantId: 'owner', role: 'cashier', isActive: true, email: fbUser.email, displayName: 'Kasa' })));
    const signOut = vi.spyOn(internals, 'forceSignOut');

    const user = await internals.loadProfile(fbUser);

    expect(read).toHaveBeenCalledTimes(3);
    expect(signOut).not.toHaveBeenCalled();
    expect(user).toMatchObject({ id: 'u1', tenantId: 'owner', role: 'cashier', isActive: true });
    expect(svc.authNotice()).toBeNull();
  });

  it('hep çevrimdışı ve önbellek yok → oturum KAPATILMAZ, "tekrar dene" uyarısı', async () => {
    vi.spyOn(internals, 'readUserDocFromServer').mockRejectedValue(offline());
    const signOut = vi.spyOn(internals, 'forceSignOut');

    expect(await internals.loadProfile(fbUser)).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
    expect(svc.authNotice()).toBe('profile-retry');
  });

  it('isActive alanı yoksa aktif sayılır; tenantId yoksa eski sahip (tenantId = uid, admin)', async () => {
    vi.spyOn(internals, 'readUserDocFromServer').mockResolvedValue(snap({ email: fbUser.email, displayName: 'Eski' }));
    const signOut = vi.spyOn(internals, 'forceSignOut').mockResolvedValue(null);
    // backfill / ensureTenantDoc sahte Firestore'da hata verir; profil yine yüklenmeli
    localStorage.setItem('tm.profile.tenant.u1', '1');

    const user = await internals.loadProfile(fbUser).catch(e => e);

    expect(signOut).not.toHaveBeenCalled();
    expect(user).toMatchObject({ tenantId: 'u1', role: 'admin', isActive: true });
  });

  it('çiftçi hesabı eski sahip sayılmaz: tenant / eski profil tamamlama çalışmaz (çiftçi rapor #27)', async () => {
    vi.spyOn(internals, 'readUserDocFromServer').mockResolvedValue(snap({
      accountType: 'farmer', tenantId: null, role: null, isActive: true, farmerId: 'f1',
      email: '905551234567@ciftci.tarimmarket.app', displayName: 'Hüseyin',
    }));
    const priv = svc as unknown as { backfillLegacyFields(): void; ensureTenantDoc(): void };
    const backfill = vi.spyOn(priv, 'backfillLegacyFields');
    const tenant = vi.spyOn(priv, 'ensureTenantDoc');

    const user = await internals.loadProfile({ ...fbUser, email: '905551234567@ciftci.tarimmarket.app' });

    expect(user).toMatchObject({ tenantId: '', role: 'staff', accountType: 'farmer', isActive: true });
    expect(backfill).not.toHaveBeenCalled();
    expect(tenant).not.toHaveBeenCalled();
    expect(internals.startProfileWatch).not.toHaveBeenCalled();
  });

  it('isActive: false → pasif, oturum kapatılır', async () => {
    vi.spyOn(internals, 'readUserDocFromServer').mockResolvedValue(
      snap({ tenantId: 'owner', role: 'staff', isActive: false, email: fbUser.email }));
    const signOut = vi.spyOn(internals, 'forceSignOut').mockResolvedValue(null);

    expect(await internals.loadProfile(fbUser)).toBeNull();
    expect(signOut).toHaveBeenCalledWith('inactive');
  });
});
