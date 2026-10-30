import { inject, Injectable } from '@angular/core';
import {
  Firestore, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
  DocumentData, Timestamp,
} from '@angular/fire/firestore';
import {
  ApplicationLog, FarmerConsent, FarmerInvite, FarmerLink, FarmerProfile, FarmerPurchase, FarmField, farmerLinkId,
  Recommendation, Season,
} from '../../../shared/models/farmer.model';
import { ShareTargets, sameTenantSet } from '../utils/consent.util';
import type {
  AcceptInviteInput, ApplicationLogRepository, FarmerAccountRepository, FarmerLinkRepository, FarmerPurchaseRepository,
  FieldRepository, NewApplicationLog, NewField, NewSeason, RecommendationRepository, SeasonRepository, UserAccount,
} from './repositories';
import {
  consentToData, fromDate, toFarmer, toField, toInvite, toLink, toLog, toPurchase, toRecommendation, toSeason,
} from './converters';
import { FarmerSyncTracker } from './sync-tracker';

/** Çiftçi tarafı Firestore implementasyonları. Okumalar tek seferlik (getDocs) — Spark kotası (§7.3). */

const C = {
  users: 'users', farmers: 'farmers', invites: 'farmerInvites', links: 'farmerLinks', fields: 'fields',
  seasons: 'seasons', logs: 'applicationLogs', purchases: 'farmerPurchases', recs: 'recommendations',
} as const;

/** undefined alanları atar (Firestore undefined kabul etmez). */
function clean(o: Record<string, unknown>): DocumentData {
  const out: DocumentData = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out;
}

@Injectable({ providedIn: 'root' })
export class FirestoreFarmerAccountRepository implements FarmerAccountRepository {
  private readonly fs = inject(Firestore);

