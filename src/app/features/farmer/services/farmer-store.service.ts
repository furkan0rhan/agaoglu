import { computed, inject, Injectable, signal } from '@angular/core';
import { ApplicationLog, FarmerPurchase, FarmerPurchaseItem, FarmField, Recommendation, Season } from '../../../shared/models/farmer.model';
import {
  APPLICATION_LOG_REPOSITORY, FARMER_PURCHASE_REPOSITORY, FIELD_REPOSITORY, NewApplicationLog, NewField, NewSeason,
  RECOMMENDATION_REPOSITORY, SEASON_REPOSITORY,
} from '../data/repositories';
import { FarmerSession } from '../auth/farmer-session.service';
import { activePhiWarnings, PhiWarning } from '../utils/phi.util';

/** Ambar satırı: tamamlanmış satıştaki bir kalem. Biten kalem de listede kalır (GTS / SKT / e-reçete kaydı için). */
export interface BarnRow {
  key: string;
  purchaseId: string;
  index: number;
  item: FarmerPurchaseItem;
  remaining: number;
  tenantName: string;
  date: Date;
  usedUp: boolean;
}

/** Tamamlanmış satışlardan ambar satırları (ana sayfa sayacı ve Ambarım aynı kuralı kullanır). */
export function barnRowsOf(purchases: readonly FarmerPurchase[]): BarnRow[] {
  const rows: BarnRow[] = [];
  for (const p of purchases) {
    if (p.status !== 'completed') continue;
    p.items.forEach((item, i) => {
      const remaining = p.remaining[String(i)] ?? item.quantity;
      rows.push({ key: `${p.id}:${i}`, purchaseId: p.id, index: i, item, remaining, tenantName: p.tenantName, date: p.purchasedAt, usedUp: !(remaining > 0) });
    });
  }
  return rows;
}

const SEEN_KEY = 'tm.farmer.seenRecs.';

function readSeen(fid: string): ReadonlySet<string> {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY + fid) ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Bu süreden eski veri, uygulama öne gelince (görünür / odak) kendiliğinden yenilenir. */
export const FARMER_STALE_MS = 30_000;

/**
 * Çiftçi verisinin oturum içi önbelleği. Koleksiyonlar getDocs ile okunur (Spark kotası §7.3, sürekli dinleyici yok);
 * yazmalar yerelde hemen yansıtılır, sunucuya gönderim FarmerSyncTracker ile izlenir. Bayinin yazdıkları (satış, borç,
 * öneri) "Yenile" düğmesiyle ve uygulama tekrar öne geldiğinde (`refreshIfStale`) gelir (rapor #4).
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
  /** Yenileme sürüyor (düğmede dönen ikon). */
  readonly refreshing = signal(false);
  /** Her başarılı yenilemede artar: kendi verisini ayrı okuyan sayfalar (borç detayı) buna göre yeniden okur. */
  readonly refreshTick = signal(0);
  private lastLoadedAt = 0;

  private loadedFor: string | null = null;
  private loading: Promise<void> | null = null;

  readonly activeRecommendations = computed(() => this.recommendations().filter(r => r.status === 'active'));

  /** Bu cihazda görülmüş öneriler (alt menüdeki "Bayim" rozeti yalnız yenileri sayar). */
  private readonly seenRecIds = signal<ReadonlySet<string>>(new Set());
  readonly unseenRecCount = computed(() => {
    const seen = this.seenRecIds();
    return this.activeRecommendations().filter(r => !seen.has(r.id)).length;
  });

  readonly phiWarnings = computed<PhiWarning[]>(() => {
    const expected: Record<string, Date | null> = {};
    for (const s of this.seasons()) expected[s.id] = s.status === 'harvested' ? null : s.expectedHarvestDate;
    return activePhiWarnings(this.logs().filter(l => l.type === 'pesticide'), expected);
  });

  readonly barnRows = computed(() => barnRowsOf(this.purchases()));
  /** Ambarda kalanı olan kalem sayısı (Ambarım'daki ana liste) */
  readonly barnItemCount = computed(() => this.barnRows().filter(r => !r.usedUp).length);
  /** Biten / kullanılan kalem sayısı (Ambarım'daki "Biten" bölümü) */
  readonly barnUsedUpCount = computed(() => this.barnRows().filter(r => r.usedUp).length);

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
        this.seenRecIds.set(readSeen(fid));
        this.loadedFor = fid;
        this.lastLoadedAt = Date.now();
        this.loaded.set(true);
      } catch {
        this.loadError.set(true);
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  }

  /** Öneriler ekranı açıldı: şu anki önerileri görüldü say. */
  markRecsSeen(): void {
    const fid = this.session.farmerId();
    if (!fid) return;
    const ids = new Set(this.recommendations().map(r => r.id));
    this.seenRecIds.set(ids);
    try { localStorage.setItem(SEEN_KEY + fid, JSON.stringify([...ids])); } catch { /* yok say */ }
  }

  /** Bağlantılar (bakiye, vade) + tüm çiftçi verisi yeniden okunur. Eşzamanlı çağrılar birleşir. */
  async refresh(): Promise<void> {
    if (this.refreshing() || !this.session.farmerId()) return;
    this.refreshing.set(true);
    try {
      await Promise.all([this.session.refreshLinks().catch(() => undefined), this.load(true)]);
      this.refreshTick.update(n => n + 1);
    } finally {
      this.refreshing.set(false);
    }
  }

  /** Veri `maxAgeMs`'den eskiyse yeniler (uygulama öne geldiğinde çağrılır). */
  refreshIfStale(maxAgeMs = FARMER_STALE_MS, now = Date.now()): boolean {
    if (!this.loaded() || now - this.lastLoadedAt < maxAgeMs) return false;
    void this.refresh();
    return true;
  }

  clear(): void {
    this.loadedFor = null;
    this.lastLoadedAt = 0;
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
