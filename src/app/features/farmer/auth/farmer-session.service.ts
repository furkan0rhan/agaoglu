import { computed, inject, Injectable, signal } from '@angular/core';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { FarmerLink, FarmerProfile } from '../../../shared/models/farmer.model';
import { FARMER_ACCOUNT_REPOSITORY, FARMER_LINK_REPOSITORY, UserAccount } from '../data/repositories';
import { computeShareTargets, ShareTargets } from '../utils/consent.util';

export type FarmerSessionState = 'unknown' | 'signed-out' | 'dealer' | 'not-owner' | 'ready' | 'error';

/**
 * Çiftçi oturumu: Firebase kullanıcısı → users/{uid} (accountType, farmerId) → farmers/{farmerId} (sahiplik) → bağlantılar.
 * Veri uid'e değil farmerId'ye bağlıdır; PIN sıfırlama sonrası eski uid `ownerUids`'ten çıkar ve 'not-owner' olur.
 */
@Injectable({ providedIn: 'root' })
export class FarmerSession {
  private readonly auth = inject(Auth);
  private readonly accounts = inject(FARMER_ACCOUNT_REPOSITORY);
  private readonly linkRepo = inject(FARMER_LINK_REPOSITORY);

  readonly state = signal<FarmerSessionState>('unknown');
  readonly uid = signal<string | null>(null);
  readonly account = signal<UserAccount | null>(null);
  readonly farmer = signal<FarmerProfile | null>(null);
  readonly links = signal<FarmerLink[]>([]);

  readonly farmerId = computed(() => this.farmer()?.id ?? null);
  readonly activeLinks = computed(() => this.links().filter(l => l.status === 'active'));
  readonly shareTargets = computed<ShareTargets>(() => computeShareTargets(this.links()));

  private loading: { uid: string | null; promise: Promise<FarmerSessionState> } | null = null;

  /** İlk Firebase auth durumunu bekler. */
  private firstUser(): Promise<User | null> {
    if (this.auth.currentUser) return Promise.resolve(this.auth.currentUser);
    return new Promise(resolve => {
      const unsub = onAuthStateChanged(this.auth, u => { unsub(); resolve(u); });
    });
  }

  /** Oturumu yükler (aynı uid için tekrar okumaz). */
  async ensureLoaded(force = false): Promise<FarmerSessionState> {
    const user = await this.firstUser();
    const uid = user?.uid ?? null;
    if (!force && this.loading?.uid === uid) return this.loading.promise;
    const promise = this.load(user);
    this.loading = { uid, promise };
    promise.then(s => { if (s === 'error' && this.loading?.promise === promise) this.loading = null; });
    return promise;
  }

  private async load(user: User | null): Promise<FarmerSessionState> {
    this.reset();
    if (!user) return this.setState('signed-out');
    this.uid.set(user.uid);
    try {
      const acc = await this.accounts.getUserAccount(user.uid);
      this.account.set(acc);
      if (!acc || acc.accountType !== 'farmer') return this.setState(acc ? 'dealer' : 'signed-out');
      if (!acc.farmerId || !acc.isActive) return this.setState('not-owner');
      const farmer = await this.accounts.getFarmer(acc.farmerId).catch(() => null);
      if (!farmer || !farmer.ownerUids.includes(user.uid)) return this.setState('not-owner');
      this.farmer.set(farmer);
      this.links.set(await this.linkRepo.listByFarmer(farmer.id));
      return this.setState('ready');
    } catch {
      return this.setState('error');
    }
  }

  async refreshLinks(): Promise<void> {
    const fid = this.farmerId();
    if (fid) this.links.set(await this.linkRepo.listByFarmer(fid));
  }

  async refreshFarmer(): Promise<void> {
    const fid = this.farmerId();
    if (fid) this.farmer.set(await this.accounts.getFarmer(fid));
  }

  /** Çıkışta / hesap değişiminde. */
  clear(): void {
    this.reset();
    this.loading = null;
    this.state.set('signed-out');
  }

  private reset(): void {
    this.uid.set(null);
    this.account.set(null);
    this.farmer.set(null);
    this.links.set([]);
  }

  private setState(s: FarmerSessionState): FarmerSessionState {
    this.state.set(s);
    return s;
  }
}