  async getUserAccount(uid: string): Promise<UserAccount | null> {
    const snap = await getDoc(doc(this.fs, C.users, uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      accountType: d['accountType'] === 'farmer' ? 'farmer' : 'dealer',
      farmerId: typeof d['farmerId'] === 'string' ? d['farmerId'] : null,
      isActive: d['isActive'] === true,
    };
  }

  async getFarmer(farmerId: string): Promise<FarmerProfile | null> {
    const snap = await getDoc(doc(this.fs, C.farmers, farmerId));
    return snap.exists() ? toFarmer(snap.id, snap.data()) : null;
  }

  async updateFarmer(farmerId: string, patch: Partial<Pick<FarmerProfile, 'displayName' | 'city' | 'district' | 'village' | 'cksNo'>>): Promise<void> {
    await updateDoc(doc(this.fs, C.farmers, farmerId), { ...clean(patch), updatedAt: serverTimestamp() });
  }

  async requestDeletion(farmerId: string): Promise<void> {
    await updateDoc(doc(this.fs, C.farmers, farmerId), { deletionRequestedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }

  async getInvite(code: string): Promise<FarmerInvite | null> {
    const snap = await getDoc(doc(this.fs, C.invites, code));
    return snap.exists() ? toInvite(snap.id, snap.data()) : null;
  }

  async acceptInvite(i: AcceptInviteInput): Promise<string> {
    const inv = i.invite;
    const batch = writeBatch(this.fs);
    let farmerId: string;

    if (inv.farmerId) {
      // PIN sıfırlama / yeni cihaz: bayi bu çiftçi profili için davet üretti → yeni uid tek sahip olur
      farmerId = inv.farmerId;
      batch.update(doc(this.fs, C.farmers, farmerId), { ownerUids: [i.uid], inviteCode: inv.code, updatedAt: serverTimestamp() });
    } else if (i.existingFarmerId) {
      // Zaten çiftçi hesabı var → ikinci bayiye bağlanma
      farmerId = i.existingFarmerId;
    } else {
      farmerId = doc(collection(this.fs, C.farmers)).id;
      batch.set(doc(this.fs, C.farmers, farmerId), {
        ownerUids: [i.uid], inviteCode: inv.code, displayName: i.displayName, phone: i.phone,
        city: null, district: null, village: null, cksNo: null, deletionRequestedAt: null,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }

    if (!i.hasUserDoc) {
      batch.set(doc(this.fs, C.users, i.uid), {
        accountType: 'farmer', tenantId: null, role: null, canPrescribe: false, isActive: true,
        farmerId, email: i.email, displayName: i.displayName, createdAt: serverTimestamp(),
      });
    }

    batch.set(doc(this.fs, C.links, farmerLinkId(inv.tenantId, farmerId)), {
      tenantId: inv.tenantId, farmerId, customerId: inv.customerId, inviteCode: inv.code, status: 'active',
      consent: consentToData(i.consent), tenantName: inv.tenantName, farmerName: i.displayName,
      balance: null, balanceUpdatedAt: null, createdAt: serverTimestamp(),
    });

    batch.update(doc(this.fs, C.invites, inv.code), {
      used: true, usedBy: i.uid, usedFarmerId: farmerId, usedAt: serverTimestamp(),
    });

    await batch.commit();
    return farmerId;
  }
}

@Injectable({ providedIn: 'root' })
export class FirestoreFieldRepository implements FieldRepository {
  private readonly fs = inject(Firestore);
  private readonly sync = inject(FarmerSyncTracker);

  async listByFarmer(farmerId: string): Promise<FarmField[]> {
    const snap = await getDocs(query(collection(this.fs, C.fields), where('farmerId', '==', farmerId), where('isActive', '==', true)));
    return snap.docs.map(d => toField(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }

  async get(id: string): Promise<FarmField | null> {
    const snap = await getDoc(doc(this.fs, C.fields, id));
    return snap.exists() ? toField(snap.id, snap.data()) : null;
  }

  create(data: NewField): string {
    const ref = doc(collection(this.fs, C.fields));
    this.sync.track(setDoc(ref, { ...fieldData(data), isActive: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    return ref.id;
  }

  update(id: string, patch: Partial<NewField>): void {
    this.sync.track(updateDoc(doc(this.fs, C.fields, id), { ...fieldData(patch), updatedAt: serverTimestamp() }));
  }

  archive(id: string): void {
    this.sync.track(updateDoc(doc(this.fs, C.fields, id), { isActive: false, updatedAt: serverTimestamp() }));
  }
}

function fieldData(d: Partial<NewField>): DocumentData {
  return clean({
    farmerId: d.farmerId, name: d.name?.trim(), areaDecare: d.areaDecare, city: d.city, district: d.district, village: d.village,
    ada: d.ada, parsel: d.parsel, location: d.location, irrigation: d.irrigation, sharedTenantIds: d.sharedTenantIds,
  });
}

@Injectable({ providedIn: 'root' })
export class FirestoreSeasonRepository implements SeasonRepository {
  private readonly fs = inject(Firestore);
  private readonly sync = inject(FarmerSyncTracker);

  async listByFarmer(farmerId: string): Promise<Season[]> {
    const snap = await getDocs(query(collection(this.fs, C.seasons), where('farmerId', '==', farmerId)));
    return snap.docs.map(d => toSeason(d.id, d.data()))
      .sort((a, b) => (b.sowingDate?.getTime() ?? 0) - (a.sowingDate?.getTime() ?? 0));
  }

  create(data: NewSeason): string {
    const ref = doc(collection(this.fs, C.seasons));
    this.sync.track(setDoc(ref, { ...seasonData(data), createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    return ref.id;
  }

  update(id: string, patch: Partial<NewSeason>): void {
    this.sync.track(updateDoc(doc(this.fs, C.seasons, id), { ...seasonData(patch), updatedAt: serverTimestamp() }));
  }
}

function seasonData(d: Partial<NewSeason>): DocumentData {
  return clean({
    farmerId: d.farmerId, fieldId: d.fieldId, crop: d.crop, variety: d.variety, status: d.status,
    sowingDate: d.sowingDate === undefined ? undefined : fromDate(d.sowingDate),
    expectedHarvestDate: d.expectedHarvestDate === undefined ? undefined : fromDate(d.expectedHarvestDate),
    harvestDate: d.harvestDate === undefined ? undefined : fromDate(d.harvestDate),
    sharedTenantIds: d.sharedTenantIds,
  });
}

@Injectable({ providedIn: 'root' })
export class FirestoreApplicationLogRepository implements ApplicationLogRepository {
  private readonly fs = inject(Firestore);
  private readonly sync = inject(FarmerSyncTracker);

  async listByFarmer(farmerId: string, max = 200): Promise<ApplicationLog[]> {
    const snap = await getDocs(query(collection(this.fs, C.logs), where('farmerId', '==', farmerId), orderBy('date', 'desc'), limit(max)));
    return snap.docs.map(d => toLog(d.id, d.data()));
  }

  create(d: NewApplicationLog, rem?: { purchaseId: string; index: number; remaining: number }): string {
    const ref = doc(collection(this.fs, C.logs));
    const batch = writeBatch(this.fs);
    batch.set(ref, clean({
      farmerId: d.farmerId, fieldId: d.fieldId, seasonId: d.seasonId, type: d.type, date: Timestamp.fromDate(d.date),
      purchaseId: d.purchaseId, purchaseItemIndex: d.purchaseItemIndex, productName: d.productName, quantity: d.quantity, unit: d.unit,
      areaDecare: d.areaDecare, dosePerDecare: d.dosePerDecare, appliedBy: d.appliedBy, notes: d.notes, phiDays: d.phiDays,
      phiSource: d.phiSource, earliestHarvestDate: fromDate(d.earliestHarvestDate), recommendationId: d.recommendationId,
      sharedTenantIds: d.sharedTenantIds, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
    if (rem) batch.update(doc(this.fs, C.purchases, rem.purchaseId), { [`remaining.${rem.index}`]: rem.remaining });
    this.sync.track(batch.commit());
    return ref.id;
  }

  delete(id: string): void {
    this.sync.track(deleteDoc(doc(this.fs, C.logs, id)));
  }
}

@Injectable({ providedIn: 'root' })
export class FirestoreFarmerLinkRepository implements FarmerLinkRepository {
  private readonly fs = inject(Firestore);

  async listByFarmer(farmerId: string): Promise<FarmerLink[]> {
    const snap = await getDocs(query(collection(this.fs, C.links), where('farmerId', '==', farmerId)));
    return snap.docs.map(d => toLink(d.id, d.data()));
  }

  async updateConsent(linkId: string, consent: FarmerConsent): Promise<void> {
    await updateDoc(doc(this.fs, C.links, linkId), { consent: consentToData(consent), updatedAt: serverTimestamp() });
  }

  async revoke(linkId: string): Promise<void> {
    await updateDoc(doc(this.fs, C.links, linkId), { status: 'revoked', updatedAt: serverTimestamp() });
  }

  async applySharing(farmerId: string, t: ShareTargets): Promise<number> {
    const targets: [string, string[]][] = [[C.fields, t.fields], [C.seasons, t.fields], [C.logs, t.logs]];
    const updates: { path: string; id: string; ids: string[] }[] = [];
    for (const [col, ids] of targets) {
      const snap = await getDocs(query(collection(this.fs, col), where('farmerId', '==', farmerId)));
      for (const d of snap.docs) {
        const cur = Array.isArray(d.data()['sharedTenantIds']) ? (d.data()['sharedTenantIds'] as string[]) : [];
        if (!sameTenantSet(cur, ids)) updates.push({ path: col, id: d.id, ids });
      }
    }
    for (let i = 0; i < updates.length; i += 400) {
      const batch = writeBatch(this.fs);
      for (const u of updates.slice(i, i + 400)) batch.update(doc(this.fs, u.path, u.id), { sharedTenantIds: u.ids, updatedAt: serverTimestamp() });
      await batch.commit();
    }
    return updates.length;
  }
}

@Injectable({ providedIn: 'root' })
export class FirestoreFarmerPurchaseRepository implements FarmerPurchaseRepository {
  private readonly fs = inject(Firestore);

  async listByFarmer(farmerId: string, max = 100): Promise<FarmerPurchase[]> {
    const snap = await getDocs(query(collection(this.fs, C.purchases), where('farmerId', '==', farmerId), orderBy('purchasedAt', 'desc'), limit(max)));
    return snap.docs.map(d => toPurchase(d.id, d.data()));
  }

  async listByFarmerAndTenant(farmerId: string, tenantId: string, max = 20): Promise<FarmerPurchase[]> {
    const snap = await getDocs(query(
      collection(this.fs, C.purchases), where('farmerId', '==', farmerId), where('tenantId', '==', tenantId),
      orderBy('purchasedAt', 'desc'), limit(max),
    ));
    return snap.docs.map(d => toPurchase(d.id, d.data()));
  }
}

@Injectable({ providedIn: 'root' })
export class FirestoreRecommendationRepository implements RecommendationRepository {
  private readonly fs = inject(Firestore);

  async listByFarmer(farmerId: string): Promise<Recommendation[]> {
    const snap = await getDocs(query(collection(this.fs, C.recs), where('farmerId', '==', farmerId), orderBy('createdAt', 'desc'), limit(50)));
    return snap.docs.map(d => toRecommendation(d.id, d.data()));
  }
}
