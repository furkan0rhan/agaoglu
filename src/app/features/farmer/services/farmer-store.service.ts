import { computed, inject, Injectable, signal } from '@angular/core';
import { ApplicationLog, FarmerPurchase, FarmField, Recommendation, Season } from '../../../shared/models/farmer.model';
import {
  APPLICATION_LOG_REPOSITORY, FARMER_PURCHASE_REPOSITORY, FIELD_REPOSITORY, NewApplicationLog, NewField, NewSeason,
  RECOMMENDATION_REPOSITORY, SEASON_REPOSITORY,
} from '../data/repositories';
import { FarmerSession } from '../auth/farmer-session.service';
import { activePhiWarnings, PhiWarning } from '../utils/phi.util';

/**
 * Çiftçi verisinin oturum içi önbelleği. Her koleksiyon oturumda bir kez okunur (getDocs, Spark kotası §7.3);
 * yazmalar yerelde hemen yansıtılır, sunucuya gönderim FarmerSyncTracker ile izlenir. "Yenile" ile tekrar okunur.
 */
@Injectable({ providedIn: 'root' })
export class FarmerStore {
  private readonly session = inject(FarmerSession);
  private readonly fieldRepo = inject(FIELD_REPOSITORY);
  private readonly seasonRepo = inject(SEASON_REPOSITORY);
  private readonly logRepo = inject(APPLICATION_LOG_REPOSITORY);
  private readonly purchaseRepo = inject(FARMER_PURCHASE_REPOSITORY);
  private readonly recRepo = inject(RECOMMENDATION_REPOSITORY);

  readonly fields = signal<FarmField[]>([]);
  readonly seasons = signal<Season[]>([]);
  readonly logs = signal<ApplicationLog[]>([]);
  readonly purchases = signal<FarmerPurchase[]>([]);
  readonly recommendations = signal<Recommendation[]>([]);
  readonly loaded = signal(false);
  readonly loadError = signal(false);

  private loadedFor: string | null = null;
  private loading: Promise<void> | null = null;

  readonly activeRecommendations = computed(() => this.recommendations().filter(r => r.status === 'active'));

  readonly phiWarnings = computed<PhiWarning[]>(() => {
    const expected: Record<string, Date | null> = {};
    for (const s of this.seasons()) expected[s.id] = s.status === 'harvested' ? null : s.expectedHarvestDate;
    return activePhiWarnings(this.logs().filter(l => l.type === 'pesticide'), expected);
  });

  /** Ambardaki (iptal edilmemiş) kalem sayısı */
  readonly barnItemCount = computed(() =>
    this.purchases().filter(p => p.status === 'completed').reduce((n, p) => n + p.items.length, 0));

  async load(force = false): Promise<void> {
    const fid = this.session.farmerId();
    if (!fid) return;
    if (!force && this.loadedFor === fid) return;
    if (this.loading && !force) return this.loading;
    this.loading = (async () => {
      this.loadError.set(false);
      try {
        const [fields, seasons, logs, purchases, recs] = await Promise.all([
          this.fieldRepo.listByFarmer(fid), this.seasonRepo.listByFarmer(fid), this.logRepo.listByFarmer(fid),
          this.purchaseRepo.listByFarmer(fid), this.recRepo.listByFarmer(fid).catch(() => [] as Recommendation[]),
        ]);
        this.fields.set(fields);
        this.seasons.set(seasons);
        this.logs.set(logs);
        this.purchases.set(purchases);
        this.recommendations.set(recs);
        this.loadedFor = fid;
        this.loaded.set(true);
      } catch {
        this.loadError.set(true);
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  }

  clear(): void {
    this.loadedFor = null;
    this.loaded.set(false);
    for (const s of [this.fields, this.seasons, this.logs, this.purchases, this.recommendations] as const) s.set([] as never);
  }

  field(id: string | null | undefined): FarmField | undefined {
    return this.fields().find(f => f.id === id);
  }

  seasonsOf(fieldId: string): Season[] {
    return this.seasons().filter(s => s.fieldId === fieldId);
  }

  /** Tarlanın güncel (hasat edilmemiş, en son ekilen) sezonu */
  currentSeason(fieldId: string): Season | undefined {
    return this.seasonsOf(fieldId).find(s => s.status !== 'harvested');
  }

  // ---- yazmalar (yerel önbelleğe anında yansır) ----

  addField(data: Omit<NewField, 'farmerId' | 'sharedTenantIds'>): string {
    const farmerId = this.session.farmerId() as string;
    const sharedTenantIds = this.session.shareTargets().fields;
    const id = this.fieldRepo.create({ ...data, farmerId, sharedTenantIds });
    this.fields.update(fs => [...fs, { ...data, id, farmerId, sharedTenantIds, isActive: true, createdAt: new Date(), updatedAt: new Date() }]
      .sort((a, b) => a.name.localeCompare(b.name, 'tr')));
    return id;
  }

  updateField(id: string, patch: Partial<NewField>): void {
    this.fieldRepo.update(id, patch);
    this.fields.update(fs => fs.map(f => (f.id === id ? { ...f, ...patch, updatedAt: new Date() } : f)));
  }

  archiveField(id: string): void {
    this.fieldRepo.archive(id);
    this.fields.update(fs => fs.filter(f => f.id !== id));
  }

  addSeason(data: Omit<NewSeason, 'farmerId' | 'sharedTenantIds'>): string {
    const farmerId = this.session.farmerId() as string;
    const sharedTenantIds = this.session.shareTargets().fields;
    const id = this.seasonRepo.create({ ...data, farmerId, sharedTenantIds });
    this.seasons.update(ss => [{ ...data, id, farmerId, sharedTenantIds, createdAt: new Date(), updatedAt: new Date() }, ...ss]);
    return id;
  }

  updateSeason(id: string, patch: Partial<NewSeason>): void {
    this.seasonRepo.update(id, patch);
    this.seasons.update(ss => ss.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }

  addLog(data: Omit<NewApplicationLog, 'farmerId' | 'sharedTenantIds'>, remaining?: { purchaseId: string; index: number; remaining: number }): string {
    const farmerId = this.session.farmerId() as string;
    const sharedTenantIds = this.session.shareTargets().logs;
    const id = this.logRepo.create({ ...data, farmerId, sharedTenantIds }, remaining);
    this.logs.update(ls => [{ ...data, id, farmerId, sharedTenantIds, createdAt: new Date(), updatedAt: new Date() }, ...ls]
      .sort((a, b) => b.date.getTime() - a.date.getTime()));
    if (remaining) {
      this.purchases.update(ps => ps.map(p => (p.id === remaining.purchaseId
        ? { ...p, remaining: { ...p.remaining, [String(remaining.index)]: remaining.remaining } } : p)));
    }
    return id;
  }

  deleteLog(id: string): void {
    this.logRepo.delete(id);
    this.logs.update(ls => ls.filter(l => l.id !== id));
  }
}
